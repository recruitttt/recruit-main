# Upload notes UI

Title: Upload notes UI
Owner: Maya
Priority: P0
Status: Ready
Labels: frontend, demo-critical
Feature Area: Upload
Demo Critical: yes
Can Mock: no
Can Cut: no

## What

Build the first screen where a student can paste notes or select the seeded sample notes.

## Why

The demo needs a clear starting point that judges can understand immediately.

## Done Means

- [ ] Paste box and seeded sample option render
- [ ] Generate button passes notes into the demo flow
- [ ] Empty state explains what to do

## Build Notes

Prioritize a reliable pasted-text flow. File upload can be hidden if it is unstable.

## Verification

- [ ] Functional check: pasted notes advance to generation
- [ ] UI check: upload screen looks presentable
- [ ] Data check: seeded biology notes load correctly
- [ ] Demo check: presenter can start in under 20 seconds
- [ ] Fallback check: seeded sample works without upload
- [ ] Logging/observability check: input path is visible in console/status

## Blocked By

- none

## Unlocks

- Generate cram plan
- Build dashboard view

## Demo Impact

This is the first live click in the demo.

## Risks

- File upload could distract from the core demo path

## Backup Plan

Use a pasted seeded notes block instead of file upload.

## AI Context

Read project source of truth, upload component, and demo plan.

---

# Parse uploaded notes into text

Title: Parse uploaded notes into text
Owner: Leo
Priority: P0
Status: Ready
Labels: backend, data, demo-critical, risky
Feature Area: Parsing
Demo Critical: yes
Can Mock: yes
Can Cut: no

## What

Convert pasted or seeded notes into clean text for the AI prompt.

## Why

The AI output quality depends on clean source text.

## Done Means

- [ ] Pasted notes are normalized
- [ ] Seeded notes produce stable text
- [ ] Parser failure returns a usable fallback message

## Build Notes

Support plain text first. Defer PDF parsing unless the text path is verified.

## Verification

- [ ] Functional check: sample notes parse into readable text
- [ ] UI check: parser errors are understandable
- [ ] Data check: no empty or undefined content reaches generation
- [ ] Demo check: seeded notes parse during rehearsal
- [ ] Fallback check: pre-parsed text is available
- [ ] Logging/observability check: parser failures are visible

## Blocked By

- Upload notes UI

## Unlocks

- Generate cram plan
- Generate practice questions

## Demo Impact

The audience does not need to see parsing, but the demo fails if generation receives bad text.

## Risks

- File types beyond pasted text may fail

## Backup Plan

Use pre-parsed seeded text.

## AI Context

Read project source of truth, parser code, and sample notes.

---

# Generate cram plan

Title: Generate cram plan
Owner: Leo
Priority: P0
Status: Ready
Labels: ai, backend, demo-critical, risky
Feature Area: AI Output
Demo Critical: yes
Can Mock: yes
Can Cut: no

## What

Generate a time-boxed final-exam cram plan from cleaned notes.

## Why

This is the central product value and the main proof point for the demo thesis.

## Done Means

- [ ] Output includes study blocks, weak areas, and priorities
- [ ] Output is specific to the sample notes
- [ ] Seeded fallback output exists

## Build Notes

Tune for a useful result over broad generality. Prefer deterministic seeded fallback if live AI is slow.

## Verification

- [ ] Functional check: generation returns a complete plan
- [ ] UI check: plan content fits dashboard sections
- [ ] Data check: output references actual note topics
- [ ] Demo check: live or seeded result appears in under 60 seconds
- [ ] Fallback check: cached output is ready
- [ ] Logging/observability check: generation errors are visible

## Blocked By

- Parse uploaded notes into text

## Unlocks

- Build dashboard view
- Write pitch script

## Demo Impact

This is the moment the product demonstrates value.

## Risks

- Live model latency or vague output could weaken the demo

## Backup Plan

Show the seeded cram plan and state that live generation is being stabilized.

## AI Context

Read prompt code, sample notes, and dashboard requirements.

---

# Generate practice questions

Title: Generate practice questions
Owner: Leo
Priority: P1
Status: Scoped
Labels: ai, stretch, mockable
Feature Area: AI Output
Demo Critical: no
Can Mock: yes
Can Cut: yes

## What

Generate 5-8 practice questions from the weak areas in the cram plan.

## Why

Practice questions make the result feel more actionable, but the core thesis can still work without them.

## Done Means

- [ ] Questions map to weak areas
- [ ] Answers or hints are available
- [ ] Dashboard can hide this section if not ready

## Build Notes

Build only after cram plan output is stable. Keep the UI section optional.

## Verification

- [ ] Functional check: questions generate from seeded notes
- [ ] UI check: optional section does not break layout
- [ ] Data check: questions reference real topics
- [ ] Demo check: can be skipped without hurting flow
- [ ] Fallback check: seeded questions exist
- [ ] Logging/observability check: failures are non-blocking

## Blocked By

- Generate cram plan

## Unlocks

- Stronger dashboard story

## Demo Impact

Nice enhancement if stable; not required for the core path.

## Risks

- Could consume time needed for verification

## Backup Plan

Use seeded questions or cut the section.

## AI Context

