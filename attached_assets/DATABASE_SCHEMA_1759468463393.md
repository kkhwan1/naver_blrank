# 데이터베이스 스키마 설계
**프로젝트**: 네이버 블로그 스마트블록 순위 추적 시스템
**데이터베이스**: Supabase (PostgreSQL 15)
**버전**: 1.0
**최종 업데이트**: 2025-10-02

## 1. 개요

### 1.1 Supabase 사용 이유
- **PostgreSQL 기반**: 완전한 PostgreSQL 15 호환
- **실시간 구독**: Realtime API로 순위 변경 즉시 감지
- **Row Level Security (RLS)**: 테이블 레벨 권한 관리
- **자동 백업**: 일일 자동 백업 및 포인트-인-타임 복구
- **REST API 자동 생성**: PostgREST로 자동 API 엔드포인트
- **무료 티어**: 500MB 데이터베이스, 1GB 파일 저장소, 50MB 파일 업로드

### 1.2 확장 기능
```sql
-- 필요한 PostgreSQL 확장 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- UUID 생성
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- 쿼리 성능 분석
```

## 2. 테이블 설계

### 2.1 keywords (키워드 관리)

사용자가 추적하려는 키워드와 목표 블로그 URL을 저장합니다.

```sql
CREATE TABLE keywords (
  id BIGSERIAL PRIMARY KEY,

  -- 키워드 정보
  keyword TEXT NOT NULL,
  target_url TEXT NOT NULL,

  -- 측정 설정
  measurement_interval TEXT NOT NULL DEFAULT '1h',
  -- '15m', '30m', '1h', '2h', '6h', '12h', '24h'

  is_active BOOLEAN NOT NULL DEFAULT true,

  -- 알림 설정
  alert_on_drop BOOLEAN NOT NULL DEFAULT true,
  alert_on_rank_decrease BOOLEAN NOT NULL DEFAULT true,
  alert_threshold INTEGER DEFAULT 2, -- 순위 하락 N단계 이상일 때 알림

  -- 메타데이터
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- 제약조건
  CONSTRAINT keywords_keyword_target_url_key UNIQUE(keyword, target_url),
  CONSTRAINT keywords_interval_check CHECK (
    measurement_interval IN ('15m', '30m', '1h', '2h', '6h', '12h', '24h')
  )
);

-- 인덱스
CREATE INDEX idx_keywords_active ON keywords(is_active) WHERE is_active = true;
CREATE INDEX idx_keywords_created_by ON keywords(created_by);

-- 자동 업데이트 타임스탬프
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_keywords_updated_at
  BEFORE UPDATE ON keywords
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own keywords"
  ON keywords FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can insert their own keywords"
  ON keywords FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own keywords"
  ON keywords FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own keywords"
  ON keywords FOR DELETE
  USING (auth.uid() = created_by);

-- 코멘트
COMMENT ON TABLE keywords IS '추적할 키워드 및 목표 블로그 URL';
COMMENT ON COLUMN keywords.measurement_interval IS '측정 주기: 15m, 30m, 1h, 2h, 6h, 12h, 24h';
COMMENT ON COLUMN keywords.alert_threshold IS '순위 하락 N단계 이상일 때 알림';
```

### 2.2 measurements (측정 결과)

키워드별 측정 결과를 시계열로 저장합니다.

