This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Push notifications

Game alerts (kickoff, scores, halftime, final, big moments) are sent with Web Push. On
iPhone they only work after **Add to Home Screen** (iOS 16.4+); `usePush().needsInstall`
tells the UI when to ask for that.

**Env vars** (Vercel preview + production, and `.env.local`):
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`,
`CRON_SECRET`, `BLOB_READ_WRITE_TOKEN`.

**Pieces**
- `public/sw.js`: shows pushes, focuses/opens the app on tap, re-subscribes on
  `pushsubscriptionchange`. It has no fetch handler and caches nothing, so scores are never
  stale.
- `src/hooks/usePush.ts`: client hook (subscribe / updatePrefs / unsubscribe / sendTest).
- `POST /api/push/subscribe`, `/api/push/unsubscribe`, `/api/push/status` (server copy of
  prefs), `/api/push/test` (one test per 30 s), `GET /api/push/vapid` (public key for the SW).
  Endpoints must be https and on a known push service (FCM, Apple, Mozilla, WNS).
- Storage is Vercel Blob. The store is public-by-URL, so subscriptions live at
  `subs/<sha256(endpoint)>.json` (unguessable) and there is no list API. Per-game dedup
  state lives at `state/<sport>-<eventId>.json`. Dead subscriptions (404/410 from the push
  service) are deleted on send.

**Cron.** `vercel.json` runs `GET /api/cron/notify` every minute; Vercel sends
`Authorization: Bearer $CRON_SECRET` (anything else gets 401). Each tick, per sport, it
reads South Carolina's ESPN schedule, picks games that are live, start within 35 min, or
started in the last 8 h, fetches the summary, and runs the pure detector
`src/lib/push/detect.ts` (`detect(prevState, summary, now) -> { events, nextState }`).
State is saved with a conditional write *before* sending, so overlapping ticks can't double
send. The first time a game is seen already in progress, state is seeded silently (no
backlog of old scores); a missed stretch of 3+ scores collapses into one "Score update".
Finished games are skipped without fetching. Football alerts per scoring play; baseball per
run; basketball only kickoff, halftime, overtime, close-late and final. TTLs: kickoff-soon
until kickoff, kickoff 5 min, scores 10 min, final 1 h. The tick returns 500 with an
`errors` list if ESPN or Blob failed, so it shows in Vercel logs.

**Test locally**
```bash
npm run test:push      # replays real ESPN JSON (SC 27, Tennessee 24; Kentucky 35, SC 34)
                       # through the detector, plus a full cron tick with mocked web-push
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/notify
```
Without a game in the window the tick returns `"games": []`. Fixtures are in
`src/lib/push/__tests__/fixtures/`.
