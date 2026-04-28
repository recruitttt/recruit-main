# Hackathon OS

Hackathon OS is a cloneable command pack and knowledge layer for running fast hackathon teams.

This repo folder is named `god-speed`; the product inside it is Hackathon OS.

It is not just a prompt library. It is an installable execution system: markdown slash commands, structured knowledge, Linear-ready issue formats, sprint playbooks, and a setup script for local project state.

Linear is the source of truth. Hackathon OS is the execution layer. AI skills operate on the structured context.

## What It Is

Hackathon OS helps 2-4 person teams answer what they are building, why it matters, who owns each piece, what blocks what, what can be parallelized, what can be mocked or cut, and how the demo will be verified.

## Why It Exists

Hackathon teams lose time to vague scope, duplicate work, unclear ownership, optimistic status, and unreliable demos. Hackathon OS turns execution into durable artifacts teammates and AI assistants can read before acting.

## Quick Start

```bash
git clone <repo>
cd god-speed
npm install
npm run setup
```

`npm run setup` creates a local `.hackathon-os/` workspace in the directory where you run it. In normal use, run it from the cloned `god-speed` folder. If you copy this command pack into another project, run setup from that project root.

Then fill in `.hackathon-os/knowledge/project-source-of-truth.md`, run `/brief create`, run `/issues generate`, copy/import issues into Linear, and use `/next`.

## Core Workflow

1. Fill in the project source of truth.
2. Generate an operating brief.
3. Generate Linear-ready issues.
4. Assign owners and statuses in Linear.
5. Use `/next`, `/implement`, `/verify`, and `/status` during the sprint.
6. Use `/demo plan` when the demo path emerges.
7. Use `/rescue` in the final 3 hours.

## The Two Layers

### Command Layer

The `commands/` folder contains reusable slash-command prompts. Each command says what to read, what to write or propose, and what output format to produce.

### Knowledge Layer

The `knowledge/` folder contains context AI needs to avoid random execution: project source of truth, operating rules, Linear conventions, architecture snapshot, decision log, and glossary.

## Recommended Slash Commands

- `/brief create`: creates the operating brief.
- `/issues generate`: creates Linear-ready issues.
- `/next`: recommends highest-leverage work.
- `/implement`: plans or builds a selected issue.
- `/verify`: checks whether work is actually done.
- `/status`: updates teammate-readable sprint status.
- `/scope cut`: decides keep/cut/mock/defer.
- `/demo plan`: creates the safest demo path.
- `/rescue`: runs final-3-hours rescue mode.

See `commands/README.md` for the full command index.

## Recommended Skills

The `skills/` folder mirrors the core command set with shorter role files such as `brief.md`, `issues.md`, `next.md`, `implement.md`, `verify.md`, and `rescue.md`. Use a skill when you want the assistant to stay in one role across a longer task.

See `skills/README.md` for the full skill index.

## How It Works With Linear

Linear remains the source of truth for owner, priority, status, and comments. Hackathon OS produces issue content and status recommendations, but v1 does not write to Linear automatically. Copy generated issues into Linear and keep statuses aligned with `linear/statuses.md`.

## 24-Hour Sprint Usage

Lock scope in hour 1, build a runnable skeleton by hour 6, verify the core demo by hour 18, then freeze, record fallback artifacts, and submit.

## 36-Hour Sprint Usage

Spend more time on architecture and polish, but still verify the demo-critical path before the final 10 hours.

## Final 3-Hour Rescue Mode

No new features. Pick the safest demo path, patch only demo-breaking bugs, record screenshots/video, and mark every issue Demo Ready, Cut, or Known Broken.

## Folder Structure

```txt
commands/   slash-command prompt files
skills/     reusable AI skill prompts
knowledge/  source context copied into local installs
templates/  operating docs and checklists
playbooks/  24h/36h/final-hours workflows
linear/     statuses, labels, views, issue template
examples/   AI Study Buddy example artifacts
scripts/    setup and creation helpers
```

## License

MIT. See `LICENSE`.

## How Teammates Should Use It

Before asking AI for help, give it the matching command file, project source of truth, current status, and selected Linear issue. After work finishes, update status, verification, architecture notes, and decisions.

## What v1 Does Not Do

No web dashboard, auth, database, live Linear API write, multi-workspace sync, AI API integration, complex plugin system, background jobs, enterprise permissions, or automatic GitHub issue syncing.

## Next Roadmap

## Roadmap

### v1: Repo-Only Command Pack

- Markdown commands
- Knowledge layer
- Templates
- Playbooks
- Setup script

### v2: CLI Runner

- `hos next`
- `hos status`
- `hos command run`
- local context bundling

### v3: AI-Integrated Runner

- API-backed command execution
- output written to `.hackathon-os/outputs`
- approval before overwriting knowledge files

### v4: Linear Integration

- create issues
- update statuses
- post comments
- sync blockers

### v5: Team Dashboard

- demo readiness score
- blocker board
- skill backlog
- issue dependency graph
