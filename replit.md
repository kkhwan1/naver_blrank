# Naver Blog Smart Block Rank Tracker

## Overview

A web application for tracking Naver blog post rankings within Smart Block search results. The system automatically monitors keyword rankings, provides real-time notifications when rankings change, and helps content creators make data-driven decisions about when to republish content.

**Core Purpose**: Automate the manual process of checking blog post rankings in Naver's integrated search results, particularly within the "Smart Block" (subject area) section.

**Key Features**:
- Automated rank tracking for blog URL + keyword combinations
- Real-time alerts for rank changes and drops
- 30-day trend analysis for optimizing republishing timing
- Scalable from 10 to 1,000+ keywords

## User Preferences

Preferred communication style: Simple, everyday language.

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
- `POST /api/analyze` - URL analysis endpoint for extracting keywords and metadata from blog posts

**Storage Layer**:
- Currently using in-memory storage (MemStorage class)
- Schema defined with Drizzle ORM
- Designed for PostgreSQL migration (Drizzle configuration present)

**Planned Architecture** (from technical design docs):
- Job scheduling with BullMQ + Redis
- Worker pool for measurement processing
- SerpAPI integration for Naver SERP scraping
- Smart Block HTML parser for rank extraction
- Naver Search API for blog tab rankings
- Real-time updates via Supabase Realtime WebSocket

### Data Models

**Current Schema** (shared/schema.ts):
- Users table with username/password authentication
- Validation using Zod schemas

**Planned Models** (from PRD/technical docs):
- Keywords tracking table
- Measurements/rankings history
- Alerts/notifications
- Search volume data

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
│   ├── storage.ts        # Data access layer
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

**API Rate Limiting Considerations**:
- Technical docs identify SerpAPI quota limitations (100 requests/month)
- Proposed hybrid approach using Naver API + SerpAPI
- Redis-based distributed locking for concurrency control (planned)

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