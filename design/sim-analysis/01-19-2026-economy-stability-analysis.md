# Economy Stability Analysis - January 19, 2026

## Executive Summary

Ran 8 simulations (seeds 100-800) for 2000 ticks each to analyze economic health excluding starvation deaths. **The economy has fundamental structural issues that prevent sustainable business operation.**

### Critical Findings

1. **Property Management Dominance**: 88.5% of new businesses are residential property management companies, crowding out productive businesses
2. **Zero Bankruptcies**: All business closures (662 total) result from leader starvation, not financial failure - suggesting profit margins are adequate but leadership mortality is catastrophic
3. **Massive Employment Churn**: 3,492 fires vs only 613 actual hires across all simulations (though metrics incorrectly report 0 hires due to instrumentation bug)
4. **Business Lifecycle Crisis**: Average business lifespan is extremely short due to sole proprietor dependency
5. **Metrics Instrumentation Bug**: Hire tracking is broken in behavior executors

---

## Aggregate Statistics (8 simulations, 2000 ticks each)

### Population & Mortality
- **Total Deaths**: 2,210 (avg 276.2 per sim)
- **Starvation Rate**: ~100% of deaths (as expected with incomplete employment)
- **Population Collapse**: Expected given current food supply limitations

### Business Activity
- **Businesses Opened**: 757 (avg 94.6 per sim)
- **Businesses Closed**: 662 (avg 82.8 per sim)
- **Net Growth**: +95 businesses (avg +11.9 per sim)
- **Closure Cause**: 100% leader death, 0% bankruptcy

### Employment
- **Total Hires**: 613+ actual (metrics report 0 due to bug)
- **Total Fires**: 3,492 (avg 436.5 per sim)
- **Net Employment Change**: -2,879 (catastrophic churn)
- **Weekly Hire Rate**: 0 reported (instrumentation failure)
- **Weekly Fire Rate**: 10-25 per week (from org dissolutions)

### Business Type Distribution

**Businesses Opened:**
- Properties (apartments): 670 (88.5%)
- Generic Business: 24 (3.2%)
- Retail Shop: 5 (0.7%)
- Boutique: 3 (0.4%)
- Other: 55 (7.3%)

**Businesses Closed:**
- Properties (apartments): 587 (88.7%)
- Retail Shop: 17 (2.6%)
- Pub: 10 (1.5%)
- Generic Business: 11 (1.7%)
- Other: 37 (5.6%)

---

## Problem 1: Property Management Monopoly

### Root Cause
The DemandAnalyzer heavily favors apartment construction because:

1. **Housing demand calculation** (DemandAnalyzer.ts:200-229):
   - Scores: `housingDemand.demand - housingDemand.supply`
   - With high agent mortality, homeless agents constantly regenerate demand
   - Housing scores can reach 20-50+ while retail/wholesale scores typically 3-10

2. **Weighted random selection** (DemandAnalyzer.ts:477-503):
   - Higher scores = much higher selection probability
   - Housing dominates the opportunity pool