```sql
CREATE TABLE measurements (
  id BIGSERIAL PRIMARY KEY,
  keyword_id BIGINT NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,

  -- 측정 시각
  measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 스마트블록 순위 (Primary KPI)
  rank_smartblock INTEGER, -- 1, 2, 3, or NULL
  smartblock_status TEXT NOT NULL,
  -- 'OK': 스마트블록에 있음
  -- 'NOT_IN_BLOCK': 스마트블록에 없음
  -- 'BLOCK_MISSING': 스마트블록 자체가 없음
  -- 'LOW_CONFIDENCE': 신뢰도 낮음
  -- 'ERROR': 측정 실패
  smartblock_confidence DECIMAL(3,2), -- 0.00-1.00

  -- 보조 지표
  blog_tab_rank INTEGER, -- 블로그 탭 순위
  search_volume_avg DECIMAL(10,2), -- 평균 검색량

  -- 성능 메트릭
  duration_ms INTEGER, -- 측정 소요 시간 (밀리초)

  -- 에러 정보
  error_message TEXT,

  -- 메타데이터
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 제약조건
  CONSTRAINT measurements_rank_check CHECK (
    rank_smartblock IS NULL OR (rank_smartblock >= 1 AND rank_smartblock <= 3)
  ),
  CONSTRAINT measurements_status_check CHECK (
    smartblock_status IN ('OK', 'NOT_IN_BLOCK', 'BLOCK_MISSING', 'LOW_CONFIDENCE', 'ERROR')
  ),
  CONSTRAINT measurements_confidence_check CHECK (
    smartblock_confidence IS NULL OR (smartblock_confidence >= 0 AND smartblock_confidence <= 1)
  )
);

-- 인덱스 (시계열 쿼리 최적화)
CREATE INDEX idx_measurements_keyword_time
  ON measurements(keyword_id, measured_at DESC);

CREATE INDEX idx_measurements_status
  ON measurements(smartblock_status);

CREATE INDEX idx_measurements_rank
  ON measurements(keyword_id, measured_at DESC, rank_smartblock)
  WHERE rank_smartblock IS NOT NULL;

-- 파티셔닝 (선택사항 - 대용량 데이터용)
-- Supabase는 자동으로 시계열 데이터 최적화를 제공하지만
-- 필요시 수동 파티셔닝 가능

-- Row Level Security
ALTER TABLE measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view measurements for their keywords"
  ON measurements FOR SELECT
  USING (
    keyword_id IN (
      SELECT id FROM keywords WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Service role can insert measurements"
  ON measurements FOR INSERT
  WITH CHECK (true); -- 서비스 키로만 삽입

-- 코멘트
COMMENT ON TABLE measurements IS '키워드별 측정 결과 (시계열 데이터)';
COMMENT ON COLUMN measurements.rank_smartblock IS '스마트블록 순위: 1-3 또는 NULL';
COMMENT ON COLUMN measurements.smartblock_status IS '측정 상태: OK, NOT_IN_BLOCK, BLOCK_MISSING, LOW_CONFIDENCE, ERROR';
COMMENT ON COLUMN measurements.smartblock_confidence IS '탐지 신뢰도: 0.00-1.00';
```

### 2.3 snapshots (HTML 스냅샷)

파싱 실패 시 디버깅을 위한 HTML 스냅샷을 저장합니다.

```sql
CREATE TABLE snapshots (
  id BIGSERIAL PRIMARY KEY,
  keyword_id BIGINT NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,

  -- HTML 데이터 (Supabase Storage 사용 권장)
  storage_path TEXT, -- Supabase Storage 경로
  html_preview TEXT, -- 첫 1000자만 저장 (미리보기용)

  -- 메타데이터
  confidence DECIMAL(3,2),
  file_size_bytes INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 자동 삭제 (30일 이상 된 스냅샷)
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

-- 인덱스
CREATE INDEX idx_snapshots_keyword_created
  ON snapshots(keyword_id, created_at DESC);

CREATE INDEX idx_snapshots_expires
  ON snapshots(expires_at);

-- 자동 삭제 함수
CREATE OR REPLACE FUNCTION delete_expired_snapshots()
RETURNS void AS $$
BEGIN
  DELETE FROM snapshots WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 크론 작업 (Supabase pg_cron 사용)
-- 매일 새벽 3시에 만료된 스냅샷 삭제
-- Supabase Dashboard > Database > Cron Jobs에서 설정:
-- SELECT delete_expired_snapshots();

-- Row Level Security
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view snapshots for their keywords"
  ON snapshots FOR SELECT
  USING (
    keyword_id IN (
      SELECT id FROM keywords WHERE created_by = auth.uid()
    )
  );

-- 코멘트
COMMENT ON TABLE snapshots IS '파싱 실패 시 HTML 스냅샷 (디버깅용)';
COMMENT ON COLUMN snapshots.storage_path IS 'Supabase Storage 버킷 경로';
COMMENT ON COLUMN snapshots.expires_at IS '자동 삭제 날짜 (30일 후)';
```

### 2.4 alerts (알림 기록)

발송된 알림 내역을 저장합니다.

