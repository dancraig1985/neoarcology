---
name: leanify-claude-md
description: "Review and trim CLAUDE.md to remove bloat while preserving critical coding guidance. Use when CLAUDE.md grows beyond ~250 lines or accumulates verbose explanations."
allowed-tools: Read, Edit, Bash
---

# Leanify CLAUDE.md

Periodically review and trim the project's CLAUDE.md file to keep it focused on coding best practices without wasting context.

## When to Use

- CLAUDE.md exceeds ~250 lines
- Verbose explanations or historical context have accumulated
- Redundant information appears in multiple sections
- Game mechanics details have crept into coding doc (should be in design/bible/)

## Process

### 1. Analyze Current State

Read CLAUDE.md and count lines:
```bash
wc -l CLAUDE.md
```

### 2. Identify Bloat Categories

Look for:
- **Historical context** - Bug stories, "why this matters" explanations, evolution notes
- **Game mechanics** - Supply chains, economic verticals, simulation details (belongs in bible)
- **Verbose examples** - Multiple code blocks showing same pattern
- **Redundant sections** - Same info in multiple places (e.g., ID generation in both "Key Files" and "Common Pitfalls")
- **Over-explanation** - Detailed justifications instead of concise rules

### 3. What to KEEP

**Must preserve:**
- Quick Reference (stack, time units)
- Core Concepts (simulation-first, tags over types, etc.)
- Bible reference table (critical navigation)
- Key Files section (file navigation)
- Headless testing commands
- Configuration file locations
- No Magic Numbers policy
- Development Principles (YAGNI, DRY, Data-Driven)
- System Organization rules
- Behavior System rules
- Agent State Management helpers
- Common Pitfalls (all categories)
- Metrics instrumentation

**Format to preserve:**
- Tables (Bible reference, config files)
- Code examples showing ❌ bad vs ✅ good patterns
- Bullet lists for rules

### 4. Trimming Strategies

**Historical Examples → Brief Rules:**
```markdown
# BEFORE (verbose with example)
Example (PLAN-032):
- ❌ `EconomySystem.ts` (2243 lines) - handled payroll, restocking, agent decisions
- ✅ Split into:
  - `AgentEconomicSystem.ts` (~940 LOC)
  - `PayrollSystem.ts` (~420 LOC)

# AFTER (concise rule)
- 800 lines max per file. Large files indicate mixed responsibilities.
```

**Multi-paragraph Explanations → Bullets:**
```markdown
# BEFORE
**Why this matters**: CityGenerator and runtime both create entities. If they use separate counters, IDs will collide, causing runtime entities to replace city-gen entities, breaking all references and corrupting state.

**Historical bug**: Before fix, Office 0 got ID `loc_2`...

# AFTER
- CityGenerator and runtime share same IdGenerator to prevent collisions.
```

**Delete Redundant Sections:**
- If ID generation covered in "Key Files", don't repeat full explanation in "Common Pitfalls"
- If behavior system covered in dedicated section, don't re-explain in pitfalls

**Game Mechanics → Remove:**
```markdown
# DELETE (belongs in design/bible/economy.md)
## Economic Verticals

**Food Vertical:**
Provisions Factory → Retail Shop → Agent

**Alcohol Vertical:**
Brewery → Pub → Agent
```

### 5. Execute Edits

Use Edit tool to condense sections one at a time. Common patterns:

```markdown
# Condense verbose paragraphs
old_string: """Multiple paragraphs explaining concept"""
new_string: """- Bullet point rule
- Bullet point rule"""

# Remove redundant sections entirely
old_string: """## Redundant Section\n\nContent..."""
new_string: ""  # Delete the section

# Compress examples
old_string: """Example with 15 lines of context"""
new_string: """Example: key point only"""
```

### 6. Verify and Report

After all edits:
```bash
wc -l CLAUDE.md
```

Report to user:
- Before line count
- After line count
- Percentage reduction
- What was trimmed (categories)
- What was preserved

## Target Metrics

- **Goal:** ~250 lines or less
- **Maximum:** 300 lines (if critical info requires it)
- **Format:** Concise bullets over prose paragraphs

## Example Session

```
User: /leanify-claude-md