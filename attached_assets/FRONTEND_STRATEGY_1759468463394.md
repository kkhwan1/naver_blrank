# Frontend Development Strategy
**프로젝트**: 네이버 블로그 스마트블록 순위 추적 시스템
**버전**: 1.0
**작성일**: 2025-01-03
**상태**: Phase 2 - Frontend Implementation

---

## 📋 Executive Summary

### 개발 전략
- **MCP 활용**: Magic MCP (UI 생성) + Playwright MCP (실시간 디버깅)
- **병렬 개발**: Multi-agent 동시 작업으로 개발 속도 3배 향상
- **실시간 검증**: 브라우저에서 즉시 확인하며 반복 개선

### 기술 스택 확정
```yaml
Framework: Next.js 14.2+ (App Router)
UI Library: shadcn/ui (Radix UI + Tailwind CSS)
Styling: Tailwind CSS 3.4+
Charts: Recharts 2.12+
Real-time: Supabase Realtime WebSocket
State: Zustand 4.5+ (전역 상태)
Animation: Framer Motion 11+
Icons: Lucide React
Forms: React Hook Form + Zod
Testing: Playwright (E2E)
```

---

## 🎯 Phase 2-A: Frontend Setup (1-2일)

### Day 1: 프로젝트 초기화

#### 1.1 Next.js 프로젝트 생성
```bash
npx create-next-app@latest naver-blog-frontend \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*"
```

**디렉토리 구조**:
```
naver-blog-frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root 레이아웃
│   │   ├── page.tsx                # 홈 (리다이렉트 → /dashboard)
│   │   ├── (dashboard)/            # 대시보드 그룹
│   │   │   ├── layout.tsx          # 공통 레이아웃
│   │   │   ├── page.tsx            # 메인 대시보드
│   │   │   └── keywords/
│   │   │       └── [id]/
│   │   │           └── page.tsx    # 상세 페이지
│   │   └── api/                    # API Routes (proxy)
│   │       └── keywords/
│   │           └── route.ts
│   │
│   ├── components/
│   │   ├── ui/                     # shadcn/ui components
│   │   ├── atoms/
│   │   ├── molecules/
│   │   ├── organisms/
│   │   └── templates/
│   │
│   ├── lib/
│   │   ├── supabase.ts             # Supabase client
│   │   ├── utils.ts                # 유틸 함수
│   │   └── constants.ts            # 상수
│   │
│   ├── hooks/
│   │   ├── useKeywords.ts          # 키워드 데이터 훅
│   │   ├── useRealtime.ts          # Realtime 구독 훅
│   │   └── useMeasurements.ts      # 측정 데이터 훅
│   │
│   ├── types/
│   │   ├── keyword.ts
│   │   ├── measurement.ts
│   │   └── index.ts
│   │
│   └── store/
│       └── useKeywordStore.ts      # Zustand 전역 상태
│
├── public/
│   ├── logo.svg
│   └── favicon.ico
│
├── .env.local
├── next.config.js
├── tailwind.config.ts
└── tsconfig.json
```

#### 1.2 shadcn/ui 초기화
```bash
npx shadcn-ui@latest init
```

**설치할 컴포넌트**:
```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add table
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add input
npx shadcn-ui@latest add select
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add skeleton
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add tabs
npx shadcn-ui@latest add slider
```

#### 1.3 필수 패키지 설치
```bash
npm install @supabase/supabase-js
npm install recharts
npm install framer-motion
npm install lucide-react
npm install zustand
npm install react-hook-form @hookform/resolvers
npm install date-fns
npm install clsx tailwind-merge
npm install react-virtuoso  # 무한 스크롤
```

**개발 의존성**:
```bash
npm install -D @playwright/test
npm install -D prettier prettier-plugin-tailwindcss
npm install -D @types/node
```

---

## 🎨 Phase 2-B: UI Component Development (3-4일)

### MCP 활용 전략

#### Magic MCP 워크플로우
```yaml
Step 1: UI 요구사항 정의
  - 컴포넌트 설명 작성
  - 필요한 props 명시
  - 디자인 참고 이미지/링크 제공

Step 2: Magic MCP로 초안 생성
  - /21 명령어 사용
  - PandaRank 스타일 지정
  - TypeScript + Tailwind 출력

Step 3: shadcn/ui 통합
  - 생성된 컴포넌트에 shadcn 적용
  - 일관된 스타일 가이드 준수

Step 4: Playwright MCP로 실시간 검증
  - 브라우저에서 즉시 확인
  - 스크린샷 캡처
  - 반응형 테스트
```

