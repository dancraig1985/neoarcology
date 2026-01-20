# Food Supply Crisis Analysis - January 19, 2026

## Executive Summary

**Every death in the simulation is an employed agent with income.** The problem is NOT unprofitable businesses or unaffordable food. The problem is a **food supply chain collapse** caused by workers not showing up at factories.

### Critical Finding

**100% of deaths are employed agents** (144 deaths in seed 100, all while employed by orgs). This includes:
- 55% business owners
- 45% regular employees

Business owners and workers are starving **despite having income** because:
1. Factory workers don't show up to work
2. Factories stop producing after phase 42 (~week 1)
3. Shops run out of inventory by phase 123 (~week 2)
4. Agents buy last available food by phase 188 (~week 3)
5. Everyone starves over the next 300+ phases with zero food supply

---

## The Math Actually Works

### Food Affordability Calculation

**Cost of food:**
- 1 provision costs 20 credits (retail)
- Agents buy in bulk: 5 provisions for 100 credits
- Eating frequency: ~57 phases (≈1 week)
- **Food cost: 20 credits/week**

**Income:**
- Unskilled salary: 50-70 credits/week
- **Food takes 28-40% of income**
- Remaining: 30-50 credits/week for housing, leisure, etc.

**This is sustainable!** Agents can afford food on their salaries.

### Observed Behavior (Seed 100, Agent: Jordan Andersen)

- Phase 1: Ate (2→1 provisions)
- Phase 58: Ate (1→0)
- Phase 116: **Bought 5 for 100 credits** at Synth Supply
- Phase 117-345: Ate regularly every ~57 phases
- Phase 345: Ate last provision (1→0)
- **Phase 345-570: No food available anywhere**
- Phase 570: **Died of starvation** (hungry for 225 phases / 4 weeks)

**He had income, he had money, but there was no food to buy.**

---

## Supply Chain Breakdown Timeline

### Phase 0-42: Production Phase
- Factories spawn with workers
- Production happens: "2 workers produced 2 provisions (every 2 phases)"
- Example: Apex Manufacturing, Grid Works producing regularly

### Phase 42+: Production Stops
```
• Phase 50 [Synth Industries] 2 workers employed but none present - no production this phase
```

**Workers are employed but not at work.** This is a behavior priority issue.

### Phase 117-123: Last Wholesale Restocking
```
• Phase 117 [Jordan Sterling's Shop] bought 18 provisions from Storage Warehouse for 54 credits
• Phase 123 [Jordan Yamamoto's Restaurant] bought 9 provisions from Storage Warehouse for 27 credits
```

Shops deplete warehouse inventory trying to restock.

### Phase 188: Last Retail Purchase
```
• Phase 188 [Blake Okonkwo] bought 5 provisions for 100 credits at Sector Seven
```

After this, **zero provision purchases** for remaining 1812 ticks.

### Phase 190-2000: Famine
- Factory inventory: 0 provisions
- Shop inventory: 0 provisions
- Agent inventory: 56 provisions total (for 54 living agents = 1.0 per agent)
- **Mass starvation** as agents exhaust personal reserves

---

## Why Workers Don't Show Up

### Evidence from Logs

**Phase 50 example:**
```
• Phase 50 [Office 2] 1 workers employed but none present - no production this phase
• Phase 50 [Synth Industries] 2 workers employed but none present - no production this phase
```

### Possible Causes

1. **Behavior priority hierarchy**
   - Workers may prioritize travel, seeking food, leisure over going to work
   - Once hungry, may be stuck seeking food that doesn't exist
   - Can't reach workplace due to travel/distance

2. **Fatigue forcing rest**
   - Fatigue increases 1.785/phase (very fast)
   - Force rest threshold: 100
   - Time to exhaustion: 100/1.785 = 56 phases (1 week)
   - If workers must rest every week and rest takes time, work attendance drops

3. **Task completion requirements**
   - Behaviors may not release until completion
   - Workers get stuck in non-work tasks

4. **Location/travel issues**
   - Workers can't reach factories due to distance
   - Travel system may be blocking work attendance

### Need to Investigate

Check `data/config/behaviors.json` for:
- Work behavior priority level
- Conditions that interrupt work
- Whether hunger/fatigue override employment behavior

---

## Profit Margins Are Actually Fine

### Evidence

**Zero bankruptcies** across all simulations:
- 662 business closures total
- 100% due to "leader died", 0% due to bankruptcy
- Businesses survive for hundreds of phases while paying wages and dividends

