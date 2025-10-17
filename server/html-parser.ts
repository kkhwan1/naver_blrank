import axios from 'axios';
import * as cheerio from 'cheerio';
import type { BlogResult } from './naver-client';

export interface SmartBlockCategory {
  categoryName: string;
  blogs: BlogResult[];
  totalBlogs: number;
}

export interface SmartBlockDetectionResult {
  found: boolean;
  blogResults: BlogResult[];
  categories: SmartBlockCategory[];
  totalBlogs: number;
}

export class NaverHTMLParser {
  private cookies: Record<string, string>;
  private headers: Record<string, string>;

  constructor() {
    this.cookies = {
      'NNB': 'ECHGGL2ZR7AGO',
      'nx_ssl': '2',
      'NACT': '1',
    };

    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'ko,en-US;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': 'https://search.naver.com/',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    };
  }

  async searchNaver(keyword: string): Promise<SmartBlockDetectionResult> {
    try {
      const cookieString = Object.entries(this.cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');

      const response = await axios.get('https://search.naver.com/search.naver', {
        params: {
          where: 'nexearch',
          query: keyword,
        },
        headers: {
          ...this.headers,
          Cookie: cookieString,
        },
        timeout: 15000,
      });

      const html = response.data;
      return this.parseSmartBlock(html);
    } catch (error) {
      console.error('Error fetching Naver HTML:', error);
      return {
        found: false,
        blogResults: [],
        categories: [],
        totalBlogs: 0,
      };
    }
  }

  private parseSmartBlock(html: string): SmartBlockDetectionResult {
    const $ = cheerio.load(html);
    const blogResults: BlogResult[] = [];
    const seenUrls = new Set<string>();
    const categories: SmartBlockCategory[] = [];

    console.log('\n=== HTML 파싱 시작 ===');
    console.log(`HTML 길이: ${html.length} 바이트`);
    
    const NON_BLOG_CATEGORIES = [
      '숏텐츠',
      '네이버 클립',
      'NAVER 클립',
      '짧은 즐거움 네이버 클립',
      'NAVER NOW',
    ];
    
    const footerTitles = $('[class*="fds-comps-footer-more-subject"]').toArray();
    const headerTitles = $('[class*="fds-comps-header-headline"]').toArray();
    
    const candidateTitles = [...footerTitles, ...headerTitles];
    console.log(`제목 후보 요소 개수: ${candidateTitles.length} (footer: ${footerTitles.length}, header: ${headerTitles.length})`);
    
    const smartBlockTitles = candidateTitles.filter(titleElement => {
      const $title = $(titleElement);
      const text = $title.text().trim();
      
      if (!text || text.length > 100) return false;
      
      if (NON_BLOG_CATEGORIES.some(excluded => text.includes(excluded))) {
        console.log(`  ✗ 블로그 무관 카테고리 제외: "${text}"`);
        return false;
      }
      
      let $container = $title.closest('div');
      let depth = 0;
      while ($container.length > 0 && depth < 15) {
        const blogLinks = $container.find('a[href*="blog.naver.com"]').length;
        const influencerLinks = $container.find('a[href*="in.naver.com"][data-cb-target*="nblog_post"]').length;
        
        if (blogLinks > 0 || influencerLinks > 0) {
          break;
        }
        
        $container = $container.parent();
        depth++;
      }
      
      const blogLinks = $container.find('a[href*="blog.naver.com"]').length;
      const influencerLinks = $container.find('a[href*="in.naver.com"][data-cb-target*="nblog_post"]').length;
      const hasRelevantLinks = blogLinks > 0 || influencerLinks > 0;
      
      if (hasRelevantLinks) {
        console.log(`  ✓ 스마트블록 발견: "${text}" (블로그: ${blogLinks}개, 인플루언서: ${influencerLinks}개)`);
      }
      
      return hasRelevantLinks;
    });
    
    console.log(`스마트블록 제목 개수: ${smartBlockTitles.length}`);
    
    const seenCategories = new Set<string>();
    
    for (const titleElement of smartBlockTitles) {
      const $title = $(titleElement);
      const categoryName = $title.text().trim();
      
      if (seenCategories.has(categoryName)) {
        console.log(`  - 중복 스마트블록 스킵: "${categoryName}"`);
        continue;
      }
      
      let $container = $title.closest('div');
      let depth = 0;
      while ($container.length > 0 && depth < 15) {
        const blogLinks = $container.find('a[href*="blog.naver.com"]').length;
        const influencerLinks = $container.find('a[href*="in.naver.com"][data-cb-target*="nblog_post"]').length;
        
        if (blogLinks > 0 || influencerLinks > 0) {
          break;
        }
        
        $container = $container.parent();
        depth++;
      }
      
      if ($container.length === 0) {
        continue;
      }

      const blogLinks = $container.find('a[href*="blog.naver.com"]').toArray();
      const influencerLinks = $container.find('a[href*="in.naver.com"][data-cb-target*="nblog_post"]').toArray();
      const allLinks = [...blogLinks, ...influencerLinks];
      
      const categoryBlogs: BlogResult[] = [];
      const categorySeenUrls = new Set<string>();
      
      for (const link of allLinks) {
        const $link = $(link);
        const href = $link.attr('href') || '';
        let blogUrl: string | null = null;
        
        if (href.includes('blog.naver.com')) {
          blogUrl = this.extractBlogUrl(href);
        } else if (href.includes('in.naver.com')) {
          blogUrl = this.extractInfluencerBlogUrl($link);
        }
        
        if (blogUrl && !categorySeenUrls.has(blogUrl)) {
          categorySeenUrls.add(blogUrl);
          let title = $link.text().trim() || $link.attr('aria-label') || $link.attr('title') || '';
          
          // "접기" 문구 제거
          title = title.replace(/\s*접기\s*$/g, '').trim();
          
          // Phase 1: CSS visibility 체크
          const visibilityCheck = this.checkElementVisibility($link, $);
          
          // 블로그 메타정보 추출
          const metadata = this.extractBlogMetadata($link, $, $container);
          
          categoryBlogs.push({
            url: blogUrl,
            title: title || '제목 없음',
            position: categoryBlogs.length,
            isVisible: visibilityCheck.isVisible,
            hiddenReason: visibilityCheck.hiddenReason,
            blogName: metadata.blogName,
            author: metadata.author,
            publishedDate: metadata.publishedDate,
            description: metadata.description,
            imageUrl: metadata.imageUrl,
          });
          
          if (!seenUrls.has(blogUrl)) {
            seenUrls.add(blogUrl);
            blogResults.push({
              url: blogUrl,
              title: title || '제목 없음',
              position: blogResults.length,
              isVisible: visibilityCheck.isVisible,
              hiddenReason: visibilityCheck.hiddenReason,
              blogName: metadata.blogName,
              author: metadata.author,
              publishedDate: metadata.publishedDate,
              description: metadata.description,
              imageUrl: metadata.imageUrl,
            });
          }
        }
      }
      
      if (categoryBlogs.length > 0) {
        seenCategories.add(categoryName);
        categories.push({
          categoryName,
          blogs: categoryBlogs,
          totalBlogs: categoryBlogs.length,
        });
      }
    }

    if (blogResults.length === 0) {
      console.log('\n스마트블록 제목으로 블로그를 찾지 못함. 전체 페이지에서 검색...');
      const allLinks = $('a[href*="blog.naver.com"]').toArray();
      console.log(`전체 블로그 링크 개수: ${allLinks.length}`);
      
      for (const link of allLinks.slice(0, 10)) {
        const $link = $(link);
        const href = $link.attr('href') || '';
        const blogUrl = this.extractBlogUrl(href);
        
        if (blogUrl && !seenUrls.has(blogUrl)) {
          seenUrls.add(blogUrl);
          let title = $link.text().trim() || $link.attr('aria-label') || '제목 없음';
          
          // "접기" 문구 제거
          title = title.replace(/\s*접기\s*$/g, '').trim();
          
          // Phase 1: CSS visibility 체크
          const visibilityCheck = this.checkElementVisibility($link, $);
          
          // 블로그 메타정보 추출
          const metadata = this.extractBlogMetadata($link, $, undefined);
          
          blogResults.push({
            url: blogUrl,
            title,
            position: blogResults.length,
            isVisible: visibilityCheck.isVisible,
            hiddenReason: visibilityCheck.hiddenReason,
            blogName: metadata.blogName,
            author: metadata.author,
            publishedDate: metadata.publishedDate,
            description: metadata.description,
            imageUrl: metadata.imageUrl,
          });
        }
      }
    }

    console.log(`\n=== 파싱 완료 ===`);
    console.log(`총 ${blogResults.length}개 블로그 발견`);
    console.log(`총 ${categories.length}개 카테고리 발견`);
    if (blogResults.length > 0) {
      console.log(`\n상위 3개 블로그:`);
      blogResults.slice(0, 3).forEach((blog, i) => {
        console.log(`  ${i+1}. ${blog.url}`);
      });
    }

    return {
      found: blogResults.length > 0,
      blogResults: blogResults.slice(0, 10),
      categories,
      totalBlogs: blogResults.length,
    };
  }

  private checkElementVisibility($element: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): { isVisible: boolean; hiddenReason?: string } {
    let $current = $element;
    let depth = 0;
    const maxDepth = 10;

    while ($current.length > 0 && depth < maxDepth) {
      const style = $current.attr('style') || '';
      const className = $current.attr('class') || '';

      if (style.includes('display:none') || style.includes('display: none')) {
        return { isVisible: false, hiddenReason: 'display_none' };
      }

      if (style.includes('visibility:hidden') || style.includes('visibility: hidden')) {
        return { isVisible: false, hiddenReason: 'visibility_hidden' };
      }

      if (style.includes('opacity:0') || style.includes('opacity: 0')) {
        return { isVisible: false, hiddenReason: 'opacity_zero' };
      }

      if (className.includes('hidden') || className.includes('d-none') || className.includes('display-none')) {
        return { isVisible: false, hiddenReason: 'css_class_hidden' };
      }

      $current = $current.parent();
      depth++;
    }

    return { isVisible: true };
  }

  private extractBlogUrl(url: string): string | null {
    try {
      const blogMatch = url.match(/blog\.naver\.com\/([^/?]+)\/(\d+)/);
      if (blogMatch && blogMatch[2]) {
        return `https://blog.naver.com/${blogMatch[1]}/${blogMatch[2]}`;
      }

      const paramMatch = url.match(/blogId=([^&]+).*?logNo=(\d+)/);
      if (paramMatch && paramMatch[2]) {
        return `https://blog.naver.com/${paramMatch[1]}/${paramMatch[2]}`;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  private extractInfluencerBlogUrl($link: cheerio.Cheerio<any>): string | null {
    try {
      const dataTarget = $link.attr('data-cb-target') || '';
      const href = $link.attr('href') || '';
      
      const postMatch = dataTarget.match(/nblog_post_(\d+)/);
      if (!postMatch || !postMatch[1]) {
        return null;
      }
      
      const postNo = postMatch[1];
      
      const userMatch = href.match(/in\.naver\.com\/([^/?]+)/);
      if (!userMatch || !userMatch[1]) {
        return null;
      }
      
      const userId = userMatch[1];
      
      return `https://blog.naver.com/${userId}/${postNo}`;
    } catch (error) {
      return null;
    }
  }

  private extractBlogMetadata($link: cheerio.Cheerio<any>, $: cheerio.CheerioAPI, $container?: cheerio.Cheerio<any>): { blogName?: string; author?: string; publishedDate?: string; description?: string; imageUrl?: string } {
    const metadata: { blogName?: string; author?: string; publishedDate?: string; description?: string; imageUrl?: string } = {};
    
    try {
      // 스마트블록 카드 레벨까지 올라가기 - 컨테이너가 제공되면 사용, 아니면 링크에서 탐색
      let $card = $container || $link.closest('li.bx, li[class*="blog"], div[data-cr-area*="blog"], article, .item');
      
      // 카드를 찾지 못하면 충분히 큰 컨테이너 찾기
      if ($card.length === 0) {
        let $container = $link.parent();
        let depth = 0;
        while ($container.length > 0 && depth < 7) {
          const containerText = $container.text().length;
          if (containerText > 100) {
            $card = $container;
            break;
          }
          $container = $container.parent();
          depth++;
        }
      }
      
      if ($card.length === 0) {
        $card = $link.parent();
      }
      
      // 발행일 추출 (우선순위: data 속성 > 특정 클래스 > 텍스트 패턴)
      
      // 패턴 1: data-time 속성 (가장 신뢰도 높음)
      const $dataTime = $card.find('[data-time]').first();
      if ($dataTime.length > 0) {
        const dataTimeAttr = $dataTime.attr('data-time');
        const displayText = $dataTime.text().trim();
        metadata.publishedDate = displayText || dataTimeAttr || undefined;
      }
      
      // 패턴 2: .source_txt, .source_box, .detail_info 같은 네이버 메타 블록
      if (!metadata.publishedDate) {
        const $metaBlock = $card.find('.source_txt, .source_box, .detail_info, .sub_txt, .sub_time').first();
        if ($metaBlock.length > 0) {
          const metaText = $metaBlock.text().trim();
          // 불릿(·)으로 구분된 메타 정보에서 날짜 추출
          const parts = metaText.split(/[·•]/);
          for (const part of parts) {
            const trimmed = part.trim();
            if (/(\d+일\s*전|\d+시간\s*전|\d+분\s*전|\d{4}\.\d{1,2}\.\d{1,2}|\d{4}-\d{1,2}-\d{1,2}|어제|오늘)/.test(trimmed)) {
              const match = trimmed.match(/(\d+일\s*전|\d+시간\s*전|\d+분\s*전|\d{4}\.\d{1,2}\.\d{1,2}|\d{4}-\d{1,2}-\d{1,2}|어제|오늘)/);
              if (match && match[1]) {
                metadata.publishedDate = match[1].trim();
                break;
              }
            }
          }
        }
      }
      
      // 패턴 3: time 태그
      if (!metadata.publishedDate) {
        const $time = $card.find('time').first();
        if ($time.length > 0) {
          metadata.publishedDate = $time.text().trim();
        }
      }
      
      // 패턴 4: 날짜/시간 관련 클래스
      if (!metadata.publishedDate) {
        const $dateEl = $card.find('[class*="date"], [class*="time"], dd, .txt').filter((i, el) => {
          const text = $(el).text().trim();
          return /(\d+일\s*전|\d+시간\s*전|\d+분\s*전|\d{4}\.\d{1,2}\.\d{1,2}|\d{4}-\d{1,2}-\d{1,2}|어제|오늘)/.test(text);
        }).first();
        
        if ($dateEl.length > 0) {
          const dateText = $dateEl.text().trim();
          const match = dateText.match(/(\d+일\s*전|\d+시간\s*전|\d+분\s*전|\d{4}\.\d{1,2}\.\d{1,2}|\d{4}-\d{1,2}-\d{1,2}|어제|오늘)/);
          if (match && match[1]) {
            metadata.publishedDate = match[1].trim();
          }
        }
      }
      
      // 패턴 5: 전체 카드 텍스트에서 날짜 패턴 찾기 (마지막 수단)
      if (!metadata.publishedDate) {
        const cardText = $card.text();
        const datePatterns = [
          /(\d+일\s*전)/,
          /(\d+시간\s*전)/,
          /(\d+분\s*전)/,
          /(\d{4}\.\d{1,2}\.\d{1,2})/,
          /(\d{4}-\d{1,2}-\d{1,2})/,
          /(어제)/,
          /(오늘)/,
        ];
        
        for (const pattern of datePatterns) {
          const match = cardText.match(pattern);
          if (match && match[1]) {
            metadata.publishedDate = match[1].trim();
            break;
          }
        }
      }
      
      // 블로그명/발행자 추출
      // 패턴 1: data-source 속성이나 .source_txt, .sub_name 같은 네이버 특유 클래스
      const $source = $card.find('.source_txt, .sub_name, [data-source], [class*="author"], [class*="blogger"], dt').first();
      if ($source.length > 0) {
        const sourceText = $source.text().trim();
        // 불릿으로 구분된 경우 첫 번째 부분이 보통 블로그명
        const blogName = sourceText.split(/[·•]/)[0].trim();
        if (blogName && blogName.length < 50 && blogName !== metadata.publishedDate) {
          metadata.author = blogName;
          metadata.blogName = blogName;
        }
      }
      
      // 패턴 2: 카드 내 작은 텍스트 요소에서 블로그명 찾기
      if (!metadata.blogName) {
        const $nearbyText = $card.find('span, div, p, dd, dt').filter((i, el) => {
          const text = $(el).text().trim();
          return text.length > 0 && text.length < 50 && 
                 !text.includes('http') && 
                 text !== $link.text().trim() &&
                 text !== metadata.publishedDate &&
                 !/^\d/.test(text); // 숫자로 시작하지 않음 (날짜 제외)
        });
        
        if ($nearbyText.length > 0) {
          const text = $nearbyText.first().text().trim();
          const blogName = text.split(/[·•]/)[0].trim();
          if (blogName) {
            metadata.blogName = blogName;
            if (!metadata.author) {
              metadata.author = blogName;
            }
          }
        }
      }
      
      // 요약문(description) 추출 - 스마트블록 구조에 맞게 개선
      // 링크의 형제 또는 부모의 형제 요소에서 텍스트 찾기
      let $descElement = $link.siblings().filter((i, el) => {
        const text = $(el).text().trim();
        return text.length >= 15 && text.length <= 500 && text !== $link.text().trim();
      }).first();
      
      // 형제에서 못 찾으면 부모의 형제에서 찾기
      if ($descElement.length === 0) {
        $descElement = $link.parent().siblings().filter((i, el) => {
          const text = $(el).text().trim();
          return text.length >= 15 && text.length <= 500 && text !== $link.text().trim();
        }).first();
      }
      
      // 카드 전체에서 찾기 (마지막 방법)
      if ($descElement.length === 0) {
        const allTexts: string[] = [];
        $card.find('*').each((i, el) => {
          const $el = $(el);
          if ($el.children().length === 0) { // 자식이 없는 요소 (leaf 노드)
            const text = $el.text().trim();
            if (text.length >= 15 && text.length <= 500 && 
                text !== $link.text().trim() && 
                !text.includes('http') &&
                text !== metadata.publishedDate) {
              allTexts.push(text);
            }
          }
        });
        if (allTexts.length > 0) {
          // 가장 긴 텍스트를 요약문으로
          metadata.description = allTexts.reduce((a, b) => a.length > b.length ? a : b);
        }
      } else {
        metadata.description = $descElement.text().trim();
      }
      
      // 이미지(imageUrl) 추출 - 스마트블록 구조에 맞게 개선
      // 링크와 가까운 이미지 우선 (형제 또는 부모의 형제)
      let $imageElement = $link.siblings('img, [style*="background-image"]').first();
      
      if ($imageElement.length === 0) {
        $imageElement = $link.parent().siblings().find('img').first();
      }
      
      if ($imageElement.length === 0) {
        $imageElement = $card.find('img').first();
      }
      
      if ($imageElement.length > 0) {
        const tagName = $imageElement.prop('tagName')?.toLowerCase();
        if (tagName === 'img') {
          const imgSrc = $imageElement.attr('src') || $imageElement.attr('data-src') || $imageElement.attr('data-lazy-src');
          if (imgSrc && (imgSrc.startsWith('http') || imgSrc.startsWith('//'))) {
            metadata.imageUrl = imgSrc.startsWith('//') ? 'https:' + imgSrc : imgSrc;
          }
        } else {
          // background-image에서 URL 추출
          const style = $imageElement.attr('style') || '';
          const bgMatch = style.match(/background-image:\s*url\(['"]?([^'"]+)['"]?\)/);
          if (bgMatch && bgMatch[1]) {
            const imgSrc = bgMatch[1];
            metadata.imageUrl = imgSrc.startsWith('//') ? 'https:' + imgSrc : imgSrc;
          }
        }
      }
      
      // 디버그 로그 (개발 환경에서만)
      if (process.env.NODE_ENV === 'development') {
        console.log(`📝 메타정보 추출: blogName="${metadata.blogName}", author="${metadata.author}", date="${metadata.publishedDate}", desc="${metadata.description?.substring(0, 30)}...", img="${metadata.imageUrl?.substring(0, 50)}..."`);
      }
      
    } catch (error) {
      console.error('메타정보 추출 오류:', error);
    }
    
    return metadata;
  }

  normalizeUrl(url: string): string {
    try {
      let normalized = url.trim();
      normalized = normalized.replace('m.blog.naver.com', 'blog.naver.com');
      normalized = normalized.replace(/^https?:\/\//, '');
      normalized = normalized.replace(/\/$/, '');
      normalized = normalized.split('?')[0];
      normalized = normalized.split('#')[0];
      return normalized;
    } catch (error) {
      return url;
    }
  }
}