### Day 2-3: Atoms & Molecules

#### 2.1 Atoms (기본 요소)
**Agent 1 - Status Components**:
```typescript
// components/atoms/StatusDot.tsx
interface StatusDotProps {
  status: 'rank1' | 'rank2-3' | 'out' | 'error';
  size?: 'sm' | 'md' | 'lg';
}

// Magic MCP Prompt:
// "Create a status indicator dot component with 4 colors:
//  - Green (#00D9A3) for rank 1
//  - Yellow (#FFA502) for rank 2-3
//  - Gray (#95A5A6) for out of smart block
//  - Red (#FF4757) for error
//  Use Tailwind CSS, support sm/md/lg sizes"
```

**Agent 2 - Badge Components**:
```typescript
// components/atoms/RankBadge.tsx
interface RankBadgeProps {
  rank: number | null;
  variant?: 'default' | 'compact';
}

// Magic MCP Prompt:
// "Create a rank badge component showing ranking number (1-3).
//  Rank 1: Gold gradient, Rank 2-3: Silver gradient.
//  Use shadcn/ui Badge as base."
```

**Agent 3 - Change Indicator**:
```typescript
// components/atoms/ChangeIndicator.tsx
interface ChangeIndicatorProps {
  change: number;
  showArrow?: boolean;
}

// Magic MCP Prompt:
// "Create a rank change indicator with arrow icons.
//  Positive: Green up arrow (↑), Negative: Red down arrow (↓).
//  Include Framer Motion for scale animation on mount."
```

#### 2.2 Molecules (조합 요소)
**Agent 4 - Stat Card**:
```typescript
// components/molecules/StatCard.tsx
interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
}

// Magic MCP Prompt:
// "Create a dashboard stat card with:
//  - Icon in top-left (Lucide)
//  - Large number in center
//  - Small trend indicator below
//  - Card hover effect (shadow increase)
//  PandaRank style, use shadcn/ui Card"
```

**Agent 5 - Mini Sparkline**:
```typescript
// components/molecules/MiniSparkline.tsx
interface MiniSparklineProps {
  data: { date: Date; rank: number }[];
  width?: number;
  height?: number;
}

// Magic MCP Prompt:
// "Create a mini sparkline chart using Recharts.
//  30px height, simple line, no axes, gradient fill.
//  Green (#00D9A3) line color."
```

**Agent 6 - Keyword Card**:
```typescript
// components/molecules/KeywordCard.tsx
interface KeywordCardProps {
  keyword: string;
  rank: number | null;
  change: number;
  lastMeasured: Date;
  targetUrl: string;
  onClick?: () => void;
}

// Magic MCP Prompt:
// "Create a keyword summary card with:
//  - Keyword text (bold, large)
//  - Current rank badge
//  - Change indicator
//  - Mini sparkline chart
//  - Last measured time (relative, e.g., '5분 전')
//  Responsive, mobile-friendly, shadcn Card base"
```

### Day 4: Organisms (복합 블록)

**Agent 7 - Dashboard Stats Grid**:
```typescript
// components/organisms/DashboardStats.tsx
interface DashboardStatsProps {
  totalKeywords: number;
  rankIncreased: number;
  rankDecreased: number;
  newAlerts: number;
}

// Magic MCP Prompt:
// "Create a 4-column stats grid using StatCard.
//  Icons: TrendingUp, ArrowUp, ArrowDown, Bell.
//  Responsive: 1 col (mobile), 2 cols (tablet), 4 cols (desktop).
//  Gap-4, consistent spacing."
```

**Agent 8 - Keyword Table**:
```typescript
// components/organisms/KeywordTable.tsx
interface KeywordTableProps {
  keywords: Keyword[];
  onRowClick: (id: string) => void;
  sortBy?: 'rank' | 'change' | 'time';
  filterBy?: 'all' | 'up' | 'down' | 'stable';
}

// Magic MCP Prompt:
// "Create a keyword data table with:
//  - Columns: Status, Keyword, Rank, Change, Last Measured, Mini Chart, Actions
//  - Sortable headers (click to sort)
//  - Filter buttons above table (All, Rising, Falling, Stable)
//  - Row hover effect
//  - Pagination (10 rows per page)
//  Use shadcn/ui Table, Button, Badge components.
//  PandaRank table design."
```

