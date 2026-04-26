# Digital Twin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the existing 3D `/3d` page into a true digital twin — a navigable workspace where every Recruit capability (profile, jobs, recruiters, applications, personalization) is exposed as a physical interaction in the room.

**Architecture:** Keep the existing R3F scene infrastructure. Add: schema for recruiters + personalization + brainstormedAnswers; persistent per-company recruiter agents (GPT-5.4 nano + web search); 3D desk hub with `<Html>`-mounted live UI; application terminal that drives existing Ashby/Lever form filler with graceful fallback for unsupported providers; floating personalization companion. Phase A blocks all Phase B work; Phase B sub-agents run concurrently; Phase C wires flows and tests E2E.

**Tech Stack:** Next.js 15 App Router, React Three Fiber, @react-three/drei, Three.js, Tween.js, Convex, OpenAI SDK (GPT-5.4 nano + web_search tool), Playwright, Browserbase, Vitest.

**Reference spec:** `docs/superpowers/specs/2026-04-26-digital-twin-design.md`

---

## File Structure

### Phase A — Schema (sequential, blocks all of Phase B)
- Modify: `convex/schema.ts` — add `recruiters`, `recruiterConversations`; add fields to `applicationJobs`
- Modify: `lib/profile.ts` — add `Personalization` type to `UserProfile`

### Phase B1 — 3D Scene Foundation (parallel)
- Modify: `components/room/player-character.tsx` — fix spawn position
- Modify: `components/room/room-furniture.tsx` — desk collapse/expand
- Modify: `components/room/room-camera.tsx` — first-person-at-desk mode
- Modify: `components/room/room-store.ts` — new state: deskState, playerPose
- Create: `lib/room/animation.ts` — Tween helpers
- Create: `tests/room-spawn.test.ts`
- Create: `tests/room-animation.test.ts`

### Phase B2 — Recruiter Backend (parallel)
- Create: `convex/recruiters.ts` — queries/mutations
- Create: `convex/recruiterActions.ts` — agent action with web search
- Create: `lib/recruiter/types.ts`
- Create: `lib/recruiter/prompt.ts` — base + per-company assembly
- Create: `lib/recruiter/web-search.ts` — tool wrapper
- Create: `lib/recruiter/insight-extractor.ts` — extracts brainstormed answers
- Create: `tests/recruiter-prompt.test.ts`
- Create: `tests/recruiter-extractor.test.ts`

### Phase B3 — Recruiter 3D (parallel; depends on B1 spawn fix being merged)
- Create: `lib/recruiter/appearance.ts` — seed-based variant generator
- Create: `lib/recruiter/desk-layout.ts` — arc positioning math
- Create: `components/room/recruiter-character.tsx`
- Create: `components/room/recruiter-desk.tsx`
- Create: `components/room/room-recruiters.tsx`
- Create: `components/room/recruiter-dialogue.tsx`
- Modify: `components/room/room-scene.tsx` — mount `<RoomRecruiters>` instead of `<RoomAgents>`
- Create: `tests/recruiter-appearance.test.ts`
- Create: `tests/recruiter-layout.test.ts`

### Phase B4 — Desk Hub UI (parallel)
- Create: `components/room/desk-hub.tsx`
- Create: `components/room/desk-hub/profile-tab.tsx`
- Create: `components/room/desk-hub/discover-tab.tsx`
- Create: `components/room/desk-hub/top-jobs-tab.tsx`
- Create: `components/room/desk-hub/resumes-tab.tsx`
- Create: `components/room/desk-hub/apply-queue-tab.tsx`

### Phase B5 — Application Terminal & Form Filler Integration (parallel)
- Modify: `convex/applicationJobs.ts` — add `brainstormedAnswers` field, getter
- Modify: `convex/applicationActions.ts` — pass brainstormedAnswers to form-engine; classify error to user-friendly category
- Modify: `lib/form-engine/types.ts` — add `BrainstormedAnswer` type
- Modify: `lib/form-engine/runner.ts` — accept brainstormed answers; prefer over LLM when present
- Create: `lib/application/provider-detection.ts` — classify URL → ATS provider
- Create: `lib/application/error-messages.ts` — failure category → friendly message
- Create: `components/room/application-terminal.tsx`
- Create: `components/room/terminal-progress.tsx`
- Create: `components/room/manual-application-pack.tsx`
- Create: `tests/provider-detection.test.ts`
- Create: `tests/error-messages.test.ts`

### Phase B6 — Personalization Agent (parallel)
- Modify: `lib/profile.ts` — add `Personalization` type (also done in Phase A)
- Create: `convex/personalizationAgent.ts` — agent action
- Create: `lib/personalization/types.ts`
- Create: `lib/personalization/questions.ts`
- Create: `lib/personalization/insight-extractor.ts`
- Create: `components/room/personalization-companion.tsx`
- Create: `components/room/personalization-dialogue.tsx`
- Create: `tests/personalization-questions.test.ts`
- Create: `tests/personalization-extractor.test.ts`

### Phase C — Integration (sequential)
- Modify: `app/(app)/3d/page.tsx` — wire all subsystems
- Create: `tests/e2e/digital-twin-journey.spec.ts` — Playwright E2E
- Polish pass on all components

---

## Phase A: Schema Foundation

### Task A1: Convex schema — recruiters, recruiterConversations, brainstormedAnswers

**Files:**
- Modify: `convex/schema.ts`
- Modify: `lib/profile.ts`

- [ ] **Step 1: Open `convex/schema.ts` and locate the position after `applicationJobEvidence` definition (search for `applicationJobEvidence: defineTable`).**

- [ ] **Step 2: Add the `recruiters` and `recruiterConversations` tables immediately after `applicationJobEvidence`.**

```typescript
recruiters: defineTable({
  userId: v.string(),
  jobId: v.id("applicationJobs"),
  companyName: v.string(),
  companyDomain: v.optional(v.string()),
  recruiterName: v.string(),
  appearanceSeed: v.number(),
  positionIndex: v.number(),
  status: v.union(
    v.literal("active"),
    v.literal("applied"),
    v.literal("departed"),
  ),
  companyContext: v.optional(v.string()),
  contextFetchedAt: v.optional(isoString),
  createdAt: isoString,
  updatedAt: isoString,
})
  .index("by_user", ["userId"])
  .index("by_user_status", ["userId", "status"])
  .index("by_user_position", ["userId", "positionIndex"]),

recruiterConversations: defineTable({
  recruiterId: v.id("recruiters"),
  userId: v.string(),
  messages: v.array(
    v.object({
      role: v.union(v.literal("user"), v.literal("recruiter"), v.literal("tool")),
      content: v.string(),
      timestamp: isoString,
      toolCalls: v.optional(v.array(v.any())),
    }),
  ),
  brainstormedAnswers: v.array(
    v.object({
      questionType: v.string(),
      answer: v.string(),
      extractedAt: isoString,
    }),
  ),
  createdAt: isoString,
  updatedAt: isoString,
})
  .index("by_recruiter", ["recruiterId"])
  .index("by_user", ["userId"]),
```

- [ ] **Step 3: Add `brainstormedAnswers` field to `applicationJobs` schema.**

Locate `applicationJobs: defineTable({` in `convex/schema.ts`. Add `brainstormedAnswers` after the existing `error` field (around line 412):

```typescript
    error: v.optional(v.string()),
    brainstormedAnswers: v.optional(
      v.array(
        v.object({
          questionType: v.string(),
          answer: v.string(),
        }),
      ),
    ),
    createdAt: isoString,
```

- [ ] **Step 4: Run Convex typegen to verify schema is valid.**

Run: `npx convex codegen`
Expected: completes without errors; new types appear in `convex/_generated/`.

- [ ] **Step 5: Add `Personalization` type to `lib/profile.ts`.**

In `lib/profile.ts`, add after the `ProfilePrefs` type (around line 57):

```typescript
export type Personalization = {
  careerGoals?: string;
  workEnvironment?: {
    remote?: boolean;
    teamSize?: string;
    pace?: string;
  };
  motivations?: string[];
  communicationStyle?: string;
  valuesAlignment?: string[];
  storyFragments?: Array<{
    topic: string;
    story: string;
    updatedAt: string;
  }>;
  lastInteractionAt?: string;
};
```

- [ ] **Step 6: Add `personalization` to the `UserProfile` type.**

In `lib/profile.ts`, find the `UserProfile` type definition. Add `personalization?: Personalization;` to it.

- [ ] **Step 7: Run typecheck to verify nothing breaks.**

Run: `npx tsc --noEmit`
Expected: no errors related to UserProfile or schema changes.

- [ ] **Step 8: Commit Phase A.**

```bash
git add convex/schema.ts lib/profile.ts
git commit -m "feat(schema): add recruiters, recruiterConversations, brainstormedAnswers, personalization"
```

---

## Phase B — Parallel Subsystems

> Phase A must be merged before any of B1–B6 begin. B1–B6 are independent and may run concurrently.

---

### Task B1: 3D Scene Foundation

**Files:**
- Create: `lib/room/animation.ts`
- Modify: `components/room/player-character.tsx`
- Modify: `components/room/room-furniture.tsx`
- Modify: `components/room/room-camera.tsx`
- Modify: `components/room/room-store.ts`
- Modify: `lib/room/player-position.ts`
- Test: `tests/room-spawn.test.ts`, `tests/room-animation.test.ts`

#### B1.1 — Spawn position fix

- [ ] **Step 1: Inspect current spawn in `lib/room/player-position.ts` to find the initial position.**

Run: `grep -n "spawn\|initial\|0, 0, 0\|playerPos" lib/room/player-position.ts components/room/player-character.tsx`

- [ ] **Step 2: Define `SPAWN_POINT` constant in `lib/room/player-position.ts`.**

Add at the top of the file:

```typescript
export const SPAWN_POINT: readonly [number, number, number] = [0, 0, 4];
export const SPAWN_FACING: number = Math.PI; // facing -Z (toward desks)
```

- [ ] **Step 3: Update `components/room/player-character.tsx` to use `SPAWN_POINT`.**

Find where the player's initial position is set (likely a `useState` or useRef with a position vector). Replace the initial value with `SPAWN_POINT` imported from `lib/room/player-position.ts`.

- [ ] **Step 4: Add a Vitest unit test that asserts SPAWN_POINT is non-zero on Z and the desk does not overlap.**

Create `tests/room-spawn.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { SPAWN_POINT } from "../lib/room/player-position";
import { STATIONS } from "../lib/room/stations";

describe("player spawn", () => {
  it("places player away from desk-collision zone", () => {
    expect(Math.abs(SPAWN_POINT[2])).toBeGreaterThanOrEqual(2);
  });

  it("does not overlap with any station within 1m radius", () => {
    for (const station of STATIONS) {
      const dx = SPAWN_POINT[0] - station.pos[0];
      const dz = SPAWN_POINT[2] - station.pos[2];
      const dist = Math.sqrt(dx * dx + dz * dz);
      expect(dist).toBeGreaterThan(1);
    }
  });
});
```

- [ ] **Step 5: Run the test.**

Run: `npx vitest run tests/room-spawn.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add lib/room/player-position.ts components/room/player-character.tsx tests/room-spawn.test.ts
git commit -m "feat(room): fix player spawn point away from desk"
```

#### B1.2 — Tween animation helpers

- [ ] **Step 1: Install `@tweenjs/tween.js` if not present.**

Run: `npm ls @tweenjs/tween.js || npm install @tweenjs/tween.js@^25`

- [ ] **Step 2: Create `lib/room/animation.ts`.**

```typescript
import * as TWEEN from "@tweenjs/tween.js";

export type EaseName = "linear" | "cubicInOut" | "quadOut" | "expoInOut";

const EASINGS: Record<EaseName, (k: number) => number> = {
  linear: TWEEN.Easing.Linear.None,
  cubicInOut: TWEEN.Easing.Cubic.InOut,
  quadOut: TWEEN.Easing.Quadratic.Out,
  expoInOut: TWEEN.Easing.Exponential.InOut,
};

export function tweenValue(
  from: number,
  to: number,
  durationMs: number,
  ease: EaseName,
  onUpdate: (v: number) => void,
  onComplete?: () => void,
): TWEEN.Tween<{ v: number }> {
  const obj = { v: from };
  const tween = new TWEEN.Tween(obj)
    .to({ v: to }, durationMs)
    .easing(EASINGS[ease])
    .onUpdate(() => onUpdate(obj.v));
  if (onComplete) tween.onComplete(onComplete);
  tween.start();
  return tween;
}

export function updateTweens(now: number) {
  TWEEN.update(now);
}
```

- [ ] **Step 3: Create unit test for the helper.**

Create `tests/room-animation.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import * as TWEEN from "@tweenjs/tween.js";
import { tweenValue, updateTweens } from "../lib/room/animation";

describe("tweenValue", () => {
  it("interpolates from start to end over duration", () => {
    let current = 0;
    const t0 = 1000;
    tweenValue(0, 10, 1000, "linear", (v) => (current = v));
    updateTweens(t0 + 500);
    expect(current).toBeCloseTo(5, 1);
    updateTweens(t0 + 1000);
    expect(current).toBeCloseTo(10, 1);
  });

  it("calls onComplete after duration", () => {
    let done = false;
    const t0 = 2000;
    tweenValue(0, 1, 100, "linear", () => {}, () => (done = true));
    updateTweens(t0 + 200);
    expect(done).toBe(true);
  });
});
```

Note: TWEEN uses `performance.now()` internally; the test pattern above relies on TWEEN's manual update which uses the timestamp passed. Adjust if TWEEN version differs.

- [ ] **Step 4: Run the test.**

Run: `npx vitest run tests/room-animation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add lib/room/animation.ts tests/room-animation.test.ts package.json package-lock.json
git commit -m "feat(room): add tween animation helpers"
```

#### B1.3 — Desk collapse/expand state and animation

- [ ] **Step 1: Add desk state to `components/room/room-store.ts`.**

Add to the `RoomState` type:

