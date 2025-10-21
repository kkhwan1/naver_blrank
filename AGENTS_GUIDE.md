# Blrank_naver 프로젝트 Agent 활용 가이드

## 개요

이 프로젝트에서는 27개의 전문 AI Agent를 활용할 수 있습니다. 각 Agent는 특정 도메인에 특화되어 있으며, 키워드 기반으로 자동 활성화되거나 명시적으로 호출할 수 있습니다.

## Agent 시스템 작동 원리

### 자동 활성화 (Auto-Activation)
- **신뢰도 임계값**: 0.75 이상일 때 자동 활성화
- **점수 계산 방식**:
  - 키워드 매칭: 40%
  - 컨텍스트 관련성: 30%
  - 과거 성공률: 20%
  - 도구 가용성: 10%

### 명시적 호출 (Task Tool)
```typescript
// 예시: Database Architect Agent 직접 호출
{
  subagent_type: "database-architect",
  description: "PostgreSQL 스키마 최적화",
  prompt: "keywords 테이블과 measurements 테이블의 인덱스 전략 개선"
}
```

---

## 사용 가능한 Agent 목록 (27개)

### 🎨 Frontend & UI 전문가

#### 1. **frontend-developer** (신뢰도: 0.92)
- **역할**: React 컴포넌트 개발, 반응형 레이아웃, 접근성
- **활성화 키워드**: React, component, UI, responsive, accessibility, CSS, Tailwind
- **주요 작업**: 컴포넌트 생성, 스타일 최적화, UI 개선
- **Blrank_naver 활용**:
  - Dashboard 컴포넌트 리팩토링
  - 차트 시각화 개선 (Recharts 최적화)
  - 모바일 반응형 레이아웃 강화

#### 2. **web-accessibility-checker** (신뢰도: 0.88)
- **역할**: WCAG 준수성 검사, 스크린 리더 호환성
- **활성화 키워드**: WCAG, accessibility, compliance, screen reader, ARIA
- **주요 작업**: 접근성 감사, 검증, 개선
- **Blrank_naver 활용**:
  - 키워드 테이블 접근성 검증
  - 폼 요소 ARIA 라벨 추가

---

### 🗄️ Backend & Database 전문가

#### 3. **backend-architect** (신뢰도: 0.90)
- **역할**: API 설계, 마이크로서비스 아키텍처, 확장성
- **활성화 키워드**: API, server, microservices, architecture, scalability
- **주요 작업**: 시스템 설계, 최적화, 확장
- **Blrank_naver 활용**:
  - Express 라우트 구조 개선
  - Scheduler 시스템 아키텍처 리뷰

#### 4. **database-architect** (신뢰도: 0.93) ⭐ **최우선 추천**
- **역할**: 데이터베이스 스키마 설계, 정규화, 최적화
- **활성화 키워드**: database, schema, data model, PostgreSQL, normalization
- **주요 작업**: 스키마 설계, 모델링, 최적화, 마이그레이션
- **Blrank_naver 활용**:
  - `keywords`, `measurements` 테이블 인덱스 전략 최적화
  - `keyword_recommendations` JSONB 구조 개선
  - 측정 데이터 파티셔닝 전략 (30일 이상 데이터 관리)
  - 쿼리 성능 분석 및 개선

#### 5. **database-optimizer** (신뢰도: 0.89)
- **역할**: 쿼리 최적화, 인덱스, 느린 쿼리 분석
- **활성화 키워드**: query, performance, index, optimization, slow query
- **주요 작업**: 쿼리 튜닝, 분석, 벤치마크
- **Blrank_naver 활용**:
  - 대시보드 측정 데이터 조회 쿼리 최적화
  - JOIN 성능 개선 (keywords + measurements)

#### 6. **database-optimization** (신뢰도: 0.87)
- **역할**: 성능 병목 해결, 실행 계획 분석
- **활성화 키워드**: performance, bottleneck, execution plan, query tuning
- **주요 작업**: 최적화, 분석, 벤치마크

#### 7. **database-admin** (신뢰도: 0.86)
- **역할**: 백업, 복제, 모니터링, 운영
- **활성화 키워드**: backup, replication, monitoring, administration
- **주요 작업**: 설정, 모니터링, 유지보수