**Agent 9 - Rank Trend Chart**:
```typescript
// components/organisms/RankTrendChart.tsx
interface RankTrendChartProps {
  data: Measurement[];
  timeRange?: '7d' | '30d' | '90d';
}

// Magic MCP Prompt:
// "Create a large rank trend chart using Recharts Area Chart.
//  - X-axis: Time, Y-axis: Rank (inverted, 1 at top)
//  - Green gradient fill (#00D9A3)
//  - Grid lines, tooltips
//  - Time range selector (7/30/90 days)
//  - Responsive height (300px desktop, 200px mobile)"
```

**Agent 10 - Measurement History Table**:
```typescript
// components/organisms/MeasurementHistory.tsx
interface MeasurementHistoryProps {
  measurements: Measurement[];
  pageSize?: number;
}

// Magic MCP Prompt:
// "Create a measurement history table with:
//  - Columns: Time, Smart Block Rank, Blog Tab Rank, Confidence, Duration
//  - Infinite scroll (react-virtuoso)
//  - Confidence bar (progress indicator)
//  - Time formatted (YYYY-MM-DD HH:mm)
//  shadcn Table, responsive"
```

---

## 🔄 Phase 2-C: Real-time Integration (2일)

### Day 5: Supabase Realtime

#### 3.1 Custom Hooks
**Agent 11 - useRealtime Hook**:
```typescript
// hooks/useRealtime.ts
export function useRealtime(keywordId?: string) {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);

  useEffect(() => {
    const channel = supabase
      .channel('measurements')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'measurements',
          filter: keywordId ? `keyword_id=eq.${keywordId}` : undefined
        },
        (payload) => {
          setMeasurements(prev => [payload.new as Measurement, ...prev]);

          // 토스트 알림
          toast.success(`새로운 측정 완료: ${payload.new.keyword}`);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [keywordId]);

  return measurements;
}
```

#### 3.2 State Management
**Agent 12 - Zustand Store**:
```typescript
// store/useKeywordStore.ts
interface KeywordStore {
  keywords: Keyword[];
  selectedKeyword: Keyword | null;
  filter: 'all' | 'up' | 'down' | 'stable';

  setKeywords: (keywords: Keyword[]) => void;
  selectKeyword: (id: string) => void;
  setFilter: (filter: KeywordStore['filter']) => void;

  // Real-time updates
  addMeasurement: (keywordId: string, measurement: Measurement) => void;
}

export const useKeywordStore = create<KeywordStore>((set) => ({
  keywords: [],
  selectedKeyword: null,
  filter: 'all',

  setKeywords: (keywords) => set({ keywords }),
  selectKeyword: (id) => set((state) => ({
    selectedKeyword: state.keywords.find(k => k.id === id) || null
  })),
  setFilter: (filter) => set({ filter }),

  addMeasurement: (keywordId, measurement) => set((state) => ({
    keywords: state.keywords.map(k =>
      k.id === keywordId
        ? { ...k, measurements: [measurement, ...k.measurements] }
        : k
    )
  }))
}));
```

---

## 🧪 Phase 2-D: Playwright Live Debugging (지속적)

### Playwright MCP 워크플로우

#### 4.1 자동화된 테스트 시나리오
```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: true
  }
});

// tests/dashboard.spec.ts
test('Dashboard loads and shows stats', async ({ page }) => {
  await page.goto('/dashboard');

  // Stat cards visible
  await expect(page.locator('[data-testid="stat-total"]')).toBeVisible();

  // Table renders
  await expect(page.locator('table')).toBeVisible();

  // Screenshot for visual comparison
  await page.screenshot({ path: 'screenshots/dashboard.png', fullPage: true });
});

test('Real-time update appears in table', async ({ page }) => {
  await page.goto('/dashboard');

  // Trigger measurement (via API call or database insert)
  // ...

  // Wait for new row to appear
  await expect(page.locator('table tr').first()).toContainText('새 키워드');

  // Verify toast notification
  await expect(page.locator('.toast')).toBeVisible();
});
```

