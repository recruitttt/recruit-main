# Project Source of Truth

## Project Name

AI Study Buddy

## Mission

AI Study Buddy helps students upload course notes and generate a personalized final-exam cram plan, practice questions, and weak-area review schedule.

## Demo Thesis

A student can paste notes and get a useful study plan in under one minute.

## Target User

College students preparing for finals with limited time.

## MVP

Notes input, text parsing, cram plan generation, practice questions, and dashboard view.

## Stretch

Calendar export, saved history, multi-course support, and PDF parsing.

## Cut List

Auth, payments, LMS integration, mobile app, and real-time collaboration.

## Team

| Name | Role | Primary Ownership | Backup Ownership |
|---|---|---|---|
| Maya | Frontend | Upload and dashboard | Screenshots |
| Leo | AI/backend | Parsing and generation | Seed data |
| Sam | Product/demo | Pitch and Devpost | QA |

## Current Demo-Critical Path

1. Paste biology notes.
2. Generate cram plan and questions.
3. Show dashboard and weak areas.

## Current Blockers

| Blocker | Owner | Severity | Needed Decision | Fallback |
|---|---|---|---|---|
| Live generation latency | Leo | High | Live or seeded | Pre-generated response |

## Current Risks

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Parser fails on PDFs | High | Medium | Demo pasted text only |
| Generated plan is vague | Medium | Medium | Tune prompt and seed expected output |

## Current Status

Skeleton works locally. Generation is in progress.

## What Works

- Upload screen
- Seed dashboard

## What Does Not Work

- PDF parsing
- Saved history

## What We Are Not Claiming

- Full LMS integration
- Perfect educational accuracy

## Next Best Actions

1. Verify text-note demo path.
2. Create seeded fallback output.
3. Write pitch around verified features.
