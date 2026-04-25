# Recruit Mockup — Context

A frontend-only mockup of **Recruit**, the autonomous job-application agent Mo is building for the 2026-04-26 hackathon demo with Owen Fisher's team. Built as a separate repo from Owen's Next.js/Convex stack so it can ship a preview URL without touching his architecture.

**Owner:** Mo. **Deployed:** Vercel (mohosys-projects/recruit-mockup, linked via `.vercel/project.json`). **GitHub:** mohosy/recruit-mockup (private).

---

## What it is

A single-page marketing + onboarding experience. No real backend. All state is `localStorage` + mock data in `lib/mock-data.ts`.

**Scope:** Landing → chat-style onboarding → populated dashboard → application detail → DLQ → pricing → settings.

**Not built yet:** Real auth (Clerk planned, deferred). Any real backend. Stripe. Convex. Browserbase.

---

## Stack

- **Next.js 16.2.4** (App Router, Turbopack, RSC)
- **React 19**, TypeScript
- **Tailwind v4** (`@tailwindcss/postcss`, tokens in `@theme { }` inside `app/globals.css`)
- **motion/react** v12 (successor to framer-motion)
- **lucide-react** for icons
- Fonts via `next/font/google`: Instrument Serif (hero), Inter (UI), JetBrains Mono (metrics/logs)
- Deployed on **Vercel** (GitHub integration)

Note: the repo has an `AGENTS.md` warning that this Next.js version has breaking changes from training data — check `node_modules/next/dist/docs/` before writing Next-specific code.

---

## Theme: warm paper (light)

Earlier iteration was dark-cyan/black (Linear/Vercel console aesthetic). **Pivoted to light** mid-session because job hunting is stressful and dark + neon felt clinical.

Tokens in `app/globals.css`:

```css
--color-bg:             #F9F7F3   /* warm ivory */
--color-surface:        #FFFFFF
--color-surface-1:      #F3F1EC
--color-border:         #E5E2DB
--color-fg:             #0F0F12   /* warm near-black, not pure */
--color-fg-muted:       #585861
--color-fg-subtle:      #8E8C93
--color-accent:         #0891B2   /* cyan-600, deeper on light */
--color-accent-glow:    rgba(8,145,178,0.32)
```

Colored text uses `-700` variants (text-emerald-700 etc.); tinted backgrounds use `/10` of 500-variants. Never `-300`/`-400` for text on light.

---

## The 5-agent model

**Decision:** All 5 agents do the *same* job (full application pipeline) and run in parallel — one agent per application. They are NOT specialists. Earlier design had them as pipeline specialists (Scout sources, Mimi tailors...) but Mo pushed back: the product story is "5 robots applying while you sleep," not an assembly line.

Characters have personality (name, color, face) but functional parity. Defined in `lib/agents.ts`. Custom SVG portraits in `components/onboarding/characters.tsx`:

| id    | name  | hue               | expression |
|-------|-------|-------------------|-----------|
| scout | Scout | #0891B2 cyan-600  | antenna + pulse ring, curious smile, wide eyes (the **lead**, does all onboarding talking) |
| mimi  | Mimi  | #DB2777 pink-600  | hair tufts, closed happy `⌒⌒` eyes, pink blush, tiny `w` mouth |
| pip   | Pip   | #7C3AED violet-600| one big cyclops eye with colored iris, serious flat mouth |
| juno  | Juno  | #D97706 amber-600 | pointy ears, alert oval eyes, surprised `o` mouth |
| bodhi | Bodhi | #059669 emerald-600| wider body, sleepy zen eyes, sparkle above, calm smile |

---

## Routes + surfaces

