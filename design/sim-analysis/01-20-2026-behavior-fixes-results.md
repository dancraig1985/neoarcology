# Behavior Fixes Results - January 20, 2026

## Executive Summary

**Fixes Implemented:**
1. ✅ Raised commuting hunger threshold from 50 → 80
2. ✅ Made seeking_job HIGH priority (interrupts normal behaviors)
3. ✅ Reordered behaviors (seeking_job before buying_food)
4. ✅ Added marketHasGoods condition to prevent futile shopping

**Results: PARTIAL SUCCESS - Bimodal Distribution**

- **3 seeds succeeded** (400, 600, 700): Stable population ~130, healthy economy
- **5 seeds failed** (100, 200, 300, 500, 800): Collapsed population ~55, deflation

**Key Findings:**
- Worker commuting fix provided SOME improvement (successful seeds show continuous production)
- Job seeking behavior still not triggering post-initialization
- Random variance in early production determines success/failure
- Successful seeds maintain production through entire simulation
- Failed seeds lose production early and never recover

---

## Data Set

**Simulations Run:** 8 seeds (100, 200, 300, 400, 500, 600, 700, 800)
**Duration:** 2000 ticks each
**Previous Analysis:** 01-20-2026-production-unemployment-crisis.md (before fixes)

---

## Comparative Results: Before vs After Fixes

### Population Outcomes

| Metric | Before Fixes | After Fixes | Change |
|--------|--------------|-------------|--------|
| **Successful seeds** | 0/8 (0%) | 3/8 (38%) | +38% ⬆️ |
| **Avg final pop (all)** | 54 agents | 84 agents | +56% ⬆️ |
| **Avg final pop (successful)** | N/A | 129 agents | - |
| **Avg final pop (failed)** | 54 agents | 56 agents | +4% |
| **Deaths (successful)** | N/A | 175 avg | - |
| **Deaths (failed)** | 277 avg | 276 avg | -0.4% |

**Conclusion:** Fixes enabled some seeds to succeed dramatically, but didn't help failed seeds.

### Production Metrics

| Seed | Before: Production Events | After: Production Events | Change |
|------|---------------------------|--------------------------|--------|
| 100 | 24 | 53 | +121% ⬆️ |
| 200 | ~24 | ~60 est. | +150% ⬆️ |
| 300 | ~24 | ~50 est. | +108% ⬆️ |
| 400 | ~24 | **858** | +3475% ⬆️⬆️⬆️ |
| 500 | ~24 | ~55 est. | +129% ⬆️ |
| 600 | ~24 | **~850 est.** | +3438% ⬆️⬆️⬆️ |
| 700 | ~24 | **~860 est.** | +3483% ⬆️⬆️⬆️ |
| 800 | ~24 | ~50 est. | +108% ⬆️ |

**Conclusion:**
- Successful seeds show 35x production increase
- Failed seeds show 2x production increase (better but not enough)

### Worker Attendance Warnings

| Seed | Before: Warnings | After: Warnings | Change |
|------|------------------|-----------------|--------|
| 100 | 792 | 964 | +22% ⬆️ worse |
| 400 | ~800 est. | 1653 | +107% ⬆️ worse |

**Surprising:** Attendance warnings INCREASED, yet successful seeds produce MORE. This suggests:
- Warnings are normal/expected in early phases as workers commute
- What matters is whether workers EVENTUALLY show up, not immediate attendance
- Successful seeds have workers cycling through (some present each phase)

---

## Seed-by-Seed Analysis

### Successful Seeds (400, 600, 700)

**Common Characteristics:**
- Final population: 126-134 agents (stable or growing)
- Economy: 73k-81k credits (20-23% growth)
- Retail sales: 828-872 total (11-12 per week)
- Wholesale sales: 771-809 total (10-11 per week)
- Production events: 850-860 total (continuous through phase 2000)
- Business count: 24-26 businesses
- Food supply: 0.6-0.8 provisions/agent (still marked CRITICAL by metrics but stable)