#### 8. **supabase-schema-architect** (신뢰도: 0.91)
- **역할**: Supabase/PostgreSQL 스키마, RLS, 마이그레이션
- **활성화 키워드**: Supabase, PostgreSQL, RLS, migration, schema design
- **주요 작업**: 스키마 설계, 마이그레이션, 보안, 최적화
- **Blrank_naver 활용**:
  - Neon Database 스키마 설계 개선
  - RLS 정책 구현 (multi-tenant 지원 준비)

---

### 🔍 Code Quality & Review 전문가

#### 9. **code-reviewer** (신뢰도: 0.90) ⭐ **최우선 추천**
- **역할**: 코드 품질 검토, 베스트 프랙티스, 리팩토링
- **활성화 키워드**: review, quality, best practices, refactor, clean code
- **주요 작업**: 코드 리뷰, 분석, 개선 제안
- **Blrank_naver 활용**:
  - `server/html-parser.ts` 코드 품질 검토
  - `server/scheduler.ts` 에러 처리 개선
  - TypeScript 타입 안정성 강화

#### 10. **architect-reviewer** (신뢰도: 0.88)
- **역할**: 아키텍처 일관성, SOLID 원칙, 유지보수성
- **활성화 키워드**: architecture, SOLID, patterns, design, maintainability
- **주요 작업**: 아키텍처 리뷰, 검증, 평가

#### 11. **dependency-manager** (신뢰도: 0.85)
- **역할**: 의존성 분석, npm 패키지, 취약점, 라이선스
- **활성화 키워드**: dependencies, npm, packages, vulnerabilities, licenses
- **주요 작업**: 의존성 분석, 업데이트, 감사
- **Blrank_naver 활용**:
  - `package.json` 보안 취약점 검사
  - 미사용 의존성 제거

---

### 📝 Documentation 전문가

#### 12. **documentation-expert** (신뢰도: 0.91) ⭐ **최우선 추천**
- **역할**: 기술 문서 작성, API 문서, 가이드
- **활성화 키워드**: documentation, README, API docs, guides, technical writing
- **주요 작업**: 문서 생성, 개선, 유지보수
- **Blrank_naver 활용**:
  - API 엔드포인트 자동 문서화 (Swagger/OpenAPI)
  - `CLAUDE.md` 업데이트 자동화
  - 사용자 가이드 작성 (키워드 등록, 측정 주기 설정)

#### 13. **technical-writer** (신뢰도: 0.90)
- **역할**: 튜토리얼, 가이드, 사용자 매뉴얼
- **활성화 키워드**: tutorial, guide, documentation, user manual, instructions
- **주요 작업**: 작성, 생성, 설명, 문서화

---

### 📊 Product & Business 전문가

#### 14. **product-strategist** (신뢰도: 0.87)
- **역할**: 제품 전략, 로드맵, 시장 분석
- **활성화 키워드**: product, strategy, roadmap, positioning, market analysis
- **주요 작업**: 분석, 기획, 전략, 리서치
- **Blrank_naver 활용**:
  - 기능 우선순위 결정 (알림 시스템 vs 경쟁사 분석)
  - 사용자 페르소나 정의

#### 15. **business-analyst** (신뢰도: 0.86)
- **역할**: KPI, 지표, 수익 분석, 리포팅
- **활성화 키워드**: KPI, metrics, revenue, analysis, reporting, business intelligence
- **주요 작업**: 분석, 추적, 리포팅, 측정

#### 16. **competitive-intelligence-analyst** (신뢰도: 0.85)
- **역할**: 경쟁사 분석, 시장 조사, 산업 트렌드
- **활성화 키워드**: competitor, market research, intelligence, industry trends
- **주요 작업**: 분석, 조사, 정보 수집, 리포팅

---

### 📢 Marketing 전문가

#### 17. **content-marketer** (신뢰도: 0.84)
- **역할**: 콘텐츠 마케팅, SEO, 블로그, 소셜 미디어
- **활성화 키워드**: content, marketing, SEO, blog, social media, engagement
- **주요 작업**: 콘텐츠 생성, 최적화, 발행, 분석

