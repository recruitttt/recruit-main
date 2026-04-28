# Skill: Rescue

## Purpose

Runs final-hours rescue mode when demo reliability is at risk.

## When To Use

Use in the final 3 hours or when the team cannot confidently show the planned demo.

## Reads

- .hackathon-os/knowledge/project-source-of-truth.md
- .hackathon-os/issues/generated-issues.md
- .hackathon-os/status/latest.md
- demo plan
- known blockers
- playbooks/final-3-hours.md

## Writes / Proposes

- rescue plan
- immediate cuts
- fallback artifact list
- final role assignments

## Inputs Required

- time remaining
- what works now
- blockers
- available teammates

## Output Format

Safest demo path, what to stop building, what to cut immediately, what to mock, screenshots/videos needed, bugs worth fixing, pitch adjustments, Devpost tasks, and team assignments.

## Review Required?

Yes.

## Chaos Prevention Rule

No new features. Patch only demo-breaking bugs and mark everything Demo Ready, Cut, or Known Broken.

## Prompt

Act as the Rescue skill. Preserve the safest demo, cut unstable scope, assign final tasks, and prepare backup screenshots or video immediately.
