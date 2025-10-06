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
      while ($container.length > 0 && $container.find('a[href*="blog.naver.com"]').length === 0 && depth < 15) {
        $container = $container.parent();
        depth++;
      }
      
      const hasBlogLinks = $container.length > 0 && $container.find('a[href*="blog.naver.com"]').length > 0;
      if (hasBlogLinks) {
        console.log(`  ✓ 스마트블록 발견: "${text}" (블로그 링크 ${$container.find('a[href*="blog.naver.com"]').length}개)`);
      }
      
      return hasBlogLinks;
    });
    
    console.log(`스마트블록 제목 개수: ${smartBlockTitles.length}`);

    for (const titleElement of smartBlockTitles) {
      const $title = $(titleElement);
      const categoryName = $title.text().trim();
      
      let $container = $title.closest('div');
      let depth = 0;
      while ($container.length > 0 && $container.find('a[href*="blog.naver.com"]').length === 0 && depth < 15) {
        $container = $container.parent();
        depth++;
      }
      
      if ($container.length === 0) {
        continue;
      }

      const links = $container.find('a[href*="blog.naver.com"]').toArray();
      const categoryBlogs: BlogResult[] = [];
      const categorySeenUrls = new Set<string>();
      
      for (const link of links) {
        const href = $(link).attr('href') || '';
        
        if (href.includes('blog.naver.com')) {
          const blogUrl = this.extractBlogUrl(href);
          if (blogUrl && !categorySeenUrls.has(blogUrl)) {
            categorySeenUrls.add(blogUrl);
            const title = $(link).text().trim() || $(link).attr('aria-label') || $(link).attr('title') || '';
            
            categoryBlogs.push({
              url: blogUrl,
              title: title || '제목 없음',
              position: categoryBlogs.length,
            });
            
            if (!seenUrls.has(blogUrl)) {
              seenUrls.add(blogUrl);
              blogResults.push({
                url: blogUrl,
                title: title || '제목 없음',
                position: blogResults.length,
              });
            }
          }
        }
      }
      
      if (categoryBlogs.length > 0) {
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
        const href = $(link).attr('href') || '';
        const blogUrl = this.extractBlogUrl(href);
        
        if (blogUrl && !seenUrls.has(blogUrl)) {
          seenUrls.add(blogUrl);
          const title = $(link).text().trim() || $(link).attr('aria-label') || '제목 없음';
          
          blogResults.push({
            url: blogUrl,
            title,
            position: blogResults.length,
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

  private extractBlogUrl(url: string): string | null {
    try {
      const blogMatch = url.match(/blog\.naver\.com\/([^/]+)\/(\d+)/);
      if (blogMatch) {
        return `https://blog.naver.com/${blogMatch[1]}/${blogMatch[2]}`;
      }

      const paramMatch = url.match(/blogId=([^&]+).*?logNo=(\d+)/);
      if (paramMatch) {
        return `https://blog.naver.com/${paramMatch[1]}/${paramMatch[2]}`;
      }

      return null;
    } catch (error) {
      return null;
    }
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
