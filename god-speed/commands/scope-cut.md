# /scope cut

## Purpose

Recommends what to keep, cut, mock, or defer.

## When To Use

Use when time is low, scope is growing, or demo reliability is at risk.

## Reads

- project source of truth
- issue list
- status update
- time remaining
- demo-critical path

## Writes / Proposes

- scope decision table

## Output Format

Item | Keep/Cut/Mock/Defer | Reason | Demo Impact | Risk | Owner

## Prompt

Cut anything not needed for demo thesis. Mock anything valuable but unstable. Keep anything required for the core demo path. Defer polish until core flow is verified.
