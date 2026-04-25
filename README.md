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
| `/pricing` | Free / Standard / Pro tiers with Stripe sandbox checkout |
| `/settings` | Profile, work auth, links, career prefs, cached answers |

## Stack

- Next.js 16 (App Router, TypeScript, Turbopack)
- Tailwind CSS v4 with custom design tokens
- motion (Framer Motion successor) for onboarding + activation animation
- lucide-react + custom brand SVGs
- `next/font/google`: Inter (UI), Instrument Serif (hero), JetBrains Mono (metrics)

No Convex, no Browserbase, no auth. Stripe is sandbox-only for demo.

## Local dev

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Stripe sandbox

Pricing uses hosted Stripe Checkout in test/sandbox mode. Add these values to
`.env.local` before clicking Standard or Pro:

```bash
STRIPE_SECRET_KEY=sk_test_or_sandbox_value
STRIPE_STANDARD_PRICE_ID=price_standard_test_value
STRIPE_PRO_PRICE_ID=price_pro_test_value
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Do not commit real Stripe keys. `.env.local` is ignored by git.

## Where the real project lives

Owen's planning + spec docs are in Linear:
[obro / hacktech / Recruit MVP](https://linear.app/obro/project/recruit-mvp-a25b9333167d)

Architecture, Ashby provider spec, and Demo Lock Runbook all live there.
