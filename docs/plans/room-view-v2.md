# Plan: Room View v2 (3D agent dashboard)

**Status:** Parked. Not for hackathon demo (2026-04-26). Pick up after demo lands.
**Authored:** 2026-04-24.
**One-liner:** Replace (or toggle alongside) the 2D dashboard with a top-down view of a stylized 3D room where your 5 agents physically walk between stations representing their pipeline state.

---

## Why this matters

The current 2D dashboard is a commodity. Every job-automation tool has a KPI strip, a run list, and an activity feed. A navigable 3D "agent office" is a moat: memorable, shareable, demo-gold, and it makes the abstract idea of "5 parallel agents" legible at a glance.

The pitch metaphor writes itself: *"Your 5 agents go to the office for you."* You're the manager watching the team work.

---

## Scene composition

Top-down slightly-angled camera (Clash of Clans / isometric vibe, roughly 45° tilt, warm soft lighting).

Single open room with **5 workstations**, each representing a pipeline stage. Each station has a fixed floor position and station-specific idle animations.

| Station name         | Maps to pipeline stage       | Visual elements                                                          |
|----------------------|------------------------------|--------------------------------------------------------------------------|
| **Job board**        | `discover`, `queued`         | Bulletin board on a wall, papers pinning themselves, subtle glow         |
| **Workbench**        | `tailoring`                  | Desk + monitor (screen with scrolling text), papers shuffling            |
| **Review panel**     | `reviewing`                  | Three floating persona-screens arranged in an arc                         |
| **Submit terminal**  | `submitting`, `filling`      | Mail-slot box + envelopes flying out on a timer                          |
| **Calendar desk**    | `scheduling`, `follow-up`    | Big calendar tile on the wall, flip-board style                          |

Two stations (recruiter outreach + calendar scheduling) should render with a subtle "Coming soon" pip per Owen's demo-lock constraints. Ashby-only for MVP, outreach and scheduling are display-only.

**Ambient life in the scene:**
- Slow camera drift (very slight, like 1° over 30s) to avoid static-feeling scene
- Station monitors flicker subtly
- Papers rustle on the workbench every ~8s
- Envelope flies out of submit terminal when a submission event happens in mock data
- Warm-paper floor color matches the site theme (`#F9F7F3` ivory), soft key light, cool rim light

---

## Character design

Blocky Minecraft-vibe, not Roblox fidelity. We already have the 2D character designs in `components/onboarding/characters.tsx` — port the faces as decals on cube heads.

**Geometry per character:**
- Torso = colored cube, the agent's hue (slightly saturated for 3D lighting)
- Head = cube with face decal on the front (render the existing SVG character to a texture)
- Legs = 2 smaller cubes, alternating rotation for walk cycle
- Arms = 2 smaller cubes, alternating swing
- Distinctive topper on head per agent (antenna for Scout, tufts for Mimi, etc.)

**No skeletal rigging.** Every animation is a transform on a primitive mesh, driven by `useFrame`. Very cheap.

**Walk cycle:**
- Body bob: `position.y += Math.sin(t * 6) * 0.05`
- Legs: alternating `rotation.x = Math.sin(t * 6) * 0.3`
- Arms: alternating `rotation.x = Math.sin(t * 6 + Math.PI) * 0.3`
- Character facing: `lookAt()` the destination vector

**Idle animation when at station:**
- Station-specific. At workbench: torso leans forward, arms move as if typing. At job board: head turns to "read." At submit terminal: small hand-raise tap animation.

**Color saturation note:** On the light theme the hues are cyan-600, pink-600, violet-600, amber-600, emerald-600. In 3D these read slightly darker under lighting, so bump saturation up one notch in the material color.

---

## Interaction model

**Idle state:**
- Camera top-down, static or very slightly drifting
- All 5 agents walking/working based on current mock-data stage
- Small floating name chip above each character (bill-boarded, soft background)

**Hover:**
- Outline shader / emission glow on the character in its own hue
- Name chip grows slightly, adds current action ("Mimi · submitting...")