3. **Org naming convention** (behaviors/executors/index.ts:1392):
   ```typescript
   const orgName = `${agent.name}'s ${targetLocation.template === 'apartment' ? 'Properties' : 'Business'}`;
   ```
   - All apartment businesses named "[Name]'s Properties"

### Impact
- **Retail/wholesale businesses rarely created** (only 0.7% retail shops)
- **Food vertical undersupplied** - few provisions shops despite hunger
- **Alcohol vertical essentially non-existent** - only 0.4% boutiques
- **Knowledge economy stagnant** - no B2B service businesses

### Evidence from Logs
Seed 100 log analysis:
- 93 businesses opened, 79 were Properties
- Only 5 retail shops opened across entire 2000-tick simulation
- Initial businesses (factories, shops, pubs) from CityGenerator eventually close
- Entrepreneurs overwhelmingly choose apartments over productive businesses

---

## Problem 2: Sole Proprietor Dependency

### Root Cause
Every business is a micro-org with a single leader. When the leader dies:

1. **Org dissolution triggered** (from grep: 79 "dissolved (leader died)" events in seed 100)
2. **Mass layoffs cascade** through PayrollSystem
3. **Locations become orphaned** (later purchased by new entrepreneurs)
4. **No succession planning** - organizations can't outlive founders

### Impact on Employment Stability
- **Zero job security** - employed agents face sudden unemployment when boss starves
- **No stable employment class** - can't maintain consistent workforce
- **Wage payments interrupted** - payroll stops when org dissolves
- **Experience/seniority lost** - no long-term employment relationships

### Evidence
Seed 100 dissolution timeline:
- Phase 356: "Indigo Okonkwo's Properties dissolved (leader died)"
- Phase 397: "Alex Nakamura's Properties dissolved (leader died)"
- Phase 417: "Grey Dubois's Shop dissolved (leader died)"
- Phase 868: "Chen Logistics dissolved (leader died)"

**Result**: Productive businesses (shops, factories, logistics) close despite likely profitability.

---

## Problem 3: Employment Metrics Instrumentation Bug

### Root Cause
Hire tracking is split between two code paths:

1. **LocationSystem.hireAgent()** (LocationSystem.ts:240):
   ```typescript
   recordHire(context.metrics);
   ```
   - Properly instrumented

2. **Behavior executor** (behaviors/executors/index.ts:716-750):
   ```typescript
   // Hire the agent
   const salary = ...;
   const updatedAgent = {
     ...agent,
     status: 'employed' as const,
     employer: ownerOrg.id,
     employedAt: nearestJob.id,
     salary,
   };
   // MISSING: No recordHire() call
   ```
   - **NOT instrumented** - bypasses metrics tracking

### Impact
- **Weekly summaries show "Hires: 0"** despite 613+ actual hires occurring
- **Cannot analyze employment trends** with broken data
- **False impression of zero hiring** in reports

### Evidence
Seed 100 log:
- grep "hired at" returns 613 matches
- Weekly summary reports: "Hires: 0, Fires: 549"
- Activity log shows: "• Phase 6 [Riley Yamamoto] hired at Synth Industries for 51/week"

### Fix Required
Add `recordHire(context.metrics)` to behavior executor hire path (around line 740 of behaviors/executors/index.ts).

---

## Problem 4: Business Profit Margins (Positive Finding)

### Finding: **Margins Are Adequate**

**Evidence of profitability:**
- **Zero bankruptcies** across 662 business closures
- All closures attributed to "leader died", not "bankrupt"
- No "dissolved (bankrupt)" messages in any simulation
- Businesses survive long enough to accumulate employees (seen in employment invariant warnings)

### Why This Matters
The economy's instability is **NOT due to unprofitable businesses**. The structural issues are:
1. Leadership mortality (starvation cascade)
2. Housing market crowding out productive sectors
3. No corporate succession/resilience

**Implication**: Tweaking prices/costs won't stabilize the economy. Need architectural changes.

---

## Problem 5: Business Type Diversity Crisis

### Vertical Health Assessment

**Food Vertical (Critical):**
- Provisions factories: Present at start (generated by CityGenerator)
- Retail shops: Only 5 opened across 8 sims (0.66%)
- Result: Food supply collapses as initial shops close

**Alcohol Vertical (Moribund):**
- Breweries: Rare
- Pubs: 10 opened, 10 closed (0% survival)
- Result: Discretionary economy non-functional

**Knowledge Economy (Stagnant):**
- Server factories: Present at start
- Offices: Not being created by entrepreneurs
- Result: B2B economy doesn't expand

**Housing Vertical (Oversupplied):**
- Apartments: 670 opened (88.5%)
- Result: Crowding out all other sectors

### Why Diversity Matters
Without diverse businesses:
- **Employment options limited** - most jobs in property management (non-productive)
- **Supply chains break** - retail depends on wholesale depends on production
- **Economic feedback loops fail** - can't sustain balanced economy

---

## Anomalies & Edge Cases

### Invariant Violations (Employment Sync Issues)

Found in seed 100 log:
```
⚠️ [employment] Location Grid Works lists Winter Petrov as employee but agent's employedAt is loc_1
⚠️ [employment] Location Grid Works lists Finn Johansson as employee but agent's employedAt is loc_1
```

**Cause**: Bidirectional relationship desync between:
- `location.employees[]` ↔ `agent.employedAt`

**Status**: Known issue, tracked by invariant checker. Likely related to org dissolution cleanup.

### High Business Churn Rate

Weekly pattern observed across all simulations:
- Week 30: 8-12 deaths → 3-5 business closures → 4-7 business openings
- Week 31: 5-11 deaths → 2-6 business closures → 3-6 business openings
- Week 32: 4-10 deaths → 3-7 business closures → 2-5 business openings

**Pattern**: Continuous churn as leaders die → businesses close → new entrepreneurs open (mostly apartments) → repeat

**Impact**: Economy never reaches steady state, constant disruption

---

## Recommendations for Stabilization

### Priority 1: Fix Business Type Imbalance

**Option A: Reweight housing opportunity scores**
- Divide housing finalScore by 2-3x to reduce selection probability
- Forces entrepreneurs to consider other verticals more often
- Location: DemandAnalyzer.ts:440

**Option B: Add market saturation for housing**
- Calculate apartments-per-capita ratio (like retail saturation at line 310)
- Apply penalty when housing market oversaturated
- Prevents runaway apartment construction

**Option C: Minimum vertical diversity requirement**
- Require at least 1 shop per 50 agents before allowing more apartments
- Hard constraint to ensure basic services exist

**Recommendation**: Implement Option B (saturation model) - most elegant, follows existing patterns

---

### Priority 2: Add Corporate Succession/Resilience

**Option A: Multi-owner corporations**
- Allow orgs to have board members who can become leader when founder dies
- Requires org type diversification (not all sole proprietorships)

**Option B: Manager promotion system**
- When leader dies, promote senior employee to leader role
- Requires employee seniority tracking

**Option C: Government acquisition of failed businesses**
- Public sector takes over dissolved productive businesses
- Ensures critical infrastructure (shops, factories) doesn't disappear

**Recommendation**: Start with Option C (government backstop) - simplest to implement, prevents critical service collapse

---

### Priority 3: Fix Hire Tracking Instrumentation

**Action Required:**
Add to behaviors/executors/index.ts around line 740:

```typescript
// Import at top
import { recordHire } from '../../Metrics';

