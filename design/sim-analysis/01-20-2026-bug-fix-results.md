# Bug Fix Results - ID Collision Fix (January 20, 2026)

## The Bug

**Location ID Collision Bug**: CityGenerator and IdGenerator used separate ID counters, causing runtime location creation to reuse IDs already assigned during city generation.

**Example (Seed 100):**
1. City generation: Grid Works created with ID `loc_2`
2. Phase 4: Petrov Industries expands to create Office 0
3. IdGenerator returns `loc_2` (collision!)
4. Office 0 replaces Grid Works in the locations array
5. Alex Andersen still references `loc_2`, but it's now Office 0 instead of Grid Works
6. Workers commute to wrong locations → factories abandoned → production collapses → leaders starve → businesses dissolve

## The Fix

**Part 1: Unified IdGenerator**
- Created `IdState` and `IdGenerator` BEFORE city generation
- Passed `IdGenerator` to `generateCity()` function
- CityGenerator uses the same counter throughout
- Simulation continues from where CityGenerator left off
- **Result**: No more ID collisions possible

**Part 2: Removed Dangerous "Replace If Exists" Logic**
- Removed code that replaced existing locations when ID collision detected
- Simplified to always append (safe now that collisions are prevented)
- **Result**: Even if a collision somehow occurred, it wouldn't silently corrupt state

## Test Results

### Before Fix (Original 8-Seed Test)

| Seed | Business Survival | Businesses Closed | Assessment |
|------|------------------|-------------------|------------|
| 100 | **0%** (0/17) | 17 | ❌ FAILED |
| 200 | **28%** (5/18) | 13 | ❌ FAILED |
| 300 | **32%** (6/19) | 13 | ❌ FAILED |
| 400 | **100%** (20/20) | 0 | ✅ SUCCESS |
| 500 | **33%** (6/18) | 12 | ❌ FAILED |
| 600 | **89%** (17/19) | 2 | ✅ SUCCESS |
| 700 | **100%** (20/20) | 0 | ✅ SUCCESS |
| 800 | **24%** (4/17) | 13 | ❌ FAILED |

**Success Rate: 3/8 (38%)**

---

### After Fix (Same 8 Seeds, 2000 Ticks)

| Seed | Business Survival | Businesses Closed | Pop Survival | Retail Sales | Assessment |
|------|------------------|-------------------|--------------|--------------|------------|
| 100 | **100%** (14/14) | 0 | 99% | 585 (8.2/week) | ✅ STABLE |
| 200 | **100%** (14/14) | 0 | 96% | 603 (8.5/week) | ✅ STABLE |
| 300 | **100%** (16/16) | 0 | 108% | 592 (8.3/week) | ✅ STABLE |
| 400 | **100%** (17/17) | 0 | 94% | 611 (8.6/week) | ✅ STABLE |
| 500 | **100%** (13/13) | 0 | 111% | 592 (8.3/week) | ✅ STABLE |
| 600 | **100%** (15/15) | 0 | 105% | 635 (8.9/week) | ✅ STABLE |
| 700 | **100%** (14/14) | 0 | 97% | 619 (8.7/week) | ✅ STABLE |
| 800 | **100%** (15/15) | 0 | 106% | 604 (8.5/week) | ✅ STABLE |

**Success Rate: 8/8 (100%)**

---

## Key Improvements

### Business Stability
- **Before**: 5/8 seeds had catastrophic business failures (0-33% survival)
- **After**: 8/8 seeds have perfect business stability (0 closures)
- **Improvement**: From 38% → 100% success rate

### Production Continuity
- **Before**: Failed seeds stopped producing food early (phase 96 in seed 100)
- **After**: All seeds maintain continuous production for full 2000 ticks
- **Example (Seed 100)**:
  - Before: 53 provision production events (collapsed at phase 96)
  - After: Continuous production for 71 weeks

### Supply Chain Health
- **Before**: Failed seeds had 0.4-6 retail sales/week (broken supply chains)
- **After**: All seeds have 8.2-8.9 retail sales/week (healthy commerce)
- **Improvement**: 15-20x increase in retail activity

### Population Stability
- **Before**: Not the primary metric (unemployment deaths expected)
- **After**: 94-111% survival rates (stable populations with immigration)

### Economic Health
- All seeds show healthy credit growth (29-34% inflation)
- Healthy food supplies (10-23 provisions per agent)
- Active employment markets (1500-1800 hires/fires)
- Entrepreneurship working (9-12 new businesses created)

---

## Specific Example: Seed 100

### Before Fix
```
Phase 1: Alex Andersen hired at Grid Works
Phase 4: Office 0 created with ID "loc_2" (COLLISION!)
Phase 4: Grid Works replaced by Office 0 in locations array
Phase 19: Alex commutes to "loc_2" → Arrives at Office 0 ❌ WRONG!
Phase 96: Grid Works has no workers → Production stops
Phase 406: All business leaders starve → All businesses dissolve
Result: 0% business survival
```

### After Fix
```
Phase 1: Alex Andersen hired at Grid Works (loc_2)
Phase 4: Office 0 created with ID "loc_158" (UNIQUE!)
Phase 19: Alex commutes to Grid Works (loc_2) ✅ CORRECT!
Phase 2000: Grid Works still producing → Supply chains functional
Result: 100% business survival, 99% population survival
```

---

## Conclusion

The ID collision bug was THE root cause of business failures in NeoArcology. By unifying the ID generation system:

1. **Workers now commute to correct workplaces** (no more wrong-location bugs)
2. **Factories maintain consistent workforce** (no more abandonment)
3. **Production remains continuous** (no more early collapse)
4. **Supply chains function normally** (factories → shops → agents)
5. **Business leaders don't starve** (food available)
6. **Businesses survive long-term** (0 closures in all seeds)

**The simulation is now stable and functioning as designed.**

---

## Files Changed

### Core Changes
- `src/generation/CityGenerator.ts`: Removed module-level ID counters, added `idGen` parameter
- `src/simulation/Simulation.ts`: Creates IdGenerator before city generation
- `src/simulation/systems/OrgBehaviorSystem.ts`: Removed dangerous "replace if exists" logic

### Helper Functions Updated
- All `createOrgFromTemplate()` calls: Added `idGen` parameter
- All `createLocationFromTemplate()` calls: Added `idGen` parameter
- All `createPublicLocation()` calls: Added `idGen` parameter

---

## Technical Notes

### Why "Replace If Exists" Logic Existed

The original code checked for ID collisions and replaced locations when detected:
```typescript
const locationExists = updatedLocations.some(loc => loc.id === newLocation.id);
if (locationExists) {
  updatedLocations = updatedLocations.map(loc =>
    loc.id === newLocation.id ? newLocation : loc  // REPLACE!
  );
}
```

This was commented as "orphaned purchase" logic, but:
1. It never actually implemented orphaned location purchasing
2. It created a dangerous silent corruption when collisions occurred
3. With unified IdGenerator, collisions are impossible, so check is unnecessary

### Reproducibility Maintained

The fix maintains deterministic simulation behavior:
- Same seed produces identical city layout
- Same seed produces identical runtime behavior
- IdState is part of SimulationState for proper serialization
- All random number generation still uses seeded RNG

### No Backward Compatibility Issues

This is a bugfix, not a feature change:
- Old saves won't work (but they were broken anyway)
- Tests will need baseline updates (but old baselines were measuring buggy behavior)
- Configuration files unchanged (no gameplay tuning needed)
