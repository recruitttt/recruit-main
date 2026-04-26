# Digital Twin — Design Spec

**Date:** 2026-04-26
**Author:** Brainstorm session with user
**Status:** Approved for implementation planning

---

## Overview

Transform the existing 3D room (`/3d` page, `components/room/*`) into a true **digital twin** of the Recruit application. Every backend capability — profile management, job discovery, ranking, resume tailoring, recruiter conversations, application submission — is exposed and operable inside the 3D environment as physical interactions. The user experience is: walk to a station, sit down, take an action, see live results.

This work is delivered in one push using parallel sub-agent execution (no incremental rollout).

## Goals

1. Fix the broken player spawn and desk placement so the user enters into a comfortable, navigable space.
2. Replace stage-based room agents with **5 persistent, company-specific recruiter agents** for the user's top 5 tailored job applications, each backed by GPT-5.4 nano with web search and rich personalization context.
3. Add a **Personalization Agent** — a roaming AI that proactively learns about the user and stores insights in a new profile section, used by recruiters and form-filler.
4. Build a **Desk Hub** with a 3D computer screen surfacing every dashboard capability (profile, discover, top jobs, resumes, application queue) with live Convex state.
5. Build an **Application Terminal** — separate 3D station — that triggers form-filling and shows progress in real-time.
6. Wire the existing Ashby and Lever form fillers properly so applications actually submit. Add graceful fallback for unsupported providers (Workday, Greenhouse) without crashing.
7. Add interaction animations: sit-down, stand-up, desk collapse/expand, recruiter approach detection.

## Non-Goals

- Greenhouse form-filler implementation (deferred — fallback path only)
- Workday form-filler implementation (deferred — fallback path only)
- Mobile/touch optimization
- VR/AR support
- Multi-user shared rooms

---

## Architecture

### High-Level System Map

```
┌─────────────────────────────────────────────────────────────────┐
│                      3D Room (/3d page)                         │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │ Player Char  │    │ Desk Hub     │    │ Application  │       │
│  │ (spawn fix)  │◄──►│ (collapse/   │◄──►│ Terminal     │       │
│  │              │    │  expand)     │    │              │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                    ▲                    │             │
│         │                    │                    │             │
│         ▼                    │                    ▼             │
│  ┌──────────────────────────────────────────────────────┐       │
│  │         5 Recruiters (one per top job)               │       │
│  │      [Auto-generated 3D variants with company sign]  │       │
│  └──────────────────────────────────────────────────────┘       │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────────────────────────────────────────────┐       │
│  │          Personalization Agent (floating)            │       │
│  └──────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (Convex reactive queries)
┌─────────────────────────────────────────────────────────────────┐
│                          Convex Backend                         │
│                                                                 │
│  Existing:                       New:                           │
│  - userProfiles                 - userProfiles.personalization  │
│  - tailoredApplications         - recruiters                    │
│  - applicationJobs              - recruiterConversations        │
│  - applicationActions (Ashby/   - recruiterActions              │
│    Lever form filler)           - personalizationAgent          │
│                                 - applicationJobs.brainstormedAnswers │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │  GPT-5.4 nano with   │
                   │  web search tool     │
                   │  (per recruiter)     │
                   └──────────────────────┘
```

### Component Boundaries

| Subsystem | Owns | Communicates Via |
|-----------|------|------------------|
| 3D Scene | Three.js scene graph, animations, camera, player movement | `useRoomStore` (zustand), Convex queries |
| Recruiter Backend | GPT calls, web search, prompt assembly, conversation persistence | Convex actions, `recruiters` & `recruiterConversations` tables |
| Recruiter 3D | Visual representation, idle/alert/talking states, company branding | `useRoomStore`, Convex `useQuery(recruiters)` |
| Desk Hub UI | Tab navigation, live data, action triggers | React Three Fiber `<Html>`, Convex `useQuery` |
| Application Terminal | Trigger applyJob action, show real-time progress | Convex action `runApplicationJob`, event stream |
| Personalization Agent | Conversation, insight extraction, profile updates | Convex action `personalizationAgent`, `userProfiles.personalization` |
| Form Filler (existing) | Ashby/Lever submission, error reporting | `lib/form-engine/runner.ts` (no changes; integration only) |

