# Final Economic Analysis - January 20, 2026

## Three Rounds of Testing

### Round 1: Before Fixes (Baseline)
- **Changes:** None (original broken state)
- **Success rate:** 0/8 seeds
- **Production:** ~24 events per seed (stops at phase 38-42)
- **Worker attendance warnings:** ~792 per seed
- **Key issue:** Workers don't commute back (hunger > 50 blocks commuting)

### Round 2: Initial Behavior Fixes
- **Changes:**
  - Commuting hunger threshold: 50 → 80
  - seeking_job: normal → HIGH priority
  - Reordered behaviors (seeking_job before buying_food)
  - Added marketHasGoods condition
- **Success rate:** 3/8 seeds (38%)
- **Successful seeds:** 400, 600, 700 (~850 production events, 126-133 population)
- **Failed seeds:** 100, 200, 300, 500, 800 (~50 production events, 52-59 population)
- **Worker attendance warnings:** 964-1653 per seed (INCREASED!)
- **Key finding:** Bimodal distribution - wandering during breaks creates variance

### Round 3: Wandering Blocked During Breaks
- **Changes:** Added OR condition to wandering (unemployed OR cooldown expired)
- **Success rate:** 2/8 seeds (25%) - **WORSE!**
- **Successful seeds:** 200, 600
- **Failed seeds:** 100, 300, 400, 500, 700, 800
- **Seed 400 regression:** 858 production → 93 production (89% drop!)
- **Worker attendance warnings:** 146 per seed (90% reduction but production collapsed)
- **Key finding:** Blocking wandering replaced it with WORSE behaviors (going home to rest)

---

## Summary Table: All Three Rounds

| Seed | Round 1 (Baseline) | Round 2 (Fixes) | Round 3 (No Wander) |
|------|-------------------|----------------|---------------------|
| **100** | Collapsed (~24 prod) | Collapsed (53 prod) | Collapsed (58 prod) |
| **200** | Collapsed (~24 prod) | Collapsed (60 prod est) | **STABLE** (1868 prod) |
| **300** | Collapsed (~24 prod) | Collapsed (50 prod est) | Collapsed (32 prod) |
| **400** | Collapsed (~24 prod) | **STABLE** (858 prod) | Collapsed (93 prod) |
| **500** | Collapsed (~24 prod) | Collapsed (55 prod est) | Collapsed (25 prod) |
| **600** | Collapsed (~24 prod) | **STABLE** (850 prod est) | **STABLE** (970 prod) |
| **700** | Collapsed (~24 prod) | **STABLE** (860 prod est) | Collapsed (784 prod) |
| **800** | Collapsed (~24 prod) | Collapsed (50 prod est) | Collapsed (43 prod) |

**Success rates:**
- Round 1: 0/8 (0%)
- Round 2: 3/8 (38%)  ← Best result
- Round 3: 2/8 (25%)

---

## What We Learned

### 1. Wandering Is Not The Problem

**Evidence:**
- Blocking wandering REDUCED production (Round 2 → Round 3)
- Seed 400 went from 858 production → 93 production
- Worker attendance warnings decreased but production got WORSE

**Why:** When wandering is blocked, workers engage in other behaviors during breaks:
- Going home to rest (takes longer than wandering)
- Shopping for food (travel time)
- Seeking leisure (travel to pubs)

These alternatives take workers FURTHER from the workplace, not closer.

### 2. Attendance Warnings Are Misleading

**Before (Round 2):** 1653 warnings, 858 production events
**After (Round 3):** 146 warnings, 93 production events

More warnings ≠ worse production. Warnings just indicate workers aren't at workplace EVERY phase, but they may still return regularly enough to produce.

### 3. The Real Problem: Break Activities Take Workers Away

During 8-phase cooldown, workers CAN'T commute (`phasesSinceWorkShift: 8` condition false).

They do whatever else qualifies:
1. **Rest** (if fatigue > 90) - goes HOME (far away)
2. **Buy food** (if hunger > 25) - travels to shop
3. **Leisure** (if leisure > 50) - travels to pub
4. **Wander** (idle fallback) - travels to public space

ALL of these involve travel. If travel takes 1-2 phases each way:
- Travel away: 1-2 phases
- Activity: 1 phase
- Travel back: 1-2 phases
- **Total: 3-5 phases**

Leaves only 3-5 phase buffer before cooldown expires. If they're still traveling when cooldown ends, commuting is blocked by `notTraveling: true`.

### 4. The Bimodal Distribution Is Random Luck

**Why some seeds succeed:**
- Workers happen to have lower fatigue/hunger/leisure during breaks
- Workers happen to stay at workplace (nothing triggers)
- Workers complete activities quickly
- Enough workers cycling that SOME are always present

**Why some seeds fail:**
- Workers happen to have high fatigue → go home to rest
- Workers are hungry → shop for food
- Travel times align badly with cooldown
- All workers absent simultaneously

**This is RNG-dependent**, not design-dependent.

---

## Root Cause Analysis

### The Core Issue: Cooldown + Travel = Deadlock

```
1. Worker completes shift at workplace (phase X)
2. Cooldown begins: phasesSinceWorkShift < 8
3. Commuting behavior BLOCKED (condition false)
4. Worker does something else (rest/shop/wander)
5. Worker travels away from workplace (1-2 phases)
6. Worker does activity (1 phase)
7. Cooldown expires (phase X+8)
8. Worker tries to commute back BUT:
   - If still traveling: notTraveling = false → BLOCKED
   - If hungry > 80: emergency_food overrides commuting
   - If fatigue > 90: urgent_rest overrides commuting
9. Worker stuck in travel/emergency/rest loop
10. Never returns to work
11. Production stops
```

