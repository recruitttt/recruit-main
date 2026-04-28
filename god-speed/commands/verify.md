# /verify

## Purpose

Checks if a feature is actually done.

## When To Use

Use before moving an issue to Verified or Demo Ready.

## Reads

- selected issue
- templates/verification-checklist.md
- project source of truth
- demo plan

## Writes / Proposes

- pass/fail checklist
- suggested Linear status

## Output Format

Pass/fail checklist, missing evidence, demo risk, fallback needed, suggested Linear status, and whether the feature can be marked Verified or Demo Ready. Include functional, UI, data, demo, fallback, and logging/observability verification.

## Prompt

Evaluate against the actual demo path. Be strict. Verified means tested; Demo Ready means safe to show.
