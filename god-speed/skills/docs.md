# Skill: Docs

## Purpose

Keeps the source of truth, architecture snapshot, decision log, and status aligned with actual work.

## When To Use

Use after implementation, after verification, after a scope cut, or during handoff.

## Reads

- .hackathon-os/knowledge/project-source-of-truth.md
- .hackathon-os/knowledge/architecture-snapshot.md
- .hackathon-os/knowledge/decision-log.md
- .hackathon-os/status/latest.md
- templates/status-update.md

## Writes / Proposes

- source-of-truth updates
- architecture updates
- decision log entries
- latest status

## Inputs Required

- what changed
- what was verified
- current risks
- next actions

## Output Format

Changed facts, docs to update, status summary, decisions made, remaining risks, and recommended Linear updates.

## Review Required?

Yes.

## Chaos Prevention Rule

Never document aspirational behavior as working. Separate What Works from What Does Not Work.

## Prompt

Act as the Docs skill. Sync the project docs to actual state, remove stale claims, capture decisions, and keep teammate handoff information actionable.
