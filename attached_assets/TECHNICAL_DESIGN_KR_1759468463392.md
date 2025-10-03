# 기술 설계 문서
**프로젝트**: 네이버 블로그 스마트블록 순위 추적 시스템
**버전**: 1.0
**최종 업데이트**: 2025-10-02

## 1. 시스템 아키텍처

### 1.1 전체 구조

```
┌─────────────────┐
│  웹 대시보드     │
│ (크론 기반)     │
└────────┬────────┘
         │
    ┌────▼────────────────┐    작업 스케줄러
    │    BullMQ + Redis   │◄── 작업 예약
    └────┬────────────────┘
         │
    ┌────▼──────────────────────────────┐
    │   측정 워커 풀                     │
    │  ┌────────┐ ┌────────┐ ┌────────┐ │
    │  │워커 1  │ │워커 2  │ │워커 N  │ │
    │  └───┬────┘ └───┬────┘ └───┬────┘ │
    └──────┼──────────┼──────────┼──────┘
           │          │          │
        ┌──▼──────────▼──────────▼───┐
        │   측정 로직                 │
        │  ┌─────────────────────┐   │
        │  │ SerpAPI 클라이언트  │──►│ 네이버 검색 HTML
        │  └─────────────────────┘   │
        │  ┌─────────────────────┐   │
        │  │ 스마트블록 파서     │   │
        │  │  - 섹션 탐지        │   │
        │  │  - URL 정규화기     │   │
        │  │  - 순위 매칭        │   │
        │  └─────────────────────┘   │
        │  ┌─────────────────────┐   │
        │  │ 네이버 검색 API     │──►│ 블로그탭 순위
        │  └─────────────────────┘   │
        │  ┌─────────────────────┐   │
        │  │ 네이버 DataLab API  │──►│ 검색량
        │  └─────────────────────┘   │
        └──────────┬──────────────────┘
                   │
        ┌──────────▼──────────────────┐
        │ Supabase (PostgreSQL)       │──► 측정 결과 저장
        │  - 실시간 구독              │
        │  - HTML 저장소              │
        └──────────┬──────────────────┘
                   │
        ┌──────────▼──────────────────┐
        │   알림 시스템               │
        │   (Slack/SMS/이메일)        │
        └─────────────────────────────┘
```

### 1.2 기술 스택
- **런타임**: Node.js 20.x LTS, TypeScript 5.3+
- **큐 시스템**: BullMQ 5.x + Redis 7.x
- **데이터베이스**: Supabase (PostgreSQL 15, Realtime, Storage 포함)
- **HTTP 클라이언트**: Axios 1.6+ (재시도 로직 포함)
- **HTML 파서**: Cheerio 1.0+ (jQuery와 유사한 API)
- **검증**: Zod 3.x (스키마 검증)
- **로깅**: Winston 3.x (JSON 포맷)
- **테스트**: Jest 29.x, Supertest 6.x

## 2. 핵심 컴포넌트

### 2.1 SerpAPI 클라이언트 모듈

**위치**: `src/crawler/serpapi-client.ts`

**주요 기능**:
- 네이버 검색 결과 HTML 가져오기
- API 요청 한도 관리 (월 100회)
- 오류 처리 및 재시도 로직
- Redis 캐싱으로 중복 호출 방지 (5분간)

```typescript
interface SerpAPIConfig {
  apiKey: string;          // SerpAPI 인증 키
  baseUrl: string;         // API 엔드포인트
  timeout: number;         // 요청 타임아웃 (밀리초)
  retryAttempts: number;   // 재시도 횟수
  retryDelay: number;      // 재시도 대기 시간
}

class SerpAPIClient {
  async searchNaver(keyword: string, options?: SearchOptions): Promise<SearchResult> {
    // SerpAPI에 HTTP 요청
    // 쿼리 파라미터: q={keyword}, engine=naver, num=30, no_cache=true
    // 반환: { html: string, searchId: string, timestamp: Date }
  }

  async getRateLimit(): Promise<RateLimitInfo> {
    // 현재 API 할당량 확인
  }
}

interface SearchResult {
  html: string;           // 네이버 검색 결과 HTML
  searchId: string;       // SerpAPI 요청 ID (디버깅용)
  timestamp: Date;        // 검색 수행 시각
  metadata: {
    keyword: string;
    deviceType: 'desktop' | 'mobile';
    location: string;
  };
}
```

**오류 처리**:
- 429 Too Many Requests → 지수 백오프 (2초, 4초, 8초, 16초, 32초)
- 500 Server Error → 5초 간격으로 3회 재시도
- Timeout → 경고 로그, 측정 실패로 표시
- Rate limit 소진 → 큐 일시정지, 관리자 알림

