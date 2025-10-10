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

  // Admin dashboard routes
  app.get('/api/admin/users-stats', requireAdmin, async (_req, res) => {
    try {
      const stats = await storage.getUsersWithStats();
      res.json(stats);
    } catch (error) {
      console.error('사용자 통계 조회 오류:', error);
      res.status(500).json({ error: '사용자 통계 조회 중 오류가 발생했습니다' });
    }
  });

  app.get('/api/admin/users/:userId/activities', requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
      }
      
      const keywords = await storage.getKeywordsByUser(userId);
      const measurements = await storage.getMeasurementsByUser(userId, limit);
      
      res.json({
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
        keywords,
        measurements,
      });
    } catch (error) {
      console.error('사용자 활동 조회 오류:', error);
      res.status(500).json({ error: '사용자 활동 조회 중 오류가 발생했습니다' });
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
        
        const searchVolume = measurement?.searchVolumeAvg 
          ? parseInt(measurement.searchVolumeAvg) 
          : null;

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
          searchVolume,
          measurementInterval: keyword.measurementInterval || '24h',
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

        // Helper function to parse search volume (can be string like "< 10" or number)
        const parseSearchVolume = (value: string | number): number => {
          if (typeof value === 'number') return value;
          if (typeof value === 'string') {
            // Handle "< 10" format - return 5 as estimate
            if (value.includes('<')) return 5;
            // Handle "> 1000000" format - return 1000000 as estimate
            if (value.includes('>')) return parseInt(value.replace(/[^0-9]/g, '')) || 1000000;
            // Try to parse as number
            const parsed = parseInt(value.replace(/,/g, ''));
            return isNaN(parsed) ? 0 : parsed;
          }
          return 0;
        };

        // Fetch search volume from Naver Search Ad API
        let searchVolumeStr: string | null = null;
        try {
          const keywordStats = await naverSearchAdClient.getKeywordStats(keyword.keyword);
          if (keywordStats) {
            // Calculate average monthly search volume (PC + Mobile)
            const pcVolume = parseSearchVolume(keywordStats.monthlyPcQcCnt);
            const mobileVolume = parseSearchVolume(keywordStats.monthlyMobileQcCnt);
            const avgVolume = Math.round((pcVolume + mobileVolume) / 2);
            searchVolumeStr = avgVolume.toString();
            console.log(`[Search Volume] ${keyword.keyword}: ${avgVolume}`);
          }
        } catch (volumeError) {
          console.error('[Search Volume Error]', volumeError);
          // Don't fail the entire measurement if search volume fetch fails
        }

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
            searchVolumeAvg: searchVolumeStr,
            durationMs: Date.now() - startTime,
            method: searchMethod,
          });

          return res.json({ ...measurement, method: searchMethod });
        }

        const rankResult = smartBlockParser.findRank(
          keyword.targetUrl,
          blogResults
        );

        // Phase 1: 통합검색 이탈 감지 - rank가 있지만 CSS로 숨겨진 경우 체크
        let isVisibleInSearch: boolean | undefined = undefined;
        let hiddenReason: string | undefined = undefined;
        let smartblockStatus = rankResult.rank ? 'OK' : 'NOT_IN_BLOCK';

        if (rankResult.rank && rankResult.matchedUrl) {
          // 매칭된 블로그의 visibility 정보 찾기
          const matchedBlog = blogResults.find((b: any) => 
            smartBlockParser.normalizeUrl(b.url) === smartBlockParser.normalizeUrl(rankResult.matchedUrl)
          );

          if (matchedBlog) {
            isVisibleInSearch = matchedBlog.isVisible;
            hiddenReason = matchedBlog.hiddenReason;

            // 순위는 있지만 실제로는 숨겨진 경우 (통합검색 이탈)
            if (matchedBlog.isVisible === false) {
              smartblockStatus = 'RANKED_BUT_HIDDEN';
              console.log(`⚠️ 통합검색 이탈 감지! Keyword #${keyword.id}: rank=${rankResult.rank}, hidden_reason=${hiddenReason}`);
            }
          }
        }

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
          smartblockStatus,
          smartblockConfidence: rankResult.confidence.toFixed(2),
          smartblockDetails: detailedCategories.length > 0 ? JSON.stringify(detailedCategories) : null,
          isVisibleInSearch,
          hiddenReason,
          searchVolumeAvg: searchVolumeStr,
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
          searchVolumeAvg: null,
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

  // Manual trigger for scheduled measurements (admin only, for testing)
  app.post('/api/scheduler/trigger/:interval', requireAdmin, async (req, res) => {
    try {
      const { interval } = req.params;
      const validIntervals = ['1h', '6h', '12h', '24h'];
      
      if (!validIntervals.includes(interval)) {
        return res.status(400).json({ 
          error: `Invalid interval. Must be one of: ${validIntervals.join(', ')}` 
        });
      }

      const scheduler = req.app.locals.scheduler;
      if (!scheduler) {
        return res.status(500).json({ error: 'Scheduler not initialized' });
      }

      // Trigger measurements asynchronously
      scheduler.triggerInterval(interval).catch((error: Error) => {
        console.error(`Error in manual trigger for ${interval}:`, error);
      });

      res.json({ 
        message: `Triggering measurements for ${interval} interval`,
        interval 
      });
    } catch (error) {
      console.error('Scheduler trigger error:', error);
      res.status(500).json({ error: '스케줄러 트리거 중 오류가 발생했습니다' });
    }
  });

  // Get scheduler status (admin only)
  app.get('/api/scheduler/status', requireAdmin, async (req, res) => {
    try {
      const scheduler = req.app.locals.scheduler;
      if (!scheduler) {
        return res.status(500).json({ error: 'Scheduler not initialized' });
      }

      const status = scheduler.getStatus();
      res.json(status);
    } catch (error) {
      console.error('Scheduler status error:', error);
      res.status(500).json({ error: '스케줄러 상태 조회 중 오류가 발생했습니다' });
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

      console.log('[키워드 통계] 요청:', keyword.keyword);
      const stats = await naverSearchAdClient.getKeywordStats(keyword.keyword);
      const relatedKeywords = await naverSearchAdClient.getRelatedKeywords(keyword.keyword, 10);

      console.log('[키워드 통계] 응답:', {
        keyword: keyword.keyword,
        stats: stats ? {
          monthlyPcQcCnt: stats.monthlyPcQcCnt,
          monthlyMobileQcCnt: stats.monthlyMobileQcCnt,
          compIdx: stats.compIdx,
        } : null,
        relatedKeywordsCount: relatedKeywords.length,
      });

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
