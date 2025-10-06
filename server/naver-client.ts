import axios from 'axios';

export interface SearchResult {
  html: string;
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
        q: keyword,
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

      return {
        html: JSON.stringify(response.data),
        searchId: response.data.search_metadata?.id || 'unknown',
        timestamp: new Date(),
        metadata: {
          keyword,
          deviceType: 'desktop',
        },
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          throw new Error('API rate limit exceeded');
        }
        throw new Error(`SerpAPI error: ${error.message}`);
      }
      throw error;
    }
  }
}
