import axios from 'axios';
import * as cheerio from 'cheerio';
import type { BlogResult } from './naver-client';

export interface SmartBlockDetectionResult {
  found: boolean;
  blogResults: BlogResult[];
  categoryName?: string;
  totalBlogs: number;
}

export class NaverHTMLParser {
  private cookies: Record<string, string>;
  private headers: Record<string, string>;

  constructor() {
    this.cookies = {
      'NNB': 'ECHGGL2ZR7AGO',
      'nx_ssl': '2',
    };

    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'ko,en-US;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': 'https://search.naver.com/',
      'DNT': '1',
      'Connection': 'keep-alive',
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
        totalBlogs: 0,
      };
    }
  }

  private parseSmartBlock(html: string): SmartBlockDetectionResult {
    const $ = cheerio.load(html);
    const blogResults: BlogResult[] = [];
    const seenUrls = new Set<string>();

    const smartBlockContainers = $('div[class*="fds-grid-layout"]').toArray();

    for (const container of smartBlockContainers) {
      const $container = $(container);
      
      const headingText = $container.find('h2, h3, [class*="heading"]').text().toLowerCase();
      if (!headingText.includes('블로그') && !headingText.includes('주제') && !headingText.includes('인기')) {
        continue;
      }

      const links = $container.find('a[href]').toArray();
      
      for (const link of links) {
        const href = $(link).attr('href') || '';
        
        if (href.includes('blog.naver.com')) {
          const blogUrl = this.extractBlogUrl(href);
          if (blogUrl && !seenUrls.has(blogUrl)) {
            seenUrls.add(blogUrl);
            const title = $(link).text().trim() || $(link).attr('aria-label') || $(link).attr('title') || '';
            
            blogResults.push({
              url: blogUrl,
              title: title || '제목 없음',
              position: blogResults.length,
            });
          }
        }
      }
    }

    if (blogResults.length === 0) {
      const allLinks = $('a[href*="blog.naver.com"]').toArray();
      
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

    return {
      found: blogResults.length > 0,
      blogResults: blogResults.slice(0, 10),
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
