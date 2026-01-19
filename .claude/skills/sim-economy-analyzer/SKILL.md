---
name: sim-economy-analyzer
description: "Analyze NeoArcology's economic balance through automated testing and profitability calculations. Use when tuning economy config, investigating employment churn, or validating business sustainability."
---

# Simulation Economy Analyzer

Comprehensive economic analysis for NeoArcology simulation balancing.

## When to Use This Skill

Use this skill when:
- Tuning economy configuration (prices, wages, thresholds)
- Investigating high employment churn (fires/quits)
- Validating business profitability
- Comparing economic changes across test runs
- Balancing supply and demand
- Testing entrepreneurship flow rates

## Core Capabilities

### 1. Run Economic Test Suite
Execute simulation with specific configuration and analyze results:
- Run 2000 tick tests with controlled seeds
- Extract key economic metrics (survival, fires, businesses opened)
- Calculate per-business profitability
- Analyze market saturation ratios
- Track entrepreneurship timing and flow rate

### 2. Business Profitability Analysis
Calculate break-even requirements and actual performance:
- Revenue per business type (retail, wholesale, production)
- Cost structure (wages, dividends, COGS)
- Gross profit vs operating costs
- Weekly cash flow projections
- Bankruptcy timeline estimates

### 3. Market Balance Analysis
Evaluate supply/demand equilibrium:
- Agent consumption rates vs shop inventory
- Shops-per-capita ratios vs target ratios
- Sales frequency vs business needs
- Retail vs wholesale capacity balance

### 4. Employment Churn Analysis
Identify root causes of high fire rates:
- Business cash flow vs payroll obligations
- Agent wealth accumulation vs entrepreneurship threshold
- Employment stability vs savings disruption
- Fire/hire cycle patterns

## Analysis Workflow

### Step 1: Run Baseline Test
```bash
npm run sim:test -- --ticks 2000 --seed 42 2>&1 | tee /tmp/baseline-test.log
```

Extract key metrics from final report:
- Survival rate
- Deaths by cause
- Fires count
- New businesses opened
- Final shop count
- Retail sales/week

### Step 2: Calculate Business Economics

**For each business type (retail_shop, pub, etc.):**

1. **Determine consumption rate:**
   - Check `data/config/agents.json` for needs accumulation
   - Calculate provisions consumed per agent per week
   - Multiply by living agent count for total market demand

2. **Calculate revenue per shop:**
   ```
   Total market consumption / Number of shops = Provisions sold per shop
   Provisions sold × Retail price = Revenue per shop/week
   ```

3. **Calculate costs per shop:**
   ```
   COGS = Provisions sold × Wholesale price
   Wages = Employee count × Wage rate (from economy.json salary tier)
   Dividend = Fixed 75 credits/week (hardcoded in EconomySystem.ts:1803)
   Operating Costs = Wages + Dividend
   ```

4. **Calculate profitability:**
   ```
   Gross Profit = Revenue - COGS
   Net Profit = Gross Profit - Operating Costs
   ```

5. **Determine sustainability:**
   ```
   If Net Profit < 0:
     Weeks to bankruptcy = Opening Cost / |Net Profit|
   ```

### Step 3: Analyze Market Balance

**Check market saturation:**
```
Retail Saturation = (Retail Shops / Living Agents) / (1/15)
Target: 1.0 (1 shop per 15 agents)
Oversaturated: > 1.0
Undersaturated: < 1.0
```

**Check supply chain balance:**
```
Wholesale Saturation = (Production Facilities / Retail Shops) / (1/3)
Target: 1.0 (1 factory per 3 shops)
```

### Step 4: Identify Root Causes

**If fires > 1000:**
- Calculate business profitability (Step 2)
- If Net Profit < 0: Businesses are structurally unprofitable
  - Check if dividend is paid when losing money (bug?)
  - Evaluate price increases (retail vs wholesale)
  - Consider reducing operating costs
- If Net Profit > 0: Other causes (demand fluctuation, employment churn cycle)

**If survival rate < 90%:**
- Check market saturation (undersupplied = starvation risk)
- Check entrepreneurship timing (shops opening too late?)
- Calculate break-even threshold vs actual accumulation rate

