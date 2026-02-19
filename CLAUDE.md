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

| Source | Use | Status |
|--------|-----|--------|
| ESPN API | Scores, schedules, stats | ✅ Working |
| The Odds API | Betting odds | ❌ Limited coverage for USC games |
| Polymarket | Prediction markets | Not integrated |

**Note on The Odds API:** As of Dec 2024, this API has very limited coverage for college basketball - only 4 WNCAAB games total, and rarely includes USC games. Do not rely on it for USC-specific odds.

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

## Lessons Learned

### Always validate external APIs before building integrations
Before building out a full integration with an external API:
1. **Test data availability first** - Make a quick API call to verify the data you need actually exists
2. **Check coverage for your specific use case** - An API might work generally but not have data for your specific team/sport/region
3. **Don't assume** - Just because an API advertises a feature doesn't mean it has comprehensive coverage

Example: The Odds API advertises college basketball odds, but in practice only has ~4 games at a time for WNCAAB, rarely including USC.