**Click on character:**
- Camera animates to a lower, closer angle zoomed on that character, ~500ms using `damp3` from drei
- Overlay panel slides in from the right with detail content
- Detail panel reuses the same layout as the existing application-detail page (status timeline, mapped questions, persona review)
- Escape key or click-outside dollies the camera back

**Click on station:**
- Zoom to station overview, show aggregate info (how many agents are currently using this station, throughput, etc.)

**No free-camera controls.** Keep it cinematic / directed. OrbitControls would let users break the scene.

---

## Tech stack

**react-three-fiber + drei + zustand** on top of the existing Next.js app.

Why this combo:
- **r3f** is the idiomatic React-Three bridge. Renders with Three.js but state-driven like React. Fits the project's mental model.
- **drei** provides `Html` (position React components at 3D coordinates for popups/name chips), camera helpers like `CameraControls` and `PresentationControls`, `MeshReflectorMaterial` for the floor if we want a subtle polish, and `Outlines` for hover effects.
- **zustand** for a tiny shared store (selected agent, hover state, phase). Don't need Convex or anything heavy.

**Animation:** All motion via `useFrame(({ clock, delta }) => { ... })`. No animation library needed because everything is mathematical transforms.

**Geometry:** Entirely primitives (`<boxGeometry>`, `<cylinderGeometry>`, `<planeGeometry>`). No model files. If we later want detail, free CC0 low-poly assets from Quaternius (quaternius.com) fit the stylized aesthetic.

**Performance budget:** 5 characters × ~8 meshes each + ~15 static meshes + lighting = <100 draw calls. Trivially 60fps on any modern laptop. Safari iOS should also run it.

**Alternatives rejected:**
- **Isometric 2D sprites:** cheaper to build but doesn't deliver the "wow." Mo specifically asked for 3D walking Minecraft/Roblox vibe.
- **Spline embeds:** fastest to something pretty, but limited interactivity, potential branding/licensing issues, and runtime overhead. Bad for demo.
- **Bare WebGL / custom Three.js:** reinvents what r3f already solves.
- **Pre-rendered video + overlays:** kills the "live" feeling. The whole point is that the scene is driven by actual agent state.

---

## Build timeline (post-hackathon)

Realistic 4 days of focused work. Can compress to 3 if we skip polish.

**Day 1 — Scene skeleton**
- Create `app/(app)/dashboard/room/page.tsx` (room as a separate route, not replacement)
- Set up `<Canvas>` with r3f + basic lighting (ambient + directional key + cool rim)
- Flat colored floor, 5 placeholder colored cubes at the 5 station positions
- 5 character cubes that walk between stations based on a simple state-machine driven by mock data
- Goal: prove the loop works, state flows from `lib/mock-data.ts` to character positions, 60fps confirmed

**Day 2 — Station meshes + character detail**
- Build each of the 5 stations as low-poly composed primitives (box + cylinder + plane + small decorative meshes)
- Character refinement: real head cubes with face-texture decals (bake the SVG face to a canvas texture, apply to head)
- Per-agent toppers (antenna, tufts, ears)
- Station-specific idle animations when a character arrives

**Day 3 — Interaction**
- Hover outline shader
- Floating name chips with action text
- Click-to-zoom camera animation (damp3-based lerp to target position + orientation)
- Detail popup overlay via drei's `<Html>` or a fixed-position React panel
- Click-off / ESC-key to dolly back out
- Click-on-station for aggregate info

**Day 4 — Polish**
- Sound effects: footsteps (soft taps, agent-hue-tinted reverb), station-specific clinks (typing, paper rustle, envelope whoosh)
- Lighting tuning to match warm-paper theme
- Ambient scene touches (subtle camera drift, monitor flickers, envelope flights)
- Performance pass (instance geometry where possible, disable shadows if they tank perf)
- Mobile: decide if we even support mobile for this view (probably not, fallback to 2D dashboard)

---

## How it integrates with the existing app

**Do not replace the 2D dashboard.** Add a toggle in the topnav or a button in the dashboard header:

```
[Dashboard]  [Room view · beta]
```

Default landing after onboarding still goes to 2D dashboard (safe, fast, known-good). Users opt into room view. Post-demo, if room view is stable, we can flip the default.

**Route structure:**
- `/dashboard` — existing 2D dashboard (stays)
- `/dashboard/room` — new 3D room view
- Both read from the same mock-data source, so state is consistent across the two views

**Shared state:** The 2D dashboard's "active runs" list and the room view's characters are literally the same 5 applications. Click an active run row in the 2D view, jump to room view zoomed on that agent (and vice versa). Powerful cross-link.

---

## Open design questions to resolve before building

1. **Camera behavior when a character is walking:** does click-to-zoom lock on and track the walking character (cinematic feel, slightly disorienting) or snap to the character's current position and freeze (practical, breaks the "live" feeling)? Recommendation: track with a slight delay so motion is smooth.

2. **Idle vs. action mapping:** if a character is in between stages (e.g. just finished tailoring, queued for reviewing), where does it physically stand? Proposal: walk to a center "bullpen" area between workstations, idle there briefly.

3. **Demo-day screen share:** does WebGL render well over Zoom / Google Meet screen share? Test early on a second laptop. If screen-share performance is bad, consider recording a short demo reel of the room view to show alongside a live 2D view.

4. **Do we keep the 2D dashboard as the primary view long-term** or is the goal to deprecate it once room view matures? Recommendation: keep 2D forever as the "analyst mode" for power users; room view is the default "consumer mode."

5. **Single-user vs. multi-user framing:** the room contains exactly this user's 5 agents. What about when users scale to more than 5? Does the room grow, or do agents rotate through workstations more aggressively? Probably: stay at 5 for free tier (matches pricing), add 15-agent room for paid tiers, 100+ gets a bird's-eye "hive" view.

6. **Character customization:** would users want to pick agent colors/names beyond the default squad? Would unlock cosmetics as a retention feature. Park this, explore later.

---

## Risk assessment

**Biggest risks:**
- **Scope creep.** Mo loves polish, 3D invites infinite polish. Hard cap at 4 days of build, 1 day polish. Feature-freeze after that.
- **Perf regression on lower-end machines.** Test on a cheap Chromebook or Android tablet early.
- **Breaking the warm-paper brand.** 3D lighting can easily go "video-game plastic." Keep lighting subtle, palette faithful to site, no shiny chrome materials.
- **Replacing something that works.** The 2D dashboard is the reliable demo surface. Do not risk replacing it until room view has shipped stable for 2+ weeks with user feedback.

**What could kill this feature:**
- Users find it gimmicky / slow / hard to navigate for real work. Mitigation: keep 2D dashboard as default, measure opt-in rate.
- Owen (or other stakeholders) push back on the visual direction. Mitigation: this is a solo mockup direction, not Owen's MVP. Room view goes on Mo's demo site only unless Owen wants it later.

---

## Smaller-scope fallback: "station diorama"

If 4 days is too much, here's a 1-day MVP that captures ~40% of the magic:

- Same scene, same stations, **but characters don't walk.** They teleport to stations based on state, with a tiny scale-pop animation on arrival.
- No click-to-zoom. Just tooltip on hover.
- 2D sprite characters instead of 3D cubes (use the SVG character components we already have, rendered at a tilted angle via CSS transform).

This is the "animated isometric infographic" version. Not as ambitious but still more memorable than the 2D dashboard. Safe to build in a single day.

---

## What to do next (for future-Mo / future-Claude)

1. Read this plan first.
2. Decide: full 4-day build or 1-day diorama fallback?
3. If full build: create a `room-view` branch, scaffold a basic r3f canvas at `/dashboard/room`, confirm the scene renders 60fps on target hardware. Don't progress past the skeleton until that's locked.
4. If diorama: retrofit the existing 2D dashboard with a toggle or a subsection that shows the isometric scene.
5. Keep this doc updated as decisions are made.
