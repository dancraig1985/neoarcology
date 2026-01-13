# PLAN-010: Headless Testing Infrastructure

**Status:** planned
**Priority:** P0 (critical - enables validation of all future work)
**Dependencies:** None (uses existing simulation)
**Phase:** 3

## Goal

Create a CLI tool to run the simulation headlessly and output metrics that both humans and Claude can read to evaluate simulation health.

## Context

Currently, validating the simulation requires:
1. Running the UI
2. Manually observing behavior
3. Relaying observations to Claude

This is slow and error-prone. We need a way to:
- Run simulation for N ticks programmatically
- Output structured metrics
- Evaluate whether the economy is sustainable
- Iterate quickly on balance and bug fixes

**Key users:**
- **Claude**: Read output to evaluate simulation health, suggest fixes
- **Developer**: Quick validation without launching UI, regression testing

## CLI Interface

```bash
# Run simulation for 1000 ticks (default seed)
npm run sim:test

# Run with specific parameters
npm run sim:test -- --ticks 2000 --seed 12345

# Run with verbose output (every week)
npm run sim:test -- --ticks 1000 --verbose

# Output to file
npm run sim:test -- --ticks 1000 --output report.txt
```

## Output Format

### Summary Report (Default)

```
================================================================================
SIMULATION REPORT
================================================================================
Duration: 1008 ticks (36 weeks, ~9 months)
Seed: 12345

POPULATION
  Starting: 15 agents
  Current:  12 agents (3 dead)
  Survival Rate: 80%
  Deaths by Cause:
    - Starvation: 2
    - (Other causes as added)

EMPLOYMENT
  Employed: 10 (83%)
  Unemployed: 2 (17%)
  Business Owners: 3

ECONOMY
  Total Credits: 4,250
    - Agent wallets: 1,200 (28%)
    - Org wallets: 3,050 (72%)
  Credits per living agent: 354

BUSINESSES
  Active: 8 (5 retail, 2 wholesale, 1 other)
  Closed this run: 2
  New this run: 3

FOOD SUPPLY
  Factory inventory: 120 provisions
  Shop inventory: 45 provisions
  Agent inventory: 18 provisions
  Total: 183 provisions
  Provisions per agent: 15.2

TRANSACTIONS (this run)
  Retail sales: 234 (avg 6.5/week)
  Wholesale sales: 45 (avg 1.3/week)
  Wages paid: 1,800 total
  Dividends paid: 540 total

WEEKLY TREND (last 10 weeks)
  Week 27: 13 pop, 7 biz, 3800 credits, 150 food
  Week 28: 13 pop, 7 biz, 3900 credits, 145 food
  Week 29: 12 pop, 8 biz, 4000 credits, 160 food
  Week 30: 12 pop, 8 biz, 4100 credits, 175 food
  Week 31: 12 pop, 8 biz, 4050 credits, 180 food
  Week 32: 12 pop, 8 biz, 4100 credits, 170 food
  Week 33: 12 pop, 8 biz, 4200 credits, 165 food
  Week 34: 12 pop, 8 biz, 4150 credits, 175 food
  Week 35: 12 pop, 8 biz, 4200 credits, 180 food
  Week 36: 12 pop, 8 biz, 4250 credits, 183 food

ASSESSMENT
  Population: DECLINING (lost 20% over 36 weeks)
  Economy: STABLE (credits fluctuating <10%)
  Food Supply: HEALTHY (>10 per agent)
  Overall: CAUTION - population decline unsustainable long-term
================================================================================
```

### Verbose Mode (--verbose)

Adds weekly snapshots showing key events:

```
--- Week 12 ---
  Deaths: 1 (Agent "Marcus Chen" - starvation)
  Businesses Opened: 1 ("Chen's Corner Store")
  Businesses Closed: 0
  Bankruptcies: 0
  Hires: 2, Fires: 0
  Food Produced: 24, Food Consumed: 18
```

### Machine-Readable (--json)

For programmatic analysis:

```json
{
  "duration": { "ticks": 1008, "weeks": 36 },
  "seed": 12345,
  "population": {
    "starting": 15,
    "current": 12,
    "dead": 3,
    "survivalRate": 0.80,
    "deathsByCause": { "starvation": 2, "other": 1 }
  },
  "economy": {
    "totalCredits": 4250,
    "agentCredits": 1200,
    "orgCredits": 3050
  },
  "weeklySnapshots": [...]
}
```

## Metrics to Track

### Population Metrics
- `population.alive` - Living agents
- `population.dead` - Dead agents
- `population.deathsByCause` - Breakdown by cause
- `population.employed` - Agents with income
- `population.unemployed` - Agents seeking work
- `population.businessOwners` - Org leaders

