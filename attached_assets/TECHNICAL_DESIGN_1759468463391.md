# Technical Design Document
**Project**: Naver Blog Smart Block Ranking Tracker
**Version**: 1.0
**Last Updated**: 2025-10-02

## 1. System Architecture

### 1.1 High-Level Architecture

```
┌─────────────────┐
│  Web Dashboard  │
│ (Cron-based)    │
└────────┬────────┘
         │
    ┌────▼────────────────┐    Job Scheduler
    │    BullMQ + Redis   │◄── schedules jobs
    └────┬────────────────┘
         │
    ┌────▼──────────────────────────────┐
    │   Measurement Worker Pool          │
    │  ┌────────┐ ┌────────┐ ┌────────┐ │
    │  │Worker 1│ │Worker 2│ │Worker N│ │
    │  └───┬────┘ └───┬────┘ └───┬────┘ │
    └──────┼──────────┼──────────┼──────┘
           │          │          │
        ┌──▼──────────▼──────────▼───┐
        │   Measurement Logic         │
        │  ┌─────────────────────┐   │
        │  │ SerpAPI Client      │──►│ Naver SERP HTML
        │  └─────────────────────┘   │
        │  ┌─────────────────────┐   │
        │  │ Smart Block Parser  │   │
        │  │  - Section Detector │   │
        │  │  - URL Normalizer   │   │
        │  │  - Rank Matcher     │   │
        │  └─────────────────────┘   │
        │  ┌─────────────────────┐   │
        │  │ Naver Search API    │──►│ Blog Tab Rank
        │  └─────────────────────┘   │
        │  ┌─────────────────────┐   │
        │  │ Naver DataLab API   │──►│ Search Volume
        │  └─────────────────────┘   │
        └──────────┬──────────────────┘
                   │
        ┌──────────▼──────────────────┐
        │ Supabase (PostgreSQL)       │──► Measurements Storage
        │  - Realtime subscriptions   │
        │  - Storage for HTML         │
        └──────────┬──────────────────┘
                   │
        ┌──────────▼──────────────────┐
        │   Alert System              │
        │   (Slack/SMS/Email)         │
        └─────────────────────────────┘
```

### 1.2 Technology Stack
- **Runtime**: Node.js 20.x LTS, TypeScript 5.3+
- **Queue**: BullMQ 5.x + Redis 7.x
- **Database**: Supabase (PostgreSQL 15) with Realtime and Storage
- **HTTP Client**: Axios 1.6+ with retry logic
- **HTML Parser**: Cheerio 1.0+ (fast, jQuery-like API)
- **Validation**: Zod 3.x for schema validation
- **Logging**: Winston 3.x with JSON formatting
- **Testing**: Jest 29.x, Supertest 6.x

## 2. Core Components

### 2.1 SerpAPI Client Module

**Location**: `src/crawler/serpapi-client.ts`

**Key Features**:
- Fetch Naver search result HTML
- API rate limiting (100 requests/month)
- Error handling and retry logic
- Redis caching to prevent duplicate calls (5 min TTL)

```typescript
interface SerpAPIConfig {
  apiKey: string;          // SerpAPI authentication key
  baseUrl: string;         // API endpoint
  timeout: number;         // Request timeout (ms)
  retryAttempts: number;   // Number of retry attempts
  retryDelay: number;      // Delay between retries
}

class SerpAPIClient {
  async searchNaver(keyword: string, options?: SearchOptions): Promise<SearchResult> {
    // HTTP request to SerpAPI
    // Query params: q={keyword}, engine=naver, num=30, no_cache=true
    // Returns: { html: string, searchId: string, timestamp: Date }
  }

  async getRateLimit(): Promise<RateLimitInfo> {
    // Check current API quota usage
  }
}

interface SearchResult {
  html: string;           // Raw HTML of Naver search result page
  searchId: string;       // SerpAPI request ID for debugging
  timestamp: Date;        // When search was performed
  metadata: {
    keyword: string;
    deviceType: 'desktop' | 'mobile';
    location: string;
  };
}
```

**Error Handling**:
- 429 Too Many Requests → exponential backoff (2s, 4s, 8s, 16s, 32s)
- 500 Server Error → retry 3 times with 5s delay
- Timeout → log warning, mark measurement as failed
- Rate limit exhausted → pause queue, alert admin

**Caching Strategy**:
- Cache HTML snapshots for 5 minutes (avoid duplicate API calls)
- Cache key: `serpapi:${keyword}:${deviceType}:${Math.floor(Date.now()/300000)}`
- Redis TTL: 300 seconds

### 2.2 Smart Block Parsing Engine