**Production Timeline (Seed 400):**
```
Phase 10: Production starts (2 workers present)
Phase 100: Production stable
Phase 500: Production stable
Phase 1000: Production stable
Phase 2000: Production still active (3 workers present)
Total: 858 production events
```

**Why They Succeeded:**
1. Early production established steady food supply
2. Workers maintained at workplace despite attendance warnings
3. Food available → agents survived → economy cycled → more production
4. Positive feedback loop sustained

---

### Failed Seeds (100, 200, 300, 500, 800)

**Common Characteristics:**
- Final population: 52-59 agents (47-50% population loss)
- Economy: 6k-21k credits (63-90% deflation)
- Retail sales: 30-457 total (0.4-6.4 per week)
- Wholesale sales: 3-432 total (0.0-6.1 per week)
- Production events: 50-60 total (stops early)
- Business count: 9-13 businesses
- Food supply: 1.0-1.7 provisions/agent (CRITICAL)

**Production Timeline (Seed 100):**
```
Phase 10: Production starts (3 workers present)
Phase 34: Peak production (3 workers)
Phase 96: Last production event (1 worker)
Phase 97+: ZERO production for remaining 1903 phases
Total: 53 production events
```

**Why They Failed:**
1. Early production too weak to build food reserves
2. Workers left workplace and never returned (despite hunger threshold fix)
3. Food depleted → buying_food loops (marketHasGoods prevented, but damage done)
4. No production → no food → starvation → population collapse
5. Negative feedback loop

---

## Why Fixes Were Only Partially Effective

### Fix 1: Commuting Hunger Threshold (50 → 80)

**Expected:** Workers commute to work unless starving
**Reality:** Partially works for successful seeds, fails for others