| Route                | State                                                                                       |
|----------------------|---------------------------------------------------------------------------------------------|
| `/`                  | Landing — hero with headline, rotating-placeholder prompt, pipeline flight animation        |
| `/onboarding`        | Chat-style onboarding (5 steps as beats), collects data to localStorage                     |
| `/dashboard`         | Populated dashboard — KPI strip, active runs, activity feed, pipeline, provider coverage    |
| `/applications/[id]` | Fake app detail — status timeline, tailoring score, persona review, mapped questions         |
| `/dlq`               | Dead-letter queue — unanswerable-question approval UX                                       |
| `/pricing`           | Free/Standard/Pro tiers with fake Stripe confirmation modal                                 |
| `/settings`          | Read-only display of intake data                                                            |

Shared shell for logged-in routes: `app/(app)/layout.tsx` with `components/shell/topnav.tsx`.

---

## Landing page animation choreography

A single cinematic reveal plays on every page load. State machine in `components/landing/agent-pipeline.tsx`:

```
reveal   (2.3s) → five steps stagger-fade in horizontally
                  "Finding jobs · Tailoring resumes · Submitting · Reaching recruiters · Scheduling interviews"
dwell    (1.2s) → pause so you can read the list
collapse (700ms)→ each item translates toward center, scale 0.4, fade, blur(1.5px)
burst    (260ms)→ cyan radial-gradient pulse at convergence point
                  Mark (recruit logo glyph) emerges inside the burst, scales 0.2 → 1.1, rotates -90° → 0°
fly      (780ms)→ Mark flies up-left to the header logo position (measured via [data-logo-mark])
                  Fades out in last 15% of the flight
done            → real Wordmark in header fades in (240ms), Mark pulses scale(1→1.22→1) + brightness
```

Header `Wordmark` is **hidden** (`opacity: 0`) until `AgentPipeline` calls `onComplete`. Narrative: the 5 agents literally become the brand.

Other landing details:
- **Prompt box** (`components/landing/job-prompt.tsx`): animated placeholder rotates through examples ("Ex. Looking for software engineering internships...") via framer-motion flip-up. Native placeholder empty; text is an absolutely-positioned overlay that hides on focus/typing.
- **CTA copy:** "Spin up my 5 agents"
- **No chips, no sections below the hero.** Just logo/headline/prompt, then footer.

---

## Onboarding UX (the centerpiece)

Not a wizard. A **chat thread with a lead agent (Scout)**. Located at `/onboarding`.

Structure: left rail with 5 agent avatar orbs + vertical connector line between them; right side is a chat thread that grows as Scout types.

**Beats** (see `app/onboarding/page.tsx`):
- Scout intros herself, collects name + email
- Mimi comes online (wake effect), Scout asks for resume (with "I don't have one yet" option)
- Pip comes online, Scout asks for public links (GitHub/LinkedIn/X/DevPost, all skippable)
- Juno comes online, Scout asks for role preferences (role chips, location, work auth)
- Bodhi comes online
- Scout: "Squad assembled. Spinning up."
- Activation reveal: each agent paired with one of 5 companies, all 5 "applying" status, redirect to /dashboard

