# Naver Blog Smart Block Rank Tracker

## Overview

This project is a web application designed to automate the tracking of Naver blog post rankings within Smart Block search results. Its primary purpose is to eliminate the manual effort of monitoring keyword positions, providing real-time alerts for rank changes, and offering 30-day trend analysis to optimize content republishing strategies. The system aims to scale from tracking a few keywords to over a thousand, enabling content creators to make data-driven decisions.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is built with React 18+ and Vite, utilizing Wouter for routing. UI components are developed using shadcn/ui (Radix UI primitives + Tailwind CSS), adhering to a Material Design-inspired aesthetic focused on data visibility and real-time feedback. State management is handled by TanStack Query for server state and the Context API for UI state. Recharts is used for visualizing ranking trends. Forms are managed with React Hook Form and Zod for validation. The design emphasizes scannable layouts, progressive disclosure, and a color system that uses green, orange, and red for rank indicators, supporting both light and dark modes. Typography uses Inter for interface text and JetBrains Mono for monospace elements.

### Backend Architecture

The backend operates on Node.js with Express.js and TypeScript, using tsx for development and esbuild for production bundling. It exposes RESTful API endpoints for managing keywords and initiating measurements. Data storage is PostgreSQL via **Supabase** (Seoul region, ap-northeast-2) managed by Drizzle ORM, with an in-memory fallback. The system uses **postgres** package driver with Supabase Session pooler (port 5432) for IPv4 compatibility and prepared statements support. Session storage uses memorystore for development (not production-ready). A key component is the HTML parser, which accurately detects Smart Block rankings using the `fds-comps-footer-more-subject` CSS selector, offering superior accuracy and performance compared to the less reliable SerpAPI integration. An automated scheduling system based on node-cron allows for configurable measurement intervals (1h, 6h, 12h, 24h) per keyword, with graceful lifecycle management.

### Data Models

The current database schema includes `keywords` and `measurements` tables. The `keywords` table stores search keywords, target URLs, configurable `measurementInterval`, `isActive` status, `documentCount` (number of competing documents), and `competitionRate` (documentCount / monthlySearchVolume). 

The `measurements` table records:
- Basic measurements: `measuredAt`, `rankSmartblock` (1-3 or null), `smartblockStatus` (OK, NOT_IN_BLOCK, BLOCK_MISSING, ERROR, RANKED_BUT_HIDDEN), `smartblockConfidence`, `durationMs`, `method`
- **Phase 2 hidden reason classification** (October 2025): `hiddenReason`, `hiddenReasonCategory` (품질 필터, 스팸 의심, 일시적 검토, 정책 위반, 알 수 없음), `hiddenReasonDetail`, `detectionMethod`, `recoveryEstimate`, `actionGuide`
- Search visibility tracking: `isVisibleInSearch` (boolean)

### Key Architectural Decisions

The project uses a monorepo structure with shared TypeScript types between the frontend and backend. Component design follows atomic principles, leveraging shadcn/ui for consistency and accessibility. Vite and esbuild are used for efficient build processes. The primary Smart Block detection method is direct HTML parsing with Cheerio due to its 100% accuracy for rank 1-3 detection and superior performance. SerpAPI is maintained for fallback/comparison but is not recommended for production Smart Block tracking.

## Recent Changes (October 2025)

### Database Migration to Supabase (✅ Completed - October 14, 2025)
- **Migration**: Successfully migrated from Neon PostgreSQL to **Supabase PostgreSQL** (Seoul region, ap-northeast-2)
- **Connection Details**:
  - Host: `aws-1-ap-northeast-2.pooler.supabase.com`
  - Connection mode: **Session pooler** (port 5432)
  - Driver: `postgres` package (replaced `@neondatabase/serverless`)
  - Prepared statements: **Enabled** (Session pooler supports prepared statements)
- **Session Storage**: Changed from `connect-pg-simple` to `memorystore` (temporary solution for development)
- **Schema Migration**: Successfully applied complete database schema using `npm run db:push`
  - Tables created: users, keywords, measurements, groups, keyword_groups, user_settings
  - All existing features working: authentication, keyword tracking, measurements, hidden reason classification
- **Testing**: Verified all functionality with test keyword "바겐슈타이거"
  - ✅ User authentication
  - ✅ Keyword creation
  - ✅ HTML parser measurements
  - ✅ Smart Block detection
  - ✅ Competition analysis ready

### 통합검색 이탈 감지 기능 (✅ Completed - October 2025)
**핵심 요구사항**: 스마트블록 순위는 있지만 통합검색에서 주제어 롤링으로 실제 노출되지 않을 때 빨간색 경고 표시

- **Backend Detection**: 
  - HTML Parser의 CSS visibility 체크 (display:none, visibility:hidden, opacity:0 등)
  - `RANKED_BUT_HIDDEN` 상태 감지: 순위는 있지만 실제로 숨겨진 경우
  - `isVisibleInSearch` 필드로 통합검색 실제 노출 여부 추적
  
