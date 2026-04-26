# Subagent Orchestration

The architecture uses a pluggable **adapter pattern** for data sources, not traditional subagents. See `CLAUDE.md` for the intake adapter contract and `docs/superpowers/specs/2026-04-25-recruit-merge-design.md` for the full design.

For multi-step orchestration (e.g., intake → report generation), the `runIntake` driver handles the coordination; no agent threads are spawned from the application code.