Read cram plan output and dashboard sections.

---

# Build dashboard view

Title: Build dashboard view
Owner: Maya
Priority: P0
Status: Ready
Labels: frontend, demo-critical
Feature Area: Dashboard
Demo Critical: yes
Can Mock: yes
Can Cut: no

## What

Show the cram plan, weak areas, next study block, and optional practice questions in one dashboard.

## Why

The dashboard is the visible proof that the app turned notes into a useful plan.

## Done Means

- [ ] Cram plan renders clearly
- [ ] Weak areas and next block are visible
- [ ] Seeded output can render without live generation

## Build Notes

Design for one strong demo dataset. Do not overbuild saved history or settings.

## Verification

- [ ] Functional check: dashboard renders from generated and seeded output
- [ ] UI check: layout is presentable on demo screen size
- [ ] Data check: no null placeholder text appears
- [ ] Demo check: presenter can explain the result in under 60 seconds
- [ ] Fallback check: seeded route or state works
- [ ] Logging/observability check: render failures are visible

## Blocked By

- Generate cram plan

## Unlocks

- Demo plan
- Pitch screenshots

## Demo Impact

This is the main screen judges will remember.

## Risks

- Dashboard may look empty if live generation fails

## Backup Plan

Render seeded output from a local fixture.

## AI Context

Read dashboard component, generated output shape, and demo plan.

---

# Create demo seed data

Title: Create demo seed data
Owner: Sam
Priority: P0
Status: Ready
Labels: data, qa, demo-critical, mockable
Feature Area: Demo Data
Demo Critical: yes
Can Mock: yes
Can Cut: no

## What

Create realistic biology notes, parsed text, cram plan output, and practice question fallback data.

## Why

Seed data protects the demo from upload, parser, or AI latency failures.

## Done Means

- [ ] Sample notes are realistic
- [ ] Seeded output matches the app schema
- [ ] Team knows when to switch to fallback

## Build Notes

Keep data small enough to explain during the demo.

## Verification

- [ ] Functional check: seed data loads in app
- [ ] UI check: seeded data looks real in dashboard
- [ ] Data check: topics are internally consistent
- [ ] Demo check: fallback path works offline
- [ ] Fallback check: screenshot/video can use this data
- [ ] Logging/observability check: seed mode is obvious to team

## Blocked By

- Dashboard output shape

## Unlocks

- Verify demo path
- Demo plan

## Demo Impact

This is the safety net for the whole demo.

## Risks

- Seeded output could overclaim live behavior if not presented honestly

## Backup Plan

Use screenshots and clearly say the output is a prepared fallback.

## AI Context

Read project source of truth, dashboard schema, and demo plan.

---

# Write pitch script

Title: Write pitch script
Owner: Sam
Priority: P1
Status: Scoped
Labels: pitch, docs
Feature Area: Pitch
Demo Critical: no
Can Mock: no
Can Cut: yes

## What

Write a 3-5 minute pitch that matches verified features.

## Why

The team needs a clear story, but the exact script can wait until the demo path is known.

## Done Means

- [ ] Opening hook, problem, solution, walkthrough, and closing line exist
- [ ] Script avoids unsupported claims
- [ ] Presenter notes match the live click path

## Build Notes

Draft after the dashboard and fallback path are known.

## Verification

- [ ] Functional check: script fits time limit
- [ ] UI check: demo transition matches screens
- [ ] Data check: claims match verified data
- [ ] Demo check: presenter rehearses once
- [ ] Fallback check: script includes fallback wording
- [ ] Logging/observability check: not applicable

## Blocked By

- Demo plan
- Verify demo path

## Unlocks

- Devpost notes
- Final rehearsal

## Demo Impact

Improves delivery but does not block the product demo.

## Risks

- Script may overclaim if written before verification

## Backup Plan

Use bullet presenter notes instead of a full script.

## AI Context

Read demo plan, verified features, and known limitations.

---

# Verify demo path

Title: Verify demo path
Owner: Sam
Priority: P0
Status: Ready
Labels: qa, demo-critical
Feature Area: QA
Demo Critical: yes
Can Mock: no
Can Cut: no

## What

Run the full demo path and document what passes, what fails, and what fallback is needed.

## Why

The team cannot mark features Demo Ready until the actual path has been tested.

## Done Means

- [ ] Live path tested end to end
- [ ] Fallback path tested
- [ ] Status file updated with pass/fail evidence

## Build Notes

Verify on the same machine/browser/deployed link the team will use for the demo.

## Verification

- [ ] Functional check: full flow completes
- [ ] UI check: screens are presentable
- [ ] Data check: no broken placeholders appear
- [ ] Demo check: flow fits timebox
- [ ] Fallback check: screenshots/video are ready
- [ ] Logging/observability check: failures are understandable

## Blocked By

- Upload notes UI
- Generate cram plan
- Build dashboard view
- Create demo seed data

## Unlocks

- Demo Ready status
- Final pitch
- Devpost screenshots

## Demo Impact

This determines whether the team can safely demo live.

## Risks

- Verification may reveal late demo-breaking bugs

## Backup Plan

Switch to rescue mode and show recorded fallback artifacts.

## AI Context

Read verification checklist, status update, and demo plan.