---

## Detailed Designs

### Part 1 — 3D Room & Player Foundation

**Spawn fix.** The player character spawn position is currently colliding with the desk. The fix:
- Define `SPAWN_POINT = [0, 0, 4]` (center of room, ~3m from desk).
- Update `components/room/player-character.tsx` initial position.
- Verify free path of 1.5m radius around spawn before testing.

**Desk redesign.** The desk becomes the user's personal workstation with two states:
- `collapsed` — small folded footprint (think laptop closed), positioned discreetly
- `expanded` — full workstation with chair, monitor, keyboard, peripherals

**Animation.** Use `@tweenjs/tween.js` (already a Three.js ecosystem standard) for collapse/expand:
- Trigger: user clicks desk OR uses "E" key when nearby OR clicks "Open Workstation" prompt
- Duration: 800ms with `Easing.Cubic.InOut`
- Animates: scale, rotation of fold-out parts, monitor power-on glow
- Reverse on collapse (user clicks elsewhere or presses "E" again)

**Sit-down sequence.**
1. Detect proximity to chair (radius 1.2m)
2. Show `Press E to sit` prompt overlay
3. On press: smooth walk-to-chair tween (800ms)
4. Rotate body to face desk (200ms)
5. Lower body Y position to seated height (300ms)
6. Camera transitions to `first-person-at-desk` mode (FOV ~55, position behind monitor)
7. Desk computer screen activates → Desk Hub UI renders
8. Standing reverses all steps; press `Escape` or `E`

**State additions to `useRoomStore`:**
- `deskState: "collapsed" | "expanded" | "animating"`
- `playerPose: "standing" | "walking" | "sitting" | "transitioning"`
- `cameraMode` adds new value `"first-person-desk"`

**Files affected:**
- `components/room/player-character.tsx`
- `components/room/room-camera.tsx`
- `components/room/room-furniture.tsx` (desk component)
- `components/room/room-store.ts`
- `lib/room/player-position.ts`
- New: `lib/room/animation.ts` (Tween helpers)

---

### Part 2 — Recruiter Agent System

**Goal.** Replace stage-based agents with 5 dynamically-instantiated recruiters, one per top job.

#### Backend

**New Convex tables.**

```typescript
// convex/schema.ts additions
recruiters: defineTable({
  userId: v.string(),
  jobId: v.id("applicationJobs"),         // links to a tailored job
  companyName: v.string(),
  companyDomain: v.optional(v.string()),  // for web search context
  recruiterName: v.string(),              // auto-generated, e.g., "Sarah Patel"
  appearanceSeed: v.number(),             // deterministic variant generator seed
  positionIndex: v.number(),              // 0-4, determines desk position
  status: v.union(
    v.literal("active"),       // currently visible, takes conversations
    v.literal("applied"),      // user applied through them, animating exit
    v.literal("departed")      // off-stage
  ),
  companyContext: v.optional(v.string()), // cached web search synthesis
  contextFetchedAt: v.optional(v.string()),
  createdAt: v.string(),
  updatedAt: v.string(),
})
  .index("by_user", ["userId"])
  .index("by_user_status", ["userId", "status"]),

recruiterConversations: defineTable({
  recruiterId: v.id("recruiters"),
  userId: v.string(),
  messages: v.array(
    v.object({
      role: v.union(v.literal("user"), v.literal("recruiter"), v.literal("tool")),
      content: v.string(),
      timestamp: v.string(),
      toolCalls: v.optional(v.array(v.any())),
    })
  ),
  brainstormedAnswers: v.array(
    v.object({
      questionType: v.string(),  // e.g., "why_this_company", "biggest_challenge"
      answer: v.string(),
      extractedAt: v.string(),
    })
  ),
  createdAt: v.string(),
  updatedAt: v.string(),
})
  .index("by_recruiter", ["recruiterId"])
  .index("by_user", ["userId"]),
```

**New Convex action: `convex/recruiterActions.ts`**