**Location**: `src/crawler/smartblock-parser.ts`

#### 2.2.1 Section Detection Algorithm

```typescript
class SmartBlockDetector {
  /**
   * Multi-stage heuristic scoring to identify smart block section
   * Returns confidence score 0.0-1.0 and extracted blog cards
   */
  detectSmartBlock(html: string): DetectionResult {
    const $ = cheerio.load(html);
    const candidates: SectionCandidate[] = [];

    // Stage 1: Find sections with smart block indicators
    $('section, div[class*="section"]').each((i, section) => {
      const $section = $(section);
      const score = this.scoreSection($section);

      if (score > 0.3) {
        candidates.push({
          element: $section,
          score: score,
          blogCards: this.extractBlogCards($section)
        });
      }
    });

    // Stage 2: Select best candidate
    const best = candidates.sort((a, b) => b.score - a.score)[0];

    if (!best || best.score < 0.5) {
      return { status: 'not_found', confidence: 0 };
    }

    return {
      status: 'found',
      confidence: best.score,
      blogCards: best.blogCards
    };
  }

  private scoreSection($section: Cheerio): number {
    let score = 0;

    // Heading score (40% weight)
    const heading = $section.find('h2, h3, .section_title').first().text();
    if (heading.includes('블로그') || heading.includes('주제')) {
      score += 0.4;
    }

    // Structure score (30% weight)
    const blogLinks = $section.find('a[href*="blog.naver.com"]').length;
    if (blogLinks >= 3 && blogLinks <= 10) {
      score += 0.3;
    }

    // Content score (30% weight)
    const hasImages = $section.find('img').length >= 3;
    const hasTitles = $section.find('.title, .blog_title').length >= 3;
    if (hasImages && hasTitles) {
      score += 0.3;
    }

    return Math.min(score, 1.0);
  }
}
```

#### 2.2.2 URL Normalization

```typescript
class URLNormalizer {
  /**
   * Handles URL redirects, mobile/desktop variants, query params
   */
  normalize(url: string): string {
    let normalized = url;

    // Remove query parameters (except blog post ID)
    normalized = this.removeQueryParams(normalized, ['blogId', 'logNo']);

    // Convert mobile URLs to desktop
    normalized = normalized.replace('m.blog.naver.com', 'blog.naver.com');

    // Handle redirects
    if (normalized.includes('naver.me/')) {
      normalized = this.resolveRedirect(normalized);
    }

    // Normalize trailing slashes
    normalized = normalized.replace(/\/$/, '');

    return normalized;
  }

  private resolveRedirect(shortUrl: string): string {
    // Follow HTTP redirect (cached for 1 day)
    // Returns final destination URL
  }
}
```

#### 2.2.3 Rank Matching Logic

```typescript
interface RankMatchResult {
  rank: number | null;           // Position in smart block (1-based)
  confidence: number;             // Match confidence 0.0-1.0
  matchedUrl: string;             // Actual URL found
  exactMatch: boolean;            // Whether URL is exact match
}

class RankMatcher {
  findRank(targetUrl: string, blogCards: BlogCard[]): RankMatchResult {
    const normalizedTarget = this.normalizer.normalize(targetUrl);

    for (let i = 0; i < blogCards.length; i++) {
      const card = blogCards[i];
      const normalizedCard = this.normalizer.normalize(card.url);

      if (normalizedCard === normalizedTarget) {
        return {
          rank: i + 1,
          confidence: 1.0,
          matchedUrl: card.url,
          exactMatch: true
        };
      }

      // Fuzzy matching for similar URLs
      const similarity = this.calculateSimilarity(normalizedTarget, normalizedCard);
      if (similarity > 0.9) {
        return {
          rank: i + 1,
          confidence: similarity,
          matchedUrl: card.url,
          exactMatch: false
        };
      }
    }

    return {
      rank: null,
      confidence: 0,
      matchedUrl: '',
      exactMatch: false
    };
  }
}
```

### 2.3 Job Scheduler

**Location**: `src/services/scheduler.ts`

```typescript
import { Queue, Worker, QueueScheduler } from 'bullmq';
import Redis from 'ioredis';

class MeasurementScheduler {
  private queue: Queue;
  private scheduler: QueueScheduler;

  async scheduleKeyword(keyword: Keyword): Promise<void> {
    const jobId = `keyword-${keyword.id}`;

    // Parse interval (e.g., "1h", "30m", "1d")
    const repeatOptions = this.parseInterval(keyword.measurement_interval);

    await this.queue.add(
      'measure',
      { keywordId: keyword.id },
      {
        jobId: jobId,
        repeat: repeatOptions,
        removeOnComplete: 100,  // Keep last 100 jobs
        removeOnFail: 500       // Keep last 500 failures
      }
    );
  }

  private parseInterval(interval: string): RepeatOptions {
    const match = interval.match(/^(\d+)([mhd])$/);
    if (!match) throw new Error(`Invalid interval: ${interval}`);

    const [, value, unit] = match;
    const num = parseInt(value);

    switch (unit) {
      case 'm': return { every: num * 60 * 1000 };
      case 'h': return { every: num * 60 * 60 * 1000 };
      case 'd': return { cron: `0 0 */${num} * *` };
    }
  }
}
```

