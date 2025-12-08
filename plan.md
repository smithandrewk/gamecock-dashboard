# USC Sports Dashboard - PRD & Plan

## Project Vision

**One-liner**: A beautiful, fast, one-click dashboard for USC Gamecocks sports.

**Core Thesis**: ESPN and official athletics sites are cluttered and slow. USC fans deserve a clean, focused dashboard that shows them everything they need in one glance - no searching, no clicking through menus.

## Target Audience

| Segment | Need | Entry Point |
|---------|------|-------------|
| Casual fan | "Did we win?" | Score ticker, recent results |
| Student | "When's the next game?" | Schedule, countdown |
| Stats nerd | "How's our offense trending?" | Stats, graphs, comparisons |
| Alumni | "Stay connected to USC sports" | Overview dashboard, nostalgia |

## Design Principles

1. **Glanceable** - Key info visible in <2 seconds
2. **Mobile-first** - 95% of traffic will be phone, design for thumb reach
3. **Fast** - Sub-second load times
4. **Contextual** - Smart hero that adapts (live game > upcoming > recent)
5. **Beautiful** - Robinhood + Apple Sports inspiration, shadcn/ui components

## UX Structure

### Layout
- **Sport tabs** at top: Football | Men's BB | Women's BB
- **Smart hero** that changes based on context:
  - If game is LIVE → Live score with updating indicator
  - If game today → Countdown + opponent + TV channel
  - If game yesterday → Result with score
  - Otherwise → Next upcoming game countdown
- **Below hero**: Recent results, upcoming schedule, key stats
- **Bottom**: Prediction odds, streak chart

### Mobile Optimization
- Bottom tab bar (thumb-friendly)
- Large touch targets
- Swipe between sports
- Pull-to-refresh for live updates

## Core Features (V1)

### Must Have
- [ ] **Score ticker** - Latest results across all tracked sports
- [ ] **Next game countdown** - When do we play next?
- [ ] **Schedule view** - Upcoming games with opponent, time, TV
- [ ] **Recent results** - Last 5-10 games with scores
- [ ] **Team record** - Current season W-L

### Should Have
- [ ] **Key stats** - Points per game, ranking, etc.
- [ ] **Player leaders** - Top scorers, etc.
- [ ] **Win/loss streak chart** - Visual momentum tracker
- [ ] **Prediction market odds** - Polymarket-style win probability (if API available)

### Could Have (V2+)
- [ ] Historical comparisons
- [ ] Rivalry trackers (Clemson, UGA history)
- [ ] Social feed integration
- [ ] Game day notifications

## Sports Included (V1)

- Football
- Men's Basketball
- Women's Basketball

## Technical Approach

### Constraints
- **Set and forget** - Minimal maintenance, self-updating
- **Free/cheap hosting** - No ongoing costs
- **No backend needed** - Static site with client-side data fetching

### Tech Stack
- **Framework**: Next.js 14 (App Router)
- **UI Components**: shadcn/ui
- **Styling**: Tailwind CSS
- **Charts**: Recharts (works great with shadcn)
- **Data Fetching**: TanStack Query (caching, refetching)
- **Hosting**: Vercel (free tier)
- **Updates**: Client-side fetching with smart refresh intervals

### Data Sources (Researched)

| Source | Use For | Cost | Reliability |
|--------|---------|------|-------------|
| ESPN Hidden API | Scores, schedules, stats, rankings | Free | Unofficial but stable |
| The Odds API | Betting odds, spreads, O/U | Free (500 req/mo) | Official, documented |
| Polymarket API | Prediction market probabilities | Free (1000/hr) | Official, documented |
| College Football Data API | Deep CFB stats | Free | Official |

**ESPN Endpoints:**
- Scoreboard: `site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard`
- Team: `site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/:team`

**Notes:**
- ESPN API is unofficial but widely used, stable for years
- Polymarket has actual CFB game markets with live probabilities
- The Odds API aggregates odds from DraftKings, FanDuel, etc.

