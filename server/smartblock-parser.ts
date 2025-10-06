import * as cheerio from 'cheerio';

export interface BlogCard {
  url: string;
  title: string;
  position: number;
}

export interface DetectionResult {
  status: 'found' | 'not_found' | 'error';
  confidence: number;
  blogCards: BlogCard[];
}

export interface RankMatchResult {
  rank: number | null;
  confidence: number;
  matchedUrl: string;
  exactMatch: boolean;
}

export class SmartBlockParser {
  detectSmartBlock(html: string): DetectionResult {
    try {
      const $ = cheerio.load(html);
      const blogCards: BlogCard[] = [];

      const possibleSelectors = [
        'a[href*="blog.naver.com"]',
        'a[href*="tistory.com"]',
        'a[href*="/blog/"]',
      ];

      let position = 0;
      for (const selector of possibleSelectors) {
        $(selector).each((i, element) => {
          const $elem = $(element);
          const url = $elem.attr('href');
          const title = $elem.text().trim();

          if (url && title && position < 10) {
            const normalizedUrl = this.normalizeUrl(url);
            if (normalizedUrl && !blogCards.find(c => c.url === normalizedUrl)) {
              blogCards.push({
                url: normalizedUrl,
                title,
                position: position++,
              });
            }
          }
        });
      }

      if (blogCards.length === 0) {
        return {
          status: 'not_found',
          confidence: 0,
          blogCards: [],
        };
      }

      return {
        status: 'found',
        confidence: blogCards.length >= 3 ? 0.9 : 0.6,
        blogCards: blogCards.slice(0, 10),
      };
    } catch (error) {
      console.error('SmartBlock parsing error:', error);
      return {
        status: 'error',
        confidence: 0,
        blogCards: [],
      };
    }
  }

  findRank(targetUrl: string, blogCards: BlogCard[]): RankMatchResult {
    const normalizedTarget = this.normalizeUrl(targetUrl);

    for (let i = 0; i < Math.min(blogCards.length, 3); i++) {
      const card = blogCards[i];
      const normalizedCard = this.normalizeUrl(card.url);

      if (normalizedCard === normalizedTarget) {
        return {
          rank: i + 1,
          confidence: 1.0,
          matchedUrl: card.url,
          exactMatch: true,
        };
      }

      const similarity = this.calculateSimilarity(normalizedTarget, normalizedCard);
      if (similarity > 0.85) {
        return {
          rank: i + 1,
          confidence: similarity,
          matchedUrl: card.url,
          exactMatch: false,
        };
      }
    }

    return {
      rank: null,
      confidence: 0,
      matchedUrl: '',
      exactMatch: false,
    };
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

  private calculateSimilarity(url1: string, url2: string): number {
    const parts1 = url1.split('/');
    const parts2 = url2.split('/');

    let matchCount = 0;
    const minLength = Math.min(parts1.length, parts2.length);

    for (let i = 0; i < minLength; i++) {
      if (parts1[i] === parts2[i]) {
        matchCount++;
      }
    }

    return matchCount / Math.max(parts1.length, parts2.length);
  }
}
