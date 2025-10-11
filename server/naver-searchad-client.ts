import axios from 'axios';
import crypto from 'crypto';

export interface KeywordStats {
  relKeyword: string;
  monthlyPcQcCnt: string | number;  // API returns string for low values (e.g. "< 10")
  monthlyMobileQcCnt: string | number;  // API returns string for low values (e.g. "< 10")
  monthlyAvePcClkCnt: number;
  monthlyAveMobileClkCnt: number;
  monthlyAvePcCtr: number;
  monthlyAveMobileCtr: number;
  plAvgDepth: number;
  compIdx: string;
}

export interface RelatedKeyword {
  relKeyword: string;
  monthlyPcQcCnt: string | number;  // API returns string for low values (e.g. "< 10")
  monthlyMobileQcCnt: string | number;  // API returns string for low values (e.g. "< 10")
  monthlyAvePcClkCnt: number;
  monthlyAveMobileClkCnt: number;
  monthlyAvePcCtr: number;
  monthlyAveMobileCtr: number;
  plAvgDepth: number;
  compIdx: string;
}

export class NaverSearchAdClient {
  private customerId: string;
  private accessLicense: string;
  private secretKey: string;
  private baseUrl: string;

  constructor() {
    this.customerId = this.extractValue(process.env.NAVER_SEARCHAD_CUSTOMER_ID || '');
    this.accessLicense = this.extractValue(process.env.NAVER_SEARCHAD_ACCESS_LICENSE || '');
    this.secretKey = this.extractValue(process.env.NAVER_SEARCHAD_SECRET_KEY || '');
    this.baseUrl = 'https://api.searchad.naver.com';
  }

  private extractValue(envVar: string): string {
    const trimmed = envVar.trim();
    const parts = trimmed.split('=');
    
    if (parts.length > 1 && parts[0].trim().startsWith('NAVER_SEARCHAD_')) {
      return parts.slice(1).join('=').trim();
    }
    
    return trimmed;
  }

  private validateCredentials(): void {
    if (!this.customerId || !this.accessLicense || !this.secretKey) {
      throw new Error('Naver Search Ad API credentials not configured. Please set NAVER_SEARCHAD_CUSTOMER_ID, NAVER_SEARCHAD_ACCESS_LICENSE, and NAVER_SEARCHAD_SECRET_KEY environment variables.');
    }
  }

  private generateSignature(timestamp: string, method: string, uri: string): string {
    const message = `${timestamp}.${method}.${uri}`;
    const hmac = crypto.createHmac('sha256', this.secretKey);
    hmac.update(message);
    return hmac.digest('base64');
  }

  async getKeywordStats(keyword: string): Promise<KeywordStats | null> {
    this.validateCredentials();
    
    try {
      // Sanitize keyword: remove special characters that Naver API doesn't accept
      // Keep only Korean, English, numbers, and spaces
      const sanitizedKeyword = keyword.replace(/[^가-힣a-zA-Z0-9\s]/g, ' ').trim();
      
      console.log(`[Naver SearchAd] Original keyword: "${keyword}", Sanitized: "${sanitizedKeyword}"`);
      
      const timestamp = Date.now().toString();
      const method = 'GET';
      const uri = '/keywordstool';
      const signature = this.generateSignature(timestamp, method, uri);

      const response = await axios.get(`${this.baseUrl}${uri}`, {
        params: {
          hintKeywords: sanitizedKeyword,
          showDetail: 1,
        },
        headers: {
          'X-Timestamp': timestamp,
          'X-API-KEY': this.accessLicense,
          'X-Customer': this.customerId,
          'X-Signature': signature,
        },
        timeout: 10000,
      });

      if (response.data && response.data.keywordList && response.data.keywordList.length > 0) {
        return response.data.keywordList[0];
      }

      return null;
    } catch (error) {
      console.error('Naver Search Ad API Error:', error);
      if (axios.isAxiosError(error)) {
        console.error('Error details:', {
          status: error.response?.status,
          data: error.response?.data,
        });
      }
      throw error;
    }
  }

  async getRelatedKeywords(keyword: string, limit: number = 10): Promise<RelatedKeyword[]> {
    this.validateCredentials();
    
    try {
      // Sanitize keyword: remove special characters that Naver API doesn't accept
      // Keep only Korean, English, numbers, and spaces
      const sanitizedKeyword = keyword.replace(/[^가-힣a-zA-Z0-9\s]/g, ' ').trim();
      
      console.log(`[Naver SearchAd Related] Original keyword: "${keyword}", Sanitized: "${sanitizedKeyword}"`);
      
      const timestamp = Date.now().toString();
      const method = 'GET';
      const uri = '/keywordstool';
      const signature = this.generateSignature(timestamp, method, uri);

      const response = await axios.get(`${this.baseUrl}${uri}`, {
        params: {
          hintKeywords: sanitizedKeyword,
          showDetail: 1,
        },
        headers: {
          'X-Timestamp': timestamp,
          'X-API-KEY': this.accessLicense,
          'X-Customer': this.customerId,
          'X-Signature': signature,
        },
        timeout: 10000,
      });

      if (response.data && response.data.keywordList) {
        return response.data.keywordList.slice(0, limit);
      }

      return [];
    } catch (error) {
      console.error('Naver Search Ad API Error (Related Keywords):', error);
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