```typescript
deskState: "collapsed" | "expanded" | "animating";
playerPose: "standing" | "walking" | "sitting" | "transitioning";
setDeskState: (s: "collapsed" | "expanded" | "animating") => void;
setPlayerPose: (p: "standing" | "walking" | "sitting" | "transitioning") => void;
```

Add to the `create` initial state:

```typescript
deskState: "collapsed",
playerPose: "standing",
setDeskState: (s) => set({ deskState: s }),
setPlayerPose: (p) => set({ playerPose: p }),
```

- [ ] **Step 2: In `components/room/room-furniture.tsx`, add a `Desk` component that reads `deskState`.**

Locate the existing desk rendering (search for "desk" in the file). Refactor to a function `Desk` that:

```typescript
function Desk() {
  const deskState = useRoomStore((s) => s.deskState);
  const setDeskState = useRoomStore((s) => s.setDeskState);
  const groupRef = useRef<THREE.Group>(null);
  const [scale, setScale] = useState(deskState === "expanded" ? 1 : 0.4);

  useEffect(() => {
    const target = deskState === "expanded" ? 1 : 0.4;
    setDeskState("animating");
    tweenValue(scale, target, 800, "cubicInOut", setScale, () => {
      setDeskState(deskState === "expanded" ? "expanded" : "collapsed");
    });
  }, [deskState]);

  useFrame(() => updateTweens(performance.now()));

  return (
    <group ref={groupRef} scale={[scale, scale, scale]} position={[0, 0, 0]}>
      {/* existing desk meshes */}
    </group>
  );
}
```

(Adjust to fit the existing desk geometry — wrap the desk meshes in this group; do not duplicate.)

- [ ] **Step 3: Add a click handler that toggles the desk between collapsed and expanded.**

In the `Desk` component, wrap the outermost mesh with `onClick`:

```typescript
<group
  ref={groupRef}
  scale={[scale, scale, scale]}
  onClick={(e) => {
    e.stopPropagation();
    const current = useRoomStore.getState().deskState;
    if (current === "animating") return;
    setDeskState(current === "collapsed" ? "expanded" : "collapsed");
  }}
>
```

- [ ] **Step 4: Test manually — start dev server.**

Run: `npm run dev`
Open the `/3d` page, click the desk, observe collapse/expand animation.

- [ ] **Step 5: Commit.**

```bash
git add components/room/room-store.ts components/room/room-furniture.tsx
git commit -m "feat(room): add desk collapse/expand state and animation"
```

#### B1.4 — Sit/stand camera and pose transitions

- [ ] **Step 1: Add `first-person-desk` camera mode to `components/room/room-camera.tsx`.**

In the camera component, add a branch for the new mode that positions the camera behind the desk monitor:

```typescript
const playerPose = useRoomStore((s) => s.playerPose);
const cameraMode = useRoomStore((s) => s.cameraMode);

useFrame(() => {
  if (cameraMode === "first-person-desk") {
    camera.position.lerp(new THREE.Vector3(0, 1.45, 1.2), 0.1);
    camera.lookAt(0, 1.4, -0.2);
  } else if (...) {
    // existing modes
  }
});
```

Add `"first-person-desk"` to the `CameraMode` union in `room-store.ts`:

```typescript
export type CameraMode = "overview" | "focus" | "first-person-desk";
```

- [ ] **Step 2: Add interaction prompt detection in `player-character.tsx`.**

When player position is within 1.2m of the desk and `playerPose === "standing"`, show a UI hint "Press E to sit". When E is pressed, transition pose to `sitting` and camera to `first-person-desk`.

```typescript
const distToDesk = Math.hypot(playerX - 0, playerZ - 0); // desk at origin
const canSit = distToDesk < 1.2 && playerPose === "standing";
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if (e.key.toLowerCase() === "e" && canSit) {
      setPlayerPose("transitioning");
      setCameraMode("first-person-desk");
      setTimeout(() => setPlayerPose("sitting"), 800);
    }
    if (e.key === "Escape" && playerPose === "sitting") {
      setPlayerPose("transitioning");
      setCameraMode("overview");
      setTimeout(() => setPlayerPose("standing"), 800);
    }
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, [canSit, playerPose]);
```

- [ ] **Step 3: Manually verify sit/stand interaction in browser.**

Run: `npm run dev`, walk to desk, press E, see camera transition; press Escape, see standing.

- [ ] **Step 4: Commit.**

```bash
git add components/room/room-camera.tsx components/room/player-character.tsx components/room/room-store.ts
git commit -m "feat(room): add sit-down/stand-up pose and camera transitions"
```

---

### Task B2: Recruiter Backend

**Files:**
- Create: `lib/recruiter/types.ts`
- Create: `lib/recruiter/prompt.ts`
- Create: `lib/recruiter/web-search.ts`
- Create: `lib/recruiter/insight-extractor.ts`
- Create: `convex/recruiters.ts`
- Create: `convex/recruiterActions.ts`
- Test: `tests/recruiter-prompt.test.ts`, `tests/recruiter-extractor.test.ts`

#### B2.1 — Recruiter types

- [ ] **Step 1: Create `lib/recruiter/types.ts`.**

```typescript
export type RecruiterStatus = "active" | "applied" | "departed";

export type RecruiterRecord = {
  _id: string;
  userId: string;
  jobId: string;
  companyName: string;
  companyDomain?: string;
  recruiterName: string;
  appearanceSeed: number;
  positionIndex: number;
  status: RecruiterStatus;
  companyContext?: string;
  contextFetchedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ConversationMessage = {
  role: "user" | "recruiter" | "tool";
  content: string;
  timestamp: string;
  toolCalls?: unknown[];
};

export type BrainstormedAnswer = {
  questionType: string;
  answer: string;
  extractedAt: string;
};

export type RecruiterChatContext = {
  recruiter: RecruiterRecord;
  userProfileSummary: string;
  tailoredResumeSummary: string;
  personalizationSummary: string;
  conversationHistory: ConversationMessage[];
};
```

- [ ] **Step 2: Commit.**

```bash
git add lib/recruiter/types.ts
git commit -m "feat(recruiter): add types"
```

#### B2.2 — Recruiter prompt assembly

- [ ] **Step 1: Create `lib/recruiter/prompt.ts`.**

```typescript
import type { RecruiterChatContext } from "./types";

const BASE_RECRUITER_PROMPT = `You are an experienced technical recruiter for {{COMPANY}}. You speak with the candidate as a knowledgeable insider — you know the team, culture, recent news, and the role specifics.

You help with:
- Company background, values, and recent news
- Role-specific positioning and how the candidate fits
- Application strategy
- Resume feedback for THIS specific job
- Interview preparation
- Culture fit analysis

You ALWAYS:
- Use the web_search tool BEFORE answering company-specific questions to ensure facts are current (recent funding, leadership changes, product launches, news)
- Reference the candidate's actual background and tailored resume in your advice
- Help draft answers to common application questions when asked
- Be specific — no generic platitudes like "be passionate" or "show enthusiasm"

You NEVER:
- Make up facts about the company
- Reveal information about other companies' candidates
- Pretend to have insider info you don't have
- Use generic AI slop ("Great question!", "I'm an AI assistant", "I hope this helps")
- Add disclaimers about being an AI
- Begin replies with sycophantic openers

Output style: Direct, professional, conversational. Reference specific details from the candidate's profile and the company. When the candidate mentions an application question, give a substantive answer they can adapt; the system will capture it for later.

CONTEXT FOR THIS CONVERSATION:

COMPANY: {{COMPANY}}
COMPANY_CONTEXT (cached web research):
{{COMPANY_CONTEXT}}

ROLE: {{ROLE}}

CANDIDATE PROFILE SUMMARY:
{{USER_PROFILE_SUMMARY}}

CANDIDATE TAILORED RESUME (for this role):
{{TAILORED_RESUME_SUMMARY}}

CANDIDATE PERSONALIZATION INSIGHTS:
{{PERSONALIZATION_SUMMARY}}`;

export function assembleRecruiterPrompt(ctx: RecruiterChatContext): string {
  return BASE_RECRUITER_PROMPT
    .replace(/\{\{COMPANY\}\}/g, ctx.recruiter.companyName)
    .replace(/\{\{COMPANY_CONTEXT\}\}/g, ctx.recruiter.companyContext ?? "(no cached context — call web_search before answering company-specific questions)")
    .replace(/\{\{ROLE\}\}/g, "(role description loaded from job)")
    .replace(/\{\{USER_PROFILE_SUMMARY\}\}/g, ctx.userProfileSummary)
    .replace(/\{\{TAILORED_RESUME_SUMMARY\}\}/g, ctx.tailoredResumeSummary)
    .replace(/\{\{PERSONALIZATION_SUMMARY\}\}/g, ctx.personalizationSummary || "(none yet — encourage candidate to chat with the personalization companion)");
}

export function summarizeProfile(profile: { skills?: string[]; experience?: Array<{ company: string; title: string; description?: string }>; summary?: string }, maxWords = 500): string {
  const parts: string[] = [];
  if (profile.summary) parts.push(profile.summary);
  if (profile.experience?.length) {
    parts.push("Experience: " + profile.experience.slice(0, 4).map(e => `${e.title} at ${e.company}`).join("; "));
  }
  if (profile.skills?.length) {
    parts.push("Skills: " + profile.skills.slice(0, 20).join(", "));
  }
  return truncateWords(parts.join("\n"), maxWords);
}

export function truncateWords(s: string, max: number): string {
  const words = s.split(/\s+/);
  if (words.length <= max) return s;
  return words.slice(0, max).join(" ") + "…";
}
```

- [ ] **Step 2: Create test `tests/recruiter-prompt.test.ts`.**

```typescript
import { describe, it, expect } from "vitest";
import { assembleRecruiterPrompt, truncateWords, summarizeProfile } from "../lib/recruiter/prompt";

describe("assembleRecruiterPrompt", () => {
  it("substitutes company name", () => {
    const out = assembleRecruiterPrompt({
      recruiter: { _id: "r1", userId: "u", jobId: "j", companyName: "Stripe", recruiterName: "Sarah", appearanceSeed: 1, positionIndex: 0, status: "active", createdAt: "", updatedAt: "" },
      userProfileSummary: "Engineer with 5y",
      tailoredResumeSummary: "Tailored: ...",
      personalizationSummary: "Values autonomy",
      conversationHistory: [],
    });
    expect(out).toContain("recruiter for Stripe");
    expect(out).toContain("Engineer with 5y");
    expect(out).toContain("Values autonomy");
    expect(out).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it("falls back when companyContext missing", () => {
    const out = assembleRecruiterPrompt({
      recruiter: { _id: "r1", userId: "u", jobId: "j", companyName: "Acme", recruiterName: "Pat", appearanceSeed: 1, positionIndex: 0, status: "active", createdAt: "", updatedAt: "" },
      userProfileSummary: "x",
      tailoredResumeSummary: "y",
      personalizationSummary: "",
      conversationHistory: [],
    });
    expect(out).toContain("no cached context");
  });
});

describe("truncateWords", () => {
  it("truncates over the limit", () => {
    expect(truncateWords("a b c d e", 3)).toBe("a b c…");
  });
  it("keeps short strings", () => {
    expect(truncateWords("a b", 5)).toBe("a b");
  });
});

describe("summarizeProfile", () => {
  it("includes experience and skills", () => {
    const out = summarizeProfile({ skills: ["TS", "React"], experience: [{ company: "X", title: "Eng" }], summary: "Good engineer" });
    expect(out).toContain("Good engineer");
    expect(out).toContain("Eng at X");
    expect(out).toContain("TS, React");
  });
});
```

- [ ] **Step 3: Run tests.**

Run: `npx vitest run tests/recruiter-prompt.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add lib/recruiter/prompt.ts tests/recruiter-prompt.test.ts
git commit -m "feat(recruiter): add prompt assembly with context substitution"
```

#### B2.3 — Web search tool wrapper

- [ ] **Step 1: Create `lib/recruiter/web-search.ts`.**

This wraps OpenAI's web_search tool. If the chosen model doesn't expose web_search natively, fall back to a search API. The tool definition matches OpenAI's tool schema.

```typescript
import OpenAI from "openai";

export const WEB_SEARCH_TOOL_DEF = {
  type: "function" as const,
  function: {
    name: "web_search",
    description: "Search the web for current information about a company. Use this for questions about company news, leadership, recent funding, products, culture.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query, e.g., 'Stripe recent funding 2026'" },
      },
      required: ["query"],
    },
  },
};

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

export async function executeWebSearch(query: string): Promise<WebSearchResult[]> {
  // If OPENAI provides native web search via the responses API for the chosen model, use it.
  // Otherwise, fall back to Tavily/Exa via env-configured key.
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (tavilyKey) {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: tavilyKey, query, max_results: 5 }),
    });
    if (!res.ok) throw new Error(`Tavily ${res.status}`);
    const data = await res.json();
    return (data.results ?? []).map((r: { title: string; url: string; content: string }) => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
    }));
  }
  throw new Error("No web search backend configured (set TAVILY_API_KEY or wire OpenAI native).");
}

export function formatWebSearchResults(results: WebSearchResult[]): string {
  return results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`).join("\n\n");
}
```

- [ ] **Step 2: Commit.**

```bash
git add lib/recruiter/web-search.ts
git commit -m "feat(recruiter): add web_search tool wrapper with Tavily fallback"
```

#### B2.4 — Insight extractor (brainstormed answers)

- [ ] **Step 1: Create `lib/recruiter/insight-extractor.ts`.**

```typescript
import OpenAI from "openai";
import type { BrainstormedAnswer } from "./types";

const EXTRACTION_PROMPT = `Given the following recruiter ↔ candidate conversation exchange, identify if the candidate produced an answer to a common application question (e.g., "why this company", "biggest challenge", "leadership example", "tell me about yourself", "weakness", "strengths", "team conflict").

If yes, return JSON:
{"questionType": "<short_snake_case_label>", "answer": "<the candidate's answer in their voice, 50-200 words>"}

If no, return: {"questionType": null}

Only return the JSON object. No prose.

EXCHANGE:
RECRUITER: {{RECRUITER}}
CANDIDATE: {{CANDIDATE}}`;

