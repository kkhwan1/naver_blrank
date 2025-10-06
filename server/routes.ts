import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertKeywordSchema } from "@shared/schema";
import { NaverAPIClient } from "./naver-client";
import { SmartBlockParser } from "./smartblock-parser";
import axios from 'axios';
import * as cheerio from 'cheerio';

const naverClient = new NaverAPIClient();
const smartBlockParser = new SmartBlockParser();

export async function registerRoutes(app: Express): Promise<Server> {
  app.get('/api/keywords', async (_req, res) => {
    try {
      const keywords = await storage.getKeywords();
      const latestMeasurements = await storage.getLatestMeasurements();

      const keywordsWithRank = keywords.map(keyword => {
        const measurement = latestMeasurements.get(keyword.id);
        return {
          id: keyword.id.toString(),
          keyword: keyword.keyword,
          targetUrl: keyword.targetUrl,
          rank: measurement?.rankSmartblock ?? null,
          smartblockStatus: measurement?.smartblockStatus ?? 'pending',
          lastMeasured: measurement?.measuredAt 
            ? new Date(measurement.measuredAt).toISOString() 
            : null,
          createdAt: keyword.createdAt,
          isActive: keyword.isActive,
        };
      });

      res.json(keywordsWithRank);
    } catch (error) {
      console.error('키워드 조회 오류:', error);
      res.status(500).json({ error: '키워드 조회 중 오류가 발생했습니다' });
    }
  });

  app.post('/api/keywords', async (req, res) => {
    try {
      const result = insertKeywordSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ 
          error: '입력값이 올바르지 않습니다',
          details: result.error.errors 
        });
      }

      const keyword = await storage.createKeyword(result.data);
      res.status(201).json(keyword);
    } catch (error) {
      console.error('키워드 생성 오류:', error);
      res.status(500).json({ error: '키워드 생성 중 오류가 발생했습니다' });
    }
  });

  app.delete('/api/keywords/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteKeyword(id);
      
      if (!deleted) {
        return res.status(404).json({ error: '키워드를 찾을 수 없습니다' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('키워드 삭제 오류:', error);
      res.status(500).json({ error: '키워드 삭제 중 오류가 발생했습니다' });
    }
  });

  app.post('/api/measure/:id', async (req, res) => {
    try {
      const keywordId = parseInt(req.params.id);
      const keyword = await storage.getKeyword(keywordId);

      if (!keyword) {
        return res.status(404).json({ error: '키워드를 찾을 수 없습니다' });
      }

      const startTime = Date.now();

      try {
        const searchResult = await naverClient.searchNaver(keyword.keyword);
        
        const detection = smartBlockParser.detectSmartBlock(searchResult.html);
        
        if (detection.status === 'not_found') {
          const measurement = await storage.createMeasurement({
            keywordId: keyword.id,
            measuredAt: new Date(),
            rankSmartblock: null,
            smartblockStatus: 'BLOCK_MISSING',
            smartblockConfidence: '0',
            durationMs: Date.now() - startTime,
          });

          return res.json(measurement);
        }

        const rankResult = smartBlockParser.findRank(
          keyword.targetUrl,
          detection.blogCards
        );

        const measurement = await storage.createMeasurement({
          keywordId: keyword.id,
          measuredAt: new Date(),
          rankSmartblock: rankResult.rank,
          smartblockStatus: rankResult.rank ? 'OK' : 'NOT_IN_BLOCK',
          smartblockConfidence: rankResult.confidence.toFixed(2),
          durationMs: Date.now() - startTime,
        });

        res.json(measurement);
      } catch (error) {
        const measurement = await storage.createMeasurement({
          keywordId: keyword.id,
          measuredAt: new Date(),
          rankSmartblock: null,
          smartblockStatus: 'ERROR',
          smartblockConfidence: '0',
          errorMessage: error instanceof Error ? error.message : '알 수 없는 오류',
          durationMs: Date.now() - startTime,
        });

        res.json(measurement);
      }
    } catch (error) {
      console.error('측정 오류:', error);
      res.status(500).json({ error: '측정 중 오류가 발생했습니다' });
    }
  });

  app.get('/api/measurements/:keywordId', async (req, res) => {
    try {
      const keywordId = parseInt(req.params.keywordId);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 30;
      
      const measurements = await storage.getMeasurements(keywordId, limit);
      res.json(measurements);
    } catch (error) {
      console.error('측정 결과 조회 오류:', error);
      res.status(500).json({ error: '측정 결과 조회 중 오류가 발생했습니다' });
    }
  });

  app.post('/api/analyze', async (req, res) => {
    try {
      const { url } = req.body;

      if (!url) {
        return res.status(400).json({ error: 'URL이 필요합니다' });
      }

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 10000,
      });

      const html = response.data;
      const $ = cheerio.load(html);

      const title = $('title').text() || $('h1').first().text() || '제목 없음';

      const metaKeywords = $('meta[name="keywords"]').attr('content') || '';
      const keywords: string[] = metaKeywords
        .split(',')
        .map((k: string) => k.trim())
        .filter((k: string) => k.length > 0)
        .slice(0, 20);

      $('script, style, nav, footer, header').remove();
      const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

      if (keywords.length === 0) {
        const words = bodyText
          .split(/\s+/)
          .filter((word: string) => word.length > 2 && word.length < 20)
          .slice(0, 30);
        keywords.push(...Array.from(new Set(words)));
      }

      const naverLinks: string[] = [];
      $('a[href]').each((_: number, element: any) => {
        const href = $(element).attr('href');
        if (href && (
          href.includes('naver.com') ||
          href.includes('blog.naver') ||
          href.includes('cafe.naver')
        )) {
          naverLinks.push(href);
        }
      });

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
