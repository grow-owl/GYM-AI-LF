# GYMAI — Frontend

React + TypeScript + Tailwind CSS v4 frontend for the Gym AI SaaS platform, built from `frontend-design.md` and `project_update.md`.

## Stack
- Vite + React 19 + TypeScript (strict)
- Tailwind CSS v4 (CSS-first theme in `src/index.css`)
- React Router v7
- lucide-react icons

## Getting started
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-checks then builds to dist/
```

## Structure
```
src/
  components/
    layout/   Sidebar, TopBar, DashboardShell (desktop), MobileShell (bottom-nav)
    ui/       Card, KpiCard, QuickAccessCard, Badge, ProgressBar, PageHeader
  data/       mock.ts (sample data), nav.ts (per-role navigation)
  pages/
    owner/    Dashboard, Members, Trainers, Attendance, Payments, Leads,
              Inventory, Expenses, Reports, AI Insights, Settings
    trainer/  Dashboard, My Clients, Sessions, Workout Plans, Diet Plans,
              Progress, Recovery Alerts
    member/   Home, Workout Plan, Workout Tracking (live set logging),
              Diet Plan, AI Coach, Attendance (QR), Progress, Rewards,
              Payments, Profile
    reception/ Dashboard, Member Search, Check-in, Leads, Payments
  App.tsx     All routes
```

Open `/` to pick a role (Owner, Trainer, Member, Reception) — every quick-access
card and sidebar link is a real route, so tapping through the app moves between
sections exactly per the sitemap in `frontend-design.md`.

## Design tokens
Defined in `src/index.css` under `@theme`:
- `--color-base` / `--color-surface` / `--color-surface-2/3` — blackish-grey layers
- `--color-text` (white) / `--color-text-muted` / `--color-text-faint` (grey)
- `--color-accent` `#FF6A39` — orange, used for primary actions and highlights
- `--color-good` / `--color-warn` / `--color-danger` — status colors only (churn risk, overdue payments, recovery alerts)

Fonts: Space Grotesk (display/numbers), Inter (body), IBM Plex Mono (timers, sets, currency).

## Connecting to the backend
Pages currently render from `src/data/mock.ts`. To wire up the real API in
`../backend`, replace the mock imports in each page with API calls (e.g. via
`fetch` or a small API client) against the existing Express routes — the
data shapes in `src/types/index.ts` already mirror the backend's
member/trainer/session/lead models.