### Economy Metrics
- `economy.totalCredits` - Sum of all wallets
- `economy.agentCredits` - Sum of agent wallets
- `economy.orgCredits` - Sum of org wallets
- `economy.creditsPerAgent` - Average wealth

### Business Metrics
- `businesses.active` - Currently operating
- `businesses.openedThisRun` - New businesses
- `businesses.closedThisRun` - Failed businesses
- `businesses.byType` - Breakdown by tag (retail, wholesale)

### Supply Metrics
- `supply.factoryInventory` - Goods at producers
- `supply.shopInventory` - Goods at retailers
- `supply.agentInventory` - Goods held by agents
- `supply.provisionsPerAgent` - Food security metric

### Transaction Metrics
- `transactions.retailSales` - Consumer purchases
- `transactions.wholesaleSales` - B2B purchases
- `transactions.wagesPaid` - Total salary payments
- `transactions.dividendsPaid` - Total owner dividends

### Derived Assessments
- `assessment.population` - STABLE | DECLINING | GROWING | CRITICAL
- `assessment.economy` - STABLE | INFLATING | DEFLATING | CRITICAL
- `assessment.foodSupply` - HEALTHY | ADEQUATE | SCARCE | CRITICAL
- `assessment.overall` - OK | CAUTION | WARNING | CRITICAL

## Assessment Thresholds

```typescript
// Population assessment
if (survivalRate >= 0.95) return 'STABLE';
if (survivalRate >= 0.80) return 'DECLINING';
if (survivalRate >= 0.50) return 'CRITICAL';
return 'COLLAPSED';

// Food supply assessment
const foodPerAgent = totalFood / aliveAgents;
if (foodPerAgent >= 10) return 'HEALTHY';
if (foodPerAgent >= 5) return 'ADEQUATE';
if (foodPerAgent >= 2) return 'SCARCE';
return 'CRITICAL';

// Economy assessment (credit velocity)
// Compare week-over-week change
if (Math.abs(weeklyChange) < 0.10) return 'STABLE';
if (weeklyChange > 0.20) return 'INFLATING';
if (weeklyChange < -0.20) return 'DEFLATING';
return 'CRITICAL';
```

## Implementation

### Phase A: CLI Entry Point
- [ ] Create `src/cli/sim-test.ts` entry point
- [ ] Add npm script `sim:test` in package.json
- [ ] Parse CLI arguments (ticks, seed, verbose, output)
- [ ] Run simulation headlessly (no Pixi, no window)

### Phase B: Metrics Collection
- [ ] Create `src/simulation/Metrics.ts` for tracking
- [ ] Collect population metrics each tick
- [ ] Collect economy metrics each tick
- [ ] Collect transaction counts
- [ ] Weekly snapshot storage

### Phase C: Report Generation
- [ ] Create `src/cli/ReportGenerator.ts`
- [ ] Generate text summary report
- [ ] Generate verbose weekly breakdown
- [ ] Generate JSON output option

### Phase D: Assessment Logic
- [ ] Implement threshold-based assessments
- [ ] Overall health scoring
- [ ] Trend detection (improving/declining)

### Phase E: Integration
- [ ] Test with various seeds
- [ ] Validate metrics accuracy
- [ ] Document usage in README

## Key Files

| File | Purpose |
|------|---------|
| `src/cli/sim-test.ts` | CLI entry point |
| `src/cli/ReportGenerator.ts` | Output formatting |
| `src/simulation/Metrics.ts` | Metric collection and storage |
| `package.json` | Add `sim:test` script |

## Usage Examples

### Baseline Validation
```bash
# Run default simulation, check if it survives 50 weeks
npm run sim:test -- --ticks 1400

# Expected: Population STABLE or DECLINING (not CRITICAL)
# Expected: Food Supply HEALTHY or ADEQUATE
```

### Regression Testing
```bash
# Run with fixed seed before/after changes
npm run sim:test -- --ticks 1000 --seed 42 > before.txt
# Make changes
npm run sim:test -- --ticks 1000 --seed 42 > after.txt
diff before.txt after.txt
```

### Parameter Tuning
```bash
# Test different configs by editing data/config/*.json
# Run multiple seeds to find average behavior
for seed in 1 2 3 4 5; do
  npm run sim:test -- --ticks 1000 --seed $seed
done
```

## Non-Goals (Defer)

- Automated test suite (just manual CLI for now)
- CI/CD integration
- Performance benchmarking
- Replay/recording functionality

## Notes

- This is infrastructure to enable faster iteration
- Output should be human-readable AND Claude-readable
- Fixed seeds allow reproducible debugging
- Weekly snapshots help identify when things go wrong
- Assessment thresholds can be tuned based on experience