**Key UX details:**
- **Typewriter reveal** on agent messages: 380ms typing indicator → character-by-character at 30ms/char → 520ms pause → next beat. Blinking caret while typing.
- **Synth sound effects** (`lib/sounds.ts`): send, receive, wake, activate. Web Audio API, no asset files. Mute toggle in header (persisted to `recruit:muted`).
- **Wake effects** when a new agent comes online:
  - Subtle camera shake (`[0, -1.5, 2, -1.5, 1, 0]px` over 350ms)
  - Shockwave rings from the orb in that agent's hue
  - Orb scale bounce
  - Connector line between agents fills with a gradient (prev hue → next hue)
  - No fullscreen flash, no floating badge (both removed per Mo's feedback — felt intrusive)

---

## Dashboard + other surfaces

All mock data in `lib/mock-data.ts`. KPI values are stable for demo: 128 submitted, 3 live agents, 4 DLQ pending, 312 cache reuses, 23.4hr time saved.

5 mock applications spread across lifecycle stages (queued, tailoring, reviewing, submitting, submitted). DLQ has 2 unanswerable-question items + 1 submission-error.

Dashboard components in `components/dashboard/`. Copy and semantic colors have been theme-swept to 700-variants for light.

---

## Design rules ("house style") to respect

1. **No em-dashes or hyphens in prose.** AI tells. Use periods, commas, or middle-dots (`·`) instead. Scrubbed throughout. Salary ranges like `$200k – $290k` are OK (range convention).
2. **Single cyan accent per surface** (Owen's rule). Character personalities can deviate with per-agent hue, but chrome (buttons, borders, cursor glow) stays cyan-600.
3. **Editorial density.** Thin dividers, micro labels in `10–11px` uppercase tracking-wide mono, metrics in Instrument Serif tabular-nums.
4. **Gerunds, not infinitives**, when describing what the agents do. "Finding jobs" not "Find jobs" — the agents are the subject.
5. **Light theme is warm, not clinical.** Ivory (`#F9F7F3`), not pure white. Shadows are soft `rgba(15,15,18, 0.08–0.12)`, not black.

---

## Guardrails from Owen's spec

This mockup must **not** contradict claims in Owen's Demo Lock Runbook:
- **Ashby is the only "live" provider.** Greenhouse/Lever/Workday are "Coming soon" / locked tiles.
- **No claim of automated Gmail outreach.** The "reach recruiters" step is displayed but not functionally promised in detail anywhere.
- All copy uses Ashby-specific URLs (`jobs.ashbyhq.com/...`) in mock data.

Don't add copy about "all ATS" or "universal automation."

---

## File map (quick reference)

```
app/
  layout.tsx                root (fonts, metadata)
  globals.css               all design tokens + keyframes
  page.tsx                  landing (client — needs useState for logo reveal)
  onboarding/
    layout.tsx              centered container with warm wash
    page.tsx                chat-style onboarding (the big one)
  (app)/                    shared shell for logged-in surfaces
    layout.tsx              topnav shell
    dashboard/page.tsx
    applications/[id]/page.tsx
    dlq/page.tsx
    settings/page.tsx
  pricing/page.tsx

components/
  landing/
    hero-bg.tsx             cursor spotlight + drifting orbs
    job-prompt.tsx          prompt box with rotating flip-up placeholder
    agent-pipeline.tsx      the reveal→collapse→fly-to-logo choreography
    agent-ticker.tsx        (retired, still on disk — live-runs pill)
  onboarding/
    characters.tsx          5 custom SVG characters
    agent-rail.tsx          left rail w/ orbs + connector line
    chat.tsx                AgentMessage / UserMessage / TypingIndicator
  dashboard/*               KPI strip, active runs, activity feed, pipeline, provider coverage
  shell/topnav.tsx          logged-in top nav
  ui/                       button, badge, card, logo (Wordmark + Mark)

lib/
  agents.ts                 5 agent config (id, name, label, tagline, hue)
  mock-data.ts              all demo data (apps, KPIs, DLQ, personas, questions, activity feed)
  sounds.ts                 Web Audio SFX (send/receive/wake/activate + mute)
  utils.ts                  cn(), rgba(), formatRelative()
```

---

## Deferred / next

1. **Real auth via Clerk.** The mocked "Continue with Google/GitHub" buttons in the onboarding email step should become real Clerk flows. Protect `/dashboard`, `/dlq`, `/settings` behind auth. Free tier covers hackathon.
2. Possibly wire minimal persistence (Convex or Supabase) so sessions survive refresh beyond localStorage. Only if demo reveals the need.
3. **Room view v2 (3D agent dashboard).** Parked vision: replace or toggle alongside the 2D dashboard with a top-down 3D room where the 5 agents physically walk between stations representing their pipeline state. See [`plans/room-view-v2.md`](plans/room-view-v2.md) for the full plan. Not for hackathon demo, post-demo v2.

---

## How to onboard a new session

```bash
cd /Users/mo/Downloads/CODE/recruit-mockup
npm run dev
```

Open `context.md` (this file) first. Then `app/onboarding/page.tsx` for the heaviest logic, `components/landing/agent-pipeline.tsx` for the flight animation, and `app/globals.css` for the theme.
