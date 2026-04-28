# /blocker

## Purpose

Creates a blocker report.

## When To Use

Use when blocked for 20+ minutes or a decision/dependency stops progress.

## Reads

- selected issue
- project source of truth
- architecture snapshot

## Writes / Proposes

- blocker report
- fallback path

## Output Format

Blocker summary, severity, owner, issue affected, what was tried, what is needed, unblock options, fallback path, decision needed, recommended next action.

## Prompt

Write an actionable blocker report with facts, options, and fallback.
