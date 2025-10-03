# Design Guidelines: Naver Blog Smart Block Rank Tracker

## Design Approach

**Selected Approach**: Reference-Based (PandaRank-Inspired) + Material Design System

**Justification**: This is a data-intensive productivity dashboard requiring clear information hierarchy and real-time data visualization. PandaRank's clean analytics interface provides excellent patterns for rank tracking, while Material Design principles ensure consistent interaction patterns and accessibility.

**Key Design Principles**:
- **Data First**: Information visibility over decorative elements
- **Real-time Clarity**: Instant visual feedback for rank changes
- **Scannable Layout**: Quick status assessment at a glance
- **Progressive Disclosure**: Summary → Details navigation pattern

---

## Core Design Elements

### A. Color Palette

**Light Mode:**
- Primary (Success/Rank Up): `142 85% 50%` - Vibrant green for positive indicators
- Warning (Rank 2-3): `38 92% 50%` - Warm orange for caution states  
- Danger (Rank Drop): `348 83% 47%` - Clear red for alerts
- Background: `210 20% 98%` - Soft white for main canvas
- Surface: `0 0% 100%` - Pure white for cards
- Text Primary: `217 19% 27%` - Deep slate for headings
- Text Secondary: `215 16% 47%` - Medium gray for body text
- Border: `220 13% 91%` - Subtle borders

**Dark Mode:**
- Primary (Success/Rank Up): `142 76% 36%` - Muted green maintaining visibility
- Warning (Rank 2-3): `38 92% 50%` - Orange remains vibrant
- Danger (Rank Drop): `348 83% 47%` - Red stays prominent
- Background: `222 47% 11%` - Deep slate background
- Surface: `217 33% 17%` - Elevated dark cards
- Text Primary: `210 20% 98%` - Near white for contrast
- Text Secondary: `215 20% 65%` - Lighter gray for readability
- Border: `215 28% 17%` - Visible but subtle borders

**Accent Colors:**
- Chart Gradient Start: `142 85% 50%` → End: `142 85% 35%`
- Rank 1 Gold: `45 93% 47%` - Gold badge accent
- Rank 2-3 Silver: `0 0% 63%` - Silver badge accent

### B. Typography

**Font Families**:
- Primary: `'Inter', system-ui, -apple-system, sans-serif` (Interface text, body)
- Monospace: `'JetBrains Mono', 'Fira Code', monospace` (URLs, timestamps)

**Type Scale**:
- Hero Number: `text-5xl font-bold` (Dashboard stats: "127")
- Page Title: `text-3xl font-bold` (Page headers)
- Section Heading: `text-xl font-semibold` (Card titles)
- Body Large: `text-base font-medium` (Keyword names)
- Body: `text-sm` (Table cells, descriptions)
- Caption: `text-xs` (Timestamps, metadata)

**Font Weights**: 400 (normal), 500 (medium), 600 (semibold), 700 (bold)

### C. Layout System

**Spacing Primitives**: Use Tailwind units: `2, 3, 4, 6, 8, 12, 16, 20, 24`

**Grid System**:
- Dashboard Stats: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4`
- Keyword Cards: `grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6`
- Container: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`

**Vertical Rhythm**:
- Section spacing: `space-y-6` (between major sections)
- Card content: `space-y-4` (internal spacing)
- Component groups: `space-y-2` (tight grouping)

### D. Component Library

**Dashboard Stats Cards**:
- White/dark surface with subtle shadow
- Icon in colored circle (32px diameter) top-left
- Large number display (text-4xl) centered
- Trend indicator with arrow icon and percentage below
- Hover: Lift effect with increased shadow

**Status Indicators**:
- Rank 1: Green dot + "1위" badge with gold background
- Rank 2-3: Orange dot + badge with silver background  
- Out of Block: Gray dot + "이탈" badge
- Error: Red dot + "오류" badge
- Size: 8px dot, badge with px-2 py-1

**Keyword Table**:
- Sticky header with sort indicators
- Row hover: Background highlight (bg-muted/50)
- Alternating row backgrounds for scannability
- Right-aligned numeric columns (ranks)
- Action buttons: Icon-only, ghost variant

**Rank Change Indicators**:
- Up Arrow (↑): Green, pointing up
- Down Arrow (↓): Red, pointing down
- Equals (=): Gray, stable indicator
- Display format: "↑2" or "↓1" inline with rank

