# Naver Blog Smart Block Rank Tracker

## Overview

This project is a web application designed to automate the tracking of Naver blog post rankings within Smart Block search results. Its primary purpose is to eliminate the manual effort of monitoring keyword positions, providing real-time alerts for rank changes, and offering 30-day trend analysis to optimize content republishing strategies. The system aims to scale from tracking a few keywords to over a thousand, enabling content creators to make data-driven decisions.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is built with React 18+ and Vite, utilizing Wouter for routing. UI components are developed using shadcn/ui (Radix UI primitives + Tailwind CSS), adhering to a Material Design-inspired aesthetic focused on data visibility and real-time feedback. State management is handled by TanStack Query for server state and the Context API for UI state. Recharts is used for visualizing ranking trends. Forms are managed with React Hook Form and Zod for validation. The design emphasizes scannable layouts, progressive disclosure, and a color system that uses green, orange, and red for rank indicators, supporting both light and dark modes. Typography uses Inter for interface text and JetBrains Mono for monospace elements.

### Backend Architecture

The backend operates on Node.js with Express.js and TypeScript, using tsx for development and esbuild for production bundling. It exposes RESTful API endpoints for managing keywords and initiating measurements. Data storage is primarily PostgreSQL (via Neon/Replit) managed by Drizzle ORM, with an in-memory fallback. A key component is the HTML parser, which accurately detects Smart Block rankings using the `fds-comps-footer-more-subject` CSS selector, offering superior accuracy and performance compared to the less reliable SerpAPI integration. An automated scheduling system based on node-cron allows for configurable measurement intervals (1h, 6h, 12h, 24h) per keyword, with graceful lifecycle management.

### Data Models

The current database schema includes `keywords` and `measurements` tables. The `keywords` table stores search keywords, target URLs, configurable `measurementInterval`, and `isActive` status. The `measurements` table records `measuredAt` timestamps, `rankSmartblock` (1-3 or null), `smartblockStatus` (OK, NOT_IN_BLOCK, BLOCK_MISSING, ERROR), `smartblockConfidence`, measurement `durationMs`, and the `method` used.

### Key Architectural Decisions

The project uses a monorepo structure with shared TypeScript types between the frontend and backend. Component design follows atomic principles, leveraging shadcn/ui for consistency and accessibility. Vite and esbuild are used for efficient build processes. The primary Smart Block detection method is direct HTML parsing with Cheerio due to its 100% accuracy for rank 1-3 detection and superior performance. SerpAPI is maintained for fallback/comparison but is not recommended for production Smart Block tracking. Future plans include a worker pool for concurrent processing, Naver Search API integration, and real-time updates via WebSockets.

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
- **@neondatabase/serverless**

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
- **PostgreSQL** (via Neon)

### Replit-Specific
- **@replit/vite-plugin-runtime-error-modal**
- **@replit/vite-plugin-cartographer**
- **@replit/vite-plugin-dev-banner**