# PLAN-DRAFT: Agent Behavior System Refactor

**Status:** draft
**Priority:** TBD
**Dependencies:** None (refactor of existing code)
**Phase:** TBD

## Goal

Replace the current if-statement chain in `processAgentEconomicDecision()` with a structured, data-driven behavior selection system.

## Problem Statement

Currently, agent decisions are a series of if-statements:

```typescript
if (emergencyHunger) { ... }
if (isHungry && hasNoFood) { ... }
if (employedAt && notAtWork) { ... }
if (unemployed) { ... }
if (wealthy) { ... }
if (idle && notAtPublicSpace) { ... }
```

This works fine for ~6 behaviors but becomes unwieldy as complexity grows:
- Hard to see priority order at a glance
- Conditions scattered across 200+ lines
- No easy way to add weighted decisions
- Difficult to test individual behaviors in isolation

## Trigger Condition

Consider implementing when ANY of these are true:
- More than 10 distinct agent behaviors
- Need for weighted/utility-based decisions
- Behaviors need to interrupt each other mid-execution
- Multiple behavior "modes" (e.g., combat mode vs economic mode)

## Proposed Solution: Priority Behavior List

Extract behaviors into a declarative list with explicit priorities:

```typescript
interface Behavior {
  id: string;
  priority: number;  // Higher = checked first
  condition: (agent: Agent, ctx: Context) => boolean;
  execute: (agent: Agent, ctx: Context) => Agent;
  interruptible?: boolean;  // Can be interrupted by higher priority?
}

const AGENT_BEHAVIORS: Behavior[] = [
  {
    id: 'emergency_hunger',
    priority: 100,
    condition: (a, ctx) => a.needs.hunger > 80 && !hasFood(a),
    execute: (a, ctx) => seekNearestFood(a, ctx),
  },
  {
    id: 'restock_shop',
    priority: 90,
    condition: (a, ctx) => isShopOwner(a, ctx) && shopNeedsRestock(a, ctx),
    execute: (a, ctx) => restockFromWholesale(a, ctx),
  },
  // ... etc
];

function selectBehavior(agent: Agent, ctx: Context): Behavior | null {
  return AGENT_BEHAVIORS
    .sort((a, b) => b.priority - a.priority)
    .find(b => b.condition(agent, ctx)) ?? null;
}
```

## Benefits

1. **Explicit priorities** - Single array shows decision order
2. **Testable** - Each behavior can be unit tested in isolation
3. **Extensible** - Add new behaviors by adding to array
4. **Data-driven** - Could load behaviors from config (future)
5. **Debuggable** - Easy to log "Agent X chose behavior Y because Z"

## Alternative: Utility AI

For more nuanced decisions, score each behavior and pick highest:

```typescript
interface UtilityBehavior {
  id: string;
  score: (agent: Agent, ctx: Context) => number;  // 0-100
  execute: (agent: Agent, ctx: Context) => Agent;
}

// Example: hunger score increases as hunger increases
score: (a) => a.needs.hunger  // Returns 0-100 based on hunger level
```

This allows weighted decisions like "I'm pretty hungry (60) but the shop is far (adds -20) and I'm almost at work (+10 to stay on task)".

**Recommendation**: Start with Priority List, migrate to Utility AI only if needed.

## Objectives

- [ ] Create `src/simulation/ai/BehaviorSystem.ts`
- [ ] Define `Behavior` interface
- [ ] Extract existing behaviors into declarative array
- [ ] Create `selectBehavior()` function
- [ ] Add behavior context object (avoids repeated lookups)
- [ ] Migrate `processAgentEconomicDecision()` to use new system
- [ ] Add debug logging for behavior selection
- [ ] Unit tests for individual behaviors

## Key Files

| File | Change |
|------|--------|
| `src/simulation/ai/BehaviorSystem.ts` | New - behavior definitions and selection |
| `src/simulation/systems/EconomySystem.ts` | Refactor to use BehaviorSystem |

## Non-Goals (Defer)

- Behavior trees (overkill for current needs)
- GOAP / planning systems
- Multi-step action sequences
- Learning / adaptive behaviors
- Loading behaviors from JSON config

## Notes

- Keep it simple - this is a refactor, not a new feature
- Behaviors should remain pure functions (no side effects except returning new agent state)
- Activity logging stays in behaviors, not in the selection system
- Consider adding a "current behavior" field to Agent for debugging (optional)
