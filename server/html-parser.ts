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

export interface UnifiedSearchResult {
  blogs: BlogResult[];
  targetRank: number | null;
  totalResults: number;
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
    
    // JSON 데이터 추출 (공유 헬퍼 함수 사용)
    const jsonDataMap = this.extractJsonDataFromScripts($, '[스마트블록] ');
    
    const NON_BLOG_CATEGORIES = [
      '숏텐츠',
      '네이버 클립',
      'NAVER 클립',
      '짧은 즐거움 네이버 클립',
      'NAVER NOW',
      '뉴스',
      '콘텐츠',
      '인플루언서 참여 콘텐츠',
      '놓치기 아쉬운 콘텐츠',
      '브랜드 콘텐츠',
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
          
          // 블로그 메타정보 추출 (JSON 우선, CSS 셀렉터 폴백)
          const metadata = this.extractBlogMetadata($link, $, $container);
          const jsonData = jsonDataMap.get(blogUrl);
          
          const finalMetadata = {
            blogName: jsonData?.blogName || metadata.blogName,
            author: metadata.author, // JSON에는 author 정보 없음
            publishedDate: jsonData?.createdDate || metadata.publishedDate,
            description: jsonData?.description || metadata.description,
            imageUrl: jsonData?.imageSrc || metadata.imageUrl,
          };
          
          if (jsonData) {
            console.log(`✨ [스마트블록] JSON 메타데이터 적용: "${finalMetadata.blogName}" (${finalMetadata.publishedDate})`);
          }
          
          categoryBlogs.push({
            url: blogUrl,
            title: title || '제목 없음',
            position: categoryBlogs.length,
            isVisible: visibilityCheck.isVisible,
            hiddenReason: visibilityCheck.hiddenReason,
            blogName: finalMetadata.blogName,
            author: finalMetadata.author,
            publishedDate: finalMetadata.publishedDate,
            description: finalMetadata.description,
            imageUrl: finalMetadata.imageUrl,
          });
          
          if (!seenUrls.has(blogUrl)) {
            seenUrls.add(blogUrl);
            blogResults.push({
              url: blogUrl,
              title: title || '제목 없음',
              position: blogResults.length,
              isVisible: visibilityCheck.isVisible,
              hiddenReason: visibilityCheck.hiddenReason,
              blogName: finalMetadata.blogName,
              author: finalMetadata.author,
              publishedDate: finalMetadata.publishedDate,
              description: finalMetadata.description,
              imageUrl: finalMetadata.imageUrl,
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
          
          // 블로그 메타정보 추출 (JSON 우선, CSS 셀렉터 폴백)
          const metadata = this.extractBlogMetadata($link, $, undefined);
          const jsonData = jsonDataMap.get(blogUrl);
          
          const finalMetadata = {
            blogName: jsonData?.blogName || metadata.blogName,
            author: metadata.author,
            publishedDate: jsonData?.createdDate || metadata.publishedDate,
            description: jsonData?.description || metadata.description,
            imageUrl: jsonData?.imageSrc || metadata.imageUrl,
          };
          
          if (jsonData) {
            console.log(`✨ [스마트블록 폴백] JSON 메타데이터 적용: "${finalMetadata.blogName}" (${finalMetadata.publishedDate})`);
          }
          
          blogResults.push({
            url: blogUrl,
            title,
            position: blogResults.length,
            isVisible: visibilityCheck.isVisible,
            hiddenReason: visibilityCheck.hiddenReason,
            blogName: finalMetadata.blogName,
            author: finalMetadata.author,
            publishedDate: finalMetadata.publishedDate,
            description: finalMetadata.description,
            imageUrl: finalMetadata.imageUrl,
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

  private extractJsonDataFromScripts(
    $: cheerio.CheerioAPI, 
    logPrefix: string = ''
  ): Map<string, { blogName?: string; createdDate?: string; imageSrc?: string; description?: string }> {
    const jsonDataMap = new Map<string, { blogName?: string; createdDate?: string; imageSrc?: string; description?: string }>();
    
    try {
      let totalScriptTags = 0;
      let scriptsWithCreatedDate = 0;
      let scriptsWithTitleHref = 0;
      
      $('script').each((i, script) => {
        const scriptContent = $(script).html() || '';
        totalScriptTags++;
        
        if (scriptContent.includes('"createdDate"')) scriptsWithCreatedDate++;
        if (scriptContent.includes('"titleHref"')) scriptsWithTitleHref++;
        
        if (scriptContent.includes('"createdDate"') && scriptContent.includes('"titleHref"')) {
          console.log(`🔎 ${logPrefix}JSON 데이터 발견 가능성 있는 script 태그 (길이: ${scriptContent.length})`);
          
          let searchPos = 0;
          let extractedCount = 0;
          
          while (true) {
            const titleHrefPos = scriptContent.indexOf('"titleHref"', searchPos);
            if (titleHrefPos === -1) break;
            
            let objStart = titleHrefPos;
            let braceCount = 0;
            let foundStart = false;
            
            for (let i = titleHrefPos; i >= 0; i--) {
              if (scriptContent[i] === '}') braceCount++;
              if (scriptContent[i] === '{') {
                if (braceCount === 0) {
                  objStart = i;
                  foundStart = true;
                  break;
                }
                braceCount--;
              }
            }
            
            if (!foundStart) {
              searchPos = titleHrefPos + 1;
              continue;
            }
            
            let objEnd = titleHrefPos;
            braceCount = 0;
            let foundEnd = false;
            
            for (let i = objStart; i < scriptContent.length; i++) {
              if (scriptContent[i] === '{') braceCount++;
              if (scriptContent[i] === '}') {
                braceCount--;
                if (braceCount === 0) {
                  objEnd = i + 1;
                  foundEnd = true;
                  break;
                }
              }
            }
            
            if (!foundEnd) {
              searchPos = titleHrefPos + 1;
              continue;
            }
            
            try {
              const jsonStr = scriptContent.substring(objStart, objEnd);
              const obj = JSON.parse(jsonStr);
              
              if (obj.titleHref && obj.titleHref.includes('blog.naver.com')) {
                const blogUrl = this.extractBlogUrl(obj.titleHref);
                if (blogUrl) {
                  // 첫 번째 객체의 전체 키 목록과 샘플 값을 로그로 출력 (디버깅용)
                  if (extractedCount === 0) {
                    const keys = Object.keys(obj);
                    console.log(`🔍 ${logPrefix}첫 번째 JSON 객체의 키 목록 (${keys.length}개):`, keys);
                    console.log(`🔍 ${logPrefix}샘플 값:`, {
                      title: obj.title?.substring(0, 50),
                      titleHref: obj.titleHref?.substring(0, 50),
                      imageSrc: obj.imageSrc?.substring(0, 50),
                    });
                  }
                  
                  // description은 여러 필드명으로 존재할 수 있음
                  const description = obj.snippet || obj.contents || obj.description || obj.summary || obj.dsc || obj.desc || obj.content || obj.text;
                  
                  // date는 여러 필드명으로 존재할 수 있음
                  const date = obj.createdDate || obj.date || obj.publishDate || obj.regDate || obj.writeDate || obj.postDate;
                  
                  // imageSrc는 여러 필드명으로 존재할 수 있음
                  const image = obj.imageSrc || obj.imageUrl || obj.thumbnail || obj.thumbUrl || obj.image;
                  
                  jsonDataMap.set(blogUrl, {
                    blogName: obj.title,
                    createdDate: date,
                    imageSrc: image,
                    description: description,
                  });
                  extractedCount++;
                }
              }
            } catch (parseError) {
              // JSON 파싱 실패 시 조용히 건너뛰기
            }
            
            searchPos = objEnd;
          }
          
          if (extractedCount > 0) {
            console.log(`→ ${logPrefix}추출된 블로그 JSON 객체: ${extractedCount}개`);
          }
        }
      });
      
      console.log(`📊 ${logPrefix}Script 태그 분석: 전체 ${totalScriptTags}개, createdDate 포함 ${scriptsWithCreatedDate}개, titleHref 포함 ${scriptsWithTitleHref}개`);
      console.log(`📦 ${logPrefix}HTML 내부 JSON 데이터 ${jsonDataMap.size}개 추출 성공`);
    } catch (error) {
      console.error(`❌ ${logPrefix}JSON 추출 중 오류:`, error);
    }
    
    return jsonDataMap;
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
        const UI_KEYWORDS = ['정렬', '관련도순', '최신순', 'Keep', '저장', '바로가기', '접기'];
        
        const $nearbyText = $card.find('span, div, p, dd, dt').filter((i, el) => {
          const text = $(el).text().trim();
          
          // 기본 검증
          if (!text || text.length < 3 || text.length > 50) return false;
          
          // 제외 패턴
          if (text.includes('http')) return false;
          if (text === $link.text().trim()) return false;
          if (text === metadata.publishedDate) return false;
          if (/^\d/.test(text)) return false; // 숫자로 시작
          
          // UI 키워드 제외
          if (UI_KEYWORDS.some(keyword => text.includes(keyword))) return false;
          
          return true;
        });
        
        if ($nearbyText.length > 0) {
          const text = $nearbyText.first().text().trim();
          const blogName = text.split(/[·•]/)[0].trim();
          if (blogName && blogName.length >= 3) {
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

  /**
   * 네이버 통합검색 블로그 탭에서 블로그 결과 파싱 및 타겟 URL 순위 찾기
   * @param keyword 검색 키워드
   * @param targetUrl 찾고자 하는 블로그 URL
   * @returns 블로그 리스트와 타겟 순위
   */
  async searchUnifiedBlog(keyword: string, targetUrl: string): Promise<UnifiedSearchResult> {
    try {
      console.log(`🔍 통합검색 블로그 탭 파싱 시작: "${keyword}"`);
      
      const cookieString = Object.entries(this.cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');

      const response = await axios.get('https://search.naver.com/search.naver', {
        params: {
          ssc: 'tab.blog.all',
          query: keyword,
        },
        headers: {
          ...this.headers,
          'Cookie': cookieString,
        },
        timeout: 15000,
      });

      const html = response.data;
      const $ = cheerio.load(html);
      
      const blogs: BlogResult[] = [];
      const seenUrls = new Set<string>();
      
      // 패턴 0: HTML 내부 JSON 데이터 추출 (공유 헬퍼 함수 사용)
      const jsonDataMap = this.extractJsonDataFromScripts($, '[통합검색] ');
      
      // 간단한 방법: 모든 blog.naver.com 링크 찾기
      const allBlogLinks = $('a[href*="blog.naver.com"]').toArray();
      console.log(`전체 블로그 링크 개수: ${allBlogLinks.length}`);
      
      for (const link of allBlogLinks) {
        const $link = $(link);
        const href = $link.attr('href') || '';
        
        // URL 추출
        const blogUrl = this.extractBlogUrl(href);
        
        // 중복 체크
        if (!blogUrl || seenUrls.has(blogUrl)) continue;
        seenUrls.add(blogUrl);
        
        // 제목 추출
        let title = $link.text().trim() || $link.attr('aria-label') || $link.attr('title') || '제목 없음';
        title = title.replace(/\s*접기\s*$/g, '').trim();
        
        // 블로그 카드 찾기 - 통합검색 블로그 탭의 li.bx 또는 상위 컨테이너
        let $card = $link.closest('li.bx, div[class*="fds-ugc-block"], div[class*="total_area"], div[class*="api_ani_send"]');
        if ($card.length === 0) {
          // 폴백: 더 넓은 범위에서 검색
          $card = $link.closest('div, li').filter((i, el) => {
            return $(el).find('a[href*="blog.naver.com"]').length > 0;
          }).first();
        }
        
        // 통합검색 블로그 탭 전용 메타데이터 추출
        let blogName: string | undefined;
        let publishedDate: string | undefined;
        let description: string | undefined;
        let imageUrl: string | undefined;
        
        // 패턴 0: JSON 데이터에서 메타데이터 가져오기 (최우선)
        const jsonData = jsonDataMap.get(blogUrl);
        if (jsonData) {
          blogName = jsonData.blogName;
          publishedDate = jsonData.createdDate;
          imageUrl = jsonData.imageSrc;
          description = jsonData.description;
          console.log(`✨ JSON에서 메타데이터 추출 성공: blogName="${blogName}", date="${publishedDate}", description="${description?.substring(0, 50)}..."`);
        }
        
        // 패턴 1: li.bx 구조 (전통적인 네이버 검색)
        if ($card.prop('tagName')?.toLowerCase() === 'li' && $card.hasClass('bx')) {
          // 블로그명: .sub_name, .sub_txt
          if (!blogName) {
            blogName = $card.find('.sub_name, .sub_txt').first().text().trim() || undefined;
          }
          // 날짜: .sub_time, time 태그
          if (!publishedDate) {
            publishedDate = $card.find('.sub_time, time').first().text().trim() || undefined;
          }
          // 설명: .sh_blog_passage, .api_txt_lines, .total_dsc, .dsc_txt
          if (!description) {
            description = $card.find('.sh_blog_passage, .api_txt_lines, .total_dsc, .dsc_txt').first().text().trim() || undefined;
          }
          // 이미지: .thumb img
          if (!imageUrl) {
            const $img = $card.find('.thumb img, .thumb_area img').first();
            imageUrl = $img.attr('src') || $img.attr('data-src') || undefined;
          }
        }
        
        // 패턴 2: 새로운 FDS 구조 및 범용 선택자 (현대적인 네이버 검색)
        if (!blogName || !publishedDate || !description || !imageUrl) {
          // 블로그명: .fds-info-inner-text, .name, .writer 등
          if (!blogName) {
            blogName = $card.find('.fds-info-inner-text, [class*="info-inner-text"], .name, .writer').first().text().trim() || undefined;
          }
          // 날짜: .fds-info-sub-inner-text, .date 등
          if (!publishedDate) {
            publishedDate = $card.find('.fds-info-sub-inner-text, [class*="info-sub-inner-text"], .date, .time').first().text().trim() || undefined;
          }
          // 설명: 여러 가능한 클래스 확인
          if (!description) {
            const descSelectors = [
              '.fds-comps-text-list',
              '[class*="text-list"]',
              '.total_dsc',
              '.dsc_txt',
              '.api_txt_lines',
              '.sh_blog_passage',
              '.desc',
              '.description',
              '.content_desc'
            ];
            for (const selector of descSelectors) {
              const text = $card.find(selector).first().text().trim();
              if (text && text.length > 20) {
                description = text;
                break;
              }
            }
          }
          // 이미지: 여러 가능한 이미지 소스
          if (!imageUrl) {
            const $img = $card.find('img[src*="mblogthumb"], img[src*="blogthumb"], img[src*="phinf"], img').first();
            imageUrl = $img.attr('src') || $img.attr('data-src') || $img.attr('data-lazy-src') || undefined;
          }
        }
        
        // 패턴 3: 범용 폴백 (extractBlogMetadata 사용)
        if (!blogName && !publishedDate) {
          const metadata = this.extractBlogMetadata($link, $, $card);
          blogName = metadata.blogName;
          publishedDate = metadata.publishedDate;
          description = description || metadata.description;
          imageUrl = imageUrl || metadata.imageUrl;
        }
        
        blogs.push({
          url: blogUrl,
          title,
          position: blogs.length,
          isVisible: true,
          blogName,
          publishedDate,
          description,
          imageUrl,
        });
      }
      
      console.log(`✅ 통합검색 블로그 총 ${blogs.length}개 발견`);
      
      // 타겟 URL 순위 찾기
      const normalizedTarget = this.normalizeUrl(targetUrl);
      let targetRank: number | null = null;
      
      for (let i = 0; i < blogs.length; i++) {
        const normalizedBlog = this.normalizeUrl(blogs[i].url);
        if (normalizedBlog === normalizedTarget) {
          targetRank = i + 1;
          console.log(`🎯 타겟 블로그 발견: ${targetRank}위`);
          break;
        }
      }
      
      if (targetRank === null) {
        console.log(`❌ 타겟 블로그 미발견 (총 ${blogs.length}개 중)`);
      }
      
      return {
        blogs,
        targetRank,
        totalResults: blogs.length,
      };
    } catch (error) {
      console.error('통합검색 파싱 오류:', error);
      throw error;
    }
  }
}