**If oversaturation (>30 shops for 120 agents):**
- Check DemandAnalyzer saturation penalties
- Verify entrepreneurship threshold is appropriate
- Check starting credits (too high = early burst)

### Step 5: Compare Test Runs

Create comparison tables:
```markdown
| Metric | Baseline | Test 1 | Test 2 | Change |
|--------|----------|--------|--------|--------|
| Survival Rate | X% | Y% | Z% | +/- |
| Fires | X | Y | Z | +/- |
| New Businesses | X | Y | Z | +/- |
| Retail Shops | X | Y | Z | +/- |
| Sales/Week | X | Y | Z | +/- |
```

## Economic Configuration Files

### Critical Files for Analysis

1. **`data/config/economy.json`**
   - `goods[].retailPrice` - Consumer prices
   - `goods[].wholesalePrice` - B2B prices
   - `salary` - Wage rates by tier
   - `entrepreneurThreshold` - Credits needed to open business

2. **`data/config/agents.json`**
   - `hunger.perPhase` - Food consumption rate
   - `leisure.perPhase` - Discretionary spending rate
   - `housing.bufferWeeks` - Rent affordability

3. **`data/templates/agents/civilian.json`**
   - `credits.min/max` - Starting wealth range

4. **`data/templates/locations/*.json`**
   - `balance.openingCost` - Capital required to open
   - `balance.operatingCost` - Fixed weekly costs
   - `balance.employeeSlots` - Payroll obligations
   - `balance.salaryTier` - Wage level (unskilled/skilled/professional)

5. **`src/simulation/systems/EconomySystem.ts`**
   - Line 1803: `ownerDividend = 75` - Fixed dividend payment
   - Dividend logic (only paid if org.wallet.credits >= 75)

## Key Economic Principles

### Living Wage Calculation
```
Minimum Weekly Expenses:
- Rent: 20 credits/week (apartment)
- Food: ~10-15 credits/week (0.5-0.75 provisions @ 20 credits)
- Total: ~30-35 credits/week

Unskilled Wage Must Cover:
- Living expenses: 30-35 credits
- Surplus for savings: 20-30 credits (for entrepreneurship accumulation)
- Target wage: 50-70 credits/week ✅ (current range)
```

### Business Profitability Formula
```
Break-Even Sales/Week = Operating Costs / Gross Margin per Sale

Example (retail_shop):
- Operating Costs: 135 credits/week (60 wages + 75 dividend)
- Gross Margin: 17 credits/sale (20 retail - 3 wholesale)
- Break-Even: 135 / 17 = 7.94 ≈ 8 sales/week

If actual sales < 8/week → business loses money → fires workers
```

### Entrepreneurship Timeline
```
Weeks to Threshold = (Threshold - Starting Credits) / Weekly Surplus

Example:
- Threshold: 1250 credits
- Starting: 225 credits (avg of 150-300 range)
- Surplus: 30-50 credits/week (wage minus living costs)
- Timeline: 21-35 weeks to reach threshold

If fires disrupt employment:
- Actual timeline: 40-60+ weeks (savings drain during unemployment)
- Result: Few/no entrepreneurs reach threshold
```

## Common Analysis Patterns

### Pattern 1: Oversaturation → High Fires
**Symptoms:**
- 30-40+ retail shops for 100-120 agents
- Fires > 2000
- Retail sales < 1/week per shop

**Diagnosis:**
- Too many shops competing for limited demand
- Each shop gets insufficient revenue
- Cannot afford to keep employees

**Solutions:**
- Reduce initial shop spawning (location templates `count.min/max`)
- Increase entrepreneurship threshold (economy.json)
- Reduce starting credits (civilian.json)
- Add DemandAnalyzer saturation checks

### Pattern 2: Structural Unprofitability → Fires
**Symptoms:**
- Optimal market density (1 shop per 10-15 agents)
- Fires still > 1000
- Shops have customers but still fire workers

**Diagnosis:**
- Calculate profitability (Step 2)
- If Net Profit < 0: Margins too thin vs operating costs

