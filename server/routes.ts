import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertKeywordSchema, insertUserSchema, insertGroupSchema, insertKeywordGroupSchema, insertUserSettingsSchema, insertKeywordAlertSchema } from "@shared/schema";
import { NaverAPIClient } from "./naver-client";
import { SmartBlockParser } from "./smartblock-parser";
import { NaverHTMLParser } from "./html-parser";
import { NaverSearchAdClient } from "./naver-searchad-client";
import { NaverSearchClient } from "./naver-search-client";
import { hiddenReasonClassifier } from "./hidden-reason-classifier";
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
// TEMPORARY: Auto-login as admin@gmail.com for testing
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  
  // Auto-login as admin@gmail.com
  try {
    const adminUser = await storage.getUserByUsername('admin@gmail.com');
    if (adminUser) {
      req.login(adminUser, (err) => {
        if (err) {
          return res.status(401).json({ error: "로그인이 필요합니다" });
        }
        return next();
      });
    } else {
      res.status(401).json({ error: "로그인이 필요합니다" });
    }
  } catch (error) {
    res.status(401).json({ error: "로그인이 필요합니다" });
  }
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

  // 개발 환경 전용: 테스트용 자동 로그인 엔드포인트
  if (process.env.NODE_ENV === 'development') {
    app.post('/api/auto-login', async (req, res) => {
      try {
        const username = req.body.username || 'admin@gmail.com';
        const user = await storage.getUserByUsername(username);
        
        if (!user) {
          return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
        }

        req.login(user, (err) => {
          if (err) {
            return res.status(500).json({ error: '자동 로그인 실패' });
          }
          res.json({
            id: user.id,
            username: user.username,
            role: user.role,
          });
        });
      } catch (error) {
        console.error('자동 로그인 오류:', error);
        res.status(500).json({ error: '자동 로그인 중 오류가 발생했습니다' });
      }
    });
  }

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
          documentCount: keyword.documentCount,
          competitionRate: keyword.competitionRate,
          createdAt: keyword.createdAt,
          isActive: keyword.isActive,
          latestMeasurement: measurement || null,
          previousMeasurement: previousMeasurement || null,
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

        // Phase 1 & 2: 통합검색 이탈 감지 및 분류
        let isVisibleInSearch: boolean | undefined = undefined;
        let hiddenReason: string | undefined = undefined;
        let hiddenReasonCategory: string | undefined = undefined;
        let hiddenReasonDetail: string | undefined = undefined;
        let detectionMethod: string | undefined = undefined;
        let recoveryEstimate: string | undefined = undefined;
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
            if (matchedBlog.isVisible === false && hiddenReason) {
              smartblockStatus = 'RANKED_BUT_HIDDEN';
              
              // Phase 2: 숨김 이유 분류
              const classification = hiddenReasonClassifier.classify(hiddenReason, 'css_check');
              hiddenReasonCategory = classification.category;
              hiddenReasonDetail = classification.detail;
              detectionMethod = classification.detectionMethod;
              recoveryEstimate = classification.recoveryEstimate;
              
              console.log(`⚠️ 통합검색 이탈 감지! Keyword #${keyword.id}: rank=${rankResult.rank}`);
              console.log(`   기술적 원인: ${hiddenReason}`);
              console.log(`   분류: ${classification.category} (${classification.severity})`);
              console.log(`   예상 복구: ${classification.recoveryEstimate}`);
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
                  blogName: b.blogName,
                  author: b.author,
                  publishedDate: b.publishedDate,
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
                blogName: b.blogName,
                author: b.author,
                publishedDate: b.publishedDate,
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
          hiddenReasonCategory,      // Phase 2
          hiddenReasonDetail,         // Phase 2
          detectionMethod,            // Phase 2
          recoveryEstimate,           // Phase 2
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
              blogName: b.blogName,
              author: b.author,
              publishedDate: b.publishedDate,
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

  app.get('/api/rank-trend', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const days = req.query.days ? parseInt(req.query.days as string) : 7;
      
      const trendData = await storage.getAggregatedRankTrend(user.id, days);
      
      const formattedData = trendData.map(d => ({
        date: new Date(d.date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }),
        rank: Math.round(d.avgRank * 10) / 10,
        count: d.count,
      }));
      
      res.json(formattedData);
    } catch (error) {
      console.error('순위 트렌드 조회 오류:', error);
      res.status(500).json({ error: '순위 트렌드 조회 중 오류가 발생했습니다' });
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

  /**
   * 연관검색어 및 추천검색어 조회 (스마트블록 기반 + 중복 제거 + 캐싱)
   * 
   * 데이터 소스:
   * 1. 연관키워드 (네이버 광고 API) - 제외용으로만 사용
   * 2. 연관검색어 (스마트블록 블로그 제목 분석)
   * 3. 추천검색어 (수식어 조합 + 네이버 검색 API 검증)
   * 
   * 중복 제거 순서:
   * - 광고 API 연관키워드 → 연관검색어에서 제외
   * - 연관검색어 → 추천검색어에서 제외
   * 
   * 캐싱:
   * - 기본적으로 DB에 저장된 최근 분석 결과 반환
   * - force=true 쿼리 파라미터로 강제 재분석 가능
   */
  app.get('/api/keywords/:id/related-keywords', requireAuth, async (req, res) => {
    try {
      const keywordId = parseInt(req.params.id);
      const keyword = await storage.getKeyword(keywordId);
      const force = req.query.force === 'true';

      if (!keyword) {
        return res.status(404).json({ error: '키워드를 찾을 수 없습니다' });
      }

      console.log(`\n[추천키워드 통합] 키워드: "${keyword.keyword}" (force: ${force})`);

      // 캐시된 결과 확인 (force가 아닐 때만)
      if (!force) {
        const cached = await storage.getKeywordRecommendation(keywordId);
        if (cached) {
          const data = cached.recommendations as any;
          console.log(`  ✓ 캐시된 결과 사용 (분석 시각: ${cached.analyzedAt.toISOString()})`);
          return res.json({
            keyword: keyword.keyword,
            related: data.related || [],
            recommended: data.recommended || [],
            total: (data.related?.length || 0) + (data.recommended?.length || 0),
            analyzedAt: cached.analyzedAt,
            cached: true,
          });
        }
      }

      // 새로 분석
      console.log(`  🔄 새로운 분석 시작...`);

      // ① 네이버 광고 API에서 연관키워드 가져오기 (중복 제거용)
      let adApiKeywords: string[] = [];
      try {
        const adRelatedKeywords = await naverSearchAdClient.getRelatedKeywords(keyword.keyword, 20);
        adApiKeywords = adRelatedKeywords.map(k => k.relKeyword.toLowerCase());
        console.log(`  ✓ 광고 API 연관키워드: ${adApiKeywords.length}개`);
      } catch (error) {
        console.log(`  ⚠️ 광고 API 조회 실패 (계속 진행)`);
      }

      // ② 스마트블록 기반 연관검색어 + 추천검색어 가져오기
      const htmlParser = new NaverHTMLParser();
      const allKeywords = await htmlParser.extractRelatedKeywords(keyword.keyword);

      // ③ 타입별로 분리
      let related = allKeywords.filter(k => k.type === 'related');
      let recommended = allKeywords.filter(k => k.type === 'recommended');

      // ④ 중복 제거: 광고 API 연관키워드 제외
      const adKeywordSet = new Set(adApiKeywords);
      
      related = related.filter(k => 
        !adKeywordSet.has(k.keyword.toLowerCase())
      );
      
      recommended = recommended.filter(k => 
        !adKeywordSet.has(k.keyword.toLowerCase())
      );

      // ⑤ 연관검색어 → 추천검색어 중복 제거 (이미 html-parser에서 처리됨)
      
      console.log(`\n📊 최종 결과:`);
      console.log(`  - 연관검색어: ${related.length}개 (광고 API 중복 제거 완료)`);
      console.log(`  - 추천검색어: ${recommended.length}개 (전체 중복 제거 완료)`);
      console.log(`  - 총 ${related.length + recommended.length}개 키워드\n`);

      // ⑥ 결과를 DB에 저장
      const saved = await storage.saveKeywordRecommendation({
        keywordId,
        recommendations: { related, recommended },
      });
      console.log(`  ✓ 분석 결과 저장 완료 (ID: ${saved.id})`);

      res.json({
        keyword: keyword.keyword,
        related,
        recommended,
        total: related.length + recommended.length,
        analyzedAt: saved.analyzedAt,
        cached: false,
      });

    } catch (error) {
      console.error('추천키워드 조회 오류:', error);
      res.status(500).json({ 
        error: '추천키워드 조회 중 오류가 발생했습니다',
        related: [],
        recommended: [],
        total: 0
      });
    }
  });

  /**
   * 네이버 통합검색 블로그 탭 조회 및 타겟 블로그 순위 찾기
   */
  app.get('/api/keywords/:id/unified-search', requireAuth, async (req, res) => {
    try {
      const keywordId = parseInt(req.params.id);
      const keyword = await storage.getKeyword(keywordId);

      if (!keyword) {
        return res.status(404).json({ error: '키워드를 찾을 수 없습니다' });
      }

      console.log(`[통합검색] 키워드: "${keyword.keyword}", 타겟 URL: "${keyword.targetUrl}"`);

      const htmlParser = new NaverHTMLParser();
      const result = await htmlParser.searchUnifiedBlog(keyword.keyword, keyword.targetUrl);

      res.json({
        keyword: keyword.keyword,
        targetUrl: keyword.targetUrl,
        targetRank: result.targetRank,
        blogs: result.blogs,
        totalResults: result.totalResults,
      });
    } catch (error) {
      console.error('통합검색 조회 오류:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : '통합검색 조회 중 오류가 발생했습니다'
      });
    }
  });

  /**
   * 문서수 조회 및 경쟁률 계산 API
   * 
   * 경쟁률 계산 공식:
   * - 경쟁률 = 네이버 검색 문서수 / 월간 총 검색량
   * - 문서수: 네이버 Search API에서 조회한 total 값
   * - 월간 총 검색량: PC 검색량 + 모바일 검색량 (Naver Search Ad API)
   * 
   * 경쟁률 해석:
   * - 낮을수록 경쟁이 적고, 높을수록 경쟁이 치열함
   * - 예: 경쟁률 100 = 검색량 대비 문서가 100배 많음 (치열)
   * - 예: 경쟁률 0.1 = 검색량 대비 문서가 적음 (기회)
   */
  app.post('/api/keywords/:id/update-competition', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const keywordId = parseInt(req.params.id);
      const keyword = await storage.getKeyword(keywordId);

      if (!keyword) {
        return res.status(404).json({ error: '키워드를 찾을 수 없습니다' });
      }

      // Check ownership
      if (user.role !== 'admin' && keyword.userId !== user.id) {
        return res.status(403).json({ error: '권한이 없습니다' });
      }

      console.log(`[경쟁률 계산] 시작: ${keyword.keyword}`);

      // 1. 네이버 Search API로 문서수 조회
      const blogResults = await naverSearchClient.searchBlogs(keyword.keyword, 1, 1);
      const documentCount = blogResults.total;
      console.log(`[경쟁률 계산] 문서수: ${documentCount.toLocaleString()}개`);

      // 2. 네이버 Search Ad API로 월간 검색량 조회
      const stats = await naverSearchAdClient.getKeywordStats(keyword.keyword);
      
      let competitionRate = null;
      let monthlySearchVolume = null;

      if (stats) {
        // 월간 총 검색량 = PC + Mobile
        const pcQcCnt = typeof stats.monthlyPcQcCnt === 'string' ? parseInt(stats.monthlyPcQcCnt) : stats.monthlyPcQcCnt;
        const mobileQcCnt = typeof stats.monthlyMobileQcCnt === 'string' ? parseInt(stats.monthlyMobileQcCnt) : stats.monthlyMobileQcCnt;
        monthlySearchVolume = (pcQcCnt || 0) + (mobileQcCnt || 0);
        console.log(`[경쟁률 계산] 월간 검색량: ${monthlySearchVolume.toLocaleString()}회 (PC: ${stats.monthlyPcQcCnt}, Mobile: ${stats.monthlyMobileQcCnt})`);

        // 경쟁률 = 문서수 / 월간검색량
        if (monthlySearchVolume > 0) {
          competitionRate = documentCount / monthlySearchVolume;
          console.log(`[경쟁률 계산] 경쟁률: ${competitionRate.toFixed(2)} (문서수 ${documentCount.toLocaleString()} / 검색량 ${monthlySearchVolume.toLocaleString()})`);
        } else {
          console.log(`[경쟁률 계산] 검색량이 0이므로 경쟁률 계산 불가`);
        }
      } else {
        console.log(`[경쟁률 계산] 검색광고 API에서 통계를 가져올 수 없음`);
      }

      // 3. DB 업데이트
      await storage.updateKeywordCompetition(keywordId, documentCount, competitionRate ? competitionRate.toString() : null);
      console.log(`[경쟁률 계산] DB 업데이트 완료`);

      res.json({
        keyword: keyword.keyword,
        documentCount,
        monthlySearchVolume,
        competitionRate: competitionRate ? parseFloat(competitionRate.toFixed(2)) : null,
        interpretation: competitionRate 
          ? competitionRate < 1 
            ? '경쟁 낮음 - 기회' 
            : competitionRate < 10 
              ? '경쟁 보통' 
              : '경쟁 치열'
          : '데이터 부족',
      });
    } catch (error) {
      console.error('경쟁률 계산 오류:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : '경쟁률 계산 중 오류가 발생했습니다'
      });
    }
  });

  // ===== 그룹 관리 API =====
  // 그룹 목록 조회
  app.get('/api/groups', requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const groups = await storage.getGroups(userId);
      res.json(groups);
    } catch (error) {
      console.error('그룹 목록 조회 오류:', error);
      res.status(500).json({ error: '그룹 목록 조회 중 오류가 발생했습니다' });
    }
  });

  // 그룹 생성
  app.post('/api/groups', requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const validated = insertGroupSchema.parse({ ...req.body, userId });
      const group = await storage.createGroup(validated);
      res.status(201).json(group);
    } catch (error) {
      console.error('그룹 생성 오류:', error);
      res.status(500).json({ error: '그룹 생성 중 오류가 발생했습니다' });
    }
  });

  // 그룹 수정
  app.put('/api/groups/:id', requireAuth, async (req, res) => {
    try {
      const groupId = parseInt(req.params.id);
      const updated = await storage.updateGroup(groupId, req.body);
      if (!updated) {
        return res.status(404).json({ error: '그룹을 찾을 수 없습니다' });
      }
      res.json(updated);
    } catch (error) {
      console.error('그룹 수정 오류:', error);
      res.status(500).json({ error: '그룹 수정 중 오류가 발생했습니다' });
    }
  });

  // 그룹 삭제
  app.delete('/api/groups/:id', requireAuth, async (req, res) => {
    try {
      const groupId = parseInt(req.params.id);
      const deleted = await storage.deleteGroup(groupId);
      if (!deleted) {
        return res.status(404).json({ error: '그룹을 찾을 수 없습니다' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('그룹 삭제 오류:', error);
      res.status(500).json({ error: '그룹 삭제 중 오류가 발생했습니다' });
    }
  });

  // 그룹에 속한 키워드 조회
  app.get('/api/groups/:id/keywords', requireAuth, async (req, res) => {
    try {
      const groupId = parseInt(req.params.id);
      const keywords = await storage.getKeywordsByGroup(groupId);
      res.json(keywords);
    } catch (error) {
      console.error('그룹 키워드 조회 오류:', error);
      res.status(500).json({ error: '그룹 키워드 조회 중 오류가 발생했습니다' });
    }
  });

  // 그룹에 키워드 추가 (RESTful 방식)
  app.post('/api/groups/:id/keywords', requireAuth, async (req, res) => {
    try {
      const groupId = parseInt(req.params.id);
      const { keywordId } = req.body;
      if (!keywordId) {
        return res.status(400).json({ error: 'keywordId가 필요합니다' });
      }
      const relation = await storage.addKeywordToGroup(keywordId, groupId);
      res.status(201).json(relation);
    } catch (error) {
      console.error('그룹에 키워드 추가 오류:', error);
      res.status(500).json({ error: '그룹에 키워드를 추가하는 중 오류가 발생했습니다' });
    }
  });

  // 그룹에서 키워드 제거 (RESTful 방식)
  app.delete('/api/groups/:groupId/keywords/:keywordId', requireAuth, async (req, res) => {
    try {
      const groupId = parseInt(req.params.groupId);
      const keywordId = parseInt(req.params.keywordId);
      const removed = await storage.removeKeywordFromGroup(keywordId, groupId);
      if (!removed) {
        return res.status(404).json({ error: '해당 키워드-그룹 연결을 찾을 수 없습니다' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('그룹에서 키워드 제거 오류:', error);
      res.status(500).json({ error: '그룹에서 키워드를 제거하는 중 오류가 발생했습니다' });
    }
  });

  // 키워드를 그룹에 추가
  app.post('/api/keywords/:keywordId/groups/:groupId', requireAuth, async (req, res) => {
    try {
      const keywordId = parseInt(req.params.keywordId);
      const groupId = parseInt(req.params.groupId);
      const relation = await storage.addKeywordToGroup(keywordId, groupId);
      res.status(201).json(relation);
    } catch (error) {
      console.error('키워드-그룹 연결 오류:', error);
      res.status(500).json({ error: '키워드를 그룹에 추가하는 중 오류가 발생했습니다' });
    }
  });

  // 그룹에서 키워드 제거
  app.delete('/api/keywords/:keywordId/groups/:groupId', requireAuth, async (req, res) => {
    try {
      const keywordId = parseInt(req.params.keywordId);
      const groupId = parseInt(req.params.groupId);
      const removed = await storage.removeKeywordFromGroup(keywordId, groupId);
      if (!removed) {
        return res.status(404).json({ error: '해당 키워드-그룹 연결을 찾을 수 없습니다' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('키워드-그룹 연결 해제 오류:', error);
      res.status(500).json({ error: '그룹에서 키워드를 제거하는 중 오류가 발생했습니다' });
    }
  });

  // 키워드가 속한 그룹 목록 조회
  app.get('/api/keywords/:id/groups', requireAuth, async (req, res) => {
    try {
      const keywordId = parseInt(req.params.id);
      const groups = await storage.getGroupsForKeyword(keywordId);
      res.json(groups);
    } catch (error) {
      console.error('키워드 그룹 조회 오류:', error);
      res.status(500).json({ error: '키워드 그룹 조회 중 오류가 발생했습니다' });
    }
  });

  // ===== 알림 설정 API =====
  // 키워드별 알림 설정 조회
  app.get('/api/keywords/:id/alerts', requireAuth, async (req, res) => {
    try {
      const keywordId = parseInt(req.params.id);
      const alerts = await storage.getKeywordAlerts(keywordId);
      res.json(alerts);
    } catch (error) {
      console.error('알림 설정 조회 오류:', error);
      res.status(500).json({ error: '알림 설정 조회 중 오류가 발생했습니다' });
    }
  });

  // 알림 설정 생성
  app.post('/api/keywords/:id/alerts', requireAuth, async (req, res) => {
    try {
      const keywordId = parseInt(req.params.id);
      const parsed = insertKeywordAlertSchema.safeParse({
        keywordId,
        ...req.body,
      });
      
      if (!parsed.success) {
        return res.status(400).json({ error: '잘못된 요청입니다', details: parsed.error });
      }
      
      const alert = await storage.createKeywordAlert(parsed.data);
      res.json(alert);
    } catch (error) {
      console.error('알림 설정 생성 오류:', error);
      res.status(500).json({ error: '알림 설정 생성 중 오류가 발생했습니다' });
    }
  });

  // 알림 설정 업데이트
  app.patch('/api/alerts/:id', requireAuth, async (req, res) => {
    try {
      const alertId = parseInt(req.params.id);
      
      // keywordId는 업데이트 불가
      const { keywordId: _ignored, ...updateData } = req.body;
      
      const alert = await storage.updateKeywordAlert(alertId, updateData);
      if (!alert) {
        return res.status(404).json({ error: '알림 설정을 찾을 수 없습니다' });
      }
      res.json(alert);
    } catch (error) {
      console.error('알림 설정 업데이트 오류:', error);
      res.status(500).json({ error: '알림 설정 업데이트 중 오류가 발생했습니다' });
    }
  });

  // 알림 설정 삭제
  app.delete('/api/alerts/:id', requireAuth, async (req, res) => {
    try {
      const alertId = parseInt(req.params.id);
      const success = await storage.deleteKeywordAlert(alertId);
      if (!success) {
        return res.status(404).json({ error: '알림 설정을 찾을 수 없습니다' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('알림 설정 삭제 오류:', error);
      res.status(500).json({ error: '알림 설정 삭제 중 오류가 발생했습니다' });
    }
  });

  // ===== 사용자 설정 API =====
  // 사용자 설정 조회
  app.get('/api/settings', requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const settings = await storage.getUserSettings(userId);
      res.json(settings || { navigationItems: [], preferences: {} });
    } catch (error) {
      console.error('설정 조회 오류:', error);
      res.status(500).json({ error: '설정 조회 중 오류가 발생했습니다' });
    }
  });

  // 사용자 설정 업데이트
  app.put('/api/settings', requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const settings = await storage.updateUserSettings(userId, req.body);
      res.json(settings);
    } catch (error) {
      console.error('설정 업데이트 오류:', error);
      res.status(500).json({ error: '설정 업데이트 중 오류가 발생했습니다' });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