### Business Revenue (Early Phases)

From logs:
```
• Phase 16 [Jordan Sterling] received 75 credits from Jordan Sterling's Shop
• Phase 16 [Harper Sterling] paid 66 credits by Jordan Sterling's Shop
• Phase 25 [Grey Dubois] received 75 credits from Grey Dubois's Shop
• Phase 36 [Ellis Okafor] paid 67 credits by Dana Singh's Shop
```

- **Owners receive 75 credits/week dividend**
- **Employees receive 50-70 credits/week salary**
- **Operating costs: 0 credits** (likely low or covered by revenue)

This demonstrates healthy profit margins early in the simulation.

### Why Businesses Eventually Dissolve

**Not because of financial failure**, but because:
1. Leader runs out of food
2. Leader starves
3. Org dissolves immediately (no succession in most cases)
4. Sometimes succession happens, but new leader also starves

Example:
```
• Phase 298 [Jordan Sterling] died of starvation
• Phase 352 [Harper Sterling] became new leader of Jordan Sterling's Shop
• Phase 408 [Jordan Sterling] became new leader again (???)
```

Succession system exists but can't save businesses when there's no food supply.

---

## Why Housing Dominates Business Creation

**Housing demand is artificially high** because:
1. Agents keep dying and being replaced
2. New agents need housing
3. Housing scores 20-50+ in demand analysis
4. Retail/wholesale scores only 3-10

But this is a **symptom**, not the root cause. If agents weren't starving:
- Population would stabilize
- Housing demand would drop
- Business diversity would improve naturally

---

## The Fatal Cascade

```
1. Workers don't attend factory jobs
   ↓
2. Factories stop producing provisions (phase 42)
   ↓
3. Shops can't restock (phase 123)
   ↓
4. Agents can't buy food (after phase 188)
   ↓
5. Agents starve despite having income
   ↓
6. Business owners die
   ↓
7. Businesses dissolve (even profitable ones)
   ↓
8. More unemployment
   ↓
9. Housing demand stays high due to churn
   ↓
10. New entrepreneurs open apartments (not shops)
   ↓
11. Food supply never recovers
```

**Break this cascade by fixing step 1: Get workers to show up at factories.**

---

## Recommendations (Priority Order)

### Priority 1: Fix Worker Attendance ⚠️ CRITICAL

**Investigation needed:**
1. Check behavior priorities in `behaviors.json`
2. Ensure "work" behavior has high priority (not interrupted by idle tasks)
3. Verify fatigue doesn't force constant rest
4. Check if travel distance prevents factory attendance

**Possible fixes:**
- Increase work behavior priority to "high" (same as food seeking)
- Add condition: "if employed, go to work unless hunger > 80"
- Reduce fatigue accumulation rate (from 1.785 to ~0.8)
- Add "commute" behavior that brings workers to workplace at start of week

**Test after fix:**
- Run 100 ticks
- Check: "X workers produced Y provisions" logs appear regularly
- Check: Factory inventory stays > 0
- Check: Shops can restock successfully

---

### Priority 2: Add Production Monitoring/Alerts

**Config-based solution:**
Add to `simulation.json`:
```json
{
  "alerts": {
    "factoryNoProduction": {
      "enabled": true,
      "threshold": 10,
      "message": "Factory {name} has workers but no production for {phases} phases"
    },
    "foodSupplyLow": {
      "enabled": true,
      "threshold": 50,
      "message": "Total provisions below {threshold} ({current} available)"
    }
  }
}
```

This helps diagnose supply issues during development.

---

### Priority 3: Emergency Food Distribution

**Fallback system** if production fails:
- Government/system provides basic provisions when supply < 0.5 per agent
- Prevents total famine from cascading
- Buys time to fix root cause

**Implementation:**
- Check total provisions every week (phase % 56 == 0)
- If provisions < (alive_agents * 0.5), spawn provisions at public shelters
- Log: "Emergency food distribution: {amount} provisions"

This is a **safety net**, not a solution. Still need to fix worker attendance.

---

### Priority 4: Fix Housing Market Dominance

**After fixing food supply**, address business diversity:

**Option A: Add housing market saturation** (DemandAnalyzer.ts)
```typescript
// Calculate apartments per capita
const livingAgents = agents.filter(a => a.status !== 'dead').length;
const apartments = locations.filter(loc => loc.tags.includes('residential')).length;
const apartmentsPerCapita = apartments / livingAgents;

// Target: 0.5 apartments per agent (1 apt per 2 agents)
// Apply penalty when exceeding target
const housingS aturation = apartmentsPerCapita / 0.5;
const saturationPenalty = housingsat > 1 ? (housingSaturation - 1) * 15 : 0;

finalScore = housingDemand - saturationPenalty;
```

**Option B: Boost retail/wholesale opportunity scores**
- Multiply retail demand scores by 2-3x
- Gives shops competitive chance against apartments

---

### Priority 5: Add Corporate Succession (Long-term)

**Prevent business dissolution** when leader dies:
1. When org has >2 employees, promote senior employee to leader
2. Don't dissolve org immediately
3. Transfer ownership of locations to new leader

This prevents profitable businesses from disappearing due to leadership mortality.

---

## Configuration Tuning Suggestions

### agents.json
```json
{
  "fatigue": {
    "perPhase": 0.8,  // REDUCE from 1.785 (currently too fast)
    "urgentRestThreshold": 90,
    "forceRestThreshold": 100
  }
}
```
**Rationale**: Current fatigue rate forces rest too often, interfering with work.

### behaviors.json
Ensure work behavior has appropriate priority:
```json
{
  "id": "working",
  "priority": "high",  // Must match food-seeking priority
  "conditions": {
    "hasEmployment": true,
    "needsBelow": { "hunger": 80 }  // Only skip work if starving
  },
  "completionConditions": {
    "phasesPassed": 56  // Complete after 1 work week
  }
}
```

---

## Testing Protocol

### Test 1: Worker Attendance (100 ticks)
**Success criteria:**
- ✓ Factory production logs every ~2 phases
- ✓ "2 workers produced 2 provisions" messages regular
- ✓ Factory inventory increases
- ✓ Shops can successfully restock

### Test 2: Food Supply Stability (500 ticks)
**Success criteria:**
- ✓ Total provisions > 0.5 per agent at all times
- ✓ Agents continue purchasing food regularly
- ✓ Zero starvation deaths among employed agents
- ✓ Shops maintain non-zero inventory

### Test 3: Economic Health (1000 ticks)
**Success criteria:**
- ✓ <10% of employed agents die from starvation
- ✓ Business diversity improves (>10% non-apartment businesses)
- ✓ Factories survive for 500+ phases
- ✓ Population stabilizes within ±20%

### Test 4: Long-term Stability (2000 ticks)
**Success criteria:**
- ✓ Food supply chain maintains throughout
- ✓ Business closures primarily due to succession/competition, not starvation
- ✓ Multiple businesses of each type exist
- ✓ Employment rate > 60%

---

## Data Quality & Methods

### Simulations Run
- **Seeds tested**: 100 (detailed), 200-800 (aggregate)
- **Ticks**: 2000 per simulation
- **Total deaths analyzed**: 2,210 across all seeds, 144 in seed 100 (detailed trace)

### Analysis Methods
- **grep patterns** to track production, purchases, deaths
- **Timeline reconstruction** of supply chain breakdown
- **Individual agent tracking** (Jordan Andersen case study)
- **Financial analysis** of costs vs income

### Key Metrics Observed
- **Food cost**: 20 credits/week (affordable)
- **Salary**: 50-70 credits/week (sufficient)
- **Production stoppage**: Phase 42
- **Last retail purchase**: Phase 188
- **Profit margins**: Healthy (75 cr/week dividends, 0 cr operating costs)

---

## Conclusion

**The economy is NOT failing due to unprofitable businesses.** Businesses are making money and agents can afford food.

**The economy IS failing due to supply chain collapse.** Workers aren't attending factory jobs, causing production to stop, leading to famine.

### Root Cause
Worker behavior doesn't prioritize employment attendance. Factories have workers but workers aren't physically present to produce goods.

### Solution Path
1. Fix worker attendance (behavior system)
2. Verify production resumes (factory logs)
3. Confirm food supply stabilizes
4. Then address business diversity (housing saturation)
5. Long-term: add corporate succession

### Effort Estimate
- **Worker attendance fix**: 4-6 hours (behavior investigation + tuning)
- **Testing**: 2 hours (automated test suite)
- **Housing saturation**: 2-3 hours (if needed after food fix)
- **Total**: ~1-2 days to stabilize food supply

**Once workers show up to factories, the entire economic cascade resolves naturally.**