- **UI Implementation**:
  - **StatusDot**: 빨간색 + 깜빡이는 애니메이션 (`bg-destructive animate-pulse`)
  - **Tooltip**: "통합검색 이탈" 레이블로 상태 명확히 표시
  - **MeasurementDetailDialog**: "통합검색 이탈 감지" 경고 배너 with 카테고리별 아이콘/색상
  
- **Hidden Reason Classification**: 
  - 품질 필터 (Quality Filter) - Shield icon, amber color
  - 스팸 의심 (Spam Suspected) - Ban icon, red color
  - 일시적 검토 (Temporary Review) - Clock icon, blue color
  - 정책 위반 (Policy Violation) - FileWarning icon, red color
  - 알 수 없음 (Unknown) - AlertTriangle icon
  
- **User Guidance**: 복구 예상 시간 및 조치 안내 메시지 제공

### Phase 2: Hidden Reason Classification System (✅ Completed)
- **Data Model Extension**: Added `hiddenReason`, `hiddenReasonCategory`, `hiddenReasonDetail`, `detectionMethod`, `recoveryEstimate` fields to measurements table
- **Classification Engine**: Created `hidden-reason-classifier.ts` to translate technical CSS hiding reasons into user-friendly business categories
- **Category System**: 품질 필터, 스팸 의심, 일시적 검토, 정책 위반, 알 수 없음
- **Bug Fix**: Standardized category naming from underscores to spaces (품질_필터 → 품질 필터) to match frontend expectations

### Competition Analysis Feature (✅ Completed - October 2025)
- **Data Model**: Added `documentCount` and `competitionRate` fields to keywords table
- **Naver Search API Integration**: Implemented document count retrieval via blog search API (total field)
- **Competition Rate Calculation**: Formula = documentCount / monthlySearchVolume (fully documented in code)
- **API Endpoint**: POST `/api/keywords/:id/update-competition` fetches document count and calculates competition rate
- **Keyword Sanitization**: Special characters removed before API calls (keeps only Korean, English, numbers, spaces) to prevent 400 errors
- **UI Enhancement**: Added documentCount and competitionRate columns to KeywordTable with clickable badges
- **Remeasurement Feature**: Clicking rank badge or measurement interval badge triggers both rank measurement and competition update
- **Storage Layer**: Implemented `updateKeywordCompetition` in both MemStorage and PostgresStorage

### Blog Metadata Extraction (✅ Completed - October 2025)
- **Data Model**: Added `blogName`, `author`, `publishedDate` fields to BlogResult interface
- **HTML Parser Enhancement**: 
  - Escalates to SmartBlock card container (li.bx, div[data-cr-area*="blog"]) for comprehensive metadata extraction
  - Prioritizes data-time attributes for reliable date extraction
  - Parses Naver-specific metadata blocks (.source_txt, .source_box, .detail_info)
  - Handles bullet-separated (·) metadata information
  - Supports various date formats: "5일 전", "2024.10.11", "어제", "오늘", etc.
- **Title Cleanup**: Automatically removes "접기" suffix from blog post titles
- **API Integration**: topBlogs in measurement responses now include blogName, author, and publishedDate
- **UI Display**: Measurement Detail Dialog shows enriched blog cards with:
  - Blog/post title (cleaned)
  - Blog name or author name
  - Published date when available
- **Testing**: E2E tests confirm metadata extraction and display functionality

### Phase 3: Pattern Analysis & Shadowban Detection (🚧 Planned)
Future enhancements include:
- Time-series pattern analysis for trend detection
- Shadowban detection algorithm (7+ consecutive days hidden)
- Automated re-measurement scheduler (30min/1hr intervals)
- Recovery notifications and alerts
- Worker pool for concurrent processing
- Naver Search API integration
- Real-time updates via WebSockets

## External Dependencies

### Core Framework Dependencies
- **React 18**
- **Express.js**
- **Vite**
- **TypeScript**

### UI & Styling
- **Radix UI**
- **Tailwind CSS**
- **shadcn/ui**
- **Recharts**
- **Lucide React**
- **class-variance-authority**

### Data & State Management
- **TanStack Query (React Query)**
- **React Hook Form**
- **Zod**
- **Drizzle ORM**
- **postgres** (PostgreSQL driver for Supabase)

### External Services & APIs
- **SerpAPI** (for general search result scraping, less reliable for Smart Block)
- **Naver Search Ad API** (for keyword search volume and related keywords)

### Development Tools
- **Wouter**
- **tsx**
- **esbuild**
- **Cheerio**
- **Axios**
- **nanoid**
- **node-cron**

### Database
- **PostgreSQL** (via Supabase, Seoul region)

### Replit-Specific
- **@replit/vite-plugin-runtime-error-modal**
- **@replit/vite-plugin-cartographer**
- **@replit/vite-plugin-dev-banner**