- `seedRecruiters(userId)` — pulls top 5 tailored jobs, creates 5 recruiter records with auto-generated names and appearance seeds
- `sendMessageToRecruiter(recruiterId, message)` — routes to GPT-5.4 nano with full context + web search tool, persists user + recruiter messages, extracts brainstormed answers
- `applyThroughRecruiter(recruiterId)` — marks recruiter as "applied", queues an `applicationJobs` row, triggers terminal flow
- `replenishRecruiters(userId)` — when one departs, promote next-best tailored job to a new recruiter

**Recruiter prompt assembly.**

```
Base persona (shared across all recruiters):
"You are an experienced technical recruiter for [COMPANY]. You speak with the
candidate as a knowledgeable insider — you know the team, culture, recent
news, and the role specifics. You help with: company background and values,
role-specific positioning, application strategy, resume feedback for this
specific job, interview preparation, culture fit analysis.

You ALWAYS:
- Use the web search tool BEFORE answering company-specific questions to ensure
  facts are current (recent funding, leadership changes, product launches)
- Reference the candidate's actual background and tailored resume in advice
- Help draft answers to common application questions when asked
- Be specific — no generic 'be passionate' platitudes

You NEVER:
- Make up facts about the company
- Reveal information about other companies' candidates
- Pretend to have insider info you don't have
- Generic AI slop ('great question!', 'I'm an AI assistant')
- Add disclaimers about being an AI

Output format: Direct, professional, conversational. Reference specific
details from the candidate's profile and the company. When the candidate
mentions an application question, capture their answer in structured form
for later use."

Per-recruiter context injection:
- COMPANY: {companyName}
- COMPANY_CONTEXT: {cached web search synthesis}
- ROLE: {jobTitle, jobDescription}
- USER_PROFILE_SUMMARY: {synthesized profile - 500 word max}
- TAILORED_RESUME_SUMMARY: {key points from this user's tailored resume for this job}
- PERSONALIZATION_INSIGHTS: {from userProfiles.personalization}
- CONVERSATION_HISTORY: {prior messages}
```

**Web search integration.** Use OpenAI's web_search tool wired into the GPT-5.4 nano call. The recruiter decides when to invoke it; results are cached in `recruiters.companyContext` with a 24-hour TTL.

**Brainstormed answer extraction.** Run after each recruiter response: a lightweight follow-up call asks "Did this exchange produce an answer for an application question? If yes, return JSON with `questionType` and `answer`." Stored in `recruiterConversations.brainstormedAnswers`.

#### 3D Layer

**Auto-generated recruiter appearances.**

Each recruiter has an `appearanceSeed` (number). A deterministic generator produces:
- Hair color (8 options)
- Skin tone (5 options)
- Outfit color (8 options, business casual palette)
- Body proportions (3 variants)
- Accessory (glasses / clipboard / coffee / laptop bag — random subset)
- Optional: hair style (4 variants)

Result: ~5,760 unique combinations. With 5 recruiters, collisions are negligible.

**Recruiter desk layout.** 5 desks arranged in an arc on the east side of the room:
- Center: the user's desk (Part 3)
- East arc: 5 recruiter desks at angles -40°, -20°, 0°, 20°, 40° from center, radius 7m
- Each desk has: chair, computer (decorative), small company-branded sign

**Behaviors.**
- `idle`: gentle sway, occasionally checks clipboard, sips coffee
- `alert`: when player within 3m, stand up, turn to face player
- `talking`: when conversation active, subtle gestures matching speech timing
- `applied`: stamp paperwork, hand it off, walk off-stage (exit animation 2s)
- `arriving`: walk in from queue door, take seat (entry animation 2s)

**Files affected:**
- New: `convex/schema.ts` (additions)
- New: `convex/recruiterActions.ts`
- New: `convex/recruiters.ts` (queries/mutations)
- New: `lib/recruiter/prompt.ts` (prompt assembly)
- New: `lib/recruiter/web-search.ts` (web search tool wrapper)
- New: `lib/recruiter/appearance.ts` (seed-based variant generator)
- New: `components/room/recruiter-character.tsx`
- New: `components/room/recruiter-desk.tsx`
- New: `components/room/room-recruiters.tsx` (replaces or augments `room-agents.tsx`)
- New: `components/room/recruiter-dialogue.tsx`

