import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertKeywordSchema, insertUserSchema } from "@shared/schema";
import { NaverAPIClient } from "./naver-client";
import { SmartBlockParser } from "./smartblock-parser";
import { NaverHTMLParser } from "./html-parser";
import { NaverSearchAdClient } from "./naver-searchad-client";
import { NaverSearchClient } from "./naver-search-client";
import passport from "./auth";
import bcrypt from "bcrypt";
import axios from 'axios';
import * as cheerio from 'cheerio';

const naverClient = new NaverAPIClient();
const smartBlockParser = new SmartBlockParser();
const htmlParser = new NaverHTMLParser();
const naverSearchAdClient = new NaverSearchAdClient();
const naverSearchClient = new NaverSearchClient();

// Authentication middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "로그인이 필요합니다" });
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated() && (req.user as any).role === "admin") {
    return next();
  }
  res.status(403).json({ error: "관리자 권한이 필요합니다" });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post('/api/register', async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ 
          error: '아이디와 비밀번호를 입력해주세요'
        });
      }

      // Validate username and password
      if (username.length < 3 || username.length > 20) {
        return res.status(400).json({ error: '아이디는 3-20자 사이여야 합니다' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: '비밀번호는 최소 6자 이상이어야 합니다' });
      }

      // Check if username already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: '이미 사용 중인 아이디입니다' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user (ALWAYS as regular user, never trust client-provided role)
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        role: 'user', // Force user role, admin must be created manually
      });

      // Auto-login after registration
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ error: '로그인 중 오류가 발생했습니다' });
        }
        res.status(201).json({
          id: user.id,
          username: user.username,
          role: user.role,
        });
      });
    } catch (error) {
      console.error('회원가입 오류:', error);
      res.status(500).json({ error: '회원가입 중 오류가 발생했습니다' });
    }
  });

  app.post('/api/login', (req, res, next) => {
    passport.authenticate('local', (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ error: '로그인 중 오류가 발생했습니다' });
      }
      if (!user) {
        return res.status(401).json({ error: info?.message || '로그인 실패' });
      }
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ error: '로그인 중 오류가 발생했습니다' });
        }
        res.json({
          id: user.id,
          username: user.username,
          role: user.role,
        });
      });
    })(req, res, next);
  });

  app.post('/api/logout', (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: '로그아웃 중 오류가 발생했습니다' });
      }
      res.json({ success: true });
    });
  });

  app.get('/api/user', (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: '로그인이 필요합니다' });
    }
    const user = req.user as any;
    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
    });
  });

  app.get('/api/users', requireAdmin, async (_req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users.map(u => ({
        id: u.id,
        username: u.username,
        role: u.role,
        createdAt: u.createdAt,
      })));
    } catch (error) {
      console.error('사용자 목록 조회 오류:', error);
      res.status(500).json({ error: '사용자 목록 조회 중 오류가 발생했습니다' });
    }
  });

  // Keyword routes (protected)
  app.get('/api/keywords', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      // Admin can see all keywords, regular users only see their own
      const keywords = user.role === 'admin' 
        ? await storage.getKeywords()
        : await storage.getKeywordsByUser(user.id);
      const latestMeasurements = await storage.getLatestMeasurements();
      const previousMeasurements = await storage.getPreviousMeasurements();

      const keywordsWithRank = keywords.map(keyword => {
        const measurement = latestMeasurements.get(keyword.id);
        const previousMeasurement = previousMeasurements.get(keyword.id);
        
        const currentRank = measurement?.rankSmartblock ?? null;
        const previousRank = previousMeasurement?.rankSmartblock ?? null;
        
        let change = 0;
        if (currentRank !== null && previousRank !== null) {
          change = previousRank - currentRank;
        }
        
        let smartblockCategories = null;
        if (measurement?.smartblockDetails) {
          try {
            smartblockCategories = JSON.parse(measurement.smartblockDetails);
          } catch (e) {
            console.error('Failed to parse smartblockDetails:', e);
          }
        }
        
        return {
          id: keyword.id.toString(),
          keyword: keyword.keyword,
          targetUrl: keyword.targetUrl,
          rank: currentRank,
          change,
          smartblockStatus: measurement?.smartblockStatus ?? 'pending',
          smartblockCategories,
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

  app.post('/api/keywords', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const result = insertKeywordSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ 
          error: '입력값이 올바르지 않습니다',
          details: result.error.errors 
        });
      }

      // Automatically assign userId
      const keyword = await storage.createKeyword({
        ...result.data,
        userId: user.id,
      });
      res.status(201).json(keyword);
    } catch (error) {
      console.error('키워드 생성 오류:', error);
      res.status(500).json({ error: '키워드 생성 중 오류가 발생했습니다' });
    }
  });

  app.delete('/api/keywords/:id', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const id = parseInt(req.params.id);
      
      // Check ownership
      const keyword = await storage.getKeyword(id);
      if (!keyword) {
        return res.status(404).json({ error: '키워드를 찾을 수 없습니다' });
      }

      // Admin can delete any keyword, users can only delete their own
      if (user.role !== 'admin' && keyword.userId !== user.id) {
        return res.status(403).json({ error: '권한이 없습니다' });
      }

      const deleted = await storage.deleteKeyword(id);
      res.json({ success: deleted });
    } catch (error) {
      console.error('키워드 삭제 오류:', error);
      res.status(500).json({ error: '키워드 삭제 중 오류가 발생했습니다' });
    }
  });

  app.post('/api/measure/:id', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const keywordId = parseInt(req.params.id);
      const method = (req.query.method as string) || 'html-parser';
      const keyword = await storage.getKeyword(keywordId);

      if (!keyword) {
        return res.status(404).json({ error: '키워드를 찾을 수 없습니다' });
      }

      // Check ownership
      if (user.role !== 'admin' && keyword.userId !== user.id) {
        return res.status(403).json({ error: '권한이 없습니다' });
      }

      const startTime = Date.now();

      try {
        let blogResults = [];
        let searchMethod = method;
        let categories: any[] = [];

        if (method === 'html-parser') {
          const htmlResult = await htmlParser.searchNaver(keyword.keyword);
          blogResults = htmlResult.blogResults;
          categories = htmlResult.categories;
          searchMethod = 'html-parser';
        } else {
          const searchResult = await naverClient.searchNaver(keyword.keyword);
          blogResults = searchResult.blogResults;
          searchMethod = 'serpapi';
        }
        
        if (blogResults.length === 0 && categories.length === 0) {
          const measurement = await storage.createMeasurement({
            keywordId: keyword.id,
            measuredAt: new Date(),
            rankSmartblock: null,
            smartblockStatus: 'BLOCK_MISSING',
            smartblockConfidence: '0',
            smartblockDetails: JSON.stringify([{
              categoryName: '스마트블록 없음',
              rank: null,
              totalBlogs: 0,
              status: 'BLOCK_MISSING',
              confidence: '0',
              topBlogs: [],
              message: '해당 키워드로 스마트블록을 찾을 수 없습니다.'
            }]),
            durationMs: Date.now() - startTime,
            method: searchMethod,
          });

          return res.json({ ...measurement, method: searchMethod });
        }

        const rankResult = smartBlockParser.findRank(
          keyword.targetUrl,
          blogResults
        );

        const detailedCategories = categories.length > 0 
          ? categories.map(category => {
              const categoryRankResult = smartBlockParser.findRank(
                keyword.targetUrl,
                category.blogs
              );
              return {
                categoryName: category.categoryName,
                rank: categoryRankResult.rank,
                totalBlogs: category.totalBlogs,
                status: categoryRankResult.rank ? 'FOUND' : 'NOT_FOUND',
                confidence: categoryRankResult.confidence.toFixed(2),
                topBlogs: category.blogs.slice(0, 3).map((b: any) => ({
                  url: b.url,
                  title: b.title,
                })),
                message: categoryRankResult.rank 
                  ? `${category.categoryName}에서 ${categoryRankResult.rank}위 발견`
                  : `${category.categoryName}에서 내 블로그를 찾을 수 없음 (상위 ${category.totalBlogs}개 중)`
              };
            })
          : [{
              categoryName: '전체 검색 결과',
              rank: rankResult.rank,
              totalBlogs: blogResults.length,
              status: rankResult.rank ? 'FOUND' : 'NOT_FOUND',
              confidence: rankResult.confidence.toFixed(2),
              topBlogs: blogResults.slice(0, 3).map((b: any) => ({
                url: b.url,
                title: b.title,
              })),
              message: rankResult.rank 
                ? `전체 검색 결과에서 ${rankResult.rank}위 발견`
                : `전체 검색 결과 ${blogResults.length}개 중 내 블로그를 찾을 수 없음`
            }];

        const measurement = await storage.createMeasurement({
          keywordId: keyword.id,
          measuredAt: new Date(),
          rankSmartblock: rankResult.rank,
          smartblockStatus: rankResult.rank ? 'OK' : 'NOT_IN_BLOCK',
          smartblockConfidence: rankResult.confidence.toFixed(2),
          smartblockDetails: detailedCategories.length > 0 ? JSON.stringify(detailedCategories) : null,
          durationMs: Date.now() - startTime,
          method: searchMethod,
        });

        res.json({ 
          ...measurement, 
          method: searchMethod,
          smartblockCategories: detailedCategories,
          debug: {
            totalBlogsFound: blogResults.length,
            topBlogs: blogResults.slice(0, 3).map(b => ({
              url: b.url,
              title: b.title,
            })),
          }
        });
      } catch (error) {
        const measurement = await storage.createMeasurement({
          keywordId: keyword.id,
          measuredAt: new Date(),
          rankSmartblock: null,
          smartblockStatus: 'ERROR',
          smartblockConfidence: '0',
          errorMessage: error instanceof Error ? error.message : '알 수 없는 오류',
          durationMs: Date.now() - startTime,
          method: method,
        });

        res.json({ ...measurement, method: method, error: error instanceof Error ? error.message : '알 수 없는 오류' });
      }
    } catch (error) {
      console.error('측정 오류:', error);
      res.status(500).json({ error: '측정 중 오류가 발생했습니다' });
    }
  });

  app.get('/api/measurements/:keywordId', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const keywordId = parseInt(req.params.keywordId);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 30;
      
      // Check ownership
      const keyword = await storage.getKeyword(keywordId);
      if (!keyword) {
        return res.status(404).json({ error: '키워드를 찾을 수 없습니다' });
      }
      
      if (user.role !== 'admin' && keyword.userId !== user.id) {
        return res.status(403).json({ error: '권한이 없습니다' });
      }
      
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

  app.get('/api/keywords/:id/stats', async (req, res) => {
    try {
      const keywordId = parseInt(req.params.id);
      const keyword = await storage.getKeyword(keywordId);

      if (!keyword) {
        return res.status(404).json({ error: '키워드를 찾을 수 없습니다' });
      }

      const stats = await naverSearchAdClient.getKeywordStats(keyword.keyword);
      const relatedKeywords = await naverSearchAdClient.getRelatedKeywords(keyword.keyword, 10);

      res.json({
        keyword: keyword.keyword,
        stats,
        relatedKeywords,
      });
    } catch (error) {
      console.error('키워드 통계 조회 오류:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : '키워드 통계 조회 중 오류가 발생했습니다'
      });
    }
  });

  app.get('/api/keywords/:id/blogs', async (req, res) => {
    try {
      const keywordId = parseInt(req.params.id);
      const keyword = await storage.getKeyword(keywordId);

      if (!keyword) {
        return res.status(404).json({ error: '키워드를 찾을 수 없습니다' });
      }

      const display = req.query.display ? parseInt(req.query.display as string) : 10;
      const start = req.query.start ? parseInt(req.query.start as string) : 1;

      const blogResults = await naverSearchClient.searchBlogs(keyword.keyword, display, start);

      res.json({
        keyword: keyword.keyword,
        ...blogResults,
      });
    } catch (error) {
      console.error('블로그 검색 오류:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : '블로그 검색 중 오류가 발생했습니다'
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