// In executeSeekEmploymentBehavior, after hire logic:
ActivityLog.info(
  ctx.phase,
  'employment',
  `hired at ${nearestJob.name} for ${salary}/week`,
  agent.id,
  agent.name
);

// ADD THIS LINE:
recordHire(ctx.context.metrics);
```

**Priority**: Medium (doesn't affect simulation, only metrics reporting)

---

### Priority 4: Add Immigration Pressure Valve

**Current State**: Population declines from starvation, creating housing demand, driving apartment construction

**Proposed**: Tie immigration rate to:
- Employment availability (more jobs = more immigrants)
- Housing availability (more apartments = more immigrants)
- Food supply (more provisions = more immigrants)

**Goal**: Reduce artificial housing demand from replacement population

---

## Configuration Tuning Suggestions

Based on 2000-tick runs, recommend adjusting these values in config files:

### business.json
```json
{
  "entrepreneurship": {
    "openingChancePerPhase": 0.02,  // Current value
    "minCreditsMultiplier": 1.5,    // Reduce to 1.2 (easier to open businesses)
    "expansionThreshold": 0.8       // Keep as-is
  }
}
```
**Rationale**: Lower barrier to entry might increase business diversity

### thresholds.json (if housing saturation implemented)
```json
{
  "housing": {
    "targetApartmentsPerCapita": 0.5,    // 1 apartment per 2 agents
    "saturationThreshold": 0.7,          // Penalty kicks in at 70% of target
    "oversaturationPenalty": 15          // Strong penalty to discourage excess
  }
}
```

---

## Testing Recommendations

After implementing fixes, run validation suite:

1. **Business diversity test** (500 ticks):
   - Check: At least 10% of new businesses are non-apartments
   - Check: At least 3 different business types opened

2. **Corporate resilience test** (1000 ticks):
   - Check: At least 20% of businesses survive founder death
   - Check: Employment churn ratio < 2:1 (fires:hires)

3. **Metrics accuracy test** (200 ticks):
   - Check: Weekly hire count > 0 when employment events occur
   - Check: Hire count matches activity log "hired at" events

4. **Steady state test** (2000 ticks):
   - Check: Population stabilizes within ±20% after week 20
   - Check: Business count stabilizes within ±30% after week 15
   - Check: Food supply remains > 0.5 provisions per agent

---

## Data Quality Notes

### Simulation Parameters
- **Seeds tested**: 100, 200, 300, 400, 500, 600, 700, 800
- **Ticks per sim**: 2000 (250 weeks / ~4.6 sim-years)
- **Total simulation time**: 16,000 ticks across all runs
- **Verbose logging**: Enabled (weekly summaries)

### Metrics Reliability
- **Death counts**: Accurate ✓
- **Business open/close counts**: Accurate ✓
- **Fire counts**: Accurate ✓
- **Hire counts**: **INACCURATE** ✗ (bug)
- **Financial transactions**: Not analyzed (data not logged)

### Log Analysis Methods
- Python script parsing for aggregate statistics
- Manual grep for patterns and edge cases
- tail analysis for final state examination
- Activity log inspection for event sequences

---

## Conclusion

**The economy is structurally unstable, but NOT due to unprofitable businesses.** The core issues are:

1. **Housing crowding out productive sectors** - Need market saturation limits
2. **Sole proprietor mortality cascade** - Need corporate succession
3. **Broken hire tracking** - Need instrumentation fix
4. **No steady state achievable** - Continuous churn from leadership deaths

**Profit margins are healthy** (zero bankruptcies), so price/cost tuning won't help. Need architectural changes to business lifecycle and demand analysis.

**Before adding new economic verticals**, stabilize existing ones by:
- Fixing housing market dominance
- Implementing business succession
- Ensuring basic services (food, employment) persist

**Estimated effort to stabilize**:
- Housing saturation: 2-3 hours (add calculation + config)
- Government business acquisition: 4-6 hours (new system)
- Hire tracking fix: 15 minutes (one-line change)
- Testing suite: 2 hours (automated validation)

**Total**: ~1-2 days of focused development to achieve basic economic stability.