---

### Part 3 — Desk Hub

**Goal.** When the user sits at their desk, a 3D computer screen renders a tabbed UI with all dashboard capabilities backed by live Convex data.

**Implementation.** Use `<Html>` from `@react-three/drei` to mount a React component on a 3D plane positioned as the monitor screen. The HTML element renders normally with proper transform.

**Tabs.**

1. **Profile** — Mirror existing `/profile` page. Edit fields, view personalization section, see provenance per field. Saves through existing Convex `userProfiles` mutations.

2. **Discover** — Job search with filters (location, role type, seniority). Calls existing job discovery flow. Triggers tailoring on selection.

3. **Top 5** — Live ranked tailored jobs. Each shows:
   - Company, role, match score
   - Recruiter status indicator (✓ available, applying, applied)
   - "Visit Recruiter" CTA — sets player mode to walk, focuses camera on recruiter, shows arrow indicator

4. **Resumes** — Preview tailored resumes for each top job. Regenerate / edit options. Uses existing `lib/resume/render.ts`.

5. **Apply Queue** — Shows applications in flight or pending. Each row has "Open Terminal" CTA — triggers walk-to-terminal mode.

**Real-time data.** All tabs use `useQuery` from Convex. Updates propagate within 100ms of backend changes.

**Files affected:**
- New: `components/room/desk-hub.tsx`
- New: `components/room/desk-hub/profile-tab.tsx`
- New: `components/room/desk-hub/discover-tab.tsx`
- New: `components/room/desk-hub/top-jobs-tab.tsx`
- New: `components/room/desk-hub/resumes-tab.tsx`
- New: `components/room/desk-hub/apply-queue-tab.tsx`
- Updated: `components/room/room-furniture.tsx` (mount `<Html>` on desk monitor)

---

### Part 4 — Application Workflow & Form Filler Integration

**Goal.** Wire up the existing Ashby and Lever form fillers correctly so users can actually apply. Add graceful fallback for unsupported providers.

**The bug.** `convex/applicationActions.ts:80-95` detects unsupported providers (anything not Ashby or Lever) and writes `failed_unsupported_widget` outcome. The 3D UI surfaces this as "Failed: unsupported widget" with no useful next step.

**Fixes.**

1. **Verify Ashby + Lever flow end-to-end.** Trace from terminal CTA → `runApplicationJob` action → form-engine runner → Browserbase session → submission. Identify any wiring gaps (auth, profile sync, tailored resume retrieval).

2. **Improve error UX.** Surface the failure category to the 3D UI:
   - `failed_unsupported_widget` → "We don't auto-fill this provider yet. Click for guided manual mode."
   - Other failures → specific actionable messages
   - The terminal screen shows the friendly message, not the raw category code

3. **Guided manual mode (fallback).** For unsupported providers:
   - Generate a "ready-to-apply" pack: cover letter, resume PDF link, all answers to common questions, brainstormed answers from recruiter
   - Show the user a copy-paste UI on the terminal screen
   - Offer "Open application in browser" button → opens external link
   - Mark application as `manual_pending` (new status); user confirms when done

4. **Provider compatibility detection.** Before "Submit" button is shown:
   - Run pre-flight on the URL (extract host, classify provider)
   - Display badge: ✓ Auto-fill | ⚠ Guided Manual | ❌ Unsupported (no manual option)

**3D Application Terminal.**

- Located in southeast corner of room (visible from desk)
- Walk-up triggers screen activation
- Shows queue of applications waiting (sourced from `applicationJobs` where status = pending)
- Each row: company, role, provider badge, "Submit" or "Manual" button
- On Submit (Ashby/Lever): real-time progress display with steps:
  - "Loading application page..."
  - "Authenticating session..."
  - "Filling personal info..."
  - "Filling experience..."
  - "Reviewing your recruiter brainstorm answers..."
  - "Submitting..."
  - "Submitted ✓"
- On error: actionable next step + retry / manual / skip

**Wiring Recruiter conversation → form filler.**