```sql
CREATE TABLE alerts (
  id BIGSERIAL PRIMARY KEY,
  keyword_id BIGINT NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
  measurement_id BIGINT REFERENCES measurements(id) ON DELETE SET NULL,

  -- 알림 정보
  alert_type TEXT NOT NULL,
  -- 'RANK_DROPPED': 스마트블록에서 이탈
  -- 'RANK_DECREASED': 순위 하락
  -- 'PARSING_FAILURE': 파싱 실패
  -- 'QUOTA_WARNING': API 할당량 경고

  severity TEXT NOT NULL,
  -- 'CRITICAL': 즉시 조치 필요
  -- 'HIGH': 빠른 조치 필요
  -- 'MEDIUM': 검토 필요
  -- 'LOW': 정보성

  message TEXT NOT NULL,

  -- 알림 채널
  channels JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- ['slack', 'email', 'sms']

  -- 메타데이터
  metadata JSONB,

  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 제약조건
  CONSTRAINT alerts_type_check CHECK (
    alert_type IN ('RANK_DROPPED', 'RANK_DECREASED', 'PARSING_FAILURE', 'QUOTA_WARNING')
  ),
  CONSTRAINT alerts_severity_check CHECK (
    severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')
  )
);

-- 인덱스
CREATE INDEX idx_alerts_keyword_sent
  ON alerts(keyword_id, sent_at DESC);

CREATE INDEX idx_alerts_type
  ON alerts(alert_type);

CREATE INDEX idx_alerts_severity
  ON alerts(severity, sent_at DESC);

-- Row Level Security
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view alerts for their keywords"
  ON alerts FOR SELECT
  USING (
    keyword_id IN (
      SELECT id FROM keywords WHERE created_by = auth.uid()
    )
  );

-- 코멘트
COMMENT ON TABLE alerts IS '발송된 알림 기록';
COMMENT ON COLUMN alerts.channels IS '알림 채널: slack, email, sms';
COMMENT ON COLUMN alerts.metadata IS '추가 정보 (JSON)';
```

### 2.5 api_usage (API 사용량 추적)

SerpAPI 및 네이버 API 사용량을 추적합니다.

```sql
CREATE TABLE api_usage (
  id BIGSERIAL PRIMARY KEY,

  -- API 정보
  api_provider TEXT NOT NULL,
  -- 'serpapi', 'naver_search', 'naver_datalab'

  endpoint TEXT,

  -- 사용량
  request_count INTEGER NOT NULL DEFAULT 0,

  -- 비용
  cost_usd DECIMAL(10,4),

  -- 시간 범위
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  -- 메타데이터
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 제약조건
  CONSTRAINT api_usage_provider_check CHECK (
    api_provider IN ('serpapi', 'naver_search', 'naver_datalab')
  )
);

-- 인덱스
CREATE INDEX idx_api_usage_provider_period
  ON api_usage(api_provider, period_start DESC);

-- Row Level Security (관리자만)
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view api usage"
  ON api_usage FOR SELECT
  USING (
    auth.jwt() ->> 'role' = 'admin'
  );

-- 코멘트
COMMENT ON TABLE api_usage IS 'API 사용량 및 비용 추적';
```

## 3. 뷰 (Views)

### 3.1 latest_measurements (최신 측정 결과)

```sql
CREATE OR REPLACE VIEW latest_measurements AS
SELECT DISTINCT ON (k.id)
  k.id as keyword_id,
  k.keyword,
  k.target_url,
  m.measured_at,
  m.rank_smartblock,
  m.smartblock_status,
  m.smartblock_confidence,
  m.blog_tab_rank,
  m.search_volume_avg
FROM keywords k
LEFT JOIN measurements m ON k.id = m.keyword_id
WHERE k.is_active = true
ORDER BY k.id, m.measured_at DESC;

-- 코멘트
COMMENT ON VIEW latest_measurements IS '키워드별 최신 측정 결과';
```

### 3.2 rank_changes (순위 변경 이력)

