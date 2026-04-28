# /template create

## Purpose

Creates a new reusable template or command.

## When To Use

Use when the team repeats a document type more than once.

## Reads

- existing templates
- operating rules
- project source of truth

## Writes / Proposes

- templates/[new-template].md
- commands/[new-command].md if needed

## Output Format

Template name, purpose, fields, usage instructions, example, optional command file.

## Prompt

Create a concise reusable template. Example invocations: /template create customer-interview-summary, /template create api-integration-checklist, /template create design-review-pass, /template create judge-feedback-summary.