- `recruiterConversations.brainstormedAnswers` flows through to `applicationJobs.brainstormedAnswers` (new field) when user clicks "Apply through this recruiter"
- Form-engine runner reads `brainstormedAnswers` and uses them to answer matching open-ended questions during fill
- Falls back to LLM-generated answers (existing path) when no brainstorm exists

**Files affected:**
- Updated: `convex/applicationActions.ts` (better error categorization, brainstormedAnswers integration)
- Updated: `convex/applicationJobs.ts` (new `brainstormedAnswers` field)
- Updated: `lib/form-engine/runner.ts` (read brainstormedAnswers if present)
- Updated: `lib/form-engine/types.ts` (new types)
- New: `components/room/application-terminal.tsx`
- New: `components/room/terminal-progress.tsx`
- New: `components/room/manual-application-pack.tsx`
- New: `lib/application/provider-detection.ts`

---

### Part 5 — Personalization Agent

**Goal.** A separate floating AI agent that learns about the user and stores insights for downstream use.

**Visual.** A small bobbing companion (sphere or cute robot character). Floats near the user at ~2m altitude. Click to open chat panel.

**Behaviors.**
- **Reactive:** Always available — click to chat anytime
- **Proactive:** During detected idle moments (no input for >2 min), surfaces a question via speech bubble
- **Non-intrusive:** Dismissible. Doesn't interrupt active workflows.

**Question generation.** A library of question categories:
- Career goals: "Where do you see yourself in 3 years?"
- Work environment: "Do you thrive in fast-paced or methodical environments?"
- Motivations: "What's driven your biggest career decisions?"
- Stories: "Tell me about a project you're proud of."
- Communication: "How do you prefer to give and receive feedback?"
- Values: "What's a non-negotiable for your next role?"

The agent picks questions intelligently — avoids repeats, prioritizes gaps in `userProfiles.personalization`.

**Insight extraction.** After each user response:
- LLM extracts structured insights into the personalization schema
- Updates the relevant subsection
- Optional follow-up question if the answer was rich

**New profile schema section: `userProfiles.personalization`**

```typescript
personalization: v.optional(
  v.object({
    careerGoals: v.optional(v.string()),
    workEnvironment: v.optional(
      v.object({
        remote: v.optional(v.boolean()),
        teamSize: v.optional(v.string()),
        pace: v.optional(v.string()),
      })
    ),
    motivations: v.optional(v.array(v.string())),
    communicationStyle: v.optional(v.string()),
    valuesAlignment: v.optional(v.array(v.string())),
    storyFragments: v.optional(
      v.array(
        v.object({
          topic: v.string(),
          story: v.string(),
          updatedAt: v.string(),
        })
      )
    ),
    lastInteractionAt: v.optional(v.string()),
  })
)
```

**Used by:**
- Form filler: open-ended question answers reference `storyFragments` and `motivations`
- Recruiters: prompt injection includes personalization summary
- Resume tailorer: tone/emphasis adjustments based on `communicationStyle` and `valuesAlignment`

**Files affected:**
- Updated: `convex/schema.ts` (personalization field)
- Updated: `convex/userProfiles.ts` (mutations for personalization)
- New: `convex/personalizationAgent.ts` (agent action)
- New: `lib/personalization/questions.ts` (question library)
- New: `lib/personalization/insight-extractor.ts`
- New: `components/room/personalization-companion.tsx`
- New: `components/room/personalization-dialogue.tsx`

---

### Part 6 — Data Sync

All 3D components subscribe to Convex reactive queries. The room reflects backend truth within ~100ms.

**Reactive queries to add:**
- `recruiters.listForUser(userId)` — used by recruiter 3D layer
- `recruiterConversations.byRecruiter(recruiterId)` — used by dialogue panel
- `applicationJobs.queueForUser(userId)` — used by application terminal
- `applicationJobs.statusByIdReactive(jobId)` — used during in-flight fill

**Optimistic updates.**
- Chat messages: append immediately to local state, sync to Convex; reconcile on confirmation

**Event streams.**
- Form-filler progress: existing pattern (mirror `intakeRuns` event sanitizer/persister)
- Recruiter response streaming: Convex doesn't support streaming directly, so use chunked appends to `recruiterConversations.messages` (acceptable latency for chat)