**캐싱 전략**:
- HTML 스냅샷을 5분간 캐시 (중복 API 호출 방지)
- 캐시 키: `serpapi:${keyword}:${deviceType}:${Math.floor(Date.now()/300000)}`
- Redis TTL: 300초

### 2.2 스마트블록 파싱 엔진

**위치**: `src/crawler/smartblock-parser.ts`

#### 2.2.1 섹션 탐지 알고리즘

```typescript
class SmartBlockDetector {
  /**
   * 다단계 휴리스틱 스코어링으로 스마트블록 섹션 식별
   * 신뢰도 점수 0.0-1.0과 추출된 블로그 카드 반환
   */
  detectSmartBlock(html: string): DetectionResult {
    const $ = cheerio.load(html);
    const candidates: SectionCandidate[] = [];

    // 1단계: 스마트블록 지표가 있는 섹션 찾기
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

    // 2단계: 최적 후보 선택
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

    // 제목 점수 (40% 가중치)
    const heading = $section.find('h2, h3, .section_title').first().text();
    if (heading.includes('블로그') || heading.includes('주제')) {
      score += 0.4;
    }

    // 구조 점수 (30% 가중치)
    const blogLinks = $section.find('a[href*="blog.naver.com"]').length;
    if (blogLinks >= 3 && blogLinks <= 10) {
      score += 0.3;
    }

    // 콘텐츠 점수 (30% 가중치)
    const hasImages = $section.find('img').length >= 3;
    const hasTitles = $section.find('.title, .blog_title').length >= 3;
    if (hasImages && hasTitles) {
      score += 0.3;
    }

    return Math.min(score, 1.0);
  }
}
```

#### 2.2.2 URL 정규화

```typescript
class URLNormalizer {
  /**
   * URL 리다이렉트, 모바일/데스크톱 변형, 쿼리 파라미터 처리
   */
  normalize(url: string): string {
    let normalized = url;

    // 쿼리 파라미터 제거 (블로그 포스트 ID 제외)
    normalized = this.removeQueryParams(normalized, ['blogId', 'logNo']);

    // 모바일 URL을 데스크톱으로 변환
    normalized = normalized.replace('m.blog.naver.com', 'blog.naver.com');

    // 리다이렉트 처리
    if (normalized.includes('naver.me/')) {
      normalized = this.resolveRedirect(normalized);
    }

    // 후행 슬래시 정규화
    normalized = normalized.replace(/\/$/, '');

    return normalized;
  }

  private resolveRedirect(shortUrl: string): string {
    // HTTP 리다이렉트 추적 (1일 캐시)
    // 최종 목적지 URL 반환
  }
}
```

#### 2.2.3 순위 매칭 로직

```typescript
interface RankMatchResult {
  rank: number | null;           // 스마트블록 내 위치 (1부터 시작)
  confidence: number;             // 매칭 신뢰도 0.0-1.0
  matchedUrl: string;             // 실제 발견된 URL
  exactMatch: boolean;            // URL이 정확히 일치하는지
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

      // 유사 URL에 대한 퍼지 매칭
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

### 2.3 작업 스케줄러

**위치**: `src/services/scheduler.ts`

```typescript
import { Queue, Worker, QueueScheduler } from 'bullmq';
import Redis from 'ioredis';

class MeasurementScheduler {
  private queue: Queue;
  private scheduler: QueueScheduler;

