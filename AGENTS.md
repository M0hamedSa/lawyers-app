# AGENTS.md — Law Firm Client Ledger (True Legal)

## Commands (run in order for verification)

```bash
npm run lint       # ESLint — must pass with 0 warnings (--max-warnings=0)
npm run typecheck  # tsc --noEmit, strict mode
npm run dev        # Next.js 15 dev server
npm run build      # Production build
```

No test framework is configured. There are no tests.

## Stack & structure

- **Next.js 15** App Router, TypeScript strict, Tailwind CSS 3, dark mode via `class` strategy
- **Supabase** for auth + DB; schema in `supabase/schema.sql` (raw SQL, no migration tool — run manually in Supabase SQL editor)
- **next-intl** i18n with `en` / `ar` locales; middleware handles both i18n routing and Supabase auth guard
- **Sqids** (`lib/id-utils.ts`) encodes UUIDs into short URL-safe hashes — all client/case detail routes use these
- **Puppeteer** for PDF export (`/api/export-*` routes); Arabic font at `fonts/Cairo.ttf`
- **Supabase Edge Function** at `supabase/functions/invite-user/` is Deno-based (excluded from `tsconfig.json`)
- **Three roles**: `superadmin`, `admin`, `user` — enforced via Supabase RLS policies

## Design system (Cursor-based)

Applied from `DESIGN.md` — warm cream canvas (#f7f7f4), ink text (#26251e), **Cursor Orange** (`accent-500`: #f54e00) as the sole accent color.

### Colors

Use `ink-*` palette (`ink-50` canvas → `ink-950` near-black), `accent-*` for CTAs/wordmark, `success-*` / `error-*` for finance tones. No drop shadows — only `hairline` borders (`border-ink-100`).

### Typography tokens

| Class | Use |
|---|---|
| `text-display-lg` / `text-display-md` / `text-display-sm` | Page headings (weight 400, negative tracking — magazine voice) |
| `text-title-md` / `text-title-sm` | Component titles, card headers (weight 600) |
| `text-body-md` / `text-body-sm` | Running text (weight 400) |
| `text-caption-uppercase uppercase` | Section labels, column headers (11px, 600, 0.88px tracking) |
| `text-btn` | Button labels (14px, 500) |
| `font-mono` | Code surfaces (JetBrains Mono in globals.css) |

### Components

- **Card**: `rounded-lg border border-ink-100 bg-white` — no shadows
- **Button (primary)**: `bg-accent-500 hover:bg-accent-600 text-white rounded-md h-10 px-[18px] text-btn`
- **Button (secondary)**: `border border-ink-200 bg-white text-ink-800 rounded-md`
- **Input**: `h-[44px] rounded-md border border-ink-200 bg-white px-4` — via `inputClassName` from field.tsx
- **Modal**: `rounded-t-lg sm:rounded-lg` — bottom-sheet on mobile, centered on desktop

## Key conventions

- Page-specific client components named `<Feature>Client` (e.g. `ClientsPageClient`), imported from `components/`
- `cn()` from `lib/utils.ts` for conditional class merging (`clsx` + `tailwind-merge`)
- Form inputs use `inputClassName` or `textareaClassName` from `components/ui/field.tsx`
- All financial amounts in **EGP** via `formatCurrency()` in `lib/utils.ts`

## Path aliases

`@/*` maps to project root (e.g. `@/lib/supabase/client`, `@/components/ui/card`).

## GSAP Animations

All page-level and component entrance animations use GSAP (installed, `npm install gsap`):

| Hook / Component | File | What it does |
|---|---|---|
| `useStaggerIn` | `lib/animations.ts` | Staggers children of a container fading/sliding in from below |
| `useFadeIn` | `lib/animations.ts` | Single element fade-in from below |
| `useCountUp` | `lib/animations.ts` | Counts up from 0 to a target number |
| `useScaleHover` | `lib/animations.ts` | Subtle scale-up (1.03x) on hover for buttons/clickables |
| `StaggerContainer` | `components/ui/animated.tsx` | Wrapper — staggers its children |
| `FadeInBox` | `components/ui/animated.tsx` | Wrapper — fades in its single child |
| `CountUpNumber` | `components/ui/animated.tsx` | Displays and animates a number counting up |

### Animated pages
- **Dashboard**: Metric cards stagger in; plain-number metrics use CountUpNumber
- **Sidebar**: Nav links slide in with stagger on mount
- **Client details**: Header fades in; metric grid staggers; tab content fades in
- **Case details**: Header fades in; metric grid staggers; tab content fades in
- **Data table**: Table rows stagger in with staggered slide-up
- **ActionButton**: Subtle scale-up on hover

### Skeleton loading states
All pages have dedicated `loading.tsx` files using components from `components/ui/skeleton.tsx`:
- `Skeleton` — animated pulse placeholder (any shape via className)
- `SkeletonCard` — metric card skeleton with label + value placeholders
- `SkeletonTable` — table skeleton with header row + N data rows
- `SkeletonPage` — full page skeleton (header + 4 metric cards + 6-row table)

Pages with skeleton loading:
- `/app` (main layout) — `<SkeletonPage />`
- Dashboard — 4-column skeleton metric cards
- Clients — `<SkeletonPage />`
- Admin/users — `<SkeletonPage />`
- Admin/transactions — custom layout with filter pills, stat cards, 8-row data table
- Admin/cash-advance — 3 skeleton metric cards + 6-row data table