#### 4.2 반응형 테스트
```typescript
// tests/responsive.spec.ts
test('Dashboard is responsive', async ({ page }) => {
  // Desktop
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/dashboard');
  await page.screenshot({ path: 'screenshots/desktop.png' });

  // Tablet
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.screenshot({ path: 'screenshots/tablet.png' });

  // Mobile
  await page.setViewportSize({ width: 375, height: 667 });
  await page.screenshot({ path: 'screenshots/mobile.png' });
});
```

#### 4.3 실시간 디버깅 절차
```yaml
Step 1: 브라우저 자동 실행
  - playwright_navigate(url: "http://localhost:3000/dashboard")

Step 2: 스크린샷 캡처
  - playwright_screenshot(name: "current-state", fullPage: true)

Step 3: 요소 검사
  - playwright_get_visible_html(selector: "table")
  - playwright_get_visible_text()

Step 4: 인터랙션 테스트
  - playwright_click(selector: "[data-testid='keyword-row']")
  - playwright_fill(selector: "input[name='keyword']", value: "테스트")

Step 5: 콘솔 로그 확인
  - playwright_console_logs(type: "error")

Step 6: 수정 후 재검증
  - 코드 수정
  - playwright_navigate(url: "http://localhost:3000/dashboard")
  - playwright_screenshot(name: "after-fix")
```

---

## 📊 Development Checklist

### Week 1: Setup & Atoms
- [ ] **Day 1 - 프로젝트 초기화**
  - [ ] Next.js 14 프로젝트 생성
  - [ ] shadcn/ui 설치 및 설정
  - [ ] 필수 패키지 설치
  - [ ] Supabase 클라이언트 설정
  - [ ] Tailwind 테마 커스터마이징 (색상 팔레트)
  - [ ] 폴더 구조 생성

- [ ] **Day 2 - Atoms 개발 (Agent 1-3 병렬)**
  - [ ] StatusDot 컴포넌트 (Magic MCP)
  - [ ] RankBadge 컴포넌트 (Magic MCP)
  - [ ] ChangeIndicator 컴포넌트 (Magic MCP)
  - [ ] Playwright로 각 컴포넌트 스크린샷 검증
  - [ ] Storybook 페이지 생성 (선택사항)

### Week 2: Molecules & Organisms
- [ ] **Day 3 - Molecules 개발 (Agent 4-6 병렬)**
  - [ ] StatCard 컴포넌트 (Magic MCP)
  - [ ] MiniSparkline 컴포넌트 (Magic MCP + Recharts)
  - [ ] KeywordCard 컴포넌트 (Magic MCP)
  - [ ] 반응형 테스트 (Playwright MCP)

- [ ] **Day 4 - Organisms 개발 (Agent 7-10 병렬)**
  - [ ] DashboardStats 컴포넌트 (Magic MCP)
  - [ ] KeywordTable 컴포넌트 (Magic MCP + shadcn Table)
  - [ ] RankTrendChart 컴포넌트 (Magic MCP + Recharts)
  - [ ] MeasurementHistory 컴포넌트 (Magic MCP + react-virtuoso)
  - [ ] E2E 테스트 작성 (Playwright)

### Week 3: Pages & Real-time
- [ ] **Day 5 - 페이지 구성**
  - [ ] Dashboard 레이아웃 (App Router)
  - [ ] 메인 대시보드 페이지 (조합)
  - [ ] 키워드 상세 페이지 (조합)
  - [ ] API Routes 생성 (프록시)
  - [ ] 404/Error 페이지

- [ ] **Day 6 - Real-time 통합**
  - [ ] useRealtime 훅 구현
  - [ ] useKeywords 훅 구현
  - [ ] Zustand 스토어 설정
  - [ ] 실시간 업데이트 테스트
  - [ ] 토스트 알림 통합

- [ ] **Day 7 - 통합 테스트 & 디버깅**
  - [ ] 전체 워크플로우 E2E 테스트
  - [ ] Playwright 시나리오 실행
  - [ ] 성능 측정 (Lighthouse)
  - [ ] 반응형 테스트 (3 breakpoints)
  - [ ] 버그 수정 및 최적화

---

## 🚀 Parallel Agent Strategy