---

### Part 7 — Multi-Agent Implementation Strategy

**Phase A — Schema foundation (sequential, blocking — must complete first):**

| Sub-agent | Scope | Files |
|-----------|-------|-------|
| A1 | Convex schema additions: `recruiters`, `recruiterConversations`, `userProfiles.personalization`, `applicationJobs.brainstormedAnswers` + generated types | `convex/schema.ts`, types |

**Phase B — Parallel main systems (run concurrently after Phase A):**

| Sub-agent | Scope | Files |
|-----------|-------|-------|
| B1 | 3D scene foundation: spawn fix, desk collapse/expand, sit animation | `player-character.tsx`, `room-camera.tsx`, `room-furniture.tsx`, `room-store.ts`, new `lib/room/animation.ts` |
| B2 | Recruiter backend: GPT-5.4 nano, web search, prompt assembly, persistence | `convex/recruiterActions.ts`, `convex/recruiters.ts`, `lib/recruiter/*` |
| B3 | Recruiter 3D: auto-generated variants, behaviors, layout | `recruiter-character.tsx`, `recruiter-desk.tsx`, `room-recruiters.tsx`, `lib/recruiter/appearance.ts` |
| B4 | Desk hub UI: tabs, live data | `desk-hub.tsx` + tab components |
| B5 | Application terminal 3D + progress UI + manual fallback | `application-terminal.tsx`, `terminal-progress.tsx`, `manual-application-pack.tsx` |
| B6 | Personalization agent: 3D + backend + profile section | `personalization-companion.tsx`, `convex/personalizationAgent.ts`, `lib/personalization/*` |
| B7 | Verify Ashby/Lever form-filler wiring end-to-end + improve error UX for unsupported providers | `convex/applicationActions.ts`, `lib/form-engine/runner.ts` |

**Phase C — Integration (sequential):**

| Sub-agent | Scope |
|-----------|-------|
| C1 | Wire flows: desk → recruiter → terminal → application; brainstormedAnswers handoff |
| C2 | E2E tests: full digital twin journey (spawn → desk → recruiter → terminal → submitted) |
| C3 | Polish: error states, loading states, empty states, edge cases |

---

## Data Flow — Full User Journey

1. User lands on `/3d` → spawns at lobby position (Part 1)
2. Sees 5 recruiters at their desks across the room, each with company sign (Parts 2 & 3)
3. Personalization Agent floats nearby, may ask a proactive question (Part 5)
4. User walks to desk → presses E to sit → desk unfolds → computer screen activates (Part 1)
5. User clicks "Top 5" tab → sees ranked jobs with recruiters (Part 3)
6. User clicks "Visit Recruiter" → camera pans, walk-to-recruiter mode activates → user gets up, walks
7. User approaches recruiter → recruiter stands up, greets by name (Part 2)
8. User sits at recruiter desk → chat panel opens
9. User asks: "What's the team culture like?" → recruiter calls web_search → responds with current info
10. User asks: "Help me brainstorm 'why this company?'" → recruiter walks through it; answer captured to `brainstormedAnswers`
11. User clicks "Apply through this recruiter" → recruiter prepares application; user gets up
12. Walk to Application Terminal → screen shows queued application
13. User clicks "Submit" → form-engine runs Ashby/Lever flow → progress streams
14. Submitted ✓ → Recruiter exit animation → next recruiter walks in for next-best job (Part 2)
15. Throughout: Personalization Agent gathers insights that improve open-ended answers in step 13

---

## Error Handling

| Failure | Detection | UI Response |
|---------|-----------|-------------|
| Recruiter context fetch fails (web search down) | Try/catch in action | Recruiter responds without web context, shows subtle "limited current info" indicator |
| GPT-5.4 nano API error | Try/catch in action | Friendly chat message: "Let me reconnect — try again in a moment" |
| Unsupported form provider (Workday/Greenhouse) | `applicationActions.ts` provider check | Terminal shows guided manual fallback with full answer pack |
| Browserbase session fails | Existing form-engine error path | Terminal surfaces specific error + retry button |
| Tailored resume not yet generated | Pre-flight check in apply flow | "Generating tailored resume first..." auto-trigger |
| Profile incomplete | Pre-flight check before recruiter chat | Personalization Agent appears: "Let's flesh out your profile first" |
| Convex connection lost | React Query error boundary | Toast: "Reconnecting..." |
| Player walks out of room bounds | Position clamp in player-character | Soft pushback animation |

