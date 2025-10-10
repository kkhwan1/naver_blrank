# Naver Blog Smart Block Rank Tracker

## Overview

A web application for tracking Naver blog post rankings within Smart Block search results. The system automatically monitors keyword rankings, provides real-time notifications when rankings change, and helps content creators make data-driven decisions about when to republish content.

**Core Purpose**: Automate the manual process of checking blog post rankings in Naver's integrated search results, particularly within the "Smart Block" (subject area) section.

**Key Features**:
- Automated rank tracking for blog URL + keyword combinations
- Real-time alerts for rank changes and drops
- 30-day trend analysis for optimizing republishing timing
- Scalable from 10 to 1,000+ keywords

**Current Status** (October 2025):
- PostgreSQL database operational with keywords and measurements tables
- REST API for keyword management (add/list/delete)
- Dual measurement methods: HTML parsing (recommended) and SerpAPI
- Accurate Smart Block rank detection using `fds-comps-footer-more-subject` class selector
- Rank 1-3 detection with confidence scoring

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

**October 10, 2025**:
- **Keyword Table Pagination**:
  - Implemented pagination with 14 items per page
  - Previous/Next navigation with page numbers
  - Ellipsis (...) for large page counts
  - Filter change resets to page 1
  - Synchronous page clamping prevents rendering issues when dataset shrinks
  - Safe handling of keyword deletion/filtering edge cases
  - Smooth scroll to top on page change
- **Ranking Visualization Chart**:
  - Implemented RankingChart component using Recharts
  - Line chart with reversed Y-axis (lower rank appears higher)
  - Custom tooltip showing measurement time, rank, and status
  - Statistics cards: best rank, current rank, measurement count
  - Reference lines for rank boundaries (1st, 2nd, 3rd)
  - Integrated into MeasurementDetailDialog as 4th tab ("순위 변동")
  - Filters measurements by rankSmartblock (only shows ranked measurements)
  - Empty state handling for keywords without measurement data
- **Automated Measurement Scheduling System**:
  - Implemented node-cron based scheduler for automatic measurements
  - Four cron jobs: 1h (hourly), 6h (every 6 hours), 12h (twice daily), 24h (daily at midnight)
  - Scheduler lifecycle tied to server startup/shutdown with graceful termination
  - Reuses existing measurement logic (HTML parser + SmartBlockParser + Naver Search Ad API)
  - Admin-only API endpoints: POST /api/scheduler/trigger/:interval, GET /api/scheduler/status
  - Proper error handling and measurement persistence even on failures
- **Measurement Interval Feature**: Implemented configurable auto-measurement intervals
  - Database schema extended with `measurementInterval` field (1h, 6h, 12h, 24h)
  - UI updated: AddKeywordDialog includes interval selection dropdown
  - KeywordTable displays measurement interval with color-coded badges
  - Full data flow: UI → API → Database → UI verified and working
  - Default interval: 24h (can be customized per keyword)
- **Naver Search Ad API Integration**:
  - NaverSearchAdClient implemented with proper credential extraction
  - Fixed extractValue method to handle base64 credentials with "=" characters
  - Keyword search volume statistics display (Note: API credentials need update for production)
  - Related keywords feature functional
- **Smart Block Measurement Stability**:
  - Comprehensive e2e testing completed: rank 1-3 detection verified
  - NOT_IN_BLOCK status handling confirmed
  - Multiple smart block categories detected accurately

**October 6, 2025**:
- Implemented PostgreSQL database schema with keywords and measurements tables
- Built keyword management API endpoints (POST/GET/DELETE /api/keywords)
- Created dual measurement approach: SerpAPI client and HTML parsing method
- Fixed critical SerpAPI integration issues (JSON parsing, field extraction)
- Resolved N+1 query performance issue with batched previous measurements lookup
- Completed comprehensive testing: HTML parsing method superior to SerpAPI
  - HTML parsing: 100% accuracy, faster (1463ms vs 2017ms), detects Smart Block rank 1
  - SerpAPI: Returns BLOCK_MISSING for Naver Smart Block queries
- Enhanced HTML parser to detect multiple Smart Block types:
  - "리빙 인플루언서 콘텐츠", "천안 아산가구단지", "천안삼거리 가구단지", "'천안가구단지' 관련 브랜드 콘텐츠"
  - Uses `fds-comps-footer-more-subject` and `fds-comps-header-headline` CSS selectors for reliable Smart Block detection