### Agent 분배 전략
```yaml
Phase 1: Atoms (3 agents 병렬)
  Agent 1: StatusDot + RankBadge
  Agent 2: ChangeIndicator + Button variations
  Agent 3: Skeleton + Loading states

Phase 2: Molecules (4 agents 병렬)
  Agent 4: StatCard + variants
  Agent 5: MiniSparkline + chart configs
  Agent 6: KeywordCard + responsive
  Agent 7: AlertConfigPanel + forms

Phase 3: Organisms (4 agents 병렬)
  Agent 8: DashboardStats + grid layout
  Agent 9: KeywordTable + sorting/filtering
  Agent 10: RankTrendChart + time range
  Agent 11: MeasurementHistory + virtualization

Phase 4: Pages (3 agents 병렬)
  Agent 12: Dashboard page + SSR
  Agent 13: Keyword detail page + SSR
  Agent 14: API routes + middleware

Phase 5: Integration (2 agents 병렬)
  Agent 15: Real-time hooks + store
  Agent 16: Playwright tests + debugging
```

### 병렬 작업 조정
```typescript
// 각 Agent는 독립적인 파일에서 작업
// Git branch로 충돌 방지

Agent 1 → components/atoms/StatusDot.tsx
Agent 2 → components/atoms/RankBadge.tsx
Agent 3 → components/atoms/ChangeIndicator.tsx

// 완료 후 main branch로 merge
// Playwright MCP로 통합 검증
```

---

## 🎨 Magic MCP Usage Examples

### Example 1: StatCard 생성
```
User: "I need a dashboard stat card component using Magic MCP"

Magic MCP Response:
/21 Create a stat card component with:
- Icon in top-left corner (Lucide React icon)
- Large number display in center
- Small trend indicator below (percentage change)
- Card hover effect (shadow increase, subtle scale)
- PandaRank style (modern, clean)
- Use shadcn/ui Card as base
- TypeScript with proper interfaces
- Responsive design (mobile-friendly)
```

### Example 2: KeywordTable 생성
```
User: "Generate a keyword data table with sorting and filtering"

Magic MCP Response:
/21 Create a keyword table component:
- Columns: Status, Keyword, Rank, Change, Last Measured, Actions
- Sortable headers (ASC/DESC toggle)
- Filter tabs: All, Rising, Falling, Stable
- Row hover effect
- Pagination (10 rows per page)
- Mini sparkline chart in each row
- Use shadcn/ui Table, Button, Badge
- TypeScript interfaces for all props
- PandaRank table design (modern, data-dense)
```

### Example 3: RankTrendChart 생성
```
User: "Create a rank trend chart using Recharts"

Magic MCP Response:
/21 Create an area chart component:
- X-axis: Time (formatted dates)
- Y-axis: Rank (inverted, 1 at top, 10 at bottom)
- Green gradient fill (#00D9A3 to transparent)
- Animated line drawing on mount
- Tooltips showing exact rank + time
- Time range selector buttons (7d, 30d, 90d)
- Responsive height (300px desktop, 200px mobile)
- Use Recharts AreaChart
- Framer Motion for animations
- PandaRank chart style
```

---

## 🎯 Color Palette (PandaRank Theme)

### Primary Colors
```css
--primary-green: #00D9A3;      /* Rank increase, success */
--danger-red: #FF4757;         /* Rank decrease, error */
--warning-orange: #FFA502;     /* Alert, caution */
--info-blue: #5352ED;          /* Information */
--neutral-gray: #95A5A6;       /* Out of smart block */
```

### Background Colors
```css
--bg-primary: #FFFFFF;         /* Card backgrounds */
--bg-secondary: #F8F9FA;       /* Page background */
--bg-dark: #2C3E50;            /* Dark mode (optional) */
```

### Text Colors
```css
--text-primary: #2D3436;       /* Main text */
--text-secondary: #636E72;     /* Secondary text */
--text-muted: #B2BEC3;         /* Muted text */
```

### Gradient Examples
```css
/* Rank 1 Badge */
background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);

/* Rank 2-3 Badge */
background: linear-gradient(135deg, #C0C0C0 0%, #A8A8A8 100%);

/* Chart Gradient */
background: linear-gradient(180deg, rgba(0, 217, 163, 0.3) 0%, rgba(0, 217, 163, 0) 100%);
```

---

## 📱 Responsive Breakpoints

### Tailwind Config
```typescript
// tailwind.config.ts
export default {
  theme: {
    screens: {
      'xs': '375px',    // Mobile (iPhone SE)
      'sm': '640px',    // Mobile landscape
      'md': '768px',    // Tablet
      'lg': '1024px',   // Desktop
      'xl': '1280px',   // Large desktop
      '2xl': '1536px'   // Extra large
    }
  }
}
```