```sql
CREATE OR REPLACE VIEW rank_changes AS
SELECT
  m1.keyword_id,
  k.keyword,
  m1.measured_at as current_time,
  m1.rank_smartblock as current_rank,
  m2.measured_at as previous_time,
  m2.rank_smartblock as previous_rank,
  (m1.rank_smartblock - m2.rank_smartblock) as rank_change
FROM measurements m1
JOIN keywords k ON m1.keyword_id = k.id
JOIN LATERAL (
  SELECT measured_at, rank_smartblock
  FROM measurements
  WHERE keyword_id = m1.keyword_id
    AND measured_at < m1.measured_at
    AND rank_smartblock IS NOT NULL
  ORDER BY measured_at DESC
  LIMIT 1
) m2 ON true
WHERE m1.rank_smartblock IS NOT NULL
  AND m2.rank_smartblock IS NOT NULL
  AND m1.rank_smartblock != m2.rank_smartblock;

-- 코멘트
COMMENT ON VIEW rank_changes IS '순위 변경 발생 이력';
```

### 3.3 keyword_stats (키워드 통계)

```sql
CREATE OR REPLACE VIEW keyword_stats AS
SELECT
  k.id as keyword_id,
  k.keyword,
  k.target_url,
  COUNT(m.id) as total_measurements,
  COUNT(m.id) FILTER (WHERE m.smartblock_status = 'OK') as successful_measurements,
  ROUND(
    COUNT(m.id) FILTER (WHERE m.smartblock_status = 'OK')::numeric /
    NULLIF(COUNT(m.id), 0) * 100,
    2
  ) as success_rate_pct,
  AVG(m.rank_smartblock) FILTER (WHERE m.rank_smartblock IS NOT NULL) as avg_rank,
  MIN(m.rank_smartblock) as best_rank,
  MAX(m.rank_smartblock) as worst_rank,
  AVG(m.duration_ms) as avg_duration_ms,
  MAX(m.measured_at) as last_measured_at
FROM keywords k
LEFT JOIN measurements m ON k.id = m.keyword_id
WHERE k.is_active = true
GROUP BY k.id, k.keyword, k.target_url;

-- 코멘트
COMMENT ON VIEW keyword_stats IS '키워드별 통계 요약';
```

## 4. 함수 (Functions)

### 4.1 get_rank_trend (순위 트렌드)

```sql
CREATE OR REPLACE FUNCTION get_rank_trend(
  p_keyword_id BIGINT,
  p_hours INTEGER DEFAULT 24
)
RETURNS TABLE(
  measured_at TIMESTAMPTZ,
  rank_smartblock INTEGER,
  smartblock_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.measured_at,
    m.rank_smartblock,
    m.smartblock_status
  FROM measurements m
  WHERE m.keyword_id = p_keyword_id
    AND m.measured_at > NOW() - (p_hours || ' hours')::INTERVAL
  ORDER BY m.measured_at ASC;
END;
$$ LANGUAGE plpgsql;

-- 코멘트
COMMENT ON FUNCTION get_rank_trend IS '지정된 시간 동안의 순위 트렌드 조회';
```

### 4.2 check_alert_conditions (알림 조건 확인)

```sql
CREATE OR REPLACE FUNCTION check_alert_conditions(
  p_keyword_id BIGINT,
  p_measurement_id BIGINT
)
RETURNS TABLE(
  should_alert BOOLEAN,
  alert_type TEXT,
  severity TEXT,
  message TEXT
) AS $$
DECLARE
  v_keyword RECORD;
  v_current RECORD;
  v_previous RECORD;
BEGIN
  -- 키워드 설정 조회
  SELECT * INTO v_keyword
  FROM keywords
  WHERE id = p_keyword_id;

  -- 현재 측정 조회
  SELECT * INTO v_current
  FROM measurements
  WHERE id = p_measurement_id;

  -- 이전 측정 조회
  SELECT * INTO v_previous
  FROM measurements
  WHERE keyword_id = p_keyword_id
    AND measured_at < v_current.measured_at
    AND rank_smartblock IS NOT NULL
  ORDER BY measured_at DESC
  LIMIT 1;

  -- 알림 조건 1: 스마트블록 이탈
  IF v_keyword.alert_on_drop
     AND v_previous.rank_smartblock IS NOT NULL
     AND v_current.rank_smartblock IS NULL THEN
    RETURN QUERY SELECT
      true,
      'RANK_DROPPED'::TEXT,
      'CRITICAL'::TEXT,
      format('"%s" 스마트블록에서 이탈 (이전: %s위)',
             v_keyword.keyword, v_previous.rank_smartblock);
    RETURN;
  END IF;

  -- 알림 조건 2: 순위 하락
  IF v_keyword.alert_on_rank_decrease
     AND v_previous.rank_smartblock IS NOT NULL
     AND v_current.rank_smartblock IS NOT NULL
     AND (v_current.rank_smartblock - v_previous.rank_smartblock) >= v_keyword.alert_threshold THEN
    RETURN QUERY SELECT
      true,
      'RANK_DECREASED'::TEXT,
      'MEDIUM'::TEXT,
      format('"%s" 순위 하락: %s위 → %s위',
             v_keyword.keyword, v_previous.rank_smartblock, v_current.rank_smartblock);
    RETURN;
  END IF;

  -- 알림 없음
  RETURN QUERY SELECT false, NULL::TEXT, NULL::TEXT, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 코멘트
COMMENT ON FUNCTION check_alert_conditions IS '측정 후 알림 조건 확인';
```