- Implemented dynamic smart block detection that works across all keywords
  - Removed restrictive filtering, now detects all smart block categories regardless of keyword
  - Validates smart blocks by checking for blog.naver.com links in parent containers
  - Filters out non-blog content (숏텐츠, 네이버 클립, NAVER NOW) to show only blog-related smart blocks
  - Tested with "밀키트" (9 categories) and "천안가구단지" (6 categories) - all blog categories detected accurately

## System Architecture

### Frontend Architecture

**Framework**: React 18+ with Vite build system
- **Routing**: Wouter for client-side routing
- **UI Component System**: shadcn/ui (Radix UI primitives + Tailwind CSS)
- **Design System**: Material Design-inspired with PandaRank-style analytics interface
- **State Management**: 
  - TanStack Query (React Query) for server state
  - Context API for UI state
- **Styling**: Tailwind CSS 3.4+ with custom design tokens
- **Charts/Visualization**: Recharts for ranking trend charts
- **Form Handling**: React Hook Form with Zod validation

**Design Philosophy**:
- Data-first approach prioritizing information visibility
- Real-time clarity with instant visual feedback
- Scannable layouts for quick status assessment
- Progressive disclosure (summary → details)

**Color System**:
- Rank indicators: Green (success/rank up), Orange (warning/rank 2-3), Red (danger/rank drop)
- Supports light/dark mode with HSL color variables
- Special accent colors for rank badges (gold for #1, silver for #2-3)

**Typography**:
- Primary: Inter for interface text
- Monospace: JetBrains Mono for URLs and timestamps

### Backend Architecture

**Runtime**: Node.js with Express.js
- **Language**: TypeScript (ESNext modules)
- **API Style**: RESTful endpoints
- **Development**: tsx for hot-reload development
- **Production**: esbuild for bundling

**Current Routes**:
- `POST /api/keywords` - Create new keyword tracking
- `GET /api/keywords` - List all keywords
- `DELETE /api/keywords/:id` - Delete keyword
- `POST /api/measure/:keywordId?method=html-parser|serpapi` - Measure Smart Block rank
  - `method=html-parser` (recommended): Direct HTML parsing, 100% accurate
  - `method=serpapi`: SerpAPI integration, less reliable for Smart Block

**Storage Layer**:
- PostgreSQL database (Neon/Replit built-in) with Drizzle ORM
- In-memory storage (MemStorage) available as fallback
- Database operations optimized with batched queries

**Implemented Architecture**:
- HTML parser for Smart Block detection using `fds-comps-footer-more-subject` CSS selector
- SerpAPI client for alternative measurement method
- PostgreSQL storage with Drizzle ORM
- Batched query optimization to prevent N+1 queries
- **Automated Scheduling System**:
  - node-cron based measurement scheduler with 1h/6h/12h/24h intervals
  - Graceful lifecycle management (start on server boot, stop on SIGTERM)
  - Admin-only manual trigger and status endpoints
  - Reuses measurement logic for consistency

**Planned Architecture** (from technical design docs):
- Worker pool for concurrent measurement processing
- Naver Search API for blog tab rankings
- Real-time updates for rank changes via WebSockets
- Frontend dashboard with trend visualization charts
- Migration to BullMQ + Redis for distributed job queue (optional, if scaling needed)

### Data Models

**Current Schema** (shared/schema.ts):
- **keywords** table:
  - id (serial primary key)
  - keyword (text): Search keyword to track
  - targetUrl (text): Blog post URL to monitor
  - measurementInterval (text): Auto-measurement interval (1h, 6h, 12h, 24h) - default 24h
  - isActive (boolean): Tracking status
  - createdAt, updatedAt (timestamps)
  
- **measurements** table:
  - id (serial primary key)
  - keywordId (foreign key to keywords)
  - measuredAt (timestamp): Measurement timestamp
  - rankSmartblock (integer): Position in Smart Block (1-3 or null)
  - smartblockStatus (text): OK, NOT_IN_BLOCK, BLOCK_MISSING, ERROR
  - smartblockConfidence (text): Match confidence (0.00-1.00)
  - blogTabRank (integer): Position in blog tab (planned)
  - searchVolumeAvg (integer): Search volume data (planned)
  - durationMs (integer): Measurement duration
  - errorMessage (text): Error details if any
  - method (text): Measurement method (html-parser or serpapi)

**Planned Models**:
- Alerts/notifications table for rank change alerts
- User preferences for alert thresholds
- Historical aggregations for 30-day trend analysis

### Application Structure

```
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   │   ├── ui/       # shadcn/ui components
│   │   │   └── examples/ # Component usage examples
│   │   ├── pages/        # Route pages (Dashboard, UrlAnalyzer)
│   │   ├── hooks/        # Custom React hooks
│   │   └── lib/          # Utilities and query client
├── server/                # Backend Express application
│   ├── routes.ts         # API route definitions
│   ├── storage.ts        # Data access layer (PostgreSQL + MemStorage)
│   ├── html-parser.ts    # HTML parser for Smart Block detection
│   ├── naver-client.ts   # SerpAPI client
│   ├── smartblock-parser.ts  # Rank matching logic
│   └── vite.ts           # Vite dev server integration
├── shared/               # Shared types and schemas
│   └── schema.ts         # Database schema (Drizzle)
└── attached_assets/      # Project documentation (PRD, HRD, technical specs)
```

### Key Architectural Decisions

**Monorepo Structure**:
- Single repository with client/server separation
- Shared TypeScript types between frontend and backend
- Path aliases (@/ for client, @shared/ for shared code)

**Component Design**:
- Atomic design principles
- Component examples for documentation
- Consistent use of shadcn/ui for accessibility and consistency

**Build System**:
- Vite for fast frontend development
- esbuild for production server bundling
- TypeScript strict mode enabled

**Smart Block Detection Implementation**:
- Primary method: HTML parsing with Cheerio
  - Detects Smart Block using `fds-comps-footer-more-subject` CSS class
  - Supports multiple Smart Block types (인플루언서 콘텐츠, 브랜드 콘텐츠, etc.)
  - Accuracy: 100% for rank 1-3 detection
  - Performance: ~1500ms per measurement
- Secondary method: SerpAPI
  - Limitation: Returns BLOCK_MISSING for most queries
  - Not recommended for production use
  - Kept for fallback/comparison purposes

**API Rate Limiting Considerations**:
- SerpAPI quota limitations: 100 requests/month (free tier)
- HTML parsing has no rate limits (direct web scraping)
- Future: Redis-based distributed locking for concurrent measurements

**Security Considerations** (from HRD):
- Need for input validation and SQL injection prevention
- Rate limiting implementation required
- Row-level security for multi-tenant data

## External Dependencies

### Core Framework Dependencies
- **React 18** - Frontend UI framework
- **Express.js** - Backend web server
- **Vite** - Build tool and dev server
- **TypeScript** - Type-safe development

### UI & Styling
- **Radix UI** - Accessible component primitives (full suite including dialogs, dropdowns, tooltips, etc.)
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Pre-built component system
- **Recharts** - Chart visualization library
- **Lucide React** - Icon library
- **class-variance-authority** - Component variant management
- **Framer Motion** - Animation library (planned per docs)

### Data & State Management
- **TanStack Query (React Query)** - Server state management
- **React Hook Form** - Form handling
- **Zod** - Runtime type validation and schema validation
- **Drizzle ORM** - Database ORM for PostgreSQL
- **@neondatabase/serverless** - Neon serverless PostgreSQL driver

### Planned External Services
- **SerpAPI** - Naver search result scraping
- **Naver Search API** - Official blog search rankings
- **Naver DataLab API** - Search volume data
- **Supabase** - Real-time subscriptions and PostgreSQL hosting
- **BullMQ + Redis** - Job queue and scheduling
- **Slack/SMS** - Alert notifications (per PRD)

### Development Tools
- **Wouter** - Lightweight routing library
- **tsx** - TypeScript execution for development
- **esbuild** - Production bundling
- **Cheerio** - HTML parsing for web scraping
- **Axios** - HTTP client for external APIs
- **nanoid** - Unique ID generation

### Database
- **PostgreSQL** - Primary database (via Neon/Supabase)
- **Drizzle Kit** - Database migrations
- **connect-pg-simple** - PostgreSQL session store

### Replit-Specific
- **@replit/vite-plugin-runtime-error-modal** - Development error overlay
- **@replit/vite-plugin-cartographer** - Development tooling
- **@replit/vite-plugin-dev-banner** - Development banner