**Charts (Recharts)**:
- Area Chart: Green gradient fill with smooth curves
- Y-axis Inverted: Rank 1 at top (lower is better)
- Grid: Dotted lines, subtle color
- Tooltip: Dark background, white text, sharp corners
- Height: 300px desktop, 200px mobile
- Margin: `{ top: 10, right: 30, left: 0, bottom: 0 }`

**Mini Sparklines**:
- 30px height, 100px width
- Simple line, no axes or labels
- Embedded in table cells
- Same green color as main charts

**Navigation**:
- Sidebar: Fixed left, 240px wide, collapsible on mobile
- Top bar: Logo left, search center, user menu right
- Active state: Accent color background with white text
- Breadcrumbs: text-sm with chevron separators

**Forms & Inputs**:
- Input fields: Border on all sides, focus ring in primary color
- Labels: text-sm font-medium above inputs
- Error states: Red border + error text below
- Success states: Green border + check icon
- Buttons: Primary (filled), Secondary (outline), Ghost (text only)

**Modals & Overlays**:
- Backdrop: Semi-transparent dark overlay
- Modal: Centered, max-w-2xl, rounded-lg
- Header: Sticky, with close button (X icon)
- Footer: Sticky, action buttons right-aligned

**Alert Notifications (Toast)**:
- Position: Top-right corner
- Success: Green left border, check icon
- Warning: Orange left border, alert icon
- Error: Red left border, X icon
- Auto-dismiss: 5 seconds
- Stack: New on top, max 3 visible

### E. Animation Guidelines

**Use Sparingly - Only Where Functional**:
- Page transitions: None (instant navigation)
- Data updates: Subtle fade-in for new measurements (200ms)
- Hover states: Native browser hover (no custom animations)
- Loading states: Skeleton screens (no spinners)
- Chart rendering: Disabled animations (immediate display)

**Exceptions (Allowed)**:
- Toast notifications: Slide-in from right (300ms ease-out)
- Rank change: Scale pulse on new data (150ms)
- Dropdown menus: Fade + slide down (200ms)

---

## Page-Specific Layouts

### Dashboard (`/dashboard`)
- 4-column stats grid at top (responsive)
- Filter tabs below stats (All, Rising, Falling, Stable)
- Keyword table with 10 rows, pagination below
- Search bar above table (right-aligned)
- "Add Keyword" button (primary, top-right)

### Keyword Detail (`/keywords/[id]`)  
- Page header: Keyword name (h1), target URL (monospace, muted)
- Current rank card: Large number, status indicator, last measured time
- Rank trend chart: Full width, 400px height, 30-day data
- Tabs: "History" (measurement table), "Settings" (alert config)
- Back button: Top-left breadcrumb navigation

### Measurement History Table
- Columns: Time, Smart Block Rank, Blog Tab Rank, Confidence (progress bar), Duration
- Infinite scroll (virtualized for performance)
- Time format: "YYYY-MM-DD HH:mm" in monospace
- Confidence bar: 0-100%, green gradient fill

---

## Images & Visual Assets

**No Hero Images Required** - This is a utility dashboard focused on data display.

**Icon Usage**:
- Lucide React icon library via CDN
- Icons for: TrendingUp, ArrowUp, ArrowDown, Bell, Search, Settings, Plus, X
- Size: 16px (sm), 20px (md), 24px (lg)
- Color: Inherits from parent text color

**Logo**:
- Text-based wordmark: "Rank Tracker" in bold
- Accent: Small green dot after "Rank"
- Placement: Top-left sidebar, 32px height

---

## Accessibility & Dark Mode

**Dark Mode Implementation**:
- System preference detection on load
- Manual toggle in user menu (moon/sun icon)
- Persist preference in localStorage
- All colors defined in CSS variables for easy switching
- Maintain WCAG AA contrast ratios (4.5:1 minimum)

**Form Input Dark Mode**:
- Input backgrounds: Slightly lighter than surface
- Border color: Visible in both modes
- Placeholder text: Sufficient contrast
- Focus states: Prominent accent color ring

This design system creates a professional, data-focused dashboard that prioritizes clarity, scannability, and real-time information flow while maintaining visual consistency across all components.