### Component Responsive Rules
```typescript
// 1. Stats Grid
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

// 2. Table
<div className="overflow-x-auto"> {/* Mobile scroll */}
  <table className="min-w-[800px]"> {/* Min width for readability */}

// 3. Chart
<div className="h-[200px] md:h-[300px]"> {/* Smaller on mobile */}

// 4. Typography
<h1 className="text-2xl md:text-4xl"> {/* Responsive font */}
```

---

## 🔔 Real-time Features

### 1. WebSocket Updates
```typescript
// Instant rank update notification
const channel = supabase
  .channel('measurements')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'measurements'
  }, (payload) => {
    // Update UI immediately
    updateKeywordRank(payload.new);

    // Show toast
    toast.success(`${payload.new.keyword} 순위 업데이트!`);
  })
  .subscribe();
```

### 2. Optimistic UI Updates
```typescript
// Update UI before server confirmation
async function addKeyword(keyword: string) {
  // 1. Update UI optimistically
  const tempId = `temp-${Date.now()}`;
  addKeywordToStore({ id: tempId, keyword, rank: null });

  // 2. Send to server
  const { data, error } = await supabase
    .from('keywords')
    .insert({ keyword });

  // 3. Replace temp with real data
  if (data) {
    replaceKeywordInStore(tempId, data);
  } else {
    removeKeywordFromStore(tempId);
    toast.error('키워드 추가 실패');
  }
}
```

### 3. Live Status Indicators
```typescript
// Show "측정 중..." status in real-time
const [isLoading, setIsLoading] = useState<Set<string>>(new Set());

useEffect(() => {
  const channel = supabase
    .channel('measurement-status')
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      setIsLoading(new Set(Object.keys(state)));
    })
    .subscribe();
}, []);

// Usage
{isLoading.has(keywordId) ? (
  <Skeleton className="h-4 w-12" />
) : (
  <RankBadge rank={rank} />
)}
```

---

## 🚦 Performance Targets

### Core Web Vitals
```yaml
Largest Contentful Paint (LCP): < 2.5s
First Input Delay (FID): < 100ms
Cumulative Layout Shift (CLS): < 0.1
Time to Interactive (TTI): < 3.5s
```

### Optimization Strategies
```typescript
// 1. Image Optimization
import Image from 'next.image';
<Image src="/logo.png" width={120} height={40} alt="Logo" />

// 2. Code Splitting
const RankTrendChart = dynamic(() => import('@/components/organisms/RankTrendChart'), {
  loading: () => <Skeleton className="h-[300px]" />
});

// 3. Server Components (default in App Router)
// app/dashboard/page.tsx (Server Component)
async function DashboardPage() {
  const keywords = await fetchKeywords(); // Server-side fetch
  return <DashboardClient keywords={keywords} />;
}

// 4. React Memo for expensive components
const KeywordTable = memo(({ keywords }) => {
  // Only re-render when keywords change
});
```

---

## 🔒 Security Best Practices

### 1. Supabase Row Level Security (RLS)
```sql
-- Already configured in backend
-- Frontend only sees user's own data
SELECT * FROM keywords; -- Automatically filtered by user_id
```

### 2. Environment Variables
```bash
# .env.local (Never commit!)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 3. Input Validation (Zod)
```typescript
import { z } from 'zod';

const KeywordSchema = z.object({
  keyword: z.string().min(2).max(100),
  target_url: z.string().url()
});

function AddKeywordForm() {
  const form = useForm({
    resolver: zodResolver(KeywordSchema)
  });
}
```

---

## 📦 Deployment Strategy

### Vercel (Frontend)
```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Login
vercel login

# 3. Deploy
vercel --prod

# 4. Environment Variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### Environment Configuration
```javascript
// next.config.js
module.exports = {
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  }
}
```

---

## 🧪 Testing Strategy

### Unit Tests (Vitest)
```typescript
// components/__tests__/StatusDot.test.tsx
import { render, screen } from '@testing-library/react';
import { StatusDot } from '../atoms/StatusDot';

test('renders green dot for rank 1', () => {
  render(<StatusDot status="rank1" />);
  const dot = screen.getByTestId('status-dot');
  expect(dot).toHaveClass('bg-green-500');
});
```

