import * as cron from 'node-cron';
import type { IStorage } from './storage';
import { NaverHTMLParser } from './html-parser';
import { SmartBlockParser } from './smartblock-parser';
import { NaverSearchAdClient } from './naver-searchad-client';
import { hiddenReasonClassifier } from './hidden-reason-classifier';

export class MeasurementScheduler {
  private jobs: Map<string, cron.ScheduledTask> = new Map();
  private storage: IStorage;
  private isRunning: boolean = false;
  private htmlParser: NaverHTMLParser;
  private smartBlockParser: SmartBlockParser;
  private naverSearchAdClient: NaverSearchAdClient;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.htmlParser = new NaverHTMLParser();
    this.smartBlockParser = new SmartBlockParser();
    this.naverSearchAdClient = new NaverSearchAdClient();
  }

  /**
   * Start all measurement schedulers based on interval settings
   */
  async start() {
    if (this.isRunning) {
      console.log('Scheduler already running');
      return;
    }

    console.log('Starting measurement scheduler...');
    this.isRunning = true;

    // Schedule for each interval
    this.scheduleInterval('1h', '0 * * * *');    // Every hour at minute 0
    this.scheduleInterval('6h', '0 */6 * * *');  // Every 6 hours at minute 0
    this.scheduleInterval('12h', '0 */12 * * *'); // Every 12 hours at minute 0
    this.scheduleInterval('24h', '0 0 * * *');   // Every day at midnight

    console.log('Measurement scheduler started successfully');
  }

  /**
   * Schedule measurements for a specific interval
   */
  private scheduleInterval(interval: string, cronExpression: string) {
    const job = cron.schedule(cronExpression, async () => {
      await this.runMeasurementsForInterval(interval);
    });

    this.jobs.set(interval, job);
    console.log(`Scheduled ${interval} measurements with cron: ${cronExpression}`);
  }

  /**
   * Run measurements for all keywords with a specific interval
   */
  private async runMeasurementsForInterval(interval: string) {
    try {
      console.log(`Running measurements for interval: ${interval}`);
      
      // Get all keywords from all users with this interval
      const allUsers = await this.storage.getAllUsers();
      let allKeywords: any[] = [];
      
      for (const user of allUsers) {
        const userKeywords = await this.storage.getKeywordsByUser(user.id);
        allKeywords = allKeywords.concat(userKeywords);
      }
      
      const keywords = allKeywords.filter(
        k => k.isActive && k.measurementInterval === interval
      );

      console.log(`Found ${keywords.length} active keywords for ${interval} interval`);

      // Measure each keyword
      for (const keyword of keywords) {
        try {
          console.log(`Measuring keyword #${keyword.id}: ${keyword.keyword}`);
          
          const startTime = Date.now();

          // Fetch search volume from Naver Search Ad API
          let searchVolumeStr: string | null = null;
          try {
            const keywordStats = await this.naverSearchAdClient.getKeywordStats(keyword.keyword);
            if (keywordStats) {
              const pcQcCnt = typeof keywordStats.monthlyPcQcCnt === 'string' ? parseFloat(keywordStats.monthlyPcQcCnt) : keywordStats.monthlyPcQcCnt;
              const mobileQcCnt = typeof keywordStats.monthlyMobileQcCnt === 'string' ? parseFloat(keywordStats.monthlyMobileQcCnt) : keywordStats.monthlyMobileQcCnt;
              const avgVolume = Math.round((pcQcCnt + mobileQcCnt) / 2);
              searchVolumeStr = avgVolume.toString();
              console.log(`[Search Volume] ${keyword.keyword}: ${avgVolume}`);
            }
          } catch (volumeError) {
            console.error('[Search Volume Error]', volumeError);
          }

          // Fetch Smart Block results using HTML parser
          const htmlResult = await this.htmlParser.searchNaver(keyword.keyword);
          const blogResults = htmlResult.blogResults;
          const categories = htmlResult.categories;

          if (blogResults.length === 0 && categories.length === 0) {
            await this.storage.createMeasurement({
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
              method: 'html-parser',
            });
            console.log(`No Smart Block found for keyword #${keyword.id}`);
            continue;
          }

          // Find rank in Smart Block
          const rankResult = this.smartBlockParser.findRank(
            keyword.targetUrl,
            blogResults
          );

          // Phase 1: 통합검색 이탈 감지 - rank가 있지만 CSS로 숨겨진 경우 체크
          let isVisibleInSearch: boolean | undefined = undefined;
          let hiddenReason: string | undefined = undefined;
          let hiddenReasonCategory: string | undefined = undefined;
          let hiddenReasonDetail: string | undefined = undefined;
          let detectionMethod: string | undefined = undefined;
          let recoveryEstimate: string | undefined = undefined;
          let smartblockStatus = rankResult.rank ? 'OK' : 'NOT_IN_BLOCK';

          if (rankResult.rank && rankResult.matchedUrl) {
            // 매칭된 블로그의 visibility 정보 찾기
            const matchedBlog = blogResults.find(b => 
              this.smartBlockParser.normalizeUrl(b.url) === this.smartBlockParser.normalizeUrl(rankResult.matchedUrl)
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
                const categoryRankResult = this.smartBlockParser.findRank(
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
                    : `${category.categoryName}에서 내 블로그를 찾을 수 없음`
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
                  : `전체 검색 결과에서 내 블로그를 찾을 수 없음`
              }];

          // Save measurement
          await this.storage.createMeasurement({
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
            method: 'html-parser',
          });

          console.log(`Measurement completed for keyword #${keyword.id}: rank=${rankResult.rank}, status=${smartblockStatus}, visible=${isVisibleInSearch}`);
        } catch (error) {
          console.error(`Error measuring keyword #${keyword.id}:`, error);
          
          // Save error measurement
          await this.storage.createMeasurement({
            keywordId: keyword.id,
            measuredAt: new Date(),
            rankSmartblock: null,
            smartblockStatus: 'ERROR',
            smartblockConfidence: '0',
            smartblockDetails: null,
            blogTabRank: null,
            searchVolumeAvg: null,
            durationMs: 0,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            method: 'html-parser',
          });
        }
      }

      console.log(`Completed measurements for ${interval} interval`);
    } catch (error) {
      console.error(`Error running measurements for ${interval}:`, error);
    }
  }

  /**
   * Stop all scheduled jobs
   */
  stop() {
    if (!this.isRunning) {
      console.log('Scheduler is not running');
      return;
    }

    console.log('Stopping measurement scheduler...');
    
    Array.from(this.jobs.entries()).forEach(([interval, job]) => {
      job.stop();
      console.log(`Stopped ${interval} scheduler`);
    });

    this.jobs.clear();
    this.isRunning = false;
    console.log('Measurement scheduler stopped');
  }

  /**
   * Manually trigger measurements for a specific interval (for testing)
   */
  async triggerInterval(interval: string) {
    console.log(`Manually triggering measurements for ${interval}`);
    await this.runMeasurementsForInterval(interval);
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      running: this.isRunning,
      jobs: Array.from(this.jobs.keys()),
    };
  }
}