### 2.4 Measurement Worker

**Location**: `src/services/measurement-worker.ts`

```typescript
class MeasurementWorker {
  async processMeasurement(keywordId: number): Promise<void> {
    const startTime = Date.now();

    try {
      // 1. Fetch keyword config
      const keyword = await this.getKeyword(keywordId);
      if (!keyword.is_active) return;

      // 2. Get Naver SERP HTML via SerpAPI
      const searchResult = await this.serpApiClient.searchNaver(keyword.keyword);

      // 3. Parse smart block section
      const detection = await this.smartBlockParser.parse(searchResult.html);

      // 4. Find target URL rank
      const rankResult = this.rankMatcher.findRank(
        keyword.target_url,
        detection.blogCards
      );

      // 5. Get blog tab rank (optional)
      const blogTabRank = await this.naverSearchApi.getBlogRank(
        keyword.keyword,
        keyword.target_url
      );

      // 6. Get search volume (optional)
      const searchVolume = await this.dataLabApi.getVolume(keyword.keyword);

      // 7. Save measurement
      const measurement = await this.saveMeasurement({
        keyword_id: keywordId,
        rank_smartblock: rankResult.rank,
        smartblock_status: detection.status,
        smartblock_confidence: detection.confidence,
        blog_tab_rank: blogTabRank,
        search_volume_avg: searchVolume,
        duration_ms: Date.now() - startTime
      });

      // 8. Store HTML snapshot in Supabase Storage
      await this.storeSnapshot(measurement.id, searchResult.html);

      // 9. Check alert conditions (handled by DB trigger)

    } catch (error) {
      await this.handleError(keywordId, error);
    }
  }
}
```

## 3. Database Design

**Reference**: See [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) for complete schema.

### 3.1 Key Tables

- **keywords**: Keyword configurations and tracking settings
- **measurements**: Time-series measurement data
- **snapshots**: HTML snapshot storage metadata
- **alerts**: Alert history and status
- **api_usage**: API call tracking and quotas

### 3.2 Supabase Features Used

- **PostgreSQL 15**: Core database with TimescaleDB extensions
- **Realtime**: WebSocket subscriptions for live updates
- **Storage**: Object storage for HTML snapshots
- **Row Level Security (RLS)**: User-based data isolation
- **PostgREST**: Auto-generated REST API

## 4. API Design

### 4.1 Keyword Management

```typescript
// Create keyword
POST /api/keywords
{
  "keyword": "맛집 추천",
  "target_url": "https://blog.naver.com/user123/456",
  "measurement_interval": "1h",
  "alert_on_drop": true,
  "alert_threshold": 2
}

// List keywords
GET /api/keywords?is_active=true&limit=20&offset=0

// Update keyword
PATCH /api/keywords/:id
{
  "measurement_interval": "30m",
  "alert_threshold": 3
}

// Delete keyword
DELETE /api/keywords/:id
```

### 4.2 Measurements

```typescript
// Get latest measurements
GET /api/measurements/latest?keyword_id=123

// Get measurement history
GET /api/measurements?keyword_id=123&from=2025-01-01&to=2025-01-31

// Get rank trends
GET /api/measurements/trends?keyword_id=123&days=7
```

### 4.3 Alerts

```typescript
// List alerts
GET /api/alerts?keyword_id=123&status=unread

// Mark alert as read
PATCH /api/alerts/:id
{
  "status": "read"
}
```

## 5. Data Flow

### 5.1 Measurement Flow

```
1. Scheduler triggers job (based on interval)
   └─► BullMQ adds job to queue

2. Worker picks up job
   └─► Fetch keyword config from Supabase

3. Call SerpAPI
   └─► Get Naver search HTML
   └─► Cache in Redis (5 min)

4. Parse HTML
   └─► Detect smart block section
   └─► Extract blog cards
   └─► Normalize URLs
   └─► Find target URL rank

5. Call Naver APIs (optional)
   └─► Get blog tab rank
   └─► Get search volume

6. Save to Supabase
   └─► Insert measurement row
   └─► Trigger fires → create alert if needed
   └─► Realtime broadcast to subscribers

7. Store HTML snapshot
   └─► Upload to Supabase Storage
   └─► Link to measurement record
```

