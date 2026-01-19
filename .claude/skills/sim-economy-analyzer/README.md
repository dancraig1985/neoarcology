# Simulation Economy Analyzer

A Claude Code skill for analyzing and balancing NeoArcology's economic system.

## Purpose

This skill provides a structured workflow for:
- Testing economic configuration changes
- Calculating business profitability
- Analyzing employment churn (fires/quits)
- Validating market balance (supply/demand)
- Identifying root causes of economic issues

## Installation

This is a project-level skill - it's already available in the NeoArcology repository at `.claude/skills/sim-economy-analyzer/`.

No installation needed! Just reference the skill in conversation.

## Usage

### Triggering the Skill

Claude will automatically invoke this skill when you mention:
- "analyze the economy"
- "check business profitability"
- "investigate employment churn"
- "test economic balance"
- "compare economy test runs"

Or explicitly invoke it:
```
/sim-economy-analyzer
```

### Common Workflows

#### 1. After Making Config Changes
```
I changed provisions price from 20 to 25. Can you analyze the economic impact?
```

Claude will:
- Run test with new config
- Compare to baseline
- Calculate new profitability
- Assess impact on fires and survival

#### 2. Investigating High Fires
```
Why are there 1500 fires per run? Use economy analyzer to investigate.
```

Claude will:
- Run profitability calculations
- Identify if businesses are losing money
- Recommend specific price/cost adjustments

#### 3. Comparing Multiple Tests
```
I have test results from seeds 42, 100, and 200. Can you compare the economic metrics?
```

Claude will:
- Extract metrics from all tests
- Create comparison tables
- Identify patterns across seeds
- Recommend most stable configuration

## What This Skill Does

### Economic Calculations

**Business Profitability:**
- Revenue = Sales Volume × Retail Price
- COGS = Sales Volume × Wholesale Price
- Gross Profit = Revenue - COGS
- Net Profit = Gross Profit - (Wages + Dividend)

**Market Balance:**
- Retail Saturation = (Shops / Agents) / Target Ratio
- Supply Chain Balance = (Factories / Shops) / Target Ratio

**Entrepreneurship Timeline:**
- Weeks to Threshold = (Threshold - Starting Credits) / Weekly Surplus
- Adjusted for employment disruption from fires

### Test Suite

The skill guides Claude through:
1. Running 2000-tick simulations with controlled seeds
2. Extracting metrics from simulation reports
3. Calculating per-business economics
4. Comparing before/after configurations
5. Documenting findings in `/design/sim-analysis/`

## Key Files Analyzed

- `data/config/economy.json` - Prices, wages, thresholds
- `data/config/agents.json` - Consumption rates
- `data/templates/agents/civilian.json` - Starting credits
- `data/templates/locations/*.json` - Business costs, employee slots
- `src/simulation/systems/EconomySystem.ts` - Dividend logic

## Output Format

After analysis, Claude provides:

1. **Summary Table** - Key metrics comparison
2. **Profitability Breakdown** - Per-business economics with formulas
3. **Market Balance Assessment** - Saturation ratios vs targets
4. **Root Cause Identification** - Primary economic issue
5. **Specific Recommendations** - Config changes with expected impact

## Example Analysis

```markdown
## Business Profitability (retail_shop)
- Revenue: 100 credits/week (5 provisions @ 20)
- COGS: 15 credits/week (5 @ 3 wholesale)
- Gross Profit: 85 credits/week
- Operating Costs: 135 credits/week (60 wages + 75 dividend)
- **Net Profit: -50 credits/week (LOSS)**

### Root Cause
Businesses are structurally unprofitable. Gross margins cannot
cover operating costs even at optimal market density.

### Recommendations
1. Increase provisions retail price: 20 → 25
   - Expected net profit: -25 credits/week (50% improvement)
2. Or reduce dividend: 75 → 40
   - Expected net profit: +10 credits/week (PROFITABLE)
```

## Best Practices

### Testing Discipline
- Always use **seed 42** for baseline comparisons (reproducibility)
- Change **one variable at a time** (isolate impact)
- Test **3+ seeds** before finalizing changes (validate consistency)

### Documentation
- Save all test logs to `/tmp/` for review
- Document findings in `design/sim-analysis/`
- Include analysis in commit messages

### Verification
- Check **agent affordability** after price changes (wage must cover living costs + savings)
- Verify **business profitability** is positive (net profit > 0)
- Confirm **market balance** is near target ratios

## Target Metrics

### Healthy Economy
- Survival Rate: 90-110%
- Fires: < 500 per 2000 ticks
- Market Ratio: 1 shop per 10-15 agents
- Business Net Profit: +5 to +20 credits/week
- First Entrepreneur: Week 10-20

### Warning Signs
- Fires > 1000 → Business profitability issue
- Survival < 85% → Supply shortage
- Shops > 2x optimal → Oversaturation
- No entrepreneurs by Week 30 → Threshold too high

## Version

Created: 2026-01-19
Last Updated: 2026-01-19
NeoArcology Version: 0.1.0