  async scheduleKeyword(keyword: Keyword): Promise<void> {
    const jobId = `keyword-${keyword.id}`;

    // 간격 파싱 (예: "1h", "30m", "1d")
    const repeatOptions = this.parseInterval(keyword.measurement_interval);

    await this.queue.add(
      'measure',
      { keywordId: keyword.id },
      {
        jobId: jobId,
        repeat: repeatOptions,
        removeOnComplete: 100,  // 최근 100개 작업 유지
        removeOnFail: 500       // 최근 500개 실패 유지
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

### 2.4 측정 워커

**위치**: `src/services/measurement-worker.ts`

```typescript
class MeasurementWorker {
  async processMeasurement(keywordId: number): Promise<void> {
    const startTime = Date.now();

    try {
      // 1. 키워드 설정 가져오기
      const keyword = await this.getKeyword(keywordId);
      if (!keyword.is_active) return;

      // 2. SerpAPI로 네이버 검색 HTML 가져오기
      const searchResult = await this.serpApiClient.searchNaver(keyword.keyword);

      // 3. 스마트블록 섹션 파싱
      const detection = await this.smartBlockParser.parse(searchResult.html);

      // 4. 타겟 URL 순위 찾기
      const rankResult = this.rankMatcher.findRank(
        keyword.target_url,
        detection.blogCards
      );

      // 5. 블로그탭 순위 가져오기 (선택사항)
      const blogTabRank = await this.naverSearchApi.getBlogRank(
        keyword.keyword,
        keyword.target_url
      );

      // 6. 검색량 가져오기 (선택사항)
      const searchVolume = await this.dataLabApi.getVolume(keyword.keyword);

      // 7. 측정 결과 저장
      const measurement = await this.saveMeasurement({
        keyword_id: keywordId,
        rank_smartblock: rankResult.rank,
        smartblock_status: detection.status,
        smartblock_confidence: detection.confidence,
        blog_tab_rank: blogTabRank,
        search_volume_avg: searchVolume,
        duration_ms: Date.now() - startTime
      });

      // 8. Supabase Storage에 HTML 스냅샷 저장
      await this.storeSnapshot(measurement.id, searchResult.html);

      // 9. 알림 조건 확인 (DB 트리거에서 처리)

    } catch (error) {
      await this.handleError(keywordId, error);
    }
  }
}
```

## 3. 데이터베이스 설계

**참고**: 전체 스키마는 [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)를 참조하세요.

### 3.1 주요 테이블

- **keywords**: 키워드 설정 및 추적 설정
- **measurements**: 시계열 측정 데이터
- **snapshots**: HTML 스냅샷 저장소 메타데이터
- **alerts**: 알림 이력 및 상태
- **api_usage**: API 호출 추적 및 할당량

### 3.2 Supabase 기능 활용

- **PostgreSQL 15**: TimescaleDB 확장이 있는 핵심 데이터베이스
- **Realtime**: 실시간 업데이트를 위한 WebSocket 구독
- **Storage**: HTML 스냅샷을 위한 객체 저장소
- **Row Level Security (RLS)**: 사용자 기반 데이터 격리
- **PostgREST**: 자동 생성되는 REST API

## 4. API 설계

### 4.1 키워드 관리

```typescript
// 키워드 생성
POST /api/keywords
{
  "keyword": "맛집 추천",
  "target_url": "https://blog.naver.com/user123/456",
  "measurement_interval": "1h",
  "alert_on_drop": true,
  "alert_threshold": 2
}

// 키워드 목록
GET /api/keywords?is_active=true&limit=20&offset=0

// 키워드 수정
PATCH /api/keywords/:id
{
  "measurement_interval": "30m",
  "alert_threshold": 3
}

// 키워드 삭제
DELETE /api/keywords/:id
```

### 4.2 측정값

```typescript
// 최근 측정값 가져오기
GET /api/measurements/latest?keyword_id=123

// 측정 이력 가져오기
GET /api/measurements?keyword_id=123&from=2025-01-01&to=2025-01-31

// 순위 추세 가져오기
GET /api/measurements/trends?keyword_id=123&days=7
```

### 4.3 알림

```typescript
// 알림 목록
GET /api/alerts?keyword_id=123&status=unread

// 알림 읽음 처리
PATCH /api/alerts/:id
{
  "status": "read"
}
```

## 5. 데이터 흐름

### 5.1 측정 흐름

```
1. 스케줄러가 작업 트리거 (간격 기반)
   └─► BullMQ가 큐에 작업 추가

2. 워커가 작업 처리
   └─► Supabase에서 키워드 설정 가져오기

3. SerpAPI 호출
   └─► 네이버 검색 HTML 가져오기
   └─► Redis에 캐시 (5분)

4. HTML 파싱
   └─► 스마트블록 섹션 탐지
   └─► 블로그 카드 추출
   └─► URL 정규화
   └─► 타겟 URL 순위 찾기

5. 네이버 API 호출 (선택사항)
   └─► 블로그탭 순위 가져오기
   └─► 검색량 가져오기

6. Supabase에 저장
   └─► 측정 행 삽입
   └─► 트리거 실행 → 필요시 알림 생성
   └─► Realtime으로 구독자에게 브로드캐스트

7. HTML 스냅샷 저장
   └─► Supabase Storage에 업로드
   └─► 측정 레코드에 연결
```

### 5.2 알림 흐름

```
1. 측정값 삽입
   └─► DB 트리거: check_rank_alert()

2. 트리거가 조건 평가
   ├─► 순위 이탈? → 알림 생성
   ├─► 순위 임계값만큼 하락? → 알림 생성
   └─► 문제 없음 → 건너뛰기

3. 알림 생성
   └─► Realtime 알림 발송
   └─► 외부 알림 (Slack/SMS)
```

## 6. 오류 처리

### 6.1 오류 카테고리

1. **API 오류**
   - SerpAPI rate limit → 큐 일시정지, 관리자 알림
   - 네이버 API timeout → 백오프로 재시도
   - 잘못된 응답 → 오류 로그, 측정 실패 표시

2. **파싱 오류**
   - 스마트블록 없음 → status='not_found', rank=null
   - 낮은 신뢰도 (<0.5) → status='uncertain', 경고 로그
   - URL 불일치 → 퍼지 매칭, 신뢰도 점수 로그

3. **데이터베이스 오류**
   - 연결 끊김 → 3회 재시도, 그 후 작업 실패
   - 제약 조건 위반 → 오류 로그, 측정 건너뛰기
   - 데드락 → 지터와 함께 재시도

4. **워커 오류**
   - 작업 타임아웃 (5분) → 워커 종료, 재시작
   - 메모리 누수 → 힙 모니터링, 워커 풀 재시작
   - 처리되지 않은 예외 → 스택 로그, 작업 정상적으로 실패 처리

### 6.2 재시도 전략

```typescript
const retryConfig = {
  serpApi: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000  // 2초, 4초, 8초, 16초, 32초
    }
  },
  naverApi: {
    attempts: 3,
    backoff: {
      type: 'fixed',
      delay: 5000  // 재시도 간 5초
    }
  },
  database: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000  // 1초, 2초, 4초
    }
  }
};
```

## 7. 성능 최적화

### 7.1 동시성

- **워커 풀**: 3-5개 워커 (API 제한 기반)
- **최대 동시 작업**: 워커당 10개
- **작업 타임아웃**: 5분

### 7.2 캐싱

- **SerpAPI 응답**: 5분 (Redis)
- **네이버 API 응답**: 1시간 (Redis)
- **키워드 설정**: 10분 (인메모리)

### 7.3 데이터베이스 인덱싱

```sql
-- 시계열 쿼리 최적화
CREATE INDEX idx_measurements_keyword_time
  ON measurements(keyword_id, measured_at DESC);

-- 알림 쿼리 최적화
CREATE INDEX idx_alerts_keyword_status
  ON alerts(keyword_id, status, created_at DESC);
```

## 8. 모니터링 및 로깅

### 8.1 메트릭

- **API 사용량**: 일일 요청 수, 남은 할당량
- **작업 메트릭**: 성공률, 평균 소요시간, 실패율
- **파서 메트릭**: 탐지 성공률, 평균 신뢰도
- **데이터베이스 메트릭**: 쿼리 지연시간, 연결 풀 사용량

### 8.2 로깅

```typescript
// Winston으로 구조화 로깅
logger.info('측정 완료', {
  keywordId: 123,
  rank: 3,
  confidence: 0.95,
  duration: 2500,
  timestamp: new Date().toISOString()
});

logger.error('SerpAPI rate limit 초과', {
  quotaRemaining: 0,
  nextResetAt: '2025-01-01T00:00:00Z',
  action: 'paused_queue'
});
```

## 9. 보안 고려사항

### 9.1 API 키 관리

- 환경 변수에 키 저장
- 월간 키 로테이션
- 백엔드 전용 Supabase service role key 사용
- 클라이언트 코드에 키 노출 금지

### 9.2 Row Level Security

```sql
-- 사용자는 자신의 키워드만 접근 가능
CREATE POLICY keyword_isolation ON keywords
  FOR ALL USING (created_by = auth.uid());

-- 사용자는 자신의 측정값만 읽기 가능
CREATE POLICY measurement_isolation ON measurements
  FOR SELECT USING (
    keyword_id IN (
      SELECT id FROM keywords WHERE created_by = auth.uid()
    )
  );
```

## 10. 배포

### 10.1 환경 설정

- **Node.js**: v20.x LTS
- **Redis**: v7.x (관리형 서비스 권장)
- **Supabase**: Cloud tier (또는 self-hosted)

### 10.2 환경 변수

```bash
# SerpAPI
SERPAPI_KEY=your_api_key
SERPAPI_BASE_URL=https://serpapi.com/search

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key

# Redis
REDIS_URL=redis://localhost:6379

# 알림
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
SMS_API_KEY=your_sms_api_key
```

## 11. 테스트 전략

### 11.1 단위 테스트

- SerpAPI 클라이언트 모의 응답
- 실제 HTML fixture로 파서 로직 테스트
- URL 정규화 엣지 케이스
- 순위 매칭 알고리즘

### 11.2 통합 테스트

- 종단간 측정 흐름
- 데이터베이스 트리거 및 함수
- Supabase Realtime 구독
- 알림 생성

### 11.3 성능 테스트

- 부하 상황에서 워커 처리량
- 데이터베이스 쿼리 성능
- API rate limiting 동작
