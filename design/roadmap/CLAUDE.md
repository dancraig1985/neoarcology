# Roadmap Management System

This folder manages NeoArcology's development roadmap through lightweight PLAN files.

## Structure

```
design/roadmap/
├── CLAUDE.md          # This file (system instructions)
└── plans/             # PLAN files in priority order
    ├── PLAN-001-*.md
    ├── PLAN-002-*.md
    └── ...
```

## PLAN File Format

Keep plans minimal. The consumer is Claude Code, not stakeholders.

```markdown
# PLAN-NNN: [Short Title]

**Status:** planned | in-progress | completed | paused | blocked
**Priority:** P0 (critical) | P1 (high) | P2 (medium) | P3 (low)
**Dependencies:** PLAN-XXX (if any)

## Goal
One sentence describing the outcome.

## Objectives
- [ ] Concrete deliverable 1
- [ ] Concrete deliverable 2
- [x] Completed item

## Notes
Optional context, decisions, or blockers.
```

## Operations

### Check Current Roadmap
```bash
ls plans/  # See all plans in order
```

### Update Plan Status
Edit the **Status** field. Move completed plans to `plans/archive/` if desired.

### Reprioritize
Rename files to change order.

### Add New Plan
Create `PLAN-NNN-short-name.md` with the next available number.

## Conventions

- **Numbering**: 3-digit zero-padded (001, 002, ...). Gaps are OK after reordering.
- **Filenames**: `PLAN-NNN-kebab-case-title.md`
- **Objectives**: Use `- [ ]` checkboxes for trackable items
- **Keep it short**: Each plan should fit in ~50 lines max
- **No boilerplate**: Skip background, rationale, success metrics unless critical
