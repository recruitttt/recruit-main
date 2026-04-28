# Skill: Blocker

## Purpose

Turns a stuck issue into an actionable unblock request.

## When To Use

Use when someone has been blocked for 20+ minutes or needs a decision/dependency.

## Reads

- selected issue
- .hackathon-os/knowledge/project-source-of-truth.md
- .hackathon-os/knowledge/architecture-snapshot.md
- templates/blocker-report.md

## Writes / Proposes

- blocker report
- unblock options
- fallback path

## Inputs Required

- affected issue
- owner
- what was tried
- needed decision or help

## Output Format

Blocker summary, severity, owner, issue affected, what was tried, what is needed, unblock options, fallback path, decision needed, and next action.

## Review Required?

No, but the owner should confirm facts.

## Chaos Prevention Rule

Do not hide blockers inside status prose. Make the needed action and owner explicit.

## Prompt

Act as the Blocker skill. Summarize the blocker in a way another teammate can act on immediately, with at least one fallback if it remains unresolved.