#### 18. **marketing-attribution-analyst** (신뢰도: 0.86)
- **역할**: 마케팅 어트리뷰션, 캠페인, ROI, 전환
- **활성화 키워드**: attribution, campaign, ROI, conversion, analytics
- **주요 작업**: 분석, 추적, 측정, 최적화

---

### 🛠️ Expert & Specialist Agent

#### 19. **mcp-expert** (신뢰도: 0.90)
- **역할**: MCP 통합, 서버 구성
- **활성화 키워드**: MCP, Model Context Protocol, integration, server configuration
- **주요 작업**: MCP 생성, 구성, 통합, 구현

#### 20. **command-expert** (신뢰도: 0.87)
- **역할**: CLI 명령어, 터미널, 스크립트, 자동화
- **활성화 키워드**: CLI, command, terminal, script, automation
- **주요 작업**: CLI 도구 생성, 설계, 구현, 자동화

#### 21. **task-decomposition-expert** (신뢰도: 0.88)
- **역할**: 작업 분해, 기획, 워크플로우 오케스트레이션
- **활성화 키워드**: task, breakdown, planning, workflow, orchestration
- **주요 작업**: 작업 분해, 기획, 구조화

#### 22. **query-clarifier** (신뢰도: 0.83)
- **역할**: 쿼리 명확화, 요구사항 정의
- **활성화 키워드**: clarify, refine, analyze query, requirements, specification
- **주요 작업**: 명확화, 분석, 정의

#### 23. **search-specialist** (신뢰도: 0.85)
- **역할**: 검색, 리서치, 정보 수집, 조사
- **활성화 키워드**: search, research, information gathering, web search, investigation
- **주요 작업**: 검색, 조사, 정보 수집

---

### 🤖 Computer Vision & AI 전문가

#### 24. **computer-vision-engineer** (신뢰도: 0.89)
- **역할**: 이미지 분석, OCR, 객체 감지, 비전 AI
- **활성화 키워드**: image, vision, OCR, detection, recognition, visual AI
- **주요 작업**: 이미지 분석, 감지, 인식, 처리

#### 25. **hackathon-ai-strategist** (신뢰도: 0.84)
- **역할**: 해커톤 전략, 아이디어, 실행 가능성, 프레젠테이션
- **활성화 키워드**: hackathon, strategy, ideation, feasibility, presentation
- **주요 작업**: 전략 수립, 평가, 기획, 가이드

---

### 🌐 URL & Web Analysis 전문가

#### 26. **url-link-extractor** (신뢰도: 0.86)
- **역할**: URL 추출, 링크 카탈로그, 웹사이트 분석
- **활성화 키워드**: URL, link, extract, catalog, website analysis
- **주요 작업**: URL 추출, 카탈로그, 분석

#### 27. **url-context-validator** (신뢰도: 0.85)
- **역할**: URL 검증, 링크 확인, 컨텍스트 분석
- **활성화 키워드**: URL validation, link check, context analysis, appropriateness
- **주요 작업**: URL 검증, 확인, 분석

---

## Blrank_naver 프로젝트 우선순위 Agent 추천

### 🥇 1순위: database-architect (신뢰도: 0.93)
**왜 필요한가?**
- 측정 데이터가 누적되면서 성능 저하 가능성
- `measurements` 테이블 인덱스 전략 최적화 필요
- JSONB 컬럼 (`keyword_recommendations.recommendations`) 쿼리 효율화

**활용 시나리오**:
```
"measurements 테이블의 30일 이상 데이터 파티셔닝 전략을 설계해주세요"
→ database-architect 자동 활성화
```

### 🥈 2순위: code-reviewer (신뢰도: 0.90)
**왜 필요한가?**
- HTML 파싱 로직(`html-parser.ts`) 안정성 검증
- 스케줄러 에러 처리 개선
- TypeScript 타입 안정성 강화

**활용 시나리오**:
```
"server/scheduler.ts의 에러 처리 로직을 리뷰하고 개선점을 제안해주세요"
→ code-reviewer 자동 활성화
```