**Solutions:**
- Increase retail prices (improve margins)
- Decrease wholesale prices (reduce COGS)
- Reduce dividend (currently fixed at 75)
- Reduce employee slots (fewer workers = lower payroll)

### Pattern 3: No Entrepreneurship → Starvation
**Symptoms:**
- Only initial shops remain (no new businesses)
- First entrepreneur after Week 30-40
- Deaths > 180

**Diagnosis:**
- Entrepreneurship threshold too high relative to:
  - Starting credits (long accumulation time)
  - Weekly surplus (low savings rate)
  - Employment stability (fires disrupt accumulation)

**Solutions:**
- Lower threshold (faster to reach)
- Increase starting credits (less to accumulate)
- Fix business profitability (reduce fires → stable employment → consistent savings)

## Expected Metrics (Target Ranges)

### Healthy Economy Indicators
- **Survival Rate:** 90-110% (accounting for immigration)
- **Fires:** < 500 per 2000 ticks (0.25 per tick)
- **Market Saturation:** 1 shop per 10-15 agents
- **New Businesses:** 5-15 per 2000 ticks (gradual flow)
- **Business Net Profit:** +5 to +20 credits/week per shop
- **Entrepreneurship Timing:** First business Week 10-20, steady flow thereafter

### Warning Signs
- **Fires > 1000:** Business profitability issue
- **Survival < 85%:** Supply shortage or wage issue
- **Shops > 2x optimal:** Oversaturation
- **No entrepreneurs by Week 30:** Threshold too high or fires disrupting accumulation

## Output Format

After analysis, provide:

1. **Summary Table:** Key metrics comparison
2. **Profitability Breakdown:** Per-business economics
3. **Market Balance:** Saturation ratios vs targets
4. **Root Cause:** Primary issue identified
5. **Recommendations:** Specific config changes with expected impact

Example:
```markdown
## Economic Analysis Results

### Test Configuration
- Starting Credits: 150-300
- Entrepreneurship Threshold: 1250
- Provisions Price: 20 retail / 3 wholesale

### Key Metrics
- Survival: 85% (88 living, 190 dead)
- Fires: 1492 (-27% vs baseline)
- Market Ratio: 1:9.8 (optimal)
- Sales/Week: 9.5 total, 1.06 per shop

### Business Profitability (retail_shop)
- Revenue: 100 credits/week (5 provisions @ 20)
- COGS: 15 credits/week (5 @ 3 wholesale)
- Gross Profit: 85 credits/week
- Operating Costs: 135 credits/week (60 wages + 75 dividend)
- **Net Profit: -50 credits/week (LOSS)**
- Bankruptcy Timeline: 6 weeks

### Root Cause
Businesses are structurally unprofitable. Even at optimal market density,
shops lose 50 credits/week because gross margins (85) cannot cover
operating costs (135).

### Recommendations
1. Increase provisions retail price: 20 → 25 (+25%)
   - New gross profit: 110 credits/week
   - New net profit: -25 credits/week (50% better)

2. Reduce dividend from 75 to 40 credits/week
   - New operating costs: 100 credits/week
   - New net profit: +10 credits/week (PROFITABLE)

Expected Impact:
- Fires: 1492 → ~500 (-67%)
- Stable employment → workers accumulate savings
- More entrepreneurs reach threshold naturally
```

## Testing Checklist

Before making economic changes:
- [ ] Run baseline test (seed 42)
- [ ] Calculate current business profitability
- [ ] Identify root cause (oversaturation vs unprofitability vs threshold)
- [ ] Make single change (price OR threshold OR starting credits)
- [ ] Re-test with same seed
- [ ] Compare metrics before/after
- [ ] Document findings in design/sim-analysis/

After validating changes:
- [ ] Test with 3+ different seeds (42, 100, 200)
- [ ] Verify consistency across seeds
- [ ] Update economy.json or templates
- [ ] Commit with detailed analysis in commit message

## Notes

- **Always use seed 42 for comparisons** (reproducibility)
- **Test one variable at a time** (isolate impact)
- **Document all findings** (design/sim-analysis/)
- **Commit analysis reports** (helps future tuning)
- **Check agent affordability** (any price increase must maintain living wage)