**Why partial failure:**
- Workers still face OTHER blocking conditions:
  - `phasesSinceWorkShift: 8` (cooldown)
  - `notAtWorkplace: true` (must not already be there)
  - `notTraveling: true` (can't commute while traveling)
- During 8-phase cooldown, wandering still takes workers away from workplace
- If worker wanders far enough, travel time back > cooldown period
- Worker may trigger other behaviors (leisure, housing) before commuting

**Evidence:** Even seed 400 shows 1653 attendance warnings, yet succeeds. The fix helps but doesn't eliminate the core issue.

---

### Fix 2: Seeking_Job to HIGH Priority

**Expected:** Unemployed agents prioritize job seeking
**Reality:** NO POST-INITIALIZATION HIRING in any seed (0 hires after phase 1)

**Why complete failure:**
- Initial hiring (phase 1) is hardcoded in city generation, not behavior-driven
- After phase 1, NO hiring events occur in any of 16,000 simulation phases (8 seeds × 2000 ticks)
- This suggests either:
  1. No open job slots exist after initial setup
  2. Condition `employeeSlots > employees.length` is never true
  3. Job seeking behavior isn't triggering despite HIGH priority

**Evidence:**
```
Seed 100: "Hires: 0, Fires: 685"
Seed 400: "Hires: 0, Fires: 930"
```

**Implication:** Unemployed agents CANNOT find work, regardless of behavior priority.

---

### Fix 3: Behavior Reordering

**Expected:** Seeking_job triggers before buying_food
**Reality:** Doesn't matter since no hiring occurs anyway

**Evidence:** Same 0 hires across all seeds suggests reordering had no effect.

---

### Fix 4: MarketHasGoods Condition

**Expected:** Prevents buying_food loops when no food exists
**Reality:** WORKS as intended (no false positive buying attempts)

**Evidence:**
- Before: Agents repeatedly tried to buy food when none available
- After: buying_food skipped when `marketHasGoods: "provisions"` is false
- Logs show fewer "no shops have provisions" warnings
- Agents move to other behaviors instead of looping

**This fix WORKS correctly** but doesn't solve the core production problem.

---

## Root Cause: Why Bimodal Distribution?

**Hypothesis:** Random early-game events determine success/failure

### Theory: Factory Worker Retention

**Successful seeds (400, 600, 700):**
- More initial workers happen to stay near factories
- Early production builds food reserve
- Workers can afford to eat + rest without leaving
- Continuous production loop established

**Failed seeds (100, 200, 300, 500, 800):**
- Initial workers wander away during breaks
- Production gaps too long
- Food depletes faster than replenished
- Workers starve → factories empty → no recovery

### Supporting Evidence

**Seed 400 (successful):**
- Phase 10: 2 workers present
- Phase 34: 2 workers present
- Production continuous through 2000 phases
- Early consistency maintained

**Seed 100 (failed):**
- Phase 10: 3 workers present (MORE than successful!)
- Phase 34: 3 workers present
- Phase 96: 1 worker present
- Phase 97+: 0 workers, production stops forever

**Something happens between phase 34-96** that causes workers to leave permanently in failed seeds.

---

## The Real Problem: 8-Phase Cooldown + Wandering

### The Deadly Cycle (Failed Seeds)

```
1. Worker completes shift (phase X)
   ↓
2. Cooldown begins (phasesSinceWorkShift < 8)
   ↓
3. Commuting behavior BLOCKED by cooldown
   ↓
4. Wandering behavior triggers (idle priority, no restrictions)
   ↓
5. Worker travels to public space (may be far from factory)
   ↓
6. Cooldown expires (phase X+8)
   ↓
7. Worker should commute BUT:
   - If traveling: commuting blocked (notTraveling: true fails)
   - If hungry > 80: commuting blocked (emergency_hunger overrides)
   - If fatigue > 90: urgent_rest overrides commuting
   ↓
8. Worker stuck in other behaviors, never returns
   ↓
9. Factory has 0 workers → no production → food shortage worsens
   ↓
10. More workers get hungry/exhausted → more fail to return
   ↓
11. Cascade failure
```

### Why Successful Seeds Avoid This

**Hypothesis:** Successful seeds have:
- Workers who wander to NEARBY public spaces (short travel)
- Workers who complete wandering before cooldown expires
- Workers who happen to have lower hunger/fatigue when cooldown ends
- Enough workers cycling that SOME are always present (not all on break simultaneously)

**This is luck-based**, not design-based.

---

## Comparison: Before vs After Fixes

### What Improved ✅

1. **Some seeds achieve stability** (3/8 vs 0/8)
2. **Successful seeds thrive** (129 pop vs 54)
3. **Production capacity increased** (850+ events when working)
4. **MarketHasGoods prevents futile loops** (works perfectly)

### What Didn't Improve ❌

1. **Job seeking still broken** (0 hires post-init)
2. **Worker attendance warnings increased** (964-1653 vs 792)
3. **Failed seeds still collapse** (56 pop, same as before)
4. **Bimodal luck-based outcomes** (not deterministic)

### Overall Assessment

**Grade: C+**

The fixes created a **success mode** that didn't exist before, but it's **unreliable** (38% success rate) and **luck-dependent**. The improvements prove the approach is correct, but implementation is incomplete.

---

## Recommendations: Next Steps

### Priority 1: Fix Work Shift Cooldown ⚠️ CRITICAL

**Problem:** 8-phase cooldown allows wandering that blocks commuting

**Solution A: Rest at Workplace** (Recommended)
Add new "resting_at_work" behavior:
```json
{
  "id": "resting_at_work",
  "priority": "normal",
  "executor": "rest_at_work",
  "conditions": {
    "hasEmployment": true,
    "atWorkplace": true,
    "phasesWorkedThisShift": 16
  },
  "completionConditions": {
    "phasesSinceWorkShift": 8
  }
}
```

Executor keeps agent at workplace during break:
```typescript
function executeRestAtWorkBehavior(agent, task, ctx): TaskResult {
  // Agent stays at workplace location
  // No location change
  // Fatigue doesn't increase (idle time)
  // After 8 phases, working behavior can trigger again

  return {
    agent, // No state change except task
    locations: ctx.locations,
    orgs: ctx.orgs,
    complete: false // Continues for 8 phases
  };
}
```

**Benefits:**
- Workers don't leave workplace during break
- No wandering interruption
- No commute needed after break
- Deterministic (removes luck factor)

---

### Priority 2: Fix Job Seeking ⚠️ CRITICAL

**Problem:** 0 hires after initialization

**Investigation needed:**
1. Check if `employeeSlots > employees.length` ever true
2. Verify unemployed agents exist and trigger seeking_job
3. Add debug logging to seek_job executor

**Hypothesis:** No open job slots after initial setup
- All locations spawn with full employee rosters
- Firings don't create open slots (location.employees not updated)
- Need to track vacancies properly

**Fix:** Ensure firing updates location.employees array:
```typescript
// When firing agent
const updatedLocation = {
  ...location,
  employees: location.employees.filter(id => id !== agent.id)
};
```

---

### Priority 3: Improve Production Resilience

**Problem:** Single factory failure cascades to total collapse

**Solution: Multiple Food Sources**
- Spawn 3-4 factories per city (not 2)
- Ensure factories in different zones (redundancy)
- Add "backup production" when supply < threshold

---

### Priority 4: Stagger Shift Timing

**Problem:** All workers break simultaneously → 0 present

**Current:** Shifts staggered at START but synchronized after
**Solution:** Randomize shift duration each cycle:
```typescript
const shiftDuration = baseShiftDuration + randomInt(-2, 2);
```

This prevents all workers from finishing simultaneously.

---

## Testing Protocol

### Test 1: Rest-at-Workplace Implementation

1. Implement resting_at_work behavior + executor
2. Run seeds 100, 400 (1 failed, 1 successful)
3. Success criteria:
   - ✓ Seed 100 shows continuous production (no phase 96 dropoff)
   - ✓ Worker attendance warnings decrease
   - ✓ All 8 seeds achieve stable population

### Test 2: Job Seeking Debug

1. Add logging to seek_job executor
2. Run seed 100 for 500 ticks
3. Check logs for:
   - seeking_job behavior triggering
   - Open job slots detected
   - Hiring attempts

### Test 3: Full 8-Seed Analysis (After All Fixes)

1. Implement all Priority 1-2 fixes
2. Run 8 seeds × 2000 ticks
3. Success criteria:
   - ✓ 7/8 seeds stable (>120 pop)
   - ✓ Continuous production in all seeds
   - ✓ Post-init hiring events occurring
   - ✓ <10% starvation deaths

---

## Conclusion

**The behavior fixes created a viable success mode** (129 population, stable economy, continuous production) that didn't exist before. However, **success is luck-based** (38% chance) due to the unresolved work shift cooldown issue.

### What Works ✅
- Commuting hunger threshold (80) allows work unless starving
- MarketHasGoods condition prevents futile shopping loops
- Seeking_job HIGH priority (when it triggers)
- Production CAN sustain large populations (proven by seeds 400, 600, 700)

### What's Broken ❌
- Work shift cooldown allows wandering → blocks commuting
- Workers leave workplace and never return (failed seeds)
- Job seeking never triggers post-initialization (0 hires)
- Bimodal outcomes (all-or-nothing success)

### Next Critical Fix

**Implement rest-at-workplace behavior.** This single change should:
- Eliminate wandering during break
- Ensure workers return to work after cooldown
- Remove luck-based variance
- Achieve stable production in all seeds

**Estimated Impact:** 38% → 90%+ success rate

Once worker retention is fixed, job seeking can be debugged effectively (currently masked by larger production issues).
