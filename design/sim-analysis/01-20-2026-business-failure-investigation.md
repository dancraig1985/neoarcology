# Business Failure Investigation - January 20, 2026

## Question: Why do 67-100% of businesses close in failed seeds?

---

## Discovery 1: All Business Closures = Leader Died

**Seed 100 (0% business survival)**:
- All 17 business closures show: "dissolved (leader died)"
- Example: Phase 406 "Sage Nakamura's Properties dissolved (leader died)"

**Seed 400 (100% business survival)**:
- Zero business dissolutions
- Zero leader deaths

**Conclusion**: Business survival = Leader survival

---

## Discovery 2: Production Collapsed Early in Failed Seeds

### Provision Production Comparison

| Seed | Total Provision Production | When Did It Stop? |
|------|---------------------------|-------------------|
| 100 (failed) | 53 events | Phase 96 |
| 400 (success) | 889 events | Never (continuous) |

**17x difference in food production!**

### What Happened at Phase 96 (Seed 100)?

```
Phase 96 [Grid Works] 1 workers produced 1 provisions
Phase 98 [Grid Works] 3 workers employed but none present - no production
Phase 99 [Grid Works] 3 workers employed but none present - no production
Phase 100 [Grid Works] 3 workers employed but none present - no production
...
[Workers never returned - production stopped forever]
```

---

## Discovery 3: Workers Abandoned Factories

### Seed 100 - Grid Works Example

**Initial employees** (Phase 1):
- Alex Okonkwo - hired at Grid Works
- Alex Andersen - hired at Grid Works
- (Third worker unknown)

**What happened?**:

#### Alex Andersen Timeline
```
Phase 92: Completed work shift at Grid Works
Phase 93: Wandering to Neighborhood Green (break)
Phase 94: Arrived at Neighborhood Green
Phase 100: Commuting to Office 0 ← WRONG WORKPLACE!
Phase 101: Arrived at Office 0
Phase 105: Wandering again
...never returned to Grid Works
```

#### Alex Okonkwo Timeline
```
Phase 104: Commuting to Grid Works (attempting to return)
Phase 109: Commuting to Grid Works (retry)
Phase 111: Arrived at Grid Works
Phase 134: Commuting to Storage Warehouse ← DIFFERENT LOCATION!
Phase 159: Arrived at Storage Warehouse
...never returned to Grid Works
```

**Workers commuted to WRONG locations or changed jobs without being fired/rehired!**

---

## Discovery 4: Worker Attendance Issues in BOTH Seeds

| Metric | Seed 100 (Failed) | Seed 400 (Success) |
|--------|-------------------|-------------------|
| "Workers absent" warnings | 964 | **1,608** |
| Production events | 415 | 1,190 |
| Business survival | 0% | 100% |

**Seed 400 has MORE absences but succeeds!**

**Why?**: In seed 400, workers eventually return. In seed 100, workers permanently abandon factories.

---

## Discovery 5: Food Supply Cascade

### Seed 100 Timeline

1. **Phase 1-96**: Factories producing food (53 production events)
2. **Phase 96**: Workers abandon factories
3. **Phase 96+**: Zero food production
4. **Phase 123**: Sage Nakamura (business leader) eats last provision
5. **Phase 139**: Sage runs out of food, starts starving
6. **Phase 144**: Buys 5 provisions (shops still have some stock)
7. **Phase 237-259**: Hungry again, NO SHOPS HAVE FOOD
8. **Phase 406**: Sage Nakamura dies of starvation
9. **Phase 406**: "Sage Nakamura's Properties dissolved (leader died)"

**The cascade**:
```
Workers abandon factory
  → Production stops
  → Shops run out of stock
  → Business leaders can't buy food
  → Leaders starve
  → Businesses dissolve
```

---

## Root Cause Hypothesis

### Why Are Workers Commuting to Wrong Locations?

**Observed behaviors**:
1. Alex Andersen: Employed at Grid Works → Commutes to Office 0
2. Alex Okonkwo: Employed at Grid Works → Commutes to Storage Warehouse