### Why Commuting Condition `notTraveling: true` Is Problematic

**Purpose:** Prevent starting a new commute while already traveling.

**Unintended consequence:** Blocks commuting when worker is returning from break activity. They're traveling back from the pub/shop/home, and when cooldown expires mid-travel, they can't redirect to workplace.

---

## Proposed Solutions

### Option A: Allow Commuting to Redirect Travel ⭐ RECOMMENDED

Remove `notTraveling: true` from commuting behavior and implement redirect logic.

**Behavior change:**
```json
{
  "id": "commuting",
  "conditions": {
    "hasEmployment": true,
    "notAtWorkplace": true,
    // REMOVE: "notTraveling": true,
    "needsBelow": { "hunger": 80 },
    "phasesSinceWorkShift": 8
  }
}
```

**Travel executor modification:**
The travel executor already has redirect capability (used by emergency_hunger). Extend it to commuting:

```typescript
// In executeTravelBehavior
if (isTraveling(agent) && task.type === 'commuting') {
  // Worker is traveling somewhere else but needs to commute
  // Redirect to workplace
  const workplace = ctx.locations.find(l => l.id === agent.employedAt);
  if (workplace) {
    const redirectedAgent = redirectTravel(agent, workplace, ctx.locations, ctx.transportConfig);
    return {
      agent: setTask(redirectedAgent, task),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: false
    };
  }
}
```

**Benefits:**
- Workers can change direction mid-travel when cooldown expires
- Heading to pub for leisure → cooldown expires → redirect to workplace
- Preserves break activities (rest, shop, wander) but ensures return
- Deterministic (removes RNG variance)

---

### Option B: Reduce Cooldown to 4 Phases

Half the break time - less time for workers to wander far.

**Pros:**
- Simpler config change
- Less time for travel-related problems

**Cons:**
- Workers get less break time (might not be realistic)
- Doesn't fully solve the problem (still possible to be traveling when cooldown expires)

---

### Option C: Make Breaks "Idle Time at Workplace"

Workers stay at workplace during break but don't work.

**Pros:**
- No travel during break
- Guaranteed return to work

**Cons:**
- Workers can't shop/eat/rest during breaks (unrealistic)
- Defeats the purpose of breaks
- You already rejected this ("rest at workplace")

---

### Option D: Increase Transit Speed (Your Suggestion)

Make public transit faster to reduce travel time during breaks.

**Pros:**
- Workers can complete round trips quickly
- More buffer time before cooldown expires

**Cons:**
- Compromises future vehicle differentiation
- Still RNG-dependent (if fatigue/hunger align badly)
- Doesn't solve "traveling when cooldown expires" problem

---

## Recommendation: Option A

**Allow commuting to redirect travel** is the best solution because:

1. **Deterministic** - removes luck-based variance
2. **Preserves realism** - workers can take breaks, do errands
3. **Surgical fix** - only affects commuting behavior
4. **Future-proof** - doesn't compromise vehicle speeds
5. **Existing code** - redirect logic already exists

### Implementation Steps

1. **Remove `notTraveling: true` from commuting** (behaviors.json line 246)

2. **Add redirect logic to travel executor** (executors/index.ts line 46-64):
```typescript
function executeTravelBehavior(agent, task, ctx): TaskResult {
  // If already traveling AND this is commuting, redirect
  if (isTraveling(agent)) {
    if (task.type === 'commuting' || task.params?.destination === 'employedAt') {
      // Redirect to workplace
      const workplace = ctx.locations.find(l => l.id === agent.employedAt);
      if (workplace && agent.travelingTo !== workplace.id) {
        const redirectedAgent = redirectTravel(agent, workplace, ctx.locations, ctx.transportConfig);
        ActivityLog.info(ctx.phase, 'travel',
          `redirecting to ${workplace.name} (work shift ready)`,
          agent.id, agent.name
        );
        return {
          agent: setTask(redirectedAgent, task),
          locations: ctx.locations,
          orgs: ctx.orgs,
          complete: false
        };
      }
    }

    // Otherwise, wait for current travel to complete
    return {
      agent,
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: false
    };
  }

  // ... rest of executor
}
```

3. **Test:** Run same 8 seeds, expect 6-7/8 success rate

---

## Alternative: Hybrid Approach

Combine Option A + Option B:
- Allow commuting redirect (Option A)
- Reduce cooldown to 6 phases (compromise between 8 and 4)

**Benefits:**
- Faster work cycles
- Still allows break activities
- Redirect ensures return

**Trade-off:** Slightly less break time (6 phases ≈ 0.75 days instead of 1 day)

---

## Expected Outcomes (Option A Implementation)

### Before Fix:
- Success rate: 25-38%
- Bimodal distribution (luck-based)
- Workers stuck traveling when cooldown expires

### After Fix:
- Success rate: 75-90% (predicted)
- Uniform success across seeds
- Workers redirect to workplace mid-travel

### Test Criteria:
1. Run 8 seeds × 2000 ticks
2. Success: 6+ seeds with stable population (>120)
3. Production: Continuous throughout simulation
4. Worker attendance: Warnings OK, but production consistent

---

## Conclusion

**The behavior fixes (Round 2) were on the right track** - they enabled some seeds to succeed spectacularly. However, **success was RNG-dependent** because workers couldn't commute while traveling.

**Blocking wandering (Round 3) made things worse** because it replaced wandering (nearby public spaces) with worse alternatives (going home to rest, far away).

**The solution is not to limit break activities, but to allow workers to change course mid-travel** when their break ends. This preserves the realism of breaks while ensuring workers return to work deterministically.

**Recommended next step:** Implement Option A (allow commuting redirect) and re-run 8-seed analysis.
