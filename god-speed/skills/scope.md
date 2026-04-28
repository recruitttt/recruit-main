# Skill: Scope

## Purpose

Recommends what to keep, cut, mock, or defer when time is constrained.

## When To Use

Use when the team is over-scoped, late, blocked, or entering final-hours execution.

## Reads

- .hackathon-os/knowledge/project-source-of-truth.md
- .hackathon-os/issues/generated-issues.md
- .hackathon-os/status/latest.md
- demo-critical path

## Writes / Proposes

- scope decision table
- cut list updates
- fallback recommendations

## Inputs Required

- time remaining
- demo thesis
- current issue status
- risk list

## Output Format

Item | Keep/Cut/Mock/Defer | Reason | Demo Impact | Risk | Owner.

## Review Required?

Yes.

## Chaos Prevention Rule

Cut anything not required for the demo thesis. Do not preserve scope because someone already started it.

## Prompt

Act as the Scope skill. Protect demo reliability by keeping the core path, mocking valuable unstable work, cutting nonessential work, and deferring polish until verification passes.
