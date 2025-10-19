## Overview

This project is a web application designed to automate the tracking of Naver blog post rankings within Smart Block search results. Its primary purpose is to eliminate manual monitoring of keyword positions, provide real-time alerts for rank changes, and offer 30-day trend analysis for optimizing content republishing strategies. The system aims to scale from tracking a few keywords to over a thousand, enabling content creators to make data-driven decisions and detect "통합검색 이탈" (search visibility loss).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend uses React 18+ with Vite and Wouter for routing. UI components are built with shadcn/ui (Radix UI + Tailwind CSS), following a Material Design aesthetic. State management is handled by TanStack Query for server state and the Context API for UI state. Recharts visualizes ranking trends. Forms use React Hook Form and Zod. The design prioritizes scannable layouts, progressive disclosure, and a traffic-light color system for rank indicators, supporting both light and dark modes. Typography uses Inter and JetBrains Mono.

### Backend

The backend is built with Node.js, Express.js, and TypeScript, using tsx for development and esbuild for production. It provides RESTful API endpoints for managing keywords and measurements. Data is stored in PostgreSQL via Supabase (Seoul region) using Drizzle ORM, with an in-memory fallback for development. A key component is the HTML parser, utilizing Cheerio to accurately detect Smart Block rankings using the `fds-comps-footer-more-subject` CSS selector, offering high accuracy and performance. An automated `node-cron` scheduler allows configurable measurement intervals (1h, 6h, 12h, 24h) per keyword. The system also extracts comprehensive blog metadata and JSON data from Naver HTML for improved data coverage and includes a keyword recommendation caching system.

### Data Models

The database schema includes `keywords` and `measurements` tables. `keywords` stores search terms, target URLs, `measurementInterval`, `isActive`, `documentCount`, and `competitionRate`. `measurements` records `measuredAt`, `rankSmartblock` (1-3 or null), `smartblockStatus` (e.g., OK, NOT_IN_BLOCK, RANKED_BUT_HIDDEN), `smartblockConfidence`, `durationMs`, `method`, and `isVisibleInSearch`. It also includes fields for `hiddenReasonClassification` (e.g., `hiddenReason`, `hiddenReasonCategory`, `recoveryEstimate`, `actionGuide`).

### Key Architectural Decisions

The project employs a monorepo structure with shared TypeScript types. Component design follows atomic principles using shadcn/ui. Vite and esbuild ensure efficient build processes. Direct HTML parsing with Cheerio is the primary Smart Block detection method due to its accuracy and performance, with SerpAPI maintained as a fallback. JSON data extraction from Naver HTML script tags provides 100% metadata coverage for blog results. A caching system for keyword recommendations reduces API calls and allows historical tracking. The application prioritizes a streamlined user experience, with the Dashboard as the primary landing page.

## External Dependencies

### Core Frameworks
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

### Data & State Management
- **TanStack Query (React Query)**
- **React Hook Form**
- **Zod**
- **Drizzle ORM**
- **postgres** (PostgreSQL driver)

### External Services & APIs
- **Supabase** (PostgreSQL database, Seoul region)
- **SerpAPI** (fallback for general search scraping)
- **Naver Search Ad API** (for keyword search volume and related keywords)

### Development Tools & Libraries
- **Wouter** (routing)
- **tsx** (TypeScript execution)
- **esbuild** (bundling)
- **Cheerio** (HTML parsing)
- **Axios** (HTTP client)
- **nanoid** (unique ID generation)
- **node-cron** (scheduling)