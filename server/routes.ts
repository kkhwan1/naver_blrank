import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import axios from 'axios';
import * as cheerio from 'cheerio';

export async function registerRoutes(app: Express): Promise<Server> {
  // URL 분석 API
  app.post('/api/analyze', async (req, res) => {
    try {
      const { url } = req.body;

      if (!url) {
        return res.status(400).json({ error: 'URL이 필요합니다' });
      }

      // URL에서 HTML 가져오기
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 10000,
      });

      const html = response.data;
      const $ = cheerio.load(html);

      // 제목 추출
      const title = $('title').text() || $('h1').first().text() || '제목 없음';

      // 메타 키워드 추출
      const metaKeywords = $('meta[name="keywords"]').attr('content') || '';
      const keywords: string[] = metaKeywords
        .split(',')
        .map((k: string) => k.trim())
        .filter((k: string) => k.length > 0)
        .slice(0, 20);

      // 본문 텍스트 추출
      $('script, style, nav, footer, header').remove();
      const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

      // 추가 키워드 추출 (본문에서)
      if (keywords.length === 0) {
        const words = bodyText
          .split(/\s+/)
          .filter((word: string) => word.length > 2 && word.length < 20)
          .slice(0, 30);
        keywords.push(...Array.from(new Set(words)));
      }

      // 네이버 링크 찾기
      const naverLinks: string[] = [];
      $('a[href]').each((_: number, element: cheerio.Element) => {
        const href = $(element).attr('href');
        if (href && (
          href.includes('naver.com') ||
          href.includes('blog.naver') ||
          href.includes('cafe.naver')
        )) {
          naverLinks.push(href);
        }
      });

      // 모든 링크 수 계산
      const linkCount = $('a[href]').length;
      const wordCount = bodyText.split(/\s+/).length;

      const result = {
        url,
        title,
        keywords: keywords.slice(0, 15),
        naverLinks: Array.from(new Set(naverLinks)),
        content: bodyText.substring(0, 1000),
        metadata: {
          wordCount,
          linkCount,
        },
      };

      res.json(result);
    } catch (error) {
      console.error('분석 오류:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : '분석 중 오류가 발생했습니다'
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