**Possible causes**:
1. **Bug in employedAt field**: Worker's employment record pointing to wrong location
2. **Entrepreneur behavior bug**: Worker starts business but doesn't clear old employment
3. **Job seeking bug**: Worker gets hired elsewhere but old job not cleared
4. **Orphaned location purchase**: Worker buys business, changes employment incorrectly

### Why Does This Only Affect Some Seeds?

**Hypothesis**: Early-game RNG
- Some seeds have workers who change jobs/start businesses early
- Employment state gets corrupted
- Workers commute to wrong locations
- Original factories lose all workers
- Production collapses
- Leaders starve
- Businesses dissolve

**Success depends on**: Whether workers stay in their initial jobs long enough for economy to stabilize.

---

## Key Questions to Investigate

### 1. Why is Alex Andersen commuting to Office 0?
- Never hired at Office 0 (hiring log shows: Grid Works only)
- Never started a business
- No firing event
- But commuting there anyway

**Action**: Check agent.employedAt field corruption

### 2. Are workers getting hired multiple times?
- Alex Andersen: Hired at Grid Works (phase 1), then Chen Logistics Depot (phase 1709, 1765)
- Is this legitimate job change or double-employment bug?

**Action**: Check hiring logic for proper clearEmployment()

### 3. When do workers change jobs?
- Need to find the phase where Alex Andersen's employedAt changed from Grid Works → Office 0
- Check entrepreneur, seek_job, and purchase_orphaned executors

**Action**: Add logging to track employedAt changes

### 4. Is redirect fix working?
- Seed 400 has 1,608 absence warnings but still succeeds
- Workers must be returning eventually
- But why aren't they returning in seed 100?

**Action**: Compare redirect events between seeds

---

## Implications

### This Changes Everything

**Previous assumption**: "Workers don't return from breaks"
**Reality**: Workers are going to the WRONG workplace

The redirect fix helps workers return, but if they're returning to the wrong location, it doesn't matter!

### Why Seed 400 Succeeds

**Hypothesis**: In seed 400, workers either:
1. Don't change jobs in early game, OR
2. Change jobs correctly with proper employment clearing

### Why Seeds 100, 200, 300, 500, 800 Fail

**Hypothesis**: In failed seeds:
1. Workers change jobs early (entrepreneur behavior? job seeking?)
2. Employment state gets corrupted (employedAt points to wrong location)
3. Workers commute to wrong workplace
4. Original factories abandoned
5. Food production collapses
6. Death cascade begins

---

## Next Steps

### Immediate Investigation

1. **Find the smoking gun**: When does Alex Andersen's employedAt change from Grid Works → Office 0?
   - Grep for entrepreneur behavior with Alex Andersen
   - Grep for seek_job behavior
   - Check orphaned location purchases

2. **Check employment state integrity**:
   - Are there double-employment bugs?
   - Do all employment changes use setEmployment()?
   - Are old jobs properly cleared with clearEmployment()?

3. **Compare seed 100 vs 400 early game (phases 1-200)**:
   - Count job changes
   - Count business creations
   - Track when first factory abandonment happens

### Potential Fixes

1. **Add employment state validation**: Check that agent.employedAt matches location.employees[]
2. **Fix employment corruption**: Ensure all job changes use setEmployment() helper
3. **Add logging**: Track all employedAt field changes with stack traces
4. **Prevent early entrepreneurship?**: Delay business creation until economy stabilizes

---

## Conclusion

Business failures aren't caused by "bad luck" or "worker behavior" - they're caused by **employment state corruption** leading to workers commuting to wrong locations, abandoning critical factories, and collapsing food production.

The redirect fix (allowing workers to change direction mid-travel) doesn't help if they're traveling to the WRONG destination!

**The real bug**: Something is changing agent.employedAt without properly updating location.employees[], causing workers to commute to locations where they aren't actually employed.
