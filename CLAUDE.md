# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Naver Blog Smart Block Rank Tracker** - a full-stack web application that automates tracking Naver blog post rankings within Smart Block search results. It eliminates manual monitoring of keyword positions, provides real-time alerts for rank changes, and offers 30-day trend analysis for optimizing content republishing strategies. The system is designed to scale from tracking a few keywords to over a thousand.

## Tech Stack

### Frontend
- **React 18** with **Vite** for fast development and bundling
- **Wouter** for lightweight client-side routing
- **shadcn/ui** (Radix UI + Tailwind CSS) for component library following Material Design
- **TanStack Query** for server state management
- **Recharts** for ranking trend visualization
- **React Hook Form** + **Zod** for form handling and validation

### Backend
- **Express.js** with **TypeScript**
- **Drizzle ORM** with **PostgreSQL** database
- **Passport.js** for authentication with local strategy
- **node-cron** for scheduled measurement tasks
- **Cheerio** for HTML parsing (primary Smart Block detection method)
- **Axios** for external API calls
- Session persistence in PostgreSQL (not in-memory) for production stability

### Development Tools
- **tsx** for TypeScript execution in development
- **esbuild** for fast production builds
- **TypeScript** with strict mode enabled
- **Tailwind CSS** for styling

## Development Commands

```bash
# Development (hot reload)
npm run dev

# Build for production
npm run build

# Run production server
npm start

# Type checking
npm run check

# Push database schema changes
npm run db:push
```

**Important Notes:**
- Server runs on port specified by `PORT` env variable (default: 5000)
- Development uses `tsx` for hot reload
- Production builds use `esbuild` for server and `vite build` for client
- Both API and client are served from the same port

## Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── pages/         # Route pages (Dashboard, Analytics, Settings, etc.)
│   │   ├── components/    # Reusable React components
│   │   ├── hooks/         # Custom React hooks (use-auth, use-mobile)
│   │   └── main.tsx       # Frontend entry point
│   └── index.html         # HTML template
│
├── server/                 # Express backend
│   ├── index.ts           # Server entry point, session config, scheduler init
│   ├── routes.ts          # API route definitions
│   ├── auth.ts            # Passport.js authentication strategy
│   ├── storage.ts         # Database operations layer (Drizzle ORM)
│   ├── html-parser.ts     # Naver HTML parsing for Smart Block detection
│   ├── smartblock-parser.ts # Legacy parser (fallback)
│   ├── scheduler.ts       # Cron-based measurement automation
│   ├── naver-client.ts    # Naver Search API client
│   ├── naver-search-client.ts # Naver unified search client
│   ├── naver-searchad-client.ts # Naver Search Ad API (keyword volume, related keywords)
│   ├── hidden-reason-classifier.ts # AI-powered hidden reason analysis
│   └── vite.ts            # Vite dev server integration
│
├── shared/                 # Shared TypeScript types
│   └── schema.ts          # Drizzle database schema + Zod validation schemas
│
├── migrations/             # Database migration files
├── dist/                   # Production build output
│   ├── public/            # Built frontend assets
│   └── index.js           # Built server bundle
│
├── attached_assets/        # Stored attachments and samples
├── tmp/                    # Temporary files (HTML samples for testing)
│
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── vite.config.ts         # Vite build configuration
├── drizzle.config.ts      # Drizzle ORM configuration
├── tailwind.config.ts     # Tailwind CSS configuration
├── design_guidelines.md   # UI/UX design system documentation
└── replit.md              # Detailed system architecture documentation
```

## High-Level Architecture

### Data Flow
1. **User adds keyword** → Stored in `keywords` table with `targetUrl` and `measurementInterval`
2. **Scheduler runs** (via `node-cron`) → Triggers measurements at configured intervals (1h, 6h, 12h, 24h)
3. **HTML Parser** → Fetches Naver search results, extracts Smart Block rankings using Cheerio
4. **Measurement stored** → Results saved to `measurements` table with rank, status, confidence, metadata
5. **Frontend polls** → TanStack Query fetches latest measurements, updates charts and tables
6. **Alerts triggered** → If rank drops or visibility lost, user is notified

### Smart Block Detection System

**Primary Method: Direct HTML Parsing (`html-parser.ts`)**
- Fetches raw HTML from Naver search results
- Uses Cheerio to parse DOM and locate Smart Block section
- Searches for target URL within Smart Block using `fds-comps-footer-more-subject` CSS selector
- Extracts comprehensive blog metadata from JSON data in `<script type="application/json">` tags
- **Advantages:** High accuracy (95%+), no API costs, extracts 100% metadata coverage
- **Detection Confidence:** Calculated based on URL match quality and position certainty

**Fallback Method: SerpAPI (`smartblock-parser.ts`)**
- Used when HTML parsing fails or for validation
- Lower accuracy, API costs, but simpler implementation

### Hidden Reason Classification

When a blog post is ranked but not visible in search:
- **Phase 1:** Technical detection (CSS `display:none`, `visibility:hidden`, `opacity:0`, z-index)
- **Phase 2:** AI-powered classification into user-friendly categories:
  - Quality filter (품질 필터)
  - Spam suspected (스팸 의심)
  - Temporary review (일시적 검토)
  - Ad priority display (광고 우선노출)
- Provides recovery time estimates and actionable guidance

### Database Schema Key Tables

**`keywords`** - User's tracked search terms
- `userId`, `keyword`, `targetUrl`, `isActive`
- `measurementInterval`: "1h" | "6h" | "12h" | "24h"
- `documentCount`, `competitionRate` (from Naver Search Ad API)

**`measurements`** - Historical ranking data
- `keywordId`, `measuredAt`, `rankSmartblock` (1-3 or null)
- `smartblockStatus`: "OK" | "NOT_IN_BLOCK" | "RANKED_BUT_HIDDEN" | "ERROR"
- `smartblockConfidence` (0.00-1.00), `durationMs`
- `isVisibleInSearch`, `hiddenReason`, `hiddenReasonCategory`, `recoveryEstimate`
- `blogTabRank`, `searchVolumeAvg`

**`users`** - Authentication and authorization
- `id`, `username`, `password` (stored as plaintext for admin accounts)
- `role`: "admin" | "user"

**`groups`** - Keyword organization
- `userId`, `name`, `description`, `color`

**`keyword_groups`** - Many-to-many relationship between keywords and groups

**`keyword_recommendations`** - Cached related/recommended keywords
- `keywordId`, `recommendations` (JSONB: `{ related: [...], recommended: [...] }`)
- `analyzedAt` timestamp for historical tracking

**`keyword_alerts`** - User-configured alert rules
- `keywordId`, `alertType`: "rank_drop" | "search_visibility_loss" | "measurement_failure"
- `isEnabled`, `threshold` (JSONB), `createdAt`, `updatedAt`

**`sessions`** - PostgreSQL-backed session storage (for production stability)

### Authentication & Authorization

**Strategy:** Passport.js with local username/password strategy

**Admin Account Auto-Creation:**
- On server startup, admin accounts are created/updated automatically:
  - `lee.kkhwan@gmail.com` / `test1234`
  - `keywordsolution` / `test1234`
- Passwords stored as **plaintext** (see `server/index.ts:78-112`)
- Regular users are hashed with bcrypt during registration

**Middleware:**
- `requireAuth`: Protects routes requiring any authenticated user
- `requireAdmin`: Protects admin-only routes (role check)

**Session Management:**
- Sessions stored in PostgreSQL (not in-memory) via `connect-pg-simple`
- 30-day cookie lifetime
- Sessions survive server restarts (critical for production)

### Scheduler System

**Implementation:** `server/scheduler.ts` using `node-cron`

**How It Works:**
1. On server startup, `MeasurementScheduler` initializes
2. Scans all active keywords and groups them by `measurementInterval`
3. Creates separate cron jobs for each interval:
   - `1h`: Runs every hour
   - `6h`: Runs every 6 hours
   - `12h`: Runs every 12 hours
   - `24h`: Runs daily at midnight
4. Each job triggers measurements for keywords in that interval
5. Results are saved to `measurements` table
6. Graceful shutdown on `SIGTERM` signal

**Manual Measurement:**
- Users can trigger on-demand measurements via API: `POST /api/measure/:id`
- Bypasses scheduler, runs immediately

### Path Aliases

TypeScript and Vite are configured with path aliases for cleaner imports:

```typescript
// Available aliases:
import { Component } from '@/components/Component';           // client/src/components/Component
import { schema } from '@shared/schema';                      // shared/schema.ts
import assets from '@assets/file.json';                       // attached_assets/file.json
```

**Configuration:**
- `tsconfig.json`: Defines TypeScript path mapping
- `vite.config.ts`: Defines Vite build-time resolution

### Key API Endpoints

**Authentication:**
- `POST /api/register` - User registration (auto-login after success)
- `POST /api/login` - User login (Passport.js)
- `POST /api/logout` - User logout
- `GET /api/user` - Get current authenticated user

**Keywords:**
- `GET /api/keywords` - List all keywords for current user
- `POST /api/keywords` - Add new keyword
- `GET /api/keywords/:id` - Get single keyword with measurements
- `PATCH /api/keywords/:id` - Update keyword settings
- `DELETE /api/keywords/:id` - Delete keyword
- `POST /api/measure/:id` - Trigger manual measurement
- `POST /api/measure-all/:id` - Comprehensive measurement (HTML parser + searchAll)

**Analytics:**
- `GET /api/measurements/latest` - Latest measurements for dashboard
- `GET /api/keywords/:id/measurements` - Historical measurements for charts

**Groups:**
- `GET /api/groups` - List user's keyword groups
- `POST /api/groups` - Create new group
- `PATCH /api/groups/:id` - Update group
- `DELETE /api/groups/:id` - Delete group

**Keyword Recommendations:**
- `GET /api/keywords/:id/recommendations` - Get cached related/recommended keywords
- Powered by Naver Search Ad API, cached in database for historical tracking

**Keyword Alerts:**
- `GET /api/keywords/:id/alerts` - Get alert rules for keyword
- `POST /api/keywords/:id/alerts` - Create alert rule
- `PATCH /api/alerts/:id` - Update alert rule
- `DELETE /api/alerts/:id` - Delete alert rule

### Environment Variables

Required environment variables (set in `.env` or Replit Secrets):

```bash
DATABASE_URL=postgresql://...           # PostgreSQL connection string
SESSION_SECRET=your-secret-key          # Session encryption key
NAVER_CLIENT_ID=your-client-id          # Naver Search API credentials
NAVER_CLIENT_SECRET=your-client-secret
NAVER_SEARCH_AD_API_KEY=your-api-key    # Naver Search Ad API key
NAVER_SEARCH_AD_SECRET_KEY=your-secret
NAVER_SEARCH_AD_CUSTOMER_ID=your-id     # Naver Search Ad customer ID
PORT=5000                               # Server port (default: 5000)
NODE_ENV=development|production         # Environment mode
```

## Design System

Comprehensive design guidelines are documented in `design_guidelines.md`:
- **Color Palette:** Traffic-light system (green/orange/red) for rank indicators
- **Typography:** Inter (UI) + JetBrains Mono (monospace data)
- **Components:** Material Design-inspired with shadcn/ui
- **Dark Mode:** Full support with system preference detection
- **Animations:** Minimal, functional only (no decorative animations)
- **Charts:** Inverted Y-axis (rank 1 at top, lower is better)

## Additional Documentation

For more detailed information:
- **System Architecture:** See `replit.md` for comprehensive architectural overview
- **Design System:** See `design_guidelines.md` for UI/UX specifications
- **Database Schema:** See `shared/schema.ts` for complete table definitions
- **HTML Samples:** See `tmp/naver_html_samples/` for real Naver search result examples used in testing

## Notes for Development

### Testing HTML Parser
Use `test-parser.js` to test Naver HTML parsing with local samples:
```bash
node test-parser.js
```

### Database Migrations
When schema changes are made:
```bash
# Generate migration
npx drizzle-kit generate

# Push to database (development)
npm run db:push

# Run migrations (production)
npx drizzle-kit migrate
```

### Adding New Measurement Intervals
To add new measurement intervals (e.g., "3h"):
1. Update `measurementInterval` type in `shared/schema.ts`
2. Update scheduler logic in `server/scheduler.ts`
3. Update frontend dropdown options in keyword forms
4. Update Zod validation schema

### Naver API Integration
- **Search API:** Used for document count (`documentCount`)
- **Search Ad API:** Used for keyword volume (`searchVolumeAvg`), competition rate, and recommendations
- Both require API credentials in environment variables
- Recommendation results are cached in `keyword_recommendations` table

### WebSocket Support (Future)
The project includes `ws` dependency for future real-time update support. Currently, frontend uses polling via TanStack Query.
