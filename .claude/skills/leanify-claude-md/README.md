# Leanify CLAUDE.md Skill

Automated maintenance skill for keeping the project's CLAUDE.md lean and focused.

## Purpose

Over time, CLAUDE.md can accumulate:
- Verbose explanations and historical context
- Game mechanics details (that belong in design/bible/)
- Redundant information across multiple sections
- Over-explained examples

This skill periodically reviews and trims the file to keep it under ~250 lines, focused purely on coding best practices.

## Usage

Invoke this skill when CLAUDE.md exceeds ~250 lines or feels bloated:

```bash
/leanify-claude-md
```

## What It Does

1. Reads current CLAUDE.md and counts lines
2. Identifies bloat categories (historical context, game mechanics, redundancy)
3. Condenses verbose sections into concise bullet points
4. Removes redundant information
5. Preserves all critical coding guidance
6. Reports before/after metrics

## What It Preserves

- Quick Reference and Core Concepts
- Bible reference table (navigation)
- Key Files section
- All coding dos/don'ts
- Development principles (YAGNI, DRY, Data-Driven)
- System organization rules
- Behavior system rules
- Common Pitfalls (all categories)

## What It Removes

- Historical bug stories and evolution notes
- Game mechanics details (supply chains, economic verticals)
- Verbose "why this matters" explanations
- Redundant sections (same info in multiple places)
- Over-explained examples

## When to Use

- After several updates to CLAUDE.md
- When line count exceeds ~250
- When AI context usage feels high
- As part of periodic maintenance

## Output

The skill reports:
- Before/after line count
- Percentage reduction
- Categories of content trimmed
- Verification that critical info preserved
