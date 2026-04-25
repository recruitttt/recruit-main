# Recruit — frontend mockup

Autonomous job-application agent. **This is a frontend-only mockup** built for the
2026-04-26 hackathon demo. No real backend — all data is mocked, persisted to
`localStorage`. Stack mirrors Owen's `Recruit MVP` plan in Linear (Next.js 15)
so it could merge into the real project later.

## Live preview

→ Set after deploy.

## What's in here

| Route | Purpose |
|-------|---------|
| `/` | Landing — hero, live agent ticker, mock dashboard preview, features |
| `/onboarding` | 5-step flow: Account → Resume → Links → Preferences → Activate |
| `/dashboard` | KPIs, pipeline, provider coverage, 5 active runs, live activity feed |
| `/applications/[id]` | Run timeline, browser session preview, persona reviews, mapped Q&A |
| `/dlq` | Approve cached answers for unanswerable questions |
| `/pricing` | Free / Standard / Pro tiers (mock Stripe modal) |
| `/settings` | Profile, work auth, links, career prefs, cached answers |

## Stack

- Next.js 16 (App Router, TypeScript, Turbopack)
- Tailwind CSS v4 with custom design tokens
- motion (Framer Motion successor) for onboarding + activation animation
- lucide-react + custom brand SVGs
- `next/font/google`: Inter (UI), Instrument Serif (hero), JetBrains Mono (metrics)

No Convex, no Stripe, no Browserbase, no auth. By design.

## Local dev

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Where the real project lives

Owen's planning + spec docs are in Linear:
[obro / hacktech / Recruit MVP](https://linear.app/obro/project/recruit-mvp-a25b9333167d)

Architecture, Ashby provider spec, and Demo Lock Runbook all live there.
