# Production System

Production transforms labor into goods. Factories produce provisions that flow through the supply chain to consumers.

## Key Files
- `src/simulation/systems/OrgSystem.ts` - `processFactoryProduction()`
- `data/templates/locations/factory.json` - Production configuration
- `src/config/ConfigLoader.ts` - `ProductionConfig` interface

## Production Model

Production is **labor-dependent**:
```
Production = Employees × AmountPerEmployee (when cycle triggers)
```

No employees = no production (factory sits idle).

## Production Configuration

From location template:
```json
{
  "production": [
    {
      "good": "provisions",
      "amountPerEmployee": 2,
      "phasesPerCycle": 1
    }
  ]
}
```

### Fields
- `good` - What goods type is produced
- `amountPerEmployee` - Units produced per worker per cycle
- `phasesPerCycle` - How often production runs:
  - `1` = every phase
  - `4` = every day (4 phases/day)
  - `28` = every week (28 phases/week)

## Multi-Good Production

Factories can produce multiple goods with different rates:
```json
{
  "production": [
    { "good": "provisions", "amountPerEmployee": 2, "phasesPerCycle": 1 },
    { "good": "electronics", "amountPerEmployee": 1, "phasesPerCycle": 4 }
  ]
}
```

Each production config is processed independently.

## Production Processing

Called each tick in `Simulation.tick()`:
```typescript
updatedLocations = updatedLocations.map((loc) => {
  const template = config.locationTemplates[loc.template];
  return processFactoryProduction(
    loc,
    template?.balance.production,
    phase,
    goodsSizes
  );
});
```

### Algorithm
```typescript
function processFactoryProduction(location, productionConfig, phase, goodsSizes) {
  // No production config = not a producer
  if (!productionConfig) return location;

  const employeeCount = location.employees.length;

  // No workers = no production
  if (employeeCount === 0) {
    // Log warning: "no workers - production halted"
    return location;
  }

  for (const config of productionConfig) {
    // Check if this phase is a production cycle
    if (phase % config.phasesPerCycle !== 0) continue;

    // Check capacity
    const capacity = getAvailableCapacity(location, goodsSizes);
    if (capacity <= 0) {
      // Log warning: "at capacity, production halted"
      continue;
    }

    // Calculate production
    const amount = employeeCount * config.amountPerEmployee;

    // Add to inventory (respects capacity)
    const { holder, added } = addToInventory(location, config.good, amount, goodsSizes);
    location = holder;

    // Log production
  }

  return location;
}
```

## Production Economics

### Current Factory Setup
- 2 employee slots
- 2 provisions per employee per phase
- Total: 4 provisions/phase = 16/day = 112/week

### Demand
- 21 agents eating ~1/day = ~21/week consumption
- Production far exceeds demand (by design, for stability)

### Balance
Factory produces excess inventory, which accumulates until:
- Shops buy it (wholesale)
- Capacity limit reached (500 provisions)

## Capacity Limits

Production respects inventory capacity:
- Factory capacity: 500 units
- Provisions size: 0.1
- Max provisions: 5000

When at capacity, production halts with warning log.

## Labor Market

### Workers for Factory
Factory needs workers hired via `tryGetJob()`:
1. Unemployed agent finds hiring location
2. Factory has `employeeSlots: 2`
3. Agent hired with salary 20-40/week
4. Production scales with employee count

### No Workers = No Production
If factory can't attract/retain workers:
- Production drops to 0
- Shops can't restock
- Agents starve

This creates economic feedback loop.

## Supply Chain Flow

```
FACTORY                SHOPS                 AGENTS
┌─────────┐           ┌─────────┐           ┌─────────┐
│ PRODUCE │ ─────────►│ RESTOCK │ ─────────►│PURCHASE │
│ 4/phase │ wholesale │when <15 │  retail   │ when    │
│         │  @7 each  │ buy 30  │  @15 each │ hungry  │
└─────────┘           └─────────┘           └─────────┘
     │                     │                     │
     ▼                     ▼                     ▼
 inventory            inventory              eat food
 increases            fluctuates             hunger→0
```

## Key Invariants

1. Production only happens at locations with `production` config
2. No employees = no production
3. Production respects capacity limits
4. Cycle timing uses modulo: `phase % phasesPerCycle === 0`
5. Each good in production array is processed independently
6. Goods are created from nothing (value creation)