### 5.2 Alert Flow

```
1. Measurement inserted
   └─► DB trigger: check_rank_alert()

2. Trigger evaluates conditions
   ├─► Rank dropped out? → create alert
   ├─► Rank decreased by threshold? → create alert
   └─► No issues → skip

3. Alert created
   └─► Realtime notification sent
   └─► External notification (Slack/SMS)
```

## 6. Error Handling

### 6.1 Error Categories

1. **API Errors**
   - SerpAPI rate limit → pause queue, alert admin
   - Naver API timeout → retry with backoff
   - Invalid response → log error, mark measurement failed

2. **Parsing Errors**
   - Smart block not found → status='not_found', rank=null
   - Low confidence (<0.5) → status='uncertain', log warning
   - URL mismatch → fuzzy matching, log confidence score

3. **Database Errors**
   - Connection lost → retry 3 times, then fail job
   - Constraint violation → log error, skip measurement
   - Deadlock → retry with jitter

4. **Worker Errors**
   - Job timeout (5 min) → kill worker, restart
   - Memory leak → monitor heap, restart worker pool
   - Uncaught exception → log stack, fail job gracefully

### 6.2 Retry Strategy

```typescript
const retryConfig = {
  serpApi: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000  // 2s, 4s, 8s, 16s, 32s
    }
  },
  naverApi: {
    attempts: 3,
    backoff: {
      type: 'fixed',
      delay: 5000  // 5s between retries
    }
  },
  database: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000  // 1s, 2s, 4s
    }
  }
};
```

## 7. Performance Optimization

### 7.1 Concurrency

- **Worker pool**: 3-5 workers (based on API limits)
- **Max concurrent jobs**: 10 per worker
- **Job timeout**: 5 minutes

### 7.2 Caching

- **SerpAPI responses**: 5 min (Redis)
- **Naver API responses**: 1 hour (Redis)
- **Keyword configs**: 10 min (in-memory)

### 7.3 Database Indexing

```sql
-- Optimized for time-series queries
CREATE INDEX idx_measurements_keyword_time
  ON measurements(keyword_id, measured_at DESC);

-- Optimized for alert queries
CREATE INDEX idx_alerts_keyword_status
  ON alerts(keyword_id, status, created_at DESC);
```

## 8. Monitoring & Logging

### 8.1 Metrics

- **API usage**: Requests per day, quota remaining
- **Job metrics**: Success rate, avg duration, failure rate
- **Parser metrics**: Detection success rate, avg confidence
- **Database metrics**: Query latency, connection pool usage

### 8.2 Logging

```typescript
// Structured logging with Winston
logger.info('Measurement completed', {
  keywordId: 123,
  rank: 3,
  confidence: 0.95,
  duration: 2500,
  timestamp: new Date().toISOString()
});

logger.error('SerpAPI rate limit exceeded', {
  quotaRemaining: 0,
  nextResetAt: '2025-01-01T00:00:00Z',
  action: 'paused_queue'
});
```

## 9. Security Considerations

### 9.1 API Key Management

- Store keys in environment variables
- Rotate keys monthly
- Use Supabase service role key for backend only
- Never expose keys in client code

### 9.2 Row Level Security

```sql
-- Users can only access their own keywords
CREATE POLICY keyword_isolation ON keywords
  FOR ALL USING (created_by = auth.uid());

-- Users can only read their own measurements
CREATE POLICY measurement_isolation ON measurements
  FOR SELECT USING (
    keyword_id IN (
      SELECT id FROM keywords WHERE created_by = auth.uid()
    )
  );
```

## 10. Deployment

### 10.1 Environment Setup

- **Node.js**: v20.x LTS
- **Redis**: v7.x (managed service recommended)
- **Supabase**: Cloud tier (or self-hosted)

### 10.2 Environment Variables

```bash
# SerpAPI
SERPAPI_KEY=your_api_key
SERPAPI_BASE_URL=https://serpapi.com/search

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key

# Redis
REDIS_URL=redis://localhost:6379

# Alerts
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
SMS_API_KEY=your_sms_api_key
```

## 11. Testing Strategy

### 11.1 Unit Tests

- SerpAPI client mock responses
- Parser logic with real HTML fixtures
- URL normalization edge cases
- Rank matching algorithm

### 11.2 Integration Tests

- End-to-end measurement flow
- Database triggers and functions
- Supabase Realtime subscriptions
- Alert generation

### 11.3 Performance Tests

- Worker throughput under load
- Database query performance
- API rate limiting behavior