---

## Testing Strategy

**Unit tests:**
- Recruiter prompt assembly with various contexts
- Appearance generator determinism
- Brainstormed answer extraction parsing
- Provider detection logic
- Personalization insight extraction

**Integration tests:**
- Full apply flow: recruiter chat → brainstormed answer → terminal → form fill (mocked Browserbase)
- Personalization → form filler open-ended answer
- Recruiter replenish on apply

**E2E tests (Playwright):**
- User journey: spawn → sit at desk → top 5 → visit recruiter → chat → apply → terminal → submit
- Desk collapse/expand animation completes
- Sit-down animation completes
- Recruiter approach detection
- Personalization companion floats and asks question

**Targets:** 80% coverage minimum (per project standards).

---

## Open Questions / Risks

1. **GPT-5.4 nano availability and quota.** Confirm model name and rate limits before implementation. Fallback to gpt-4o-mini if needed.

2. **Web search tool integration.** Verify the GPT-5.4 nano OpenAI SDK supports the web search tool natively. If not, integrate with a separate web search API (e.g., Tavily, Exa) and present results as tool output.

3. **`<Html>` performance in R3F.** Mounting React UI in 3D may have perf cost. Profile after Part 3 and optimize (memoization, occlusion culling) if needed.

4. **Animation library choice.** `@tweenjs/tween.js` vs `framer-motion-3d`. Default to Tween.js (lighter, no dependency added since Three.js ecosystem); reconsider if complex spring physics needed.

5. **Recruiter agent persistence.** Approach 1 (per design): each recruiter feels persistent because conversation history is stored in `recruiterConversations` and replayed into prompt context on every call. The Convex-side actor is request-scoped, but the *experience* is persistent (recruiter remembers prior exchanges, references them naturally). Verify this feels alive in user testing.

6. **Streaming chat responses.** Convex doesn't natively stream. Chunked appends to message arrays should work but verify perceived latency is acceptable.

---

## Acceptance Criteria

- [ ] User spawns in clear lobby area, no collision with desk
- [ ] Desk collapses and expands smoothly with animation
- [ ] User can sit and stand with proper animations and camera transition
- [ ] 5 recruiters visible, each with unique appearance and company sign
- [ ] User can walk to recruiter and chat; recruiter uses web search for company facts
- [ ] Recruiter prompts feel professional, not generic AI slop
- [ ] Brainstormed application answers are captured during recruiter chat
- [ ] Desk hub shows live profile, jobs, resumes, application queue
- [ ] User can apply to a real Ashby/Lever job through the terminal
- [ ] Application progress streams in real-time
- [ ] Workday/Greenhouse jobs surface guided manual mode (no crash)
- [ ] Personalization Agent floats, can be summoned, asks questions, stores insights
- [ ] Recruiters reference personalization data in conversations
- [ ] Form filler uses brainstormed answers + personalization for open-ended fields
- [ ] Sequential queue: applied recruiter exits, next enters with next-best job
- [ ] All E2E tests pass

---

## Dependencies

**External:**
- OpenAI API access for GPT-5.4 nano
- Web search API (native or Tavily/Exa)
- Browserbase (existing) for form filling
- Convex (existing)

**Internal:**
- `lib/form-engine/*` (Ashby + Lever fillers)
- `lib/resume/*` (resume generation)
- `lib/intake/*` (profile sourcing)
- Existing room scene infrastructure

**New libraries:**
- `@tweenjs/tween.js` (or equivalent) — desk + sit animations
- (none others — leverage existing stack)

---

## Implementation Order Reminder

Phase A (single sub-agent, schema only) → Phase B (7 sub-agents in parallel) → Phase C (3 sub-agents sequential for integration). Phase A blocks Phase B because all backend work depends on schema. Phase C blocks on Phase B completion because integration tests cross all subsystems.