## 5. 트리거 (Triggers)

### 5.1 자동 알림 생성

```sql
CREATE OR REPLACE FUNCTION auto_create_alert()
RETURNS TRIGGER AS $$
DECLARE
  v_alert_info RECORD;
BEGIN
  -- 알림 조건 확인
  SELECT * INTO v_alert_info
  FROM check_alert_conditions(NEW.keyword_id, NEW.id);

  -- 알림 생성
  IF v_alert_info.should_alert THEN
    INSERT INTO alerts (
      keyword_id,
      measurement_id,
      alert_type,
      severity,
      message,
      channels
    ) VALUES (
      NEW.keyword_id,
      NEW.id,
      v_alert_info.alert_type,
      v_alert_info.severity,
      v_alert_info.message,
      '["slack", "email"]'::jsonb
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_create_alert
  AFTER INSERT ON measurements
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_alert();

-- 코멘트
COMMENT ON FUNCTION auto_create_alert IS '측정 삽입 시 자동으로 알림 생성';
```

## 6. Supabase Realtime 설정

### 6.1 Realtime 활성화

```sql
-- measurements 테이블 실시간 구독 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE measurements;

-- alerts 테이블 실시간 구독 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
```

### 6.2 클라이언트 구독 예시 (TypeScript)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 새로운 측정 결과 실시간 구독
const measurementSubscription = supabase
  .channel('measurements')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'measurements',
      filter: 'keyword_id=eq.1'
    },
    (payload) => {
      console.log('새 측정:', payload.new);
    }
  )
  .subscribe();

// 새로운 알림 실시간 구독
const alertSubscription = supabase
  .channel('alerts')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'alerts'
    },
    (payload) => {
      console.log('새 알림:', payload.new);
      // 브라우저 알림 또는 UI 업데이트
    }
  )
  .subscribe();
```

## 7. Supabase Storage 설정

### 7.1 버킷 생성

Supabase Dashboard > Storage에서 버킷 생성:

- **버킷 이름**: `html-snapshots`
- **공개 여부**: Private
- **파일 크기 제한**: 10MB
- **허용 MIME 타입**: `text/html`

### 7.2 저장소 정책

```sql
-- 사용자별 스냅샷 업로드 허용
CREATE POLICY "Users can upload snapshots"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'html-snapshots' AND
    auth.role() = 'service_role' -- 서비스 키로만 업로드
  );

-- 사용자가 자신의 키워드 스냅샷 조회 허용
CREATE POLICY "Users can view their snapshots"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'html-snapshots' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM keywords WHERE created_by = auth.uid()
    )
  );
```

### 7.3 스냅샷 저장 예시

```typescript
// HTML을 Supabase Storage에 업로드
async function saveSnapshot(
  keywordId: number,
  html: string,
  confidence: number
): Promise<string> {
  const fileName = `${keywordId}/${Date.now()}.html`;

  const { data, error } = await supabase.storage
    .from('html-snapshots')
    .upload(fileName, html, {
      contentType: 'text/html',
      upsert: false
    });

  if (error) throw error;

  // 스냅샷 레코드 생성
  await supabase.from('snapshots').insert({
    keyword_id: keywordId,
    storage_path: data.path,
    html_preview: html.substring(0, 1000),
    confidence,
    file_size_bytes: Buffer.byteLength(html, 'utf8')
  });

  return data.path;
}
```

## 8. 마이그레이션

### 8.1 초기 마이그레이션

```sql
-- migrations/001_initial_schema.sql

