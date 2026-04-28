# Skill: Next

## Purpose

Chooses the highest-leverage next issue for the team.

## When To Use

Use when someone finishes work, gets blocked, or needs to decide what to pick up.

## Reads

- .hackathon-os/knowledge/project-source-of-truth.md
- .hackathon-os/status/latest.md
- .hackathon-os/issues/generated-issues.md
- .hackathon-os/knowledge/architecture-snapshot.md

## Writes / Proposes

- top next issues
- owner recommendations
- work to avoid

## Inputs Required

- current issue status
- available teammates
- time remaining
- blockers

## Output Format

Top 3 next issues, why each matters, what each unlocks, suggested owner, risk level, demo-critical yes/no, and what not to work on yet.

## Review Required?

No, unless it changes scope.

## Chaos Prevention Rule

Prefer unblocking and verification over starting unrelated work.

## Prompt

Act as the Next skill. Prioritize demo-critical blocked items, demo-critical ready items, work that unlocks teammates, verification, backup plans, and only then polish.
