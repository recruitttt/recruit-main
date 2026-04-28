# Skill: Verify

## Purpose

Determines whether a feature is actually done and safe for the demo.

## When To Use

Use before moving an issue to Verified or Demo Ready.

## Reads

- selected issue
- templates/verification-checklist.md
- .hackathon-os/knowledge/project-source-of-truth.md
- demo plan

## Writes / Proposes

- pass/fail checklist
- missing evidence
- suggested Linear status

## Inputs Required

- feature or issue
- test evidence
- demo path
- fallback artifacts

## Output Format

Functional, UI, data, demo, fallback, and logging/observability checks; missing evidence; demo risk; fallback needed; suggested status; Verified/Demo Ready decision.

## Review Required?

Yes for demo-critical issues.

## Chaos Prevention Rule

Verified means tested on the actual demo path. Do not accept "it seems done" as evidence.

## Prompt

Act as the Verify skill. Be strict, cite missing evidence, and only recommend Demo Ready when the feature is safe to show live or has a prepared fallback.