export async function extractBrainstormedAnswer(
  client: OpenAI,
  recruiterMessage: string,
  candidateMessage: string,
): Promise<BrainstormedAnswer | null> {
  const prompt = EXTRACTION_PROMPT
    .replace("{{RECRUITER}}", recruiterMessage)
    .replace("{{CANDIDATE}}", candidateMessage);
  const res = await client.chat.completions.create({
    model: "gpt-5.4-nano",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });
  const raw = res.choices[0]?.message.content ?? "{}";
  try {
    const parsed = JSON.parse(raw) as { questionType: string | null; answer?: string };
    if (!parsed.questionType || !parsed.answer) return null;
    return {
      questionType: parsed.questionType,
      answer: parsed.answer,
      extractedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Create test `tests/recruiter-extractor.test.ts`.**

```typescript
import { describe, it, expect, vi } from "vitest";
import { extractBrainstormedAnswer } from "../lib/recruiter/insight-extractor";

function mockClient(content: string) {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({ choices: [{ message: { content } }] }),
      },
    },
  } as any;
}

describe("extractBrainstormedAnswer", () => {
  it("returns parsed answer when present", async () => {
    const client = mockClient(JSON.stringify({ questionType: "why_this_company", answer: "Because their mission..." }));
    const out = await extractBrainstormedAnswer(client, "Why us?", "Because their mission resonates with my work in fintech.");
    expect(out?.questionType).toBe("why_this_company");
    expect(out?.answer).toContain("mission");
  });

  it("returns null when no question identified", async () => {
    const client = mockClient(JSON.stringify({ questionType: null }));
    const out = await extractBrainstormedAnswer(client, "Hi", "Hello");
    expect(out).toBeNull();
  });

  it("returns null on malformed JSON", async () => {
    const client = mockClient("not json");
    const out = await extractBrainstormedAnswer(client, "x", "y");
    expect(out).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests.**

Run: `npx vitest run tests/recruiter-extractor.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add lib/recruiter/insight-extractor.ts tests/recruiter-extractor.test.ts
git commit -m "feat(recruiter): add brainstormed answer extractor"
```

#### B2.5 — Convex recruiter queries/mutations

- [ ] **Step 1: Create `convex/recruiters.ts`.**

```typescript
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const listForUser = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("recruiters")
      .withIndex("by_user_status", q => q.eq("userId", userId).eq("status", "active"))
      .collect();
  },
});

export const getById = query({
  args: { recruiterId: v.id("recruiters") },
  handler: async (ctx, { recruiterId }) => {
    return await ctx.db.get(recruiterId);
  },
});

export const upsertRecruiter = mutation({
  args: {
    userId: v.string(),
    jobId: v.id("applicationJobs"),
    companyName: v.string(),
    companyDomain: v.optional(v.string()),
    recruiterName: v.string(),
    appearanceSeed: v.number(),
    positionIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("recruiters")
      .withIndex("by_user_position", q => q.eq("userId", args.userId).eq("positionIndex", args.positionIndex))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert("recruiters", { ...args, status: "active", createdAt: now, updatedAt: now });
  },
});

export const setRecruiterStatus = mutation({
  args: {
    recruiterId: v.id("recruiters"),
    status: v.union(v.literal("active"), v.literal("applied"), v.literal("departed")),
  },
  handler: async (ctx, { recruiterId, status }) => {
    await ctx.db.patch(recruiterId, { status, updatedAt: new Date().toISOString() });
  },
});

