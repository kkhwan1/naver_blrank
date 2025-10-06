import type { BlogResult } from './naver-client';

export interface RankMatchResult {
  rank: number | null;
  confidence: number;
  matchedUrl: string;
  exactMatch: boolean;
}

export class SmartBlockParser {
  findRank(targetUrl: string, blogResults: BlogResult[]): RankMatchResult {
    const normalizedTarget = this.normalizeUrl(targetUrl);

    for (let i = 0; i < Math.min(blogResults.length, 3); i++) {
      const result = blogResults[i];
      const normalizedResult = this.normalizeUrl(result.url);

      if (normalizedResult === normalizedTarget) {
        return {
          rank: i + 1,
          confidence: 1.0,
          matchedUrl: result.url,
          exactMatch: true,
        };
      }

      const similarity = this.calculateSimilarity(normalizedTarget, normalizedResult);
      if (similarity > 0.85) {
        return {
          rank: i + 1,
          confidence: similarity,
          matchedUrl: result.url,
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