### E2E Tests (Playwright)
```typescript
// tests/e2e/dashboard.spec.ts
test('User can add and track keyword', async ({ page }) => {
  await page.goto('/dashboard');

  // Click add button
  await page.click('[data-testid="add-keyword-btn"]');

  // Fill form
  await page.fill('input[name="keyword"]', '네이버 블로그');
  await page.fill('input[name="target_url"]', 'https://blog.naver.com/example');

  // Submit
  await page.click('[data-testid="submit-btn"]');

  // Verify keyword appears in table
  await expect(page.locator('table')).toContainText('네이버 블로그');
});
```

---

## 📚 Documentation

### Component Documentation
```typescript
/**
 * StatCard Component
 *
 * @description Dashboard statistic card with icon and trend
 * @example
 * <StatCard
 *   title="Total Keywords"
 *   value={42}
 *   icon={TrendingUp}
 *   trend={{ value: 12, label: 'vs last week' }}
 * />
 */
export function StatCard({ title, value, icon: Icon, trend }: StatCardProps) {
  // ...
}
```

### API Documentation
```typescript
/**
 * Fetch keywords with latest measurements
 *
 * @route GET /api/keywords
 * @query limit - Number of keywords to fetch (default: 50)
 * @query sort - Sort field (rank, change, time)
 * @returns Array of keywords with measurements
 */
export async function GET(request: Request) {
  // ...
}
```

---

## ✅ Definition of Done

### Component Completion Checklist
- [ ] TypeScript interfaces defined
- [ ] Component renders correctly
- [ ] Responsive on all breakpoints
- [ ] Playwright screenshot captured
- [ ] Props documented with JSDoc
- [ ] Unit tests written (if logic exists)
- [ ] Accessibility verified (keyboard nav, ARIA)
- [ ] Dark mode compatible (optional)
- [ ] Performance optimized (memo, lazy load)

### Page Completion Checklist
- [ ] SSR/SSG configured
- [ ] SEO meta tags added
- [ ] Loading states implemented
- [ ] Error states implemented
- [ ] Real-time updates working
- [ ] E2E test written
- [ ] Lighthouse score > 90
- [ ] Mobile responsive verified

---

## 🎓 Learning Resources

### Next.js 14 App Router
- https://nextjs.org/docs/app
- https://nextjs.org/docs/app/building-your-application/routing

### shadcn/ui
- https://ui.shadcn.com/docs
- https://ui.shadcn.com/docs/components

### Recharts
- https://recharts.org/en-US/api
- https://recharts.org/en-US/examples

### Playwright
- https://playwright.dev/docs/intro
- https://playwright.dev/docs/test-components

### Supabase Realtime
- https://supabase.com/docs/guides/realtime
- https://supabase.com/docs/reference/javascript/subscribe

---

## 📞 Support & Escalation

### Issue Tracking
```yaml
Critical (P0): Real-time updates not working, app crash
  → Slack #dev-alerts, escalate to Team Lead

High (P1): UI broken on mobile, performance regression
  → GitHub Issues, fix within 24h

Medium (P2): Visual inconsistency, minor UX issue
  → GitHub Issues, fix within 3 days

Low (P3): Nice-to-have feature, optimization
  → Backlog, prioritize in sprint planning
```

---

## 🏁 Next Steps

### Immediate Actions
1. ✅ FRONTEND_STRATEGY.md 문서 완성
2. ⏳ Next.js 프로젝트 초기화
3. ⏳ shadcn/ui 설치 및 설정
4. ⏳ Supabase 클라이언트 연결
5. ⏳ Atom 컴포넌트 3개 병렬 생성 (Magic MCP)

### Week 1 Goal
- Next.js 프로젝트 완전 설정
- Atom 컴포넌트 9개 완성
- Playwright 자동 테스트 환경 구축

### Week 2 Goal
- Molecule 컴포넌트 6개 완성
- Organism 컴포넌트 4개 완성
- 메인 대시보드 페이지 조립

### Week 3 Goal
- Real-time 기능 완전 통합
- E2E 테스트 전체 통과
- Vercel 프로덕션 배포 완료

---

**문서 버전**: 1.0
**최종 수정일**: 2025-01-03
**작성자**: Claude Code + Magic MCP + Playwright MCP
**상태**: ✅ 완료 (Ready for Implementation)
