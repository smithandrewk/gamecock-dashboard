# CLAUDE.md - Gamecock Dashboard

## Project Overview

A beautiful, fast, mobile-first dashboard for USC Gamecocks sports. Built with Next.js 14, shadcn/ui, and TanStack Query.

## Quick Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run lint     # Run ESLint
```

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **UI**: shadcn/ui + Tailwind CSS
- **Data Fetching**: TanStack Query
- **Charts**: Recharts
- **Hosting**: Vercel

## USC Brand Colors

```
Garnet: #73000A
Black: #000000
White: #FFFFFF
Gray: #58595B
```

## Data Sources

| Source | Use | Endpoint Example |
|--------|-----|------------------|
| ESPN API | Scores, schedules, stats | `site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/...` |
| The Odds API | Betting odds | Requires API key |
| Polymarket | Prediction markets | `docs.polymarket.com` |

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx          # Root layout, providers
│   ├── page.tsx            # Main dashboard
│   ├── mbb/page.tsx        # Men's Basketball
│   └── wbb/page.tsx        # Women's Basketball
├── components/
│   ├── ui/                 # shadcn components
│   └── [feature].tsx       # Feature components
├── lib/
│   ├── espn.ts             # ESPN API client
│   ├── odds.ts             # Odds API client
│   └── utils.ts            # Helpers
└── hooks/                  # TanStack Query hooks
```

## Current Phase

**MVP**: Basketball only (MBB + WBB) - ship what's in season

## Design Principles

1. **Glanceable** - Key info visible in <2 seconds
2. **Mobile-first** - 95% phone traffic, thumb-friendly
3. **Fast** - Sub-second load times
4. **Contextual** - Smart hero adapts to live/upcoming/recent
5. **Beautiful** - Robinhood + Apple Sports inspired

## Implementation Status

See `plan.md` for full PRD and implementation checklist.
