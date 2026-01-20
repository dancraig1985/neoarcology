# Hiring Metrics Fix - January 20, 2026

## Problem Statement

During economic analysis, all simulation reports showed **"Hires: 0"** despite visible "hired at" events in the logs. This made it appear that job seeking was completely broken.

---

## Investigation Results

### Discovery: Hiring WAS Working!

**Seed 400 analysis (2000 ticks)**:
- Log events: 966 "hired at" messages
- Metrics report: "Hires: 0" ← **WRONG!**
- Timeline: Continuous hiring from phase 1 → phase 1997
- Post-initialization: 876 hires after phase 500 (91% of total)

**Conclusion**: Job seeking behavior works perfectly. The problem was purely a metrics tracking bug.

---

## Root Cause

File: `src/simulation/behaviors/executors/index.ts`
Function: `executeSeekJobBehavior` (lines 755-846)

The seek_job executor:
- ✅ Evaluated conditions correctly
- ✅ Found job openings
- ✅ Updated agent employment status
- ✅ Updated location employees array
- ✅ Logged hiring events to ActivityLog
- ❌ **Never called `recordHire(metrics)`**

Compare to `LocationSystem.ts:hireAgent()` which properly calls `recordHire()` at line 240.

---

## Additional Issues Found

### Issue 2: Not Using setEmployment() Helper

The executor manually set employment fields:
```typescript
const updatedAgent = {
  ...agent,
  status: 'employed' as const,
  employer: ownerOrg.id,
  employedAt: nearestJob.id,
  salary,
};
```

**Problem**: Doesn't clear `shiftState`, which could cause:
- Stale shift state carrying over from previous job
- Incorrect cooldown calculations
- Workers starting mid-shift

**Solution**: Use `setEmployment()` helper which atomically updates all fields AND clears shift state.

---

## Fix Applied

### Changes to `/src/simulation/behaviors/executors/index.ts`

**1. Added imports** (lines 12-14):
```typescript
import { recordRetailSale, recordBusinessOpened, recordHire } from '../../Metrics';
import { randomInt } from '../../SeededRandom';
import { setEmployment } from '../../systems/AgentStateHelpers';
```

**2. Replaced manual employment assignment** (line 818):
```typescript
// OLD:
const updatedAgent = {
  ...agent,
  status: 'employed' as const,
  employer: ownerOrg.id,
  employedAt: nearestJob.id,
  salary,
};

// NEW:
const updatedAgent = setEmployment(agent, nearestJob.id, ownerOrg.id, salary);
```

**3. Added metrics tracking** (line 838):
```typescript
ActivityLog.info(ctx.phase, 'employment',
  `hired at ${nearestJob.name} for ${salary}/week`,
  agent.id, agent.name
);

// ADDED:
recordHire(ctx.context.metrics);
```

---

## Test Results

### Before Fix (Seed 400, 500 ticks):
```
Hires: 0, Fires: 54
```
(90 actual hiring events in logs - not tracked!)

### After Fix (Seed 400, 500 ticks):
```
Hires: 90, Fires: 54
```
✅ Matches actual hiring events

---

## Benefits

### 1. Accurate Metrics
- Economic reports now show true hiring activity
- Can track hiring rate across different seeds
- Can correlate hiring with population stability

### 2. Proper State Management
- `setEmployment()` clears stale `shiftState`
- New hires start with clean shift tracking
- Prevents cooldown bugs from previous jobs

### 3. Code Consistency
- Now follows same pattern as `LocationSystem.hireAgent()`
- Uses centralized state helpers from `AgentStateHelpers.ts`
- Maintains bidirectional relationships properly

---

## Impact on Economic Analysis

### Previous Confusion
The "Hires: 0" metric made us think:
- Job seeking behavior was broken
- Unemployed agents couldn't find work
- HIGH priority wasn't triggering

### Reality
- ✅ 966 hires in seed 400 (2000 ticks)
- ✅ Continuous hiring throughout simulation
- ✅ Job seeking behavior working perfectly
- ❌ Just not tracked in metrics

---

## Lessons Learned

### 1. Trust Log Events Over Metrics
When logs show activity but metrics don't, suspect metrics tracking rather than the feature itself.

### 2. Use Centralized Helpers
`setEmployment()` and `hireAgent()` exist for a reason - they handle all state updates atomically and consistently.

### 3. Grep is Your Friend
A simple `grep "hired at"` quickly revealed 966 events, contradicting the "Hires: 0" metric.

---

## Related Files

- **Fixed**: `src/simulation/behaviors/executors/index.ts` (seek_job executor)
- **Reference**: `src/simulation/systems/LocationSystem.ts:hireAgent()`
- **Reference**: `src/simulation/systems/AgentStateHelpers.ts:setEmployment()`
- **Reference**: `src/simulation/Metrics.ts:recordHire()`

---

## Future Recommendations

### Consider Refactoring hireAgent()
Currently there are TWO ways to hire agents:
1. `LocationSystem.hireAgent()` - used by some systems
2. `executeSeekJobBehavior()` - used by behavior system

**Proposal**: Make `hireAgent()` work with BehaviorContext so all hiring goes through one function. This would:
- Eliminate code duplication
- Ensure consistent behavior
- Prevent future metrics tracking bugs

### Add Metrics Validation Tests
Create tests that verify metrics match log events:
```typescript
test('recordHire increments hire counter', () => {
  const metrics = createMetrics();
  recordHire(metrics);
  expect(metrics.transactions.hires).toBe(1);
});
```

---

## Conclusion

**The "hiring is broken" issue was a false alarm.** Hiring worked perfectly all along - we just weren't tracking it.

The fix adds 2 lines:
1. `const updatedAgent = setEmployment(...)` - proper state management
2. `recordHire(ctx.context.metrics)` - track the hire

This resolves both the metrics bug and potential shift state issues for newly hired workers.