BEGIN;

-- 확장 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- 테이블 생성
-- (위의 모든 CREATE TABLE 문)

-- 인덱스 생성
-- (위의 모든 CREATE INDEX 문)

-- 뷰 생성
-- (위의 모든 CREATE VIEW 문)

-- 함수 생성
-- (위의 모든 CREATE FUNCTION 문)

-- 트리거 생성
-- (위의 모든 CREATE TRIGGER 문)

-- RLS 활성화
-- (위의 모든 RLS 정책)

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE measurements;
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;

COMMIT;
```

### 8.2 Supabase CLI를 통한 마이그레이션

```bash
# Supabase 프로젝트 초기화
supabase init

# 로컬 개발 환경 시작
supabase start

# 마이그레이션 생성
supabase migration new initial_schema

# 마이그레이션 파일 편집 후 적용
supabase db push

# 원격 Supabase 프로젝트에 배포
supabase db push --linked
```

## 9. 성능 최적화

### 9.1 파티셔닝 (선택사항)

대용량 데이터(>1M rows)를 위한 월별 파티셔닝:

```sql
-- measurements 테이블을 파티션 테이블로 변환
CREATE TABLE measurements_partitioned (
  LIKE measurements INCLUDING ALL
) PARTITION BY RANGE (measured_at);

-- 월별 파티션 생성
CREATE TABLE measurements_2025_01
  PARTITION OF measurements_partitioned
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE measurements_2025_02
  PARTITION OF measurements_partitioned
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- ... (필요한 만큼 생성)
```

### 9.2 인덱스 최적화

```sql
-- 복합 인덱스 (가장 자주 사용되는 쿼리용)
CREATE INDEX idx_measurements_keyword_status_time
  ON measurements(keyword_id, smartblock_status, measured_at DESC)
  WHERE smartblock_status = 'OK';

-- 부분 인덱스 (조건부)
CREATE INDEX idx_measurements_errors
  ON measurements(keyword_id, measured_at DESC)
  WHERE smartblock_status = 'ERROR';
```

### 9.3 쿼리 최적화

```sql
-- EXPLAIN ANALYZE를 사용하여 쿼리 성능 분석
EXPLAIN ANALYZE
SELECT * FROM latest_measurements
WHERE keyword LIKE '%호텔%';

-- 필요시 인덱스 추가
CREATE INDEX idx_keywords_keyword_trgm
  ON keywords USING gin(keyword gin_trgm_ops);
```

## 10. 백업 및 복구

### 10.1 Supabase 자동 백업

Supabase는 자동으로 다음을 제공합니다:
- **일일 백업**: 7일간 보관
- **포인트-인-타임 복구**: 최근 7일 내 임의 시점
- **수동 백업**: 대시보드에서 직접 생성 가능

### 10.2 수동 백업 (pg_dump)

```bash
# 전체 데이터베이스 백업
pg_dump -h db.xxx.supabase.co \
  -U postgres \
  -d postgres \
  -F c \
  -b -v \
  -f backup_$(date +%Y%m%d).dump

# 특정 테이블만 백업
pg_dump -h db.xxx.supabase.co \
  -U postgres \
  -d postgres \
  -t measurements \
  -F c \
  -f measurements_backup.dump
```

### 10.3 복구

```bash
# 백업 복구
pg_restore -h db.xxx.supabase.co \
  -U postgres \
  -d postgres \
  -v backup_20250102.dump
```

## 11. 모니터링

### 11.1 성능 모니터링

```sql
-- 가장 느린 쿼리 조회
SELECT
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- 테이블 크기 확인
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 인덱스 사용률 확인
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

### 11.2 알림 통계

```sql
-- 알림 유형별 통계
SELECT
  alert_type,
  severity,
  COUNT(*) as count,
  DATE_TRUNC('day', sent_at) as date
FROM alerts
WHERE sent_at > NOW() - INTERVAL '30 days'
GROUP BY alert_type, severity, DATE_TRUNC('day', sent_at)
ORDER BY date DESC, count DESC;
```

---

**문서 상태**: ✅ 완료 - Supabase 기반 스키마 설계 완료
**다음 단계**: Supabase 프로젝트 생성 → 마이그레이션 실행 → API 엔드포인트 테스트