### 🥉 3순위: frontend-developer (신뢰도: 0.92)
**왜 필요한가?**
- Dashboard 컴포넌트 성능 최적화
- 차트 시각화 개선 (Recharts)
- 모바일 반응형 강화

**활용 시나리오**:
```
"Dashboard의 측정 데이터 차트를 React.memo로 최적화해주세요"
→ frontend-developer 자동 활성화
```

### 4순위: documentation-expert (신뢰도: 0.91)
**왜 필요한가?**
- API 문서 자동화 (Swagger/OpenAPI)
- 사용자 가이드 작성
- 코드 주석 개선

**활용 시나리오**:
```
"모든 API 엔드포인트에 대한 OpenAPI 문서를 생성해주세요"
→ documentation-expert 자동 활성화
```

---

## 실전 사용 예시

### 예시 1: 데이터베이스 최적화
```
요청: "keywords 테이블과 measurements 테이블의 JOIN 쿼리가 느립니다. 인덱스 전략을 개선해주세요."

자동 활성화 Agent: database-optimizer (신뢰도: 0.89)
- "query", "performance", "index" 키워드 감지
- PostgreSQL 실행 계획 분석
- 복합 인덱스 생성 제안
- 쿼리 리팩토링 가이드
```

### 예시 2: React 컴포넌트 리팩토링
```
요청: "Dashboard 컴포넌트의 렌더링 성능을 개선하고 싶습니다."

자동 활성화 Agent: frontend-developer (신뢰도: 0.92)
- "component", "performance" 키워드 감지
- React.memo, useMemo 적용
- 불필요한 re-render 제거
- TanStack Query 캐싱 최적화
```

### 예시 3: 코드 품질 검토
```
요청: "server/html-parser.ts의 코드 품질을 검토하고 개선점을 제안해주세요."

자동 활성화 Agent: code-reviewer (신뢰도: 0.90)
- "review", "quality", "refactor" 키워드 감지
- SOLID 원칙 위반 사항 지적
- 에러 처리 개선 제안
- 테스트 커버리지 제안
```

### 예시 4: API 문서 자동화
```
요청: "server/routes.ts의 모든 엔드포인트를 Swagger 문서로 변환해주세요."

자동 활성화 Agent: documentation-expert (신뢰도: 0.91)
- "documentation", "API" 키워드 감지
- OpenAPI 3.0 스키마 생성
- JSDoc 주석 추가
- Swagger UI 설정
```

---

## Agent 명시적 호출 방법

자동 활성화가 되지 않을 때는 Task tool로 직접 호출할 수 있습니다:

```typescript
// 예시: Database Architect를 명시적으로 호출
Task({
  subagent_type: "database-architect",
  description: "PostgreSQL 스키마 최적화",
  prompt: `
    Blrank_naver 프로젝트의 measurements 테이블이 급증하고 있습니다.

    현재 상황:
    - 매일 수천 개의 측정 레코드 생성
    - 30일 이상 데이터 보관 필요
    - measuredAt, keywordId 기준 조회 빈번

    다음을 수행해주세요:
    1. 파티셔닝 전략 제안 (Range Partitioning by measuredAt)
    2. 인덱스 최적화 (복합 인덱스 전략)
    3. 마이그레이션 스크립트 작성
  `
})
```

---

## 주의사항

1. **자동 활성화 신뢰도**: 0.75 미만일 경우 일반 모드로 동작
2. **다중 Agent 협업**: 복잡한 작업은 여러 Agent가 순차적으로 활성화될 수 있음
3. **컨텍스트 유지**: Agent 간 정보 공유로 일관성 유지
4. **성능 고려**: Agent 활성화 시 약간의 오버헤드 발생 (< 100ms)

---

## 추가 자료

- **Agent 시스템 상세 문서**: `C:\Users\USER\.claude\ORCHESTRATOR.md`
- **Agent 템플릿**: `C:\Users\USER\.claude\agents\*.md`
- **SuperClaude 프레임워크**: `C:\Users\USER\.claude\CLAUDE.md`

---

**작성일**: 2025-01-20
**버전**: 1.0
**프로젝트**: Blrank_naver - Naver Blog Smart Block Rank Tracker
