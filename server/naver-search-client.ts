import axios from 'axios';

export interface BlogSearchResult {
  title: string;
  link: string;
  description: string;
  bloggername: string;
  bloggerlink: string;
  postdate: string;
}

export interface BlogSearchResponse {
  total: number;
  start: number;
  display: number;
  items: BlogSearchResult[];
}

export class NaverSearchClient {
  private clientId: string;
  private clientSecret: string;
  private baseUrl: string;

  constructor() {
    this.clientId = process.env.NAVER_CLIENT_ID || '';
    this.clientSecret = process.env.NAVER_CLIENT_SECRET || '';
    this.baseUrl = 'https://openapi.naver.com/v1/search';
  }

  private validateCredentials(): void {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Naver Search API credentials not configured. Please set NAVER_CLIENT_ID and NAVER_CLIENT_SECRET environment variables.');
    }
  }

  async searchBlogs(keyword: string, display: number = 10, start: number = 1): Promise<BlogSearchResponse> {
    this.validateCredentials();
    
    try {
      const response = await axios.get(`${this.baseUrl}/blog.json`, {
        params: {
          query: keyword,
          display,
          start,
          sort: 'sim', // sim: 정확도순, date: 날짜순
        },
        headers: {
          'X-Naver-Client-Id': this.clientId,
          'X-Naver-Client-Secret': this.clientSecret,
        },
        timeout: 10000,
      });

      return response.data;
    } catch (error) {
      console.error('Naver Search API Error:', error);
      if (axios.isAxiosError(error)) {
        console.error('Error details:', {
          status: error.response?.status,
          data: error.response?.data,
        });
      }
      throw error;
    }
  }
}