export const setCompanyContext = mutation({
  args: { recruiterId: v.id("recruiters"), companyContext: v.string() },
  handler: async (ctx, { recruiterId, companyContext }) => {
    await ctx.db.patch(recruiterId, {
      companyContext,
      contextFetchedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  },
});

export const getConversation = query({
  args: { recruiterId: v.id("recruiters") },
  handler: async (ctx, { recruiterId }) => {
    return await ctx.db
      .query("recruiterConversations")
      .withIndex("by_recruiter", q => q.eq("recruiterId", recruiterId))
      .first();
  },
});

export const appendMessage = mutation({
  args: {
    recruiterId: v.id("recruiters"),
    userId: v.string(),
    role: v.union(v.literal("user"), v.literal("recruiter"), v.literal("tool")),
    content: v.string(),
    toolCalls: v.optional(v.array(v.any())),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("recruiterConversations")
      .withIndex("by_recruiter", q => q.eq("recruiterId", args.recruiterId))
      .first();
    const message = {
      role: args.role,
      content: args.content,
      timestamp: now,
      toolCalls: args.toolCalls,
    };
    if (existing) {
      await ctx.db.patch(existing._id, {
        messages: [...existing.messages, message],
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("recruiterConversations", {
        recruiterId: args.recruiterId,
        userId: args.userId,
        messages: [message],
        brainstormedAnswers: [],
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const appendBrainstormedAnswer = mutation({
  args: {
    recruiterId: v.id("recruiters"),
    questionType: v.string(),
    answer: v.string(),
  },
  handler: async (ctx, { recruiterId, questionType, answer }) => {
    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("recruiterConversations")
      .withIndex("by_recruiter", q => q.eq("recruiterId", recruiterId))
      .first();
    if (!existing) return;
    await ctx.db.patch(existing._id, {
      brainstormedAnswers: [
        ...existing.brainstormedAnswers,
        { questionType, answer, extractedAt: now },
      ],
      updatedAt: now,
    });
  },
});
```

- [ ] **Step 2: Run codegen.**

Run: `npx convex codegen`
Expected: completes; new query/mutation references appear.

- [ ] **Step 3: Commit.**

```bash
git add convex/recruiters.ts convex/_generated/
git commit -m "feat(recruiter): add Convex queries and mutations"
```

#### B2.6 — Convex recruiter action (chat with web search)

- [ ] **Step 1: Create `convex/recruiterActions.ts`.**

```typescript
"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { anyApi } from "convex/server";
import OpenAI from "openai";
import { assembleRecruiterPrompt, summarizeProfile } from "../lib/recruiter/prompt";
import { WEB_SEARCH_TOOL_DEF, executeWebSearch, formatWebSearchResults } from "../lib/recruiter/web-search";
import { extractBrainstormedAnswer } from "../lib/recruiter/insight-extractor";

const MODEL = "gpt-5.4-nano";

export const sendMessage = action({
  args: {
    recruiterId: v.id("recruiters"),
    userId: v.string(),
    userMessage: v.string(),
  },
  handler: async (ctx, { recruiterId, userId, userMessage }) => {
    const recruiter = await ctx.runQuery(anyApi.recruiters.getById, { recruiterId });
    if (!recruiter) throw new Error("recruiter not found");

    // Persist user message immediately for optimistic UI
    await ctx.runMutation(anyApi.recruiters.appendMessage, {
      recruiterId,
      userId,
      role: "user",
      content: userMessage,
    });

    // Load profile and conversation
    const profileDoc = await ctx.runQuery(anyApi.userProfiles.getProfile, { userId });
    const conversation = await ctx.runQuery(anyApi.recruiters.getConversation, { recruiterId });
    const profile = profileDoc?.profile ?? {};

    // Load tailored resume for this job
    const tailoredApp = await ctx.runQuery(anyApi.tailoredApplications.getByJobId, { jobId: recruiter.jobId });
    const tailoredResumeSummary = tailoredApp
      ? summarizeTailoredResume(tailoredApp)
      : "(no tailored resume yet — encourage candidate to generate one from the desk)";

    const systemPrompt = assembleRecruiterPrompt({
      recruiter,
      userProfileSummary: summarizeProfile(profile),
      tailoredResumeSummary,
      personalizationSummary: profile.personalization
        ? `Career goals: ${profile.personalization.careerGoals ?? "n/a"}; Values: ${(profile.personalization.valuesAlignment ?? []).join(", ")}`
        : "",
      conversationHistory: conversation?.messages ?? [],
    });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...((conversation?.messages ?? []).map(m => ({
        role: (m.role === "recruiter" ? "assistant" : m.role) as "user" | "assistant" | "tool",
        content: m.content,
      }))),
      { role: "user" as const, content: userMessage },
    ];

    let assistantText: string | null = null;
    for (let iteration = 0; iteration < 3; iteration++) {
      const response = await client.chat.completions.create({
        model: MODEL,
        messages,
        tools: [WEB_SEARCH_TOOL_DEF],
        tool_choice: "auto",
      });
      const choice = response.choices[0];
      const toolCalls = choice.message.tool_calls ?? [];
      if (toolCalls.length === 0) {
        assistantText = choice.message.content ?? "";
        break;
      }
      messages.push(choice.message as any);
      for (const call of toolCalls) {
        if (call.function.name === "web_search") {
          const args = JSON.parse(call.function.arguments) as { query: string };
          let toolOut: string;
          try {
            const results = await executeWebSearch(args.query);
            toolOut = formatWebSearchResults(results);
            // Cache top result as company context
            if (!recruiter.companyContext && results.length > 0) {
              await ctx.runMutation(anyApi.recruiters.setCompanyContext, {
                recruiterId,
                companyContext: toolOut,
              });
            }
          } catch (err) {
            toolOut = `(web search unavailable: ${(err as Error).message})`;
          }
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: toolOut,
          } as any);
        }
      }
    }

    if (!assistantText) assistantText = "(I'm having trouble responding right now — try again in a moment.)";

    await ctx.runMutation(anyApi.recruiters.appendMessage, {
      recruiterId,
      userId,
      role: "recruiter",
      content: assistantText,
    });

    // Extract brainstormed answer (best-effort, non-blocking semantically)
    try {
      const insight = await extractBrainstormedAnswer(client, assistantText, userMessage);
      if (insight) {
        await ctx.runMutation(anyApi.recruiters.appendBrainstormedAnswer, {
          recruiterId,
          questionType: insight.questionType,
          answer: insight.answer,
        });
      }
    } catch {
      // ignore extraction failures
    }

    return { assistantText };
  },
});

export const seedRecruiters = action({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    // Pull top 5 tailored applications by score (existing pattern)
    const top = await ctx.runQuery(anyApi.tailoredApplications.listTopForUser, { userId, limit: 5 });
    if (!top || top.length === 0) return { seeded: 0 };

    let seeded = 0;
    for (let i = 0; i < top.length; i++) {
      const app = top[i];
      const seed = hashString(app.company + app._id);
      const recruiterName = generateRecruiterName(seed);
      // Ensure an applicationJobs row exists for this app to link to
      const jobId = await ctx.runMutation(anyApi.applicationJobs.ensureForTailoredApplication, {
        userId,
        tailoredApplicationId: app._id,
      });
      await ctx.runMutation(anyApi.recruiters.upsertRecruiter, {
        userId,
        jobId,
        companyName: app.company,
        companyDomain: app.companyDomain,
        recruiterName,
        appearanceSeed: seed,
        positionIndex: i,
      });
      seeded++;
    }
    return { seeded };
  },
});

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const FIRST_NAMES = ["Sarah", "Marcus", "Priya", "James", "Aisha", "Diego", "Mei", "Jordan", "Ravi", "Elena", "Tomas", "Yuki", "Femi", "Anya", "Kai"];
const LAST_NAMES = ["Patel", "Chen", "Rodriguez", "Kim", "Singh", "Nakamura", "Okafor", "Müller", "Silva", "Cohen", "Reyes", "Hassan"];

function generateRecruiterName(seed: number): string {
  const fn = FIRST_NAMES[seed % FIRST_NAMES.length];
  const ln = LAST_NAMES[Math.floor(seed / FIRST_NAMES.length) % LAST_NAMES.length];
  return `${fn} ${ln}`;
}

function summarizeTailoredResume(app: { jsonResume?: { basics?: { summary?: string }; work?: Array<{ position?: string; name?: string; highlights?: string[] }>; skills?: Array<{ name?: string }> } }): string {
  const parts: string[] = [];
  if (app.jsonResume?.basics?.summary) parts.push(app.jsonResume.basics.summary);
  if (app.jsonResume?.work?.length) {
    parts.push("Highlighted roles: " + app.jsonResume.work.slice(0, 3).map(w => `${w.position ?? "(role)"} at ${w.name ?? "(co)"}`).join("; "));
  }
  if (app.jsonResume?.skills?.length) {
    parts.push("Top skills: " + app.jsonResume.skills.slice(0, 10).map(s => s.name ?? "").filter(Boolean).join(", "));
  }
  return parts.join("\n") || "(empty)";
}
```

- [ ] **Step 2: Verify the helper queries/mutations referenced exist.**

Run: `grep -l "listTopForUser\|ensureForTailoredApplication\|getProfile" convex/`. If any are missing, add them as stubs that return placeholder data — but document the gap inline so integration phase resolves.

- [ ] **Step 3: Run codegen and typecheck.**

Run: `npx convex codegen && npx tsc --noEmit`
Expected: completes without type errors.

- [ ] **Step 4: Commit.**

```bash
git add convex/recruiterActions.ts convex/_generated/
git commit -m "feat(recruiter): add chat action with GPT-5.4 nano + web search"
```

---

### Task B3: Recruiter 3D Representation

**Files:**
- Create: `lib/recruiter/appearance.ts`
- Create: `lib/recruiter/desk-layout.ts`
- Create: `components/room/recruiter-character.tsx`
- Create: `components/room/recruiter-desk.tsx`
- Create: `components/room/room-recruiters.tsx`
- Create: `components/room/recruiter-dialogue.tsx`
- Modify: `components/room/room-scene.tsx`
- Test: `tests/recruiter-appearance.test.ts`, `tests/recruiter-layout.test.ts`

#### B3.1 — Appearance generator

- [ ] **Step 1: Create `lib/recruiter/appearance.ts`.**

```typescript
export type RecruiterAppearance = {
  hairColor: string;
  skinTone: string;
  outfitColor: string;
  bodyVariant: 0 | 1 | 2;
  accessory: "none" | "glasses" | "clipboard" | "coffee" | "laptop";
  hairStyle: 0 | 1 | 2 | 3;
};

const HAIR = ["#1f1611", "#3b2418", "#5a4022", "#8b6635", "#b8853b", "#a1a1a1", "#222831", "#4f1f1f"];
const SKIN = ["#f3d3b1", "#e0a98a", "#bd8a64", "#8d5a3e", "#5a3a2a"];
const OUTFIT = ["#2d3a4a", "#3a4d5b", "#5a6b7d", "#3a4f3a", "#5a3a3a", "#3a3a5a", "#5a4a2a", "#444444"];
const ACCESSORY = ["none", "glasses", "clipboard", "coffee", "laptop"] as const;

export function generateAppearance(seed: number): RecruiterAppearance {
  const r = mulberry32(seed);
  return {
    hairColor: HAIR[Math.floor(r() * HAIR.length)],
    skinTone: SKIN[Math.floor(r() * SKIN.length)],
    outfitColor: OUTFIT[Math.floor(r() * OUTFIT.length)],
    bodyVariant: Math.floor(r() * 3) as 0 | 1 | 2,
    accessory: ACCESSORY[Math.floor(r() * ACCESSORY.length)],
    hairStyle: Math.floor(r() * 4) as 0 | 1 | 2 | 3,
  };
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 2: Test `tests/recruiter-appearance.test.ts`.**

```typescript
import { describe, it, expect } from "vitest";
import { generateAppearance } from "../lib/recruiter/appearance";

describe("generateAppearance", () => {
  it("is deterministic for the same seed", () => {
    const a = generateAppearance(12345);
    const b = generateAppearance(12345);
    expect(a).toEqual(b);
  });

  it("produces different results for different seeds", () => {
    const a = generateAppearance(1);
    const b = generateAppearance(2);
    expect(a).not.toEqual(b);
  });

  it("produces values within enum bounds", () => {
    for (let s = 0; s < 100; s++) {
      const a = generateAppearance(s);
      expect([0, 1, 2]).toContain(a.bodyVariant);
      expect([0, 1, 2, 3]).toContain(a.hairStyle);
      expect(["none", "glasses", "clipboard", "coffee", "laptop"]).toContain(a.accessory);
    }
  });
});
```

- [ ] **Step 3: Run tests.**

Run: `npx vitest run tests/recruiter-appearance.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add lib/recruiter/appearance.ts tests/recruiter-appearance.test.ts
git commit -m "feat(recruiter): add deterministic appearance generator"
```

#### B3.2 — Desk layout (arc positioning)

- [ ] **Step 1: Create `lib/recruiter/desk-layout.ts`.**

```typescript
export type DeskPosition = {
  position: readonly [number, number, number];
  facing: number; // radians
};

export const RECRUITER_ARC_RADIUS = 7;
export const RECRUITER_ARC_CENTER: readonly [number, number, number] = [0, 0, -2];
export const RECRUITER_ANGLES_DEG = [-40, -20, 0, 20, 40];

export function deskPositionForIndex(index: number): DeskPosition {
  const angleDeg = RECRUITER_ANGLES_DEG[index] ?? 0;
  const angleRad = (angleDeg * Math.PI) / 180;
  const x = RECRUITER_ARC_CENTER[0] + Math.sin(angleRad) * RECRUITER_ARC_RADIUS;
  const z = RECRUITER_ARC_CENTER[2] - Math.cos(angleRad) * RECRUITER_ARC_RADIUS;
  return {
    position: [x, 0, z],
    facing: Math.PI - angleRad, // face toward center
  };
}
```

- [ ] **Step 2: Test `tests/recruiter-layout.test.ts`.**

```typescript
import { describe, it, expect } from "vitest";
import { deskPositionForIndex, RECRUITER_ARC_RADIUS } from "../lib/recruiter/desk-layout";

describe("deskPositionForIndex", () => {
  it("places center desk on -Z axis from origin", () => {
    const d = deskPositionForIndex(2); // 0 deg = center
    expect(d.position[0]).toBeCloseTo(0, 1);
    expect(d.position[2]).toBeLessThan(0);
  });

  it("spaces desks at non-overlapping positions", () => {
    const positions = [0, 1, 2, 3, 4].map(deskPositionForIndex);
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const dx = positions[i].position[0] - positions[j].position[0];
        const dz = positions[i].position[2] - positions[j].position[2];
        expect(Math.hypot(dx, dz)).toBeGreaterThan(1.5);
      }
    }
  });
});
```

- [ ] **Step 3: Run tests.**

Run: `npx vitest run tests/recruiter-layout.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add lib/recruiter/desk-layout.ts tests/recruiter-layout.test.ts
git commit -m "feat(recruiter): add arc desk layout"
```

#### B3.3 — Recruiter character mesh

- [ ] **Step 1: Create `components/room/recruiter-character.tsx`.**

```typescript
"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { RecruiterAppearance } from "@/lib/recruiter/appearance";

type Props = {
  appearance: RecruiterAppearance;
  pose: "idle" | "alert" | "talking" | "applied";
  position: readonly [number, number, number];
  facing: number;
};

export function RecruiterCharacter({ appearance, pose, position, facing }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const t = useRef(0);

  useFrame((_, delta) => {
    t.current += delta;
    if (groupRef.current) {
      // gentle idle bob
      const bob = pose === "idle" ? Math.sin(t.current * 1.3) * 0.02 : 0;
      groupRef.current.position.y = position[1] + bob;
      // alert: stand taller
      const targetY = pose === "alert" || pose === "talking" ? 1.1 : 1.0;
      groupRef.current.scale.y = THREE.MathUtils.lerp(groupRef.current.scale.y, targetY, 0.1);
    }
  });

  return (
    <group ref={groupRef} position={position as [number, number, number]} rotation={[0, facing, 0]}>
      {/* Body */}
      <mesh position={[0, 0.55, 0]}>
        <capsuleGeometry args={[0.25, 0.55, 4, 8]} />
        <meshStandardMaterial color={appearance.outfitColor} roughness={0.85} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.15, 0]}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color={appearance.skinTone} roughness={0.6} />
      </mesh>
      {/* Hair */}
      <mesh position={[0, 1.27, 0]}>
        <sphereGeometry args={[0.19, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <meshStandardMaterial color={appearance.hairColor} roughness={0.9} />
      </mesh>
      {/* Glasses */}
      {appearance.accessory === "glasses" && (
        <mesh position={[0, 1.13, 0.18]}>
          <torusGeometry args={[0.04, 0.008, 8, 16]} />
          <meshStandardMaterial color="#222" />
        </mesh>
      )}
      {/* Clipboard */}
      {appearance.accessory === "clipboard" && (
        <mesh position={[0.25, 0.55, 0.18]} rotation={[0, 0, -0.2]}>
          <boxGeometry args={[0.15, 0.2, 0.01]} />
          <meshStandardMaterial color="#c5a576" />
        </mesh>
      )}
    </group>
  );
}
```

- [ ] **Step 2: Commit.**

```bash
git add components/room/recruiter-character.tsx
git commit -m "feat(recruiter): add 3D character mesh with pose states"
```

#### B3.4 — Recruiter desk + company sign

- [ ] **Step 1: Create `components/room/recruiter-desk.tsx`.**

```typescript
"use client";

import { Text } from "@react-three/drei";
import type { DeskPosition } from "@/lib/recruiter/desk-layout";

type Props = {
  desk: DeskPosition;
  companyName: string;
  recruiterName: string;
};

export function RecruiterDesk({ desk, companyName, recruiterName }: Props) {
  const [x, , z] = desk.position;
  return (
    <group position={[x, 0, z]} rotation={[0, desk.facing, 0]}>
      {/* Desk surface */}
      <mesh position={[0, 0.75, 0]}>
        <boxGeometry args={[1.4, 0.05, 0.7]} />
        <meshStandardMaterial color="#8a6e4d" roughness={0.85} />
      </mesh>
      {/* Legs */}
      {[[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.3], [0.6, 0.3]].map(([dx, dz], i) => (
        <mesh key={i} position={[dx, 0.37, dz]}>
          <boxGeometry args={[0.05, 0.75, 0.05]} />
          <meshStandardMaterial color="#5e4632" />
        </mesh>
      ))}
      {/* Company sign */}
      <group position={[0, 1.2, -0.32]}>
        <mesh>
          <boxGeometry args={[0.4, 0.18, 0.02]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <Text position={[0, 0.02, 0.012]} fontSize={0.05} color="#1a1a1a" anchorX="center" anchorY="middle">
          {companyName}
        </Text>
        <Text position={[0, -0.05, 0.012]} fontSize={0.025} color="#555" anchorX="center" anchorY="middle">
          {recruiterName}
        </Text>
      </group>
      {/* Decorative laptop */}
      <mesh position={[0, 0.79, -0.05]}>
        <boxGeometry args={[0.35, 0.02, 0.25]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>
    </group>
  );
}
```

- [ ] **Step 2: Commit.**

```bash
git add components/room/recruiter-desk.tsx
git commit -m "feat(recruiter): add 3D desk with company sign"
```

#### B3.5 — Room recruiters container

- [ ] **Step 1: Create `components/room/room-recruiters.tsx`.**

```typescript
"use client";

import { useQuery } from "convex/react";
import { convexRefs } from "@/lib/convex-refs";
import { generateAppearance } from "@/lib/recruiter/appearance";
import { deskPositionForIndex } from "@/lib/recruiter/desk-layout";
import { RecruiterCharacter } from "./recruiter-character";
import { RecruiterDesk } from "./recruiter-desk";
import { useRoomStore } from "./room-store";

type Props = {
  userId: string | null;
};

export function RoomRecruiters({ userId }: Props) {
  const recruiters = useQuery(
    convexRefs.recruiters.listForUser,
    userId ? { userId } : "skip",
  );
  const playerNearestTarget = useRoomStore((s) => s.playerNearestTarget);

  if (!recruiters) return null;

  return (
    <group>
      {recruiters.map((r) => {
        const desk = deskPositionForIndex(r.positionIndex);
        const appearance = generateAppearance(r.appearanceSeed);
        const isNear = playerNearestTarget?.kind === "recruiter" && playerNearestTarget.id === r._id;
        const pose = r.status === "applied" ? "applied" : isNear ? "alert" : "idle";
        return (
          <group key={r._id}>
            <RecruiterDesk desk={desk} companyName={r.companyName} recruiterName={r.recruiterName} />
            <RecruiterCharacter
              appearance={appearance}
              pose={pose}
              position={[desk.position[0], 0.05, desk.position[2] + 0.55]}
              facing={desk.facing + Math.PI}
            />
          </group>
        );
      })}
    </group>
  );
}
```

- [ ] **Step 2: Add `recruiters` to `lib/convex-refs.ts`.**

Open `lib/convex-refs.ts`. Add:

```typescript
recruiters: {
  listForUser: makeFunctionReference<"query">("recruiters:listForUser"),
  getById: makeFunctionReference<"query">("recruiters:getById"),
  upsertRecruiter: makeFunctionReference<"mutation">("recruiters:upsertRecruiter"),
  setRecruiterStatus: makeFunctionReference<"mutation">("recruiters:setRecruiterStatus"),
  setCompanyContext: makeFunctionReference<"mutation">("recruiters:setCompanyContext"),
  getConversation: makeFunctionReference<"query">("recruiters:getConversation"),
  appendMessage: makeFunctionReference<"mutation">("recruiters:appendMessage"),
  appendBrainstormedAnswer: makeFunctionReference<"mutation">("recruiters:appendBrainstormedAnswer"),
},
recruiterActions: {
  sendMessage: makeFunctionReference<"action">("recruiterActions:sendMessage"),
  seedRecruiters: makeFunctionReference<"action">("recruiterActions:seedRecruiters"),
},
```

- [ ] **Step 3: Add `RoomNearestTarget` recruiter variant to `lib/room/interactions.ts`.**

Open `lib/room/interactions.ts`. In the `RoomNearestTarget` union type, add:

```typescript
| { kind: "recruiter"; id: string }
```

- [ ] **Step 4: Mount `<RoomRecruiters>` in `components/room/room-scene.tsx`.**

In `room-scene.tsx`, replace the `<RoomAgents />` line with:

```tsx
<RoomRecruiters userId={userId} />
{/* Keep RoomAgents during transition or remove */}
```

Add `userId` prop to `RoomScene` (pass through from `RoomCanvasClient`).

- [ ] **Step 5: Commit.**

```bash
git add components/room/room-recruiters.tsx components/room/room-scene.tsx lib/convex-refs.ts lib/room/interactions.ts
git commit -m "feat(recruiter): mount recruiter 3D layer with reactive Convex state"
```

#### B3.6 — Recruiter dialogue panel

- [ ] **Step 1: Create `components/room/recruiter-dialogue.tsx`.**

```typescript
"use client";

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { Send, X } from "lucide-react";
import { convexRefs } from "@/lib/convex-refs";
import { useRoomStore } from "./room-store";

type Props = {
  userId: string | null;
};

export function RecruiterDialogue({ userId }: Props) {
  const activeRecruiterId = useRoomStore((s) => s.activeRecruiterId);
  const setActiveRecruiterId = useRoomStore((s) => s.setActiveRecruiterId);
  const recruiter = useQuery(
    convexRefs.recruiters.getById,
    activeRecruiterId ? { recruiterId: activeRecruiterId } : "skip",
  );
  const conversation = useQuery(
    convexRefs.recruiters.getConversation,
    activeRecruiterId ? { recruiterId: activeRecruiterId } : "skip",
  );
  const sendMessage = useAction(convexRefs.recruiterActions.sendMessage);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  if (!activeRecruiterId || !recruiter) return null;

  async function handleSend() {
    if (!draft.trim() || !userId || !activeRecruiterId) return;
    setSending(true);
    try {
      await sendMessage({ recruiterId: activeRecruiterId, userId, userMessage: draft });
      setDraft("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="pointer-events-auto absolute right-6 top-6 z-30 w-96 max-h-[70vh] flex flex-col rounded-2xl bg-white/95 shadow-xl border border-black/5">
      <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
        <div>
          <div className="font-medium text-sm">{recruiter.recruiterName}</div>
          <div className="text-xs text-gray-500">{recruiter.companyName}</div>
        </div>
        <button onClick={() => setActiveRecruiterId(null)} className="text-gray-500 hover:text-gray-900">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {(conversation?.messages ?? []).map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <div className={"inline-block px-3 py-2 rounded-lg text-sm " + (m.role === "user" ? "bg-blue-100" : "bg-gray-100")}>
              {m.content}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 p-3 border-t border-black/5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
          placeholder={`Ask ${recruiter.recruiterName.split(" ")[0]} about ${recruiter.companyName}…`}
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500"
          disabled={sending}
        />
        <button onClick={handleSend} disabled={sending || !draft.trim()} className="p-2 rounded-lg bg-blue-600 text-white disabled:opacity-50">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add `activeRecruiterId` to `room-store.ts`.**

```typescript
activeRecruiterId: string | null;
setActiveRecruiterId: (id: string | null) => void;
```

Initial state: `activeRecruiterId: null, setActiveRecruiterId: (id) => set({ activeRecruiterId: id })`.

- [ ] **Step 3: Mount the dialogue in `room-canvas-client.tsx`.**

Add `<RecruiterDialogue userId={userId} />` alongside the existing dialogue panels.

- [ ] **Step 4: Commit.**

```bash
git add components/room/recruiter-dialogue.tsx components/room/room-store.ts components/room/room-canvas-client.tsx
git commit -m "feat(recruiter): add dialogue panel with live conversation"
```

---

### Task B4: Desk Hub UI (Computer Screen)

**Files:**
- Create: `components/room/desk-hub.tsx`
- Create: `components/room/desk-hub/profile-tab.tsx`
- Create: `components/room/desk-hub/discover-tab.tsx`
- Create: `components/room/desk-hub/top-jobs-tab.tsx`
- Create: `components/room/desk-hub/resumes-tab.tsx`
- Create: `components/room/desk-hub/apply-queue-tab.tsx`

#### B4.1 — Desk hub container with `<Html>` mount

- [ ] **Step 1: Create `components/room/desk-hub.tsx`.**

```typescript
"use client";

import { useState } from "react";
import { Html } from "@react-three/drei";
import { useRoomStore } from "./room-store";
import { ProfileTab } from "./desk-hub/profile-tab";
import { DiscoverTab } from "./desk-hub/discover-tab";
import { TopJobsTab } from "./desk-hub/top-jobs-tab";
import { ResumesTab } from "./desk-hub/resumes-tab";
import { ApplyQueueTab } from "./desk-hub/apply-queue-tab";

type TabId = "profile" | "discover" | "top-jobs" | "resumes" | "apply-queue";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "profile", label: "Profile" },
  { id: "discover", label: "Discover" },
  { id: "top-jobs", label: "Top 5" },
  { id: "resumes", label: "Resumes" },
  { id: "apply-queue", label: "Apply Queue" },
];

type Props = { userId: string | null };

export function DeskHub({ userId }: Props) {
  const playerPose = useRoomStore((s) => s.playerPose);
  const [tab, setTab] = useState<TabId>("top-jobs");

  if (playerPose !== "sitting") return null;

  return (
    <Html position={[0, 1.5, -0.3]} transform distanceFactor={1.4} occlude>
      <div className="w-[640px] h-[400px] bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col overflow-hidden">
        <div className="flex border-b border-gray-200 bg-gray-50">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={"flex-1 px-3 py-2 text-xs font-medium " + (tab === t.id ? "bg-white border-b-2 border-blue-500 text-blue-700" : "text-gray-600 hover:bg-gray-100")}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-4 text-sm">
          {tab === "profile" && <ProfileTab userId={userId} />}
          {tab === "discover" && <DiscoverTab userId={userId} />}
          {tab === "top-jobs" && <TopJobsTab userId={userId} />}
          {tab === "resumes" && <ResumesTab userId={userId} />}
          {tab === "apply-queue" && <ApplyQueueTab userId={userId} />}
        </div>
      </div>
    </Html>
  );
}
```

- [ ] **Step 2: Mount `<DeskHub>` inside `room-furniture.tsx` near the desk monitor (or in `room-scene.tsx`).**

Add: `<DeskHub userId={userId} />` inside the scene.

- [ ] **Step 3: Commit.**

```bash
git add components/room/desk-hub.tsx components/room/room-scene.tsx
git commit -m "feat(desk-hub): mount tabbed UI on desk computer screen"
```

#### B4.2 — Profile tab

- [ ] **Step 1: Create `components/room/desk-hub/profile-tab.tsx`.**

```typescript
"use client";

import { useQuery } from "convex/react";
import { convexRefs } from "@/lib/convex-refs";

type Props = { userId: string | null };

export function ProfileTab({ userId }: Props) {
  const profileDoc = useQuery(convexRefs.userProfiles.getProfile, userId ? { userId } : "skip");
  if (!userId) return <div className="text-gray-500">Sign in to view your profile.</div>;
  if (!profileDoc) return <div className="text-gray-500">Loading…</div>;
  const p = profileDoc.profile ?? {};

  return (
    <div className="space-y-3">
      <Section label="Name">{p.name ?? "—"}</Section>
      <Section label="Headline">{p.headline ?? "—"}</Section>
      <Section label="Skills">{(p.skills ?? []).join(", ") || "—"}</Section>
      <Section label="Experience">
        <ul className="space-y-1">
          {(p.experience ?? []).map((e: { company: string; title: string }, i: number) => (
            <li key={i}>• {e.title} at {e.company}</li>
          ))}
        </ul>
      </Section>
      <Section label="Personalization">
        {p.personalization ? (
          <ul className="text-xs text-gray-600">
            <li>Goals: {p.personalization.careerGoals ?? "(not set)"}</li>
            <li>Values: {(p.personalization.valuesAlignment ?? []).join(", ") || "(not set)"}</li>
          </ul>
        ) : (
          <div className="text-xs text-gray-500">Chat with the personalization companion to fill this in.</div>
        )}
      </Section>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-gray-500">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Commit.**

```bash
git add components/room/desk-hub/profile-tab.tsx
git commit -m "feat(desk-hub): add profile tab with personalization section"
```

#### B4.3 — Top jobs tab (with Visit Recruiter CTA)

- [ ] **Step 1: Create `components/room/desk-hub/top-jobs-tab.tsx`.**

```typescript
"use client";

import { useQuery } from "convex/react";
import { convexRefs } from "@/lib/convex-refs";
import { useRoomStore } from "../room-store";

type Props = { userId: string | null };

export function TopJobsTab({ userId }: Props) {
  const recruiters = useQuery(convexRefs.recruiters.listForUser, userId ? { userId } : "skip");
  const setActiveRecruiterId = useRoomStore((s) => s.setActiveRecruiterId);
  const setPlayerPose = useRoomStore((s) => s.setPlayerPose);
  const setCameraMode = useRoomStore((s) => s.setCameraMode);

  if (!userId) return <div className="text-gray-500">Sign in to see top jobs.</div>;
  if (!recruiters) return <div className="text-gray-500">Loading…</div>;
  if (recruiters.length === 0) return <div className="text-gray-500">No top jobs yet — discover and tailor jobs first.</div>;

  function visit(recruiterId: string) {
    setActiveRecruiterId(recruiterId);
    setPlayerPose("standing");
    setCameraMode("focus");
  }

  return (
    <div className="space-y-2">
      {recruiters.map((r, i) => (
        <div key={r._id} className="p-3 border border-gray-200 rounded flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">{r.companyName}</div>
            <div className="text-xs text-gray-500">Recruiter: {r.recruiterName} · #{i + 1}</div>
          </div>
          <button onClick={() => visit(r._id)} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">
            Visit Recruiter
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit.**

```bash
git add components/room/desk-hub/top-jobs-tab.tsx
git commit -m "feat(desk-hub): add top jobs tab with visit recruiter action"
```

#### B4.4 — Discover, Resumes, Apply Queue tabs

- [ ] **Step 1: Create `components/room/desk-hub/discover-tab.tsx`.**

```typescript
"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { convexRefs } from "@/lib/convex-refs";

type Props = { userId: string | null };

export function DiscoverTab({ userId }: Props) {
  const seedRecruiters = useAction(convexRefs.recruiterActions.seedRecruiters);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleFetch() {
    if (!userId) return;
    setBusy(true);
    setMsg(null);
    try {
      const out = await seedRecruiters({ userId });
      setMsg(`Seeded ${out.seeded} recruiters from top tailored jobs.`);
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-sm">Find relevant jobs and assign recruiters.</div>
      <button onClick={handleFetch} disabled={busy || !userId} className="px-3 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50">
        {busy ? "Fetching…" : "Fetch Top Jobs"}
      </button>
      {msg && <div className="text-xs text-gray-600">{msg}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Create `components/room/desk-hub/resumes-tab.tsx`.**

```typescript
"use client";

import { useQuery } from "convex/react";
import { convexRefs } from "@/lib/convex-refs";

type Props = { userId: string | null };

export function ResumesTab({ userId }: Props) {
  const apps = useQuery(convexRefs.tailoredApplications.listForUser, userId ? { userId, limit: 10 } : "skip");
  if (!userId) return <div className="text-gray-500">Sign in.</div>;
  if (!apps) return <div className="text-gray-500">Loading…</div>;
  if (apps.length === 0) return <div className="text-gray-500">No tailored resumes yet.</div>;
  return (
    <div className="space-y-2">
      {apps.map((a: { _id: string; company: string; title: string }) => (
        <div key={a._id} className="p-2 border border-gray-200 rounded">
          <div className="font-medium text-sm">{a.title}</div>
          <div className="text-xs text-gray-500">{a.company}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create `components/room/desk-hub/apply-queue-tab.tsx`.**

```typescript
"use client";

import { useQuery } from "convex/react";
import { convexRefs } from "@/lib/convex-refs";
import { useRoomStore } from "../room-store";

type Props = { userId: string | null };

export function ApplyQueueTab({ userId }: Props) {
  const jobs = useQuery(convexRefs.applicationJobs.listRecentForCurrentUser, userId ? { limit: 10 } : "skip");
  const setTerminalActive = useRoomStore((s) => s.setTerminalActive);
  if (!userId) return <div className="text-gray-500">Sign in.</div>;
  if (!jobs) return <div className="text-gray-500">Loading…</div>;
  if (jobs.length === 0) return <div className="text-gray-500">No applications queued.</div>;
  return (
    <div className="space-y-2">
      {jobs.map((j: { _id: string; company?: string; title?: string; status: string }) => (
        <div key={j._id} className="p-3 border border-gray-200 rounded flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">{j.title ?? "(role)"}</div>
            <div className="text-xs text-gray-500">{j.company ?? "(company)"} · {j.status}</div>
          </div>
          <button onClick={() => setTerminalActive(true)} className="px-3 py-1 text-xs bg-green-600 text-white rounded">
            Open Terminal
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Add `terminalActive` to `room-store.ts`.**

```typescript
terminalActive: boolean;
setTerminalActive: (a: boolean) => void;
```

Initial: `terminalActive: false, setTerminalActive: (a) => set({ terminalActive: a })`.

- [ ] **Step 5: Commit.**

```bash
git add components/room/desk-hub/discover-tab.tsx components/room/desk-hub/resumes-tab.tsx components/room/desk-hub/apply-queue-tab.tsx components/room/room-store.ts
git commit -m "feat(desk-hub): add discover, resumes, apply-queue tabs"
```

---

### Task B5: Application Terminal & Form Filler Integration

**Files:**
- Modify: `convex/applicationJobs.ts`
- Modify: `convex/applicationActions.ts`
- Modify: `lib/form-engine/types.ts`
- Modify: `lib/form-engine/runner.ts`
- Create: `lib/application/provider-detection.ts`
- Create: `lib/application/error-messages.ts`
- Create: `components/room/application-terminal.tsx`
- Create: `components/room/terminal-progress.tsx`
- Create: `components/room/manual-application-pack.tsx`
- Test: `tests/provider-detection.test.ts`, `tests/error-messages.test.ts`

#### B5.1 — Provider detection

- [ ] **Step 1: Create `lib/application/provider-detection.ts`.**

```typescript
export type AtsProvider = "ashby" | "lever" | "greenhouse" | "workday" | "unknown";
export type FillMode = "auto" | "guided" | "unsupported";

export function detectProvider(url: string): AtsProvider {
  try {
    const host = new URL(url).host.toLowerCase();
    if (host.includes("ashbyhq.com") || host.includes("jobs.ashbyhq.com")) return "ashby";
    if (host.includes("jobs.lever.co") || host.includes("lever.co")) return "lever";
    if (host.includes("greenhouse.io") || host.includes("boards.greenhouse.io")) return "greenhouse";
    if (host.includes("workday") || host.includes("myworkdayjobs")) return "workday";
    return "unknown";
  } catch {
    return "unknown";
  }
}

export function fillModeForProvider(p: AtsProvider): FillMode {
  if (p === "ashby" || p === "lever") return "auto";
  if (p === "greenhouse" || p === "workday") return "guided";
  return "unsupported";
}
```

- [ ] **Step 2: Test `tests/provider-detection.test.ts`.**

```typescript
import { describe, it, expect } from "vitest";
import { detectProvider, fillModeForProvider } from "../lib/application/provider-detection";

describe("detectProvider", () => {
  it("detects ashby", () => {
    expect(detectProvider("https://jobs.ashbyhq.com/co/abc")).toBe("ashby");
  });
  it("detects lever", () => {
    expect(detectProvider("https://jobs.lever.co/foo/bar")).toBe("lever");
  });
  it("detects greenhouse", () => {
    expect(detectProvider("https://boards.greenhouse.io/co/jobs/123")).toBe("greenhouse");
  });
  it("detects workday", () => {
    expect(detectProvider("https://co.wd1.myworkdayjobs.com/x/job/y")).toBe("workday");
  });
  it("returns unknown for non-matching", () => {
    expect(detectProvider("https://example.com")).toBe("unknown");
  });
  it("returns unknown for malformed", () => {
    expect(detectProvider("not a url")).toBe("unknown");
  });
});

describe("fillModeForProvider", () => {
  it.each([
    ["ashby", "auto"],
    ["lever", "auto"],
    ["greenhouse", "guided"],
    ["workday", "guided"],
    ["unknown", "unsupported"],
  ] as const)("%s -> %s", (p, expected) => {
    expect(fillModeForProvider(p)).toBe(expected);
  });
});
```

- [ ] **Step 3: Run tests.**

Run: `npx vitest run tests/provider-detection.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add lib/application/provider-detection.ts tests/provider-detection.test.ts
git commit -m "feat(application): add provider detection and fill mode classification"
```

#### B5.2 — Friendly error messages

- [ ] **Step 1: Create `lib/application/error-messages.ts`.**

```typescript
export const FRIENDLY_ERROR_MESSAGES: Record<string, { title: string; body: string; action: string }> = {
  failed_unsupported_widget: {
    title: "Auto-fill not supported",
    body: "We don't auto-fill this provider yet. We've prepared a guided manual mode with all your answers ready to paste.",
    action: "Open guided mode",
  },
  failed_user_input_required: {
    title: "Manual input needed",
    body: "Some fields require info we don't have. Review and complete them.",
    action: "Review fields",
  },
  failed_auth_required: {
    title: "Sign-in required",
    body: "This application needs you to sign in first. We'll open the page for you.",
    action: "Open page",
  },
  failed_captcha_or_bot_challenge: {
    title: "Captcha challenge",
    body: "The site asked for a human check. We'll resume after you solve it.",
    action: "Solve captcha",
  },
  failed_browser_crash: {
    title: "Browser issue",
    body: "Our browser session crashed. Retry usually resolves this.",
    action: "Retry",
  },
  failed_network: {
    title: "Network issue",
    body: "We couldn't reach the application page. Check the URL and retry.",
    action: "Retry",
  },
  failed_repairable: {
    title: "Fixable error",
    body: "We hit a temporary issue. Retrying with adjustments.",
    action: "Retry",
  },
};

export function friendlyError(category: string): { title: string; body: string; action: string } {
  return (
    FRIENDLY_ERROR_MESSAGES[category] ?? {
      title: "Something went wrong",
      body: "We couldn't complete this application. Try again or use guided manual mode.",
      action: "Try again",
    }
  );
}
```

- [ ] **Step 2: Test `tests/error-messages.test.ts`.**

```typescript
import { describe, it, expect } from "vitest";
import { friendlyError } from "../lib/application/error-messages";

describe("friendlyError", () => {
  it("returns specific message for known category", () => {
    const m = friendlyError("failed_unsupported_widget");
    expect(m.title).toContain("Auto-fill");
    expect(m.action.length).toBeGreaterThan(0);
  });
  it("returns generic fallback for unknown", () => {
    const m = friendlyError("not_a_real_category");
    expect(m.title).toContain("wrong");
  });
});
```

- [ ] **Step 3: Run tests.**

Run: `npx vitest run tests/error-messages.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add lib/application/error-messages.ts tests/error-messages.test.ts
git commit -m "feat(application): add friendly error message mapping"
```

#### B5.3 — Wire brainstormedAnswers through to form-engine

- [ ] **Step 1: Add `BrainstormedAnswer` type to `lib/form-engine/types.ts`.**

Open the file, add:

```typescript
export type BrainstormedAnswer = {
  questionType: string;
  answer: string;
};
```

Add to the `ApplicationJobInput` type:

```typescript
brainstormedAnswers?: BrainstormedAnswer[];
```

- [ ] **Step 2: Update `convex/applicationActions.ts` to load and forward brainstormedAnswers.**

In the `runApplicationJob` handler, after loading `job`, fetch the brainstormed answers via the linked recruiter:

```typescript
// Pull brainstormed answers from the recruiter conversation if present
let brainstormedAnswers: Array<{ questionType: string; answer: string }> = [];
const recruiter = await ctx.runQuery(anyApi.recruiters.findByJobId, { jobId: args.jobId });
if (recruiter) {
  const conv = await ctx.runQuery(anyApi.recruiters.getConversation, { recruiterId: recruiter._id });
  brainstormedAnswers = (conv?.brainstormedAnswers ?? []).map(a => ({ questionType: a.questionType, answer: a.answer }));
}

// Also include any directly attached on the job
brainstormedAnswers = [...brainstormedAnswers, ...((job.brainstormedAnswers ?? []) as Array<{ questionType: string; answer: string }>)];
```

Pass them into `jobInput`:

```typescript
const jobInput: ApplicationJobInput = {
  // ... existing fields
  brainstormedAnswers,
};
```

- [ ] **Step 3: Add `findByJobId` query to `convex/recruiters.ts`.**

```typescript
export const findByJobId = query({
  args: { jobId: v.id("applicationJobs") },
  handler: async (ctx, { jobId }) => {
    return await ctx.db
      .query("recruiters")
      .filter(q => q.eq(q.field("jobId"), jobId))
      .first();
  },
});
```

- [ ] **Step 4: Add `lib/form-engine/brainstorm-matcher.ts` with the matching helper.**

```typescript
import type { BrainstormedAnswer } from "./types";

export function findBrainstormedAnswer(
  questionText: string,
  brainstormedAnswers: BrainstormedAnswer[] | undefined,
): string | null {
  if (!brainstormedAnswers?.length) return null;
  const t = questionText.toLowerCase();
  for (const ba of brainstormedAnswers) {
    if (questionMatches(ba.questionType, t)) return ba.answer;
  }
  return null;
}

function questionMatches(qType: string, qTextLower: string): boolean {
  if (qType === "why_this_company") return qTextLower.includes("why") && (qTextLower.includes("company") || qTextLower.includes("us") || qTextLower.includes("here"));
  if (qType === "biggest_challenge") return qTextLower.includes("challenge") || qTextLower.includes("difficult") || qTextLower.includes("obstacle");
  if (qType === "leadership_example") return qTextLower.includes("leadership") || qTextLower.includes("led a") || qTextLower.includes("led the");
  if (qType === "tell_me_about_yourself") return qTextLower.includes("about yourself") || qTextLower.includes("introduce yourself") || qTextLower.includes("background");
  if (qType === "weakness") return qTextLower.includes("weakness") || qTextLower.includes("improve");
  if (qType === "strength") return qTextLower.includes("strength") || qTextLower.includes("strongest");
  if (qType === "team_conflict") return qTextLower.includes("conflict") || qTextLower.includes("disagreement");
  return false;
}
```

- [ ] **Step 5: Wire the matcher into `lib/form-engine/runner.ts`.**

Open `lib/form-engine/runner.ts`. Find the function/section that resolves answers for open-ended/text fields (search for any LLM-generation call or "answer" assembly inside the runner). Above that call, insert:

```typescript
import { findBrainstormedAnswer } from "./brainstorm-matcher";
// ... at the answer resolution site:
const brainstormed = findBrainstormedAnswer(questionText, jobInput.brainstormedAnswers);
if (brainstormed) {
  // skip LLM, use brainstormed answer
  return brainstormed;
}
// fall through to existing LLM resolution
```

The exact insertion point will depend on the runner's shape — find the place where for each question, an LLM is called to generate text. Wrap that with the brainstormed check.

- [ ] **Step 6: Add a unit test `tests/brainstorm-matcher.test.ts`.**

```typescript
import { describe, it, expect } from "vitest";
import { findBrainstormedAnswer } from "../lib/form-engine/brainstorm-matcher";

describe("findBrainstormedAnswer", () => {
  it("matches why_this_company on 'Why are you interested in our company'", () => {
    const out = findBrainstormedAnswer("Why are you interested in our company?", [
      { questionType: "why_this_company", answer: "Mission-fit" },
    ]);
    expect(out).toBe("Mission-fit");
  });

  it("returns null when no answers", () => {
    expect(findBrainstormedAnswer("anything", undefined)).toBeNull();
    expect(findBrainstormedAnswer("anything", [])).toBeNull();
  });

  it("matches leadership_example", () => {
    const out = findBrainstormedAnswer("Describe a time you led a team", [
      { questionType: "leadership_example", answer: "Story" },
    ]);
    expect(out).toBe("Story");
  });

  it("returns null when no match", () => {
    const out = findBrainstormedAnswer("favorite color", [
      { questionType: "why_this_company", answer: "x" },
    ]);
    expect(out).toBeNull();
  });
});
```

- [ ] **Step 7: Run the matcher test.**

Run: `npx vitest run tests/brainstorm-matcher.test.ts`
Expected: PASS.

- [ ] **Step 8: Run typecheck.**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 9: Commit.**

```bash
git add convex/applicationActions.ts convex/recruiters.ts lib/form-engine/types.ts lib/form-engine/runner.ts lib/form-engine/brainstorm-matcher.ts tests/brainstorm-matcher.test.ts
git commit -m "feat(application): forward brainstormedAnswers from recruiter chat to form filler"
```

#### B5.4 — Application terminal 3D + UI

- [ ] **Step 1: Create `components/room/application-terminal.tsx`.**

```typescript
"use client";

import { Html } from "@react-three/drei";
import { useQuery, useAction } from "convex/react";
import { useState } from "react";
import { convexRefs } from "@/lib/convex-refs";
import { useRoomStore } from "./room-store";
import { TerminalProgress } from "./terminal-progress";
import { ManualApplicationPack } from "./manual-application-pack";
import { detectProvider, fillModeForProvider } from "@/lib/application/provider-detection";
import { friendlyError } from "@/lib/application/error-messages";

const TERMINAL_POSITION: readonly [number, number, number] = [6, 0.05, -2];

type Props = { userId: string | null };

export function ApplicationTerminal({ userId }: Props) {
  const terminalActive = useRoomStore((s) => s.terminalActive);
  const setTerminalActive = useRoomStore((s) => s.setTerminalActive);
  const jobs = useQuery(convexRefs.applicationJobs.listRecentForCurrentUser, userId ? { limit: 10 } : "skip");
  const runJob = useAction(convexRefs.applicationActions.runApplicationJob);
  const [running, setRunning] = useState<string | null>(null);

  return (
    <group position={TERMINAL_POSITION}>
      {/* Kiosk geometry */}
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[0.8, 1.2, 0.4]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>
      <mesh position={[0, 1.05, 0.21]}>
        <boxGeometry args={[0.7, 0.45, 0.02]} />
        <meshStandardMaterial color={terminalActive ? "#1a3a1a" : "#0a0a0a"} emissive={terminalActive ? "#0a3a0a" : "#000000"} />
      </mesh>
      {terminalActive && (
        <Html position={[0, 1.05, 0.22]} transform distanceFactor={1.2} occlude>
          <div className="w-[480px] bg-white rounded shadow border border-gray-200">
            <div className="flex justify-between items-center p-3 border-b">
              <div className="font-medium text-sm">Application Terminal</div>
              <button onClick={() => setTerminalActive(false)} className="text-xs text-gray-500">Close</button>
            </div>
            <div className="p-3 max-h-[300px] overflow-y-auto space-y-2">
              {!jobs && <div className="text-gray-500 text-xs">Loading queue…</div>}
              {jobs?.length === 0 && <div className="text-gray-500 text-xs">No applications queued.</div>}
              {jobs?.map((j: { _id: string; company?: string; title?: string; targetUrl?: string; status: string }) => {
                const provider = detectProvider(j.targetUrl ?? "");
                const mode = fillModeForProvider(provider);
                const isFailed = j.status.startsWith("failed_");
                const friendly = isFailed ? friendlyError(j.status) : null;
                return (
                  <div key={j._id} className="p-2 border border-gray-200 rounded">
                    <div className="flex justify-between">
                      <div>
                        <div className="text-sm font-medium">{j.title ?? "(role)"}</div>
                        <div className="text-xs text-gray-500">{j.company} · {provider} · {mode}</div>
                      </div>
                      {mode === "auto" && (
                        <button
                          disabled={running === j._id}
                          onClick={async () => {
                            setRunning(j._id);
                            try { await runJob({ jobId: j._id as any }); } finally { setRunning(null); }
                          }}
                          className="px-2 py-1 text-xs bg-green-600 text-white rounded disabled:opacity-50"
                        >
                          {running === j._id ? "…" : "Submit"}
                        </button>
                      )}
                      {mode === "guided" && (
                        <ManualApplicationPack jobId={j._id} />
                      )}
                    </div>
                    {running === j._id && <TerminalProgress jobId={j._id} />}
                    {friendly && (
                      <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs">
                        <div className="font-medium">{friendly.title}</div>
                        <div className="text-gray-700">{friendly.body}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}
```

- [ ] **Step 2: Create `components/room/terminal-progress.tsx`.**

```typescript
"use client";

import { useQuery } from "convex/react";
import { convexRefs } from "@/lib/convex-refs";

const STATUS_LABELS: Record<string, string> = {
  queued: "Queued…",
  claimed: "Claimed worker…",
  browser_started: "Loading application page…",
  form_discovered: "Reading form fields…",
  answers_resolved: "Compiling answers from your recruiter chat…",
  fill_in_progress: "Filling form…",
  filled_verified: "Reviewing answers…",
  submit_attempted: "Submitting…",
  submitted_confirmed: "Submitted ✓",
  submitted_probable: "Submitted (verifying)…",
};

type Props = { jobId: string };

export function TerminalProgress({ jobId }: Props) {
  const job = useQuery(convexRefs.applicationJobs.getById, { jobId: jobId as any });
  if (!job) return null;
  const label = STATUS_LABELS[job.status] ?? job.status;
  return (
    <div className="mt-2 text-xs text-blue-700 flex items-center gap-2">
      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
      {label}
    </div>
  );
}
```

- [ ] **Step 3: Create `components/room/manual-application-pack.tsx`.**

```typescript
"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { convexRefs } from "@/lib/convex-refs";

type Props = { jobId: string };

export function ManualApplicationPack({ jobId }: Props) {
  const [open, setOpen] = useState(false);
  const job = useQuery(convexRefs.applicationJobs.getById, { jobId: jobId as any });
  const recruiter = useQuery(convexRefs.recruiters.findByJobId, { jobId: jobId as any });
  const conversation = useQuery(
    convexRefs.recruiters.getConversation,
    recruiter ? { recruiterId: recruiter._id } : "skip",
  );

  return (
    <>
      <button onClick={() => setOpen(true)} className="px-2 py-1 text-xs bg-orange-500 text-white rounded">
        Manual
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white max-w-xl w-full p-4 rounded shadow" onClick={(e) => e.stopPropagation()}>
            <div className="font-medium mb-2">Guided application pack</div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              <div>
                <div className="text-xs font-mono uppercase text-gray-500">Job URL</div>
                <a className="text-blue-600 text-sm" href={job?.targetUrl} target="_blank" rel="noopener">{job?.targetUrl}</a>
              </div>
              {(conversation?.brainstormedAnswers ?? []).map((a, i) => (
                <div key={i}>
                  <div className="text-xs font-mono uppercase text-gray-500">{a.questionType}</div>
                  <div className="text-sm whitespace-pre-wrap p-2 bg-gray-50 rounded">{a.answer}</div>
                </div>
              ))}
              {(conversation?.brainstormedAnswers ?? []).length === 0 && (
                <div className="text-sm text-gray-500">No brainstormed answers yet — chat with the recruiter to prepare answers.</div>
              )}
            </div>
            <button onClick={() => setOpen(false)} className="mt-3 px-3 py-1 text-xs bg-gray-200 rounded">Close</button>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 4: Add `getById` to `convex/applicationJobs.ts` if missing.**

Verify there's a `getById` query:

```typescript
export const getById = query({
  args: { jobId: v.id("applicationJobs") },
  handler: async (ctx, { jobId }) => {
    return await ctx.db.get(jobId);
  },
});
```

If missing, add it.

- [ ] **Step 5: Mount the terminal in the scene.**

In `room-scene.tsx`, add:

```tsx
<ApplicationTerminal userId={userId} />
```

- [ ] **Step 6: Add `applicationJobs.getById` and `applicationJobs.listRecentForCurrentUser` references to `lib/convex-refs.ts` if missing.**

- [ ] **Step 7: Manually verify in browser.**

Run: `npm run dev`. Sit at desk → Apply Queue tab → "Open Terminal" → walk to terminal → Submit (Ashby/Lever job). Watch progress.

- [ ] **Step 8: Commit.**

```bash
git add components/room/application-terminal.tsx components/room/terminal-progress.tsx components/room/manual-application-pack.tsx components/room/room-scene.tsx convex/applicationJobs.ts lib/convex-refs.ts
git commit -m "feat(application): add 3D terminal with progress and guided manual fallback"
```

---

### Task B6: Personalization Agent

**Files:**
- Create: `lib/personalization/types.ts`
- Create: `lib/personalization/questions.ts`
- Create: `lib/personalization/insight-extractor.ts`
- Create: `convex/personalizationAgent.ts`
- Create: `components/room/personalization-companion.tsx`
- Create: `components/room/personalization-dialogue.tsx`
- Test: `tests/personalization-questions.test.ts`, `tests/personalization-extractor.test.ts`

#### B6.1 — Personalization types and question library

- [ ] **Step 1: Create `lib/personalization/types.ts`.**

```typescript
export type QuestionCategory =
  | "career_goals"
  | "work_environment"
  | "motivations"
  | "communication_style"
  | "values"
  | "stories";

export type PersonalizationQuestion = {
  id: string;
  category: QuestionCategory;
  text: string;
};

export type ExtractedInsight = {
  category: QuestionCategory;
  field: string;
  value: string | string[] | { topic: string; story: string };
};
```

- [ ] **Step 2: Create `lib/personalization/questions.ts`.**

```typescript
import type { PersonalizationQuestion, QuestionCategory } from "./types";

export const QUESTIONS: PersonalizationQuestion[] = [
  { id: "cg_1", category: "career_goals", text: "Where do you want to be in three years?" },
  { id: "cg_2", category: "career_goals", text: "What kind of role do you want next, and why?" },
  { id: "we_1", category: "work_environment", text: "Do you thrive in fast-paced or methodical environments?" },
  { id: "we_2", category: "work_environment", text: "Remote, hybrid, or in-office — and what makes the difference?" },
  { id: "we_3", category: "work_environment", text: "Smaller team or larger org — what fits you better right now?" },
  { id: "mt_1", category: "motivations", text: "What's been the strongest driver in your career so far?" },
  { id: "mt_2", category: "motivations", text: "When you've felt most engaged at work, what was happening?" },
  { id: "cs_1", category: "communication_style", text: "How do you like to give and receive feedback?" },
  { id: "cs_2", category: "communication_style", text: "Are you more of a direct communicator or do you prefer to build context first?" },
  { id: "vl_1", category: "values", text: "What's a non-negotiable for your next role?" },
  { id: "vl_2", category: "values", text: "What kind of company values do you align with?" },
  { id: "st_1", category: "stories", text: "Tell me about a project you're proud of." },
  { id: "st_2", category: "stories", text: "Describe a time you led a team through ambiguity." },
  { id: "st_3", category: "stories", text: "What's a hard problem you solved recently?" },
];

export function pickNextQuestion(answeredIds: string[], gaps: QuestionCategory[]): PersonalizationQuestion | null {
  const unanswered = QUESTIONS.filter(q => !answeredIds.includes(q.id));
  if (unanswered.length === 0) return null;
  const prioritized = unanswered.filter(q => gaps.includes(q.category));
  const pool = prioritized.length > 0 ? prioritized : unanswered;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function gapsFromPersonalization(p: {
  careerGoals?: string;
  workEnvironment?: { remote?: boolean; teamSize?: string; pace?: string };
  motivations?: string[];
  communicationStyle?: string;
  valuesAlignment?: string[];
  storyFragments?: Array<{ topic: string; story: string }>;
} | undefined): QuestionCategory[] {
  if (!p) return ["career_goals", "work_environment", "motivations", "communication_style", "values", "stories"];
  const gaps: QuestionCategory[] = [];
  if (!p.careerGoals) gaps.push("career_goals");
  if (!p.workEnvironment) gaps.push("work_environment");
  if (!p.motivations || p.motivations.length === 0) gaps.push("motivations");
  if (!p.communicationStyle) gaps.push("communication_style");
  if (!p.valuesAlignment || p.valuesAlignment.length === 0) gaps.push("values");
  if (!p.storyFragments || p.storyFragments.length < 2) gaps.push("stories");
  return gaps;
}
```

- [ ] **Step 3: Test `tests/personalization-questions.test.ts`.**

```typescript
import { describe, it, expect } from "vitest";
import { pickNextQuestion, gapsFromPersonalization, QUESTIONS } from "../lib/personalization/questions";

describe("pickNextQuestion", () => {
  it("returns null when all answered", () => {
    expect(pickNextQuestion(QUESTIONS.map(q => q.id), [])).toBeNull();
  });
  it("prioritizes gap categories when available", () => {
    const q = pickNextQuestion([], ["career_goals"]);
    expect(q?.category).toBe("career_goals");
  });
  it("falls back to any unanswered if no gap match", () => {
    const q = pickNextQuestion([], ["nonexistent" as any]);
    expect(q).not.toBeNull();
  });
});

describe("gapsFromPersonalization", () => {
  it("returns all gaps for empty profile", () => {
    expect(gapsFromPersonalization(undefined)).toContain("career_goals");
    expect(gapsFromPersonalization(undefined)).toHaveLength(6);
  });
  it("excludes filled fields", () => {
    const gaps = gapsFromPersonalization({ careerGoals: "x" });
    expect(gaps).not.toContain("career_goals");
  });
});
```

- [ ] **Step 4: Run tests.**

Run: `npx vitest run tests/personalization-questions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add lib/personalization/types.ts lib/personalization/questions.ts tests/personalization-questions.test.ts
git commit -m "feat(personalization): add question library and gap detection"
```

#### B6.2 — Insight extractor

- [ ] **Step 1: Create `lib/personalization/insight-extractor.ts`.**

```typescript
import OpenAI from "openai";
import type { ExtractedInsight, QuestionCategory } from "./types";

const EXTRACTION_PROMPT = `Extract structured personalization insight from the user's answer.

Question category: {{CATEGORY}}
Question: {{QUESTION}}
Answer: {{ANSWER}}

Return JSON matching one of these patterns based on category:
- "career_goals": {"field": "careerGoals", "value": "<string>"}
- "work_environment": {"field": "workEnvironment", "value": {"remote": <bool|null>, "teamSize": "<string|null>", "pace": "<string|null>"}}
- "motivations": {"field": "motivations", "value": ["<string>", ...]}
- "communication_style": {"field": "communicationStyle", "value": "<string>"}
- "values": {"field": "valuesAlignment", "value": ["<string>", ...]}
- "stories": {"field": "storyFragments", "value": {"topic": "<short>", "story": "<the story in user's voice>"}}

Return only the JSON.`;

export async function extractInsight(
  client: OpenAI,
  category: QuestionCategory,
  question: string,
  answer: string,
): Promise<ExtractedInsight | null> {
  const prompt = EXTRACTION_PROMPT
    .replace("{{CATEGORY}}", category)
    .replace("{{QUESTION}}", question)
    .replace("{{ANSWER}}", answer);
  const res = await client.chat.completions.create({
    model: "gpt-5.4-nano",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });
  const raw = res.choices[0]?.message.content ?? "{}";
  try {
    const parsed = JSON.parse(raw) as { field: string; value: unknown };
    if (!parsed.field || parsed.value === undefined || parsed.value === null) return null;
    return { category, field: parsed.field, value: parsed.value as ExtractedInsight["value"] };
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Test `tests/personalization-extractor.test.ts`.**

```typescript
import { describe, it, expect, vi } from "vitest";
import { extractInsight } from "../lib/personalization/insight-extractor";

function mockClient(content: string) {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({ choices: [{ message: { content } }] }),
      },
    },
  } as any;
}

describe("extractInsight", () => {
  it("extracts career_goals", async () => {
    const c = mockClient(JSON.stringify({ field: "careerGoals", value: "Lead a platform team" }));
    const out = await extractInsight(c, "career_goals", "Where in 3 years?", "Lead a platform team");
    expect(out?.field).toBe("careerGoals");
    expect(out?.value).toBe("Lead a platform team");
  });

  it("extracts story fragment", async () => {
    const c = mockClient(JSON.stringify({ field: "storyFragments", value: { topic: "Migration", story: "I led..." } }));
    const out = await extractInsight(c, "stories", "Tell me about a project", "I led a migration...");
    expect(out?.field).toBe("storyFragments");
    expect((out?.value as any).topic).toBe("Migration");
  });

  it("returns null on malformed", async () => {
    const c = mockClient("not json");
    const out = await extractInsight(c, "values", "?", "x");
    expect(out).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests.**

Run: `npx vitest run tests/personalization-extractor.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add lib/personalization/insight-extractor.ts tests/personalization-extractor.test.ts
git commit -m "feat(personalization): add LLM insight extractor"
```

#### B6.3 — Convex personalization action

- [ ] **Step 1: Create `convex/personalizationAgent.ts`.**

```typescript
"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { anyApi } from "convex/server";
import OpenAI from "openai";
import { extractInsight } from "../lib/personalization/insight-extractor";
import type { QuestionCategory } from "../lib/personalization/types";

const MODEL = "gpt-5.4-nano";

export const respondToUser = action({
  args: {
    userId: v.string(),
    question: v.optional(v.string()),
    questionCategory: v.optional(v.string()),
    userMessage: v.string(),
  },
  handler: async (ctx, { userId, question, questionCategory, userMessage }) => {
    const profileDoc = await ctx.runQuery(anyApi.userProfiles.getProfile, { userId });
    const profile = profileDoc?.profile ?? {};

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Conversational reply
    const sysPrompt = `You are a friendly career personalization companion. You help the user articulate their goals, preferences, and stories so their job applications can be more authentic. Be warm, brief (1-3 sentences), curious. Avoid generic AI slop. Don't say "great answer!".`;
    const reply = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: sysPrompt },
        ...(question ? [{ role: "assistant" as const, content: question }] : []),
        { role: "user", content: userMessage },
      ],
    });
    const replyText = reply.choices[0]?.message.content ?? "Tell me more.";

    // Extract insight if question was provided
    let updatedProfile = profile;
    if (question && questionCategory) {
      const insight = await extractInsight(client, questionCategory as QuestionCategory, question, userMessage);
      if (insight) {
        updatedProfile = applyInsight(profile, insight);
        await ctx.runMutation(anyApi.userProfiles.updateProfile, {
          userId,
          profile: updatedProfile,
        });
      }
    }

    return { replyText };
  },
});

function applyInsight(profile: any, insight: { field: string; value: unknown }): any {
  const next = { ...profile };
  next.personalization = { ...(profile.personalization ?? {}) };
  if (insight.field === "careerGoals") {
    next.personalization.careerGoals = insight.value as string;
  } else if (insight.field === "workEnvironment") {
    next.personalization.workEnvironment = { ...(next.personalization.workEnvironment ?? {}), ...(insight.value as object) };
  } else if (insight.field === "motivations") {
    const existing = next.personalization.motivations ?? [];
    next.personalization.motivations = Array.from(new Set([...existing, ...(insight.value as string[])]));
  } else if (insight.field === "communicationStyle") {
    next.personalization.communicationStyle = insight.value as string;
  } else if (insight.field === "valuesAlignment") {
    const existing = next.personalization.valuesAlignment ?? [];
    next.personalization.valuesAlignment = Array.from(new Set([...existing, ...(insight.value as string[])]));
  } else if (insight.field === "storyFragments") {
    const existing = next.personalization.storyFragments ?? [];
    const v = insight.value as { topic: string; story: string };
    next.personalization.storyFragments = [...existing, { ...v, updatedAt: new Date().toISOString() }];
  }
  next.personalization.lastInteractionAt = new Date().toISOString();
  return next;
}
```

- [ ] **Step 2: Verify `userProfiles.updateProfile` mutation exists; if not, add a stub.**

Check `convex/userProfiles.ts` for an `updateProfile` mutation. If missing:

```typescript
export const updateProfile = mutation({
  args: { userId: v.string(), profile: v.any() },
  handler: async (ctx, { userId, profile }) => {
    const existing = await ctx.db.query("userProfiles").withIndex("by_user", q => q.eq("userId", userId)).first();
    const now = new Date().toISOString();
    if (existing) {
      await ctx.db.patch(existing._id, { profile, updatedAt: now });
    } else {
      await ctx.db.insert("userProfiles", { userId, profile, provenance: {}, log: [], updatedAt: now });
    }
  },
});
```

- [ ] **Step 3: Add `personalizationAgent` reference to `lib/convex-refs.ts`.**

```typescript
personalizationAgent: {
  respondToUser: makeFunctionReference<"action">("personalizationAgent:respondToUser"),
},
```

- [ ] **Step 4: Commit.**

```bash
git add convex/personalizationAgent.ts convex/userProfiles.ts lib/convex-refs.ts
git commit -m "feat(personalization): add agent action with insight persistence"
```

#### B6.4 — 3D companion + dialogue

- [ ] **Step 1: Create `components/room/personalization-companion.tsx`.**

```typescript
"use client";

import { useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useRoomStore } from "./room-store";

export function PersonalizationCompanion() {
  const ref = useRef<THREE.Mesh>(null);
  const t = useRef(0);
  const setOpen = useRoomStore((s) => s.setPersonalizationOpen);

  useFrame((_, delta) => {
    t.current += delta;
    if (ref.current) {
      // Float near the player; for now, anchor at a fixed position with bobbing
      ref.current.position.y = 1.8 + Math.sin(t.current * 1.6) * 0.08;
      ref.current.rotation.y = t.current * 0.5;
    }
  });

  return (
    <mesh ref={ref} position={[3, 1.8, 3]} onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
      <icosahedronGeometry args={[0.18, 1]} />
      <meshStandardMaterial color="#a78bfa" emissive="#5b21b6" emissiveIntensity={0.4} roughness={0.4} />
    </mesh>
  );
}
```

- [ ] **Step 2: Create `components/room/personalization-dialogue.tsx`.**

```typescript
"use client";

import { useEffect, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { Send, X } from "lucide-react";
import { convexRefs } from "@/lib/convex-refs";
import { useRoomStore } from "./room-store";
import { gapsFromPersonalization, pickNextQuestion } from "@/lib/personalization/questions";
import type { PersonalizationQuestion } from "@/lib/personalization/types";

type Props = { userId: string | null };

export function PersonalizationDialogue({ userId }: Props) {
  const open = useRoomStore((s) => s.personalizationOpen);
  const setOpen = useRoomStore((s) => s.setPersonalizationOpen);
  const profile = useQuery(convexRefs.userProfiles.getProfile, userId ? { userId } : "skip");
  const respond = useAction(convexRefs.personalizationAgent.respondToUser);
  const [question, setQuestion] = useState<PersonalizationQuestion | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<{ role: "agent" | "user"; text: string }[]>([]);

  useEffect(() => {
    if (open && !question && profile) {
      const gaps = gapsFromPersonalization(profile.profile?.personalization);
      const q = pickNextQuestion([], gaps);
      if (q) {
        setQuestion(q);
        setHistory([{ role: "agent", text: q.text }]);
      }
    }
  }, [open, question, profile]);

  if (!open) return null;

  async function handleSend() {
    if (!draft.trim() || !userId) return;
    setSending(true);
    setHistory(h => [...h, { role: "user", text: draft }]);
    const userMessage = draft;
    setDraft("");
    try {
      const out = await respond({
        userId,
        question: question?.text,
        questionCategory: question?.category,
        userMessage,
      });
      setHistory(h => [...h, { role: "agent", text: out.replyText }]);
      // Move to next question
      const gaps = gapsFromPersonalization(profile?.profile?.personalization);
      const nextQ = pickNextQuestion(question ? [question.id] : [], gaps);
      if (nextQ) {
        setQuestion(nextQ);
        setHistory(h => [...h, { role: "agent", text: nextQ.text }]);
      } else {
        setQuestion(null);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="pointer-events-auto absolute left-6 bottom-6 z-30 w-80 max-h-[60vh] flex flex-col rounded-2xl bg-white/95 shadow-xl border border-purple-200">
      <div className="flex items-center justify-between px-4 py-3 border-b border-purple-100 bg-purple-50">
        <div className="font-medium text-sm text-purple-900">Personalization Companion</div>
        <button onClick={() => setOpen(false)}><X className="h-4 w-4 text-purple-600" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm">
        {history.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <div className={"inline-block px-3 py-2 rounded-lg " + (m.role === "user" ? "bg-blue-100" : "bg-purple-100")}>{m.text}</div>
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-purple-100 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
          className="flex-1 px-3 py-2 text-sm border border-purple-200 rounded"
          placeholder="Share your thoughts…"
          disabled={sending}
        />
        <button onClick={handleSend} disabled={sending || !draft.trim()} className="px-3 py-2 bg-purple-600 text-white rounded disabled:opacity-50">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add `personalizationOpen` state to `room-store.ts`.**

```typescript
personalizationOpen: boolean;
setPersonalizationOpen: (o: boolean) => void;
```

Initial: `personalizationOpen: false, setPersonalizationOpen: (o) => set({ personalizationOpen: o })`.

- [ ] **Step 4: Mount components.**

In `room-scene.tsx`, add `<PersonalizationCompanion />` inside the canvas group.
In `room-canvas-client.tsx`, add `<PersonalizationDialogue userId={userId} />` outside the canvas.

- [ ] **Step 5: Manually verify in browser.**

Run: `npm run dev`. Click the floating purple sphere → dialogue opens with a question → answer → next question.

- [ ] **Step 6: Commit.**

```bash
git add components/room/personalization-companion.tsx components/room/personalization-dialogue.tsx components/room/room-store.ts components/room/room-scene.tsx components/room/room-canvas-client.tsx
git commit -m "feat(personalization): add 3D companion and dialogue"
```

---

## Phase C — Integration

### Task C1: Wire the full journey

**Files:**
- Modify: `app/(app)/3d/page.tsx`
- Modify: `components/room/room-canvas-client.tsx`

- [ ] **Step 1: Verify `userId` is propagated from page → canvas → scene → all subsystems.**

Check: `app/(app)/3d/page.tsx` → `<RoomCanvasClient userId={userId} />`. Inside `room-canvas-client.tsx`, ensure `userId` is passed to `RoomScene`, `DeskHub`, `ApplicationTerminal`, `RoomRecruiters`, `PersonalizationDialogue`, `RecruiterDialogue`.

- [ ] **Step 2: Trigger `seedRecruiters` once on first room load if no active recruiters exist.**

In `room-canvas-client.tsx`, add an effect:

```typescript
const recruiters = useQuery(convexRefs.recruiters.listForUser, userId ? { userId } : "skip");
const seedRecruiters = useAction(convexRefs.recruiterActions.seedRecruiters);
const [seeded, setSeeded] = useState(false);
useEffect(() => {
  if (userId && recruiters && recruiters.length === 0 && !seeded) {
    setSeeded(true);
    void seedRecruiters({ userId }).catch(() => setSeeded(false));
  }
}, [userId, recruiters, seeded]);
```

- [ ] **Step 3: Walk-to-recruiter when "Visit Recruiter" is clicked.**

In `top-jobs-tab.tsx`, when visiting a recruiter, also stand the player up and trigger walk mode:

```typescript
function visit(recruiterId: string) {
  setActiveRecruiterId(recruiterId);
  setPlayerPose("standing");        // exit sit pose
  setCameraMode("focus");
  // Walk-target hand-off: existing player walk logic should aim at the recruiter desk position
}
```

Add walk targeting: in `player-character.tsx`, react to `activeRecruiterId` change by setting walk destination to the recruiter's desk position.

- [ ] **Step 4: When user applies through a recruiter, mark recruiter as "applied" and seed replacement.**

In `convex/recruiterActions.ts`, add an `applyThroughRecruiter` action that updates status and triggers replenish:

```typescript
export const applyThroughRecruiter = action({
  args: { recruiterId: v.id("recruiters"), userId: v.string() },
  handler: async (ctx, { recruiterId, userId }) => {
    await ctx.runMutation(anyApi.recruiters.setRecruiterStatus, { recruiterId, status: "applied" });
    await ctx.runAction(anyApi.recruiterActions.seedRecruiters, { userId });
  },
});
```

Wire in `application-terminal.tsx`: after a successful submit, call `applyThroughRecruiter` for the matching recruiter.

- [ ] **Step 5: Manually run the full journey.**

Run: `npm run dev`. Verify:
- Spawn at lobby
- See 5 recruiters with company signs
- Personalization companion floats and can be summoned
- Walk to desk, sit, see tabs
- Click Top 5 → Visit Recruiter
- Walk to recruiter, chat, get web search-grounded answers
- Walk to terminal, submit Ashby/Lever job
- See progress; on completion, recruiter exits, new one arrives

- [ ] **Step 6: Commit.**

```bash
git add app/(app)/3d/page.tsx components/room/room-canvas-client.tsx components/room/desk-hub/top-jobs-tab.tsx components/room/player-character.tsx convex/recruiterActions.ts components/room/application-terminal.tsx
git commit -m "feat(integration): wire desk -> recruiter -> terminal journey end-to-end"
```

### Task C2: E2E test

**Files:**
- Create: `tests/e2e/digital-twin-journey.spec.ts`

- [ ] **Step 1: Create `tests/e2e/digital-twin-journey.spec.ts`.**

```typescript
import { test, expect } from "@playwright/test";

test.describe("Digital twin journey", () => {
  test("renders 3D scene with recruiters and desk hub", async ({ page }) => {
    await page.goto("/3d");
    await expect(page.locator("canvas")).toBeVisible();

    // Player should be in walk mode toggle
    await expect(page.locator("text=Walk")).toBeVisible({ timeout: 10000 });
  });

  test("personalization companion can be summoned", async ({ page }) => {
    await page.goto("/3d");
    await page.waitForTimeout(2000);
    // Click on the floating companion (we don't have a test-id; rely on canvas click region or add data-testid)
    // For now, simulate by setting state via console
    await page.evaluate(() => {
      // @ts-ignore
      window.useRoomStore?.getState().setPersonalizationOpen(true);
    });
    await expect(page.locator("text=Personalization Companion")).toBeVisible();
  });
});
```

- [ ] **Step 2: Add a test data-testid to companion mesh (skip — canvas content not selectable; use store hook).**

Expose store on window in dev:

```typescript
// In room-store.ts (only in non-prod)
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  // @ts-ignore
  window.useRoomStore = useRoomStore;
}
```

- [ ] **Step 3: Run E2E.**

Run: `npx playwright test tests/e2e/digital-twin-journey.spec.ts`
Expected: tests pass; if not, iterate based on failure mode.

- [ ] **Step 4: Commit.**

```bash
git add tests/e2e/digital-twin-journey.spec.ts components/room/room-store.ts
git commit -m "test(e2e): add digital twin journey smoke test"
```

### Task C3: Polish pass

- [ ] **Step 1: Run all unit tests.**

Run: `npx vitest run`
Expected: all green. Fix any cross-cutting failures.

- [ ] **Step 2: Run typecheck.**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run linter.**

Run: `npm run lint`
Expected: clean. Fix warnings.

- [ ] **Step 4: Manual smoke pass.**

Walk through full journey in browser. Note any rough edges (animation hitches, tab content empty, slow recruiter responses). File issues for non-blocking polish.

- [ ] **Step 5: Final commit.**

```bash
git add -A
git commit -m "chore: polish pass — lint clean, types green, all tests passing"
```

---

## Self-Review

### Spec coverage
- ✅ Player spawn fix → Task B1.1
- ✅ Desk collapse/expand animation → Task B1.3
- ✅ Sit/stand camera transitions → Task B1.4
- ✅ 5 recruiters per top jobs → Task B2.6 `seedRecruiters`
- ✅ Per-company recruiter context + web search → Task B2.6 + B2.3
- ✅ Centralized recruiter prompt + per-company injection → Task B2.2
- ✅ Auto-generated recruiter appearance → Task B3.1
- ✅ Recruiter desk arc layout → Task B3.2
- ✅ Recruiter idle/alert/talking poses → Task B3.3
- ✅ Recruiter sequential queue (departed/applied + replenish) → Task C1.4
- ✅ Brainstormed answers extracted → Task B2.4
- ✅ Brainstormed answers passed to form filler → Task B5.3
- ✅ Desk hub with tabs → Task B4.1–B4.4
- ✅ Application terminal 3D + progress → Task B5.4
- ✅ Friendly error UX for unsupported providers → Task B5.2 + B5.4 (manual pack)
- ✅ Personalization agent (3D + chat + insight extraction + profile section) → Task B6.1–B6.4
- ✅ Reactive Convex queries throughout → used in all UI tasks

### Risks
- **GPT-5.4 nano availability:** the model name is per spec; if not yet GA, the implementer must swap to gpt-4o-mini or current Haiku-class model. Search-replace `MODEL = "gpt-5.4-nano"` across `convex/recruiterActions.ts`, `convex/personalizationAgent.ts`, `lib/recruiter/insight-extractor.ts`, `lib/personalization/insight-extractor.ts`.
- **Web search backend:** Tavily fallback assumed; OpenAI native web_search may need different wiring depending on the model's tool support.
- **`<Html>` in R3F performance:** Profile after Task B4. If hitchy, switch to a 3D-textured plane with text rendering.
- **Convex action timeout:** Recruiter actions with web search + LLM may exceed timeout for slow models. Consider streaming chunks or splitting into multiple actions.

---

## Execution Approach

This plan is large (3 phases, 7 sub-agents in B, ~50 commit checkpoints). Recommended execution mode is **Subagent-Driven** so each Phase B sub-agent runs in parallel with isolated context, with reviews between tasks.
