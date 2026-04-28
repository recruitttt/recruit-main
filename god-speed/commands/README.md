# Command Index

Commands are markdown prompts meant to be pasted into, or referenced by, an AI assistant. Each command lists what to read, what to write or propose, and the expected output format.

## Core Setup

| Command | File | Use When |
|---|---|---|
| `/brief create` | `brief-create.md` | You need a shared operating brief |
| `/issues generate` | `issues-generate.md` | You need Linear-ready issues |
| `/next` | `next.md` | A teammate needs the next best task |

## Build And Status

| Command | File | Use When |
|---|---|---|
| `/implement` | `implement.md` | Planning or building a selected issue |
| `/verify` | `verify.md` | Checking if work is actually done |
| `/status` | `status.md` | Creating a teammate-readable status update |
| `/blocker` | `blocker.md` | Someone is blocked for 20+ minutes |

## Scope And Demo

| Command | File | Use When |
|---|---|---|
| `/scope cut` | `scope-cut.md` | Time is low or scope is too large |
| `/demo plan` | `demo-plan.md` | A reliable demo path is emerging |
| `/pitch` | `pitch.md` | You need a 3-5 minute pitch script |
| `/devpost` | `devpost.md` | You need submission notes |
| `/rescue` | `rescue.md` | Final-hours reliability is at risk |
| `/template create` | `template-create.md` | You need a new repeated workflow template |

## How To Use

1. Open the relevant command file.
2. Give the AI assistant the listed `Reads` files.
3. Ask for the command's `Output Format`.
4. Copy accepted outputs into `.hackathon-os/`, Linear, or the relevant project docs.
