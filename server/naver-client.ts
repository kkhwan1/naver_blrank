import axios from 'axios';

export interface BlogResult {
  url: string;
  title: string;
  position: number;
}

export interface SearchResult {
  blogResults: BlogResult[];
  searchId: string;
  timestamp: Date;
  metadata: {
    keyword: string;
    deviceType: 'desktop' | 'mobile';
  };
}

export class NaverAPIClient {
  private serpApiKey: string;
  private baseUrl: string;

  constructor() {
    this.serpApiKey = process.env.SERPAPI_API_KEY || '';
    this.baseUrl = 'https://serpapi.com/search';
  }

  async searchNaver(keyword: string): Promise<SearchResult> {
    try {
      const params = {
        api_key: this.serpApiKey,
        engine: 'naver',
        query: keyword,
        num: 30,
        no_cache: true,
      };

      const response = await axios.get(this.baseUrl, {
        params,
        timeout: 30000,
      });

      if (!response.data) {
        throw new Error('No data received from SerpAPI');
      }

      const blogResults: BlogResult[] = [];
      
      if (response.data.inline_blog_card_results) {
        response.data.inline_blog_card_results.forEach((result: any, index: number) => {
          if (result.link) {
            blogResults.push({
              url: result.link,
              title: result.title || '',
              position: index,
            });
          }
        });
      }
      
      if (blogResults.length === 0 && response.data.blog_card_results) {
        response.data.blog_card_results.forEach((result: any, index: number) => {
          if (result.link) {
            blogResults.push({
              url: result.link,
              title: result.title || '',
              position: index,
            });
          }
        });
      }
      
      if (blogResults.length === 0 && response.data.organic_results) {
        response.data.organic_results.forEach((result: any, index: number) => {
          if (result.link && (
            result.link.includes('blog.naver.com') ||
            result.link.includes('tistory.com') ||
            result.link.includes('/blog/')
          )) {
            blogResults.push({
              url: result.link,
              title: result.title || '',
              position: index,
            });
          }
        });
      }

      if (blogResults.length === 0 && response.data.blog_results) {
        response.data.blog_results.forEach((result: any, index: number) => {
          if (result.link && !blogResults.find(b => b.url === result.link)) {
            blogResults.push({
              url: result.link,
              title: result.title || '',
              position: blogResults.length + index,
            });
          }
        });
      }

      return {
        blogResults: blogResults.slice(0, 10),
        searchId: response.data.search_metadata?.id || 'unknown',
        timestamp: new Date(),
        metadata: {
          keyword,
          deviceType: 'desktop',
        },
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('SerpAPI Error Details:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
        if (error.response?.status === 429) {
          throw new Error('API rate limit exceeded');
        }
        if (error.response?.data) {
          throw new Error(`SerpAPI error: ${JSON.stringify(error.response.data)}`);
        }
        throw new Error(`SerpAPI error: ${error.message}`);
      }
      console.error('Unexpected error in SerpAPI call:', error);
      throw error;
    }
  }
}