## Decisions Made

1. **Name/Branding**: `cocky.ai` or `gamecock.ai` (check availability)
2. **Domain**: Custom .ai domain
3. **Historical data**: Current season only (keep it simple)
4. **Theme**: Light mode default (garnet & black on white)

## Open Questions

1. **Domain availability** - Need to check cocky.ai / gamecock.ai
2. **Notifications** - Game day alerts? (adds complexity, probably V2)

## Success Metrics

- Students/alumni actually visit and return
- Shared on social media
- Positive reception in USC community
- Zero maintenance required after launch

## MVP Scope

**Phase 1 (MVP): Basketball Only**
- Men's Basketball + Women's Basketball
- Ship what's in season NOW
- Football added in Phase 2 (before next season)

---

## Implementation Plan

### Project Setup
```
~/dev/gamecock-dashboard/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout, providers
│   │   ├── page.tsx            # Main dashboard (redirects to default sport)
│   │   ├── mbb/page.tsx        # Men's Basketball
│   │   └── wbb/page.tsx        # Women's Basketball
│   ├── components/
│   │   ├── ui/                 # shadcn components
│   │   ├── SportTabs.tsx       # Top navigation tabs
│   │   ├── SmartHero.tsx       # Contextual hero (live/upcoming/recent)
│   │   ├── GameCard.tsx        # Individual game display
│   │   ├── ScheduleList.tsx    # Upcoming games
│   │   ├── ResultsList.tsx     # Recent results
│   │   ├── StatsCard.tsx       # Team/player stats
│   │   ├── OddsDisplay.tsx     # Betting odds / prediction market
│   │   └── StreakChart.tsx     # Win/loss visualization
│   ├── lib/
│   │   ├── espn.ts             # ESPN API client
│   │   ├── odds.ts             # The Odds API client
│   │   ├── polymarket.ts       # Polymarket API client
│   │   └── utils.ts            # Helpers
│   └── hooks/
│       ├── useTeamData.ts      # TanStack Query hooks
│       └── useOdds.ts
├── public/
│   └── logos/                  # Team logos, USC branding
├── tailwind.config.ts
├── components.json             # shadcn config
└── package.json
```

### Implementation Steps

#### Step 1: Project Scaffolding ✅ DONE
- [x] Create Next.js 14 app with App Router
- [x] Install and configure shadcn/ui (tabs, card, button, badge, skeleton)
- [x] Set up Tailwind with USC colors (Garnet #73000A, Black #000)
- [x] Configure TanStack Query provider

#### Step 2: Data Layer ✅ DONE
- [x] Build ESPN API client (schedules, scores, stats)
- [ ] Build The Odds API client (betting lines)
- [ ] Build Polymarket client (prediction markets)
- [x] Create TanStack Query hooks with smart refetch intervals

#### Step 3: Core Components ✅ DONE
- [x] SportTabs - tab navigation between MBB/WBB
- [x] SmartHero - contextual display logic
- [x] GameCard - reusable game display
- [x] ScheduleList - upcoming games
- [x] ResultsList - recent results

#### Step 4: Enhanced Features
- [ ] OddsDisplay - betting odds visualization
- [ ] StreakChart - win/loss streak visualization (Recharts)
- [ ] StatsCard - key team/player stats

#### Step 5: Polish & Deploy
- [ ] Mobile optimization & testing
- [ ] Loading states, error handling
- [ ] Deploy to Vercel
- [ ] Connect custom domain (gamecock.ai or cocky.ai)

### USC Brand Colors
```css
--garnet: #73000A;
--black: #000000;
--white: #FFFFFF;
--gray: #58595B;
```

### API Refresh Strategy
| Context | Refresh Interval |
|---------|------------------|
| Live game | 30 seconds |
| Game day | 5 minutes |
| Normal | 15 minutes |
| Odds data | 5 minutes |
