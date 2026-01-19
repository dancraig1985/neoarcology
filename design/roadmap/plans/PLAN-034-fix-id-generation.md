# PLAN-034: Fix ID Generation for Reproducibility

**Status:** planned
**Priority:** P0 (critical)
**Dependencies:** PLAN-033 (need context for passing ID state)

## Goal

Move ID generation from global module-level counters into WorldState to ensure seeded simulations are fully reproducible.

## Problem

**Current architecture breaks reproducibility:**

```typescript
// EconomySystem.ts (module-level state)
let shopNameIndex = 0;
let pubNameIndex = 0;
let boutiqueNameIndex = 0;
let locationIdCounter = 1;
let orgIdCounter = 100;
let goodsOrderIdCounter = 0;

// OrgBehaviorSystem.ts
let apartmentNameIndex = 0;
let locationIdCounter = 10000;
```

**Why this breaks seeded RNG:**
- Even with identical seed, execution order affects ID sequences
- If system A runs before system B in one run but after in another, IDs differ
- Module-level state persists across test runs (not reset between tests)
- Multiple simulations can't run concurrently (IDs collide)

**Real example:**
```bash
npm run sim:test -- --seed 42  # Location IDs: 1, 2, 3, 10000, 10001
npm run sim:test -- --seed 42  # Location IDs: 4, 5, 6, 10002, 10003 (different!)
```

## Objectives

- [ ] Add ID generation state to `WorldState`
  ```typescript
  interface WorldState {
    // ... existing fields
    idState: {
      nextLocationId: number;
      nextOrgId: number;
      nextGoodsOrderId: number;
      nextVehicleId: number;
      nextAgentId: number;
      nameCounters: {
        shop: number;
        pub: number;
        boutique: number;
        apartment: number;
        // ... other named entity types
      };
    };
  }
  ```

- [ ] Create `IdGenerator` utility
  ```typescript
  export class IdGenerator {
    constructor(private state: WorldState['idState']) {}

    nextLocationId(): string {
      return `loc_${this.state.nextLocationId++}`;
    }

    nextOrgId(): string {
      return `org_${this.state.nextOrgId++}`;
    }

    nextShopName(): string {
      return `Shop ${this.state.nameCounters.shop++}`;
    }

    // ... other ID generators
  }
  ```

- [ ] Update SimulationContext to include IdGenerator
  ```typescript
  interface SimulationContext {
    metrics: SimulationMetrics;
    activityLog: ActivityLog;
    config: LoadedConfig;
    rng: () => number;
    idGen: IdGenerator; // NEW
  }
  ```

- [ ] Update all systems to use `context.idGen` instead of module counters
  - EconomySystem: Remove 6 module-level counters
  - OrgBehaviorSystem: Remove 2 module-level counters
  - Any other systems with ID generation

- [ ] Initialize ID state in CityGenerator
  ```typescript
  const worldState: WorldState = {
    // ... existing initialization
    idState: {
      nextLocationId: 1,
      nextOrgId: 100,
      nextGoodsOrderId: 1,
      nextVehicleId: 1,
      nextAgentId: 1,
      nameCounters: {
        shop: 0,
        pub: 0,
        boutique: 0,
        apartment: 0,
      },
    },
  };
  ```

- [ ] Verify reproducibility
  - Run same seed twice, compare full state snapshots
  - All IDs must match exactly
  - Add test: `verifyReproducibility(seed: number, ticks: number)`

## Files to Modify

| File | Changes |
|------|---------|
| `src/types/WorldState.ts` | Add `idState` field |
| `src/simulation/IdGenerator.ts` | NEW - ID generation utility |
| `src/types/Context.ts` | Add `idGen: IdGenerator` to SimulationContext |
| `src/simulation/Simulation.ts` | Create IdGenerator from worldState.idState |
| `src/simulation/systems/EconomySystem.ts` | Remove 6 module counters, use context.idGen |
| `src/simulation/systems/OrgBehaviorSystem.ts` | Remove 2 module counters, use context.idGen |
| `src/generation/CityGenerator.ts` | Initialize idState in initial WorldState |
| `scripts/test-simulation.ts` | Add reproducibility verification test |

## Migration Strategy

1. Add `idState` to WorldState type
2. Create IdGenerator class
3. Initialize idState in CityGenerator
4. Add idGen to SimulationContext
5. Update EconomySystem (largest user of IDs)
6. Update OrgBehaviorSystem
7. Update any other systems with ID generation
8. Remove all module-level ID counters
9. Run reproducibility test: `npm run sim:test -- --seed 42 --verify-reproducibility`

## Reproducibility Test

```typescript
function testReproducibility(seed: number, ticks: number) {
  const run1 = runSimulation(seed, ticks);
  const run2 = runSimulation(seed, ticks);

  // Compare full state snapshots at end
  assert.deepEqual(run1.state, run2.state, 'States must match exactly');

  // Compare all IDs generated
  const ids1 = extractAllIds(run1.state);
  const ids2 = extractAllIds(run2.state);
  assert.deepEqual(ids1, ids2, 'All IDs must match');

  console.log('✓ Reproducibility verified');
}
```

## Benefits

- **Full reproducibility**: Same seed = identical simulation
- **Debuggable**: Can replay exact bug scenarios
- **Testable**: Unit tests can create predictable IDs
- **Concurrent simulations**: No global state collisions
- **Clear state**: ID generation state is explicit in WorldState

## Success Criteria

- No module-level ID counters remain
- Running `--seed 42` twice produces identical state
- All IDs are deterministic given initial seed
- Test suite includes reproducibility verification
