# PLAN-035: Separate Simulation State from Derived Metrics

**Status:** planned
**Priority:** P1 (high)
**Dependencies:** PLAN-032 (cleaner after splitting systems)

## Goal

Remove analytics/derived metrics from entity state to create clean separation between simulation state and computed metrics.

## Problem

**Current architecture mixes concerns:**

```typescript
interface Location {
  // Simulation state (core)
  id: string;
  name: string;
  inventory: Inventory;
  tags: string[];

  // Derived metrics (analytics) - SHOULD NOT BE HERE
  weeklyRevenue: number;
  weeklyCosts: number;
  profitMargin: number;
}

interface Org {
  // Simulation state
  id: string;
  leader: AgentRef;
  wallet: Wallet;

  // Derived metrics - SHOULD NOT BE HERE
  totalRevenue: number;
  totalExpenses: number;
}
```

**Problems:**
1. **Serialization bloat**: Saving state includes recalculable data
2. **Inconsistency risk**: Metrics can get out of sync with reality
3. **Performance waste**: Metrics recalculated every tick but stored in every entity
4. **Mixed concerns**: Simulation logic and analytics tangled together
5. **Hard to extend**: Adding new metrics requires modifying entity types

## Objectives

- [ ] Remove derived fields from entity interfaces
  ```typescript
  // Location.ts - REMOVE these fields
  interface Location {
    - weeklyRevenue: number;
    - weeklyCosts: number;
    - profitMargin: number;
  }

  // Org.ts - REMOVE these fields
  interface Org {
    - totalRevenue: number;
    - totalExpenses: number;
  }
  ```

- [ ] Create separate analytics layer
  ```typescript
  // NEW: src/simulation/analytics/EntityMetrics.ts
  interface LocationMetrics {
    locationId: LocationRef;
    weeklyRevenue: number;
    weeklyCosts: number;
    profitMargin: number;
  }

  interface OrgMetrics {
    orgId: OrgRef;
    totalRevenue: number;
    totalExpenses: number;
  }

  interface MetricsSnapshot {
    phase: number;
    locations: Map<LocationRef, LocationMetrics>;
    orgs: Map<OrgRef, OrgMetrics>;
  }
  ```

- [ ] Create metrics calculator
  ```typescript
  // NEW: src/simulation/analytics/MetricsCalculator.ts
  export class MetricsCalculator {
    calculateLocationMetrics(
      location: Location,
      transactions: Transaction[]
    ): LocationMetrics {
      // Calculate from transaction history
    }

    calculateOrgMetrics(
      org: Org,
      transactions: Transaction[]
    ): OrgMetrics {
      // Calculate from transaction history
    }
  }
  ```

- [ ] Track transactions for metric calculation
  ```typescript
  // Option A: Store transactions in simulation state
  interface WorldState {
    transactions: Transaction[]; // Rolling window (last 56 phases = 1 week)
  }

  // Option B: Metrics tracks transactions internally
  interface SimulationMetrics {
    recentTransactions: Transaction[];
    addTransaction(txn: Transaction): void;
  }
  ```

- [ ] Update UI to query metrics layer
  ```typescript
  // BEFORE: Direct access to entity fields
  const revenue = location.weeklyRevenue;

  // AFTER: Query from metrics
  const metrics = metricsCalculator.calculateLocationMetrics(location, transactions);
  const revenue = metrics.weeklyRevenue;
  ```

- [ ] Update systems to stop setting derived fields
  - Remove all `weeklyRevenue +=` assignments
  - Remove all `profitMargin =` calculations
  - Let analytics layer compute from transactions

- [ ] Add on-demand metrics caching
  ```typescript
  class MetricsCache {
    private cache = new Map<string, MetricsSnapshot>();

    getLocationMetrics(locationId: string, phase: number): LocationMetrics {
      const cacheKey = `${locationId}:${phase}`;
      if (!this.cache.has(cacheKey)) {
        this.cache.set(cacheKey, this.calculate(locationId, phase));
      }
      return this.cache.get(cacheKey)!;
    }

    invalidate(phase: number) {
      // Clear old snapshots
    }
  }
  ```

## Files to Modify

| File | Changes |
|------|---------|
| `src/types/Location.ts` | Remove `weeklyRevenue`, `weeklyCosts`, `profitMargin` |
| `src/types/Org.ts` | Remove `totalRevenue`, `totalExpenses` |
| `src/simulation/analytics/EntityMetrics.ts` | NEW - Metric type definitions |
| `src/simulation/analytics/MetricsCalculator.ts` | NEW - Calculate metrics from state |
| `src/simulation/analytics/MetricsCache.ts` | NEW - Cache calculated metrics |
| `src/types/WorldState.ts` | Add `transactions: Transaction[]` or use Metrics |
| `src/ui/components/*.tsx` | Update to query metrics instead of entity fields |
| `src/simulation/systems/*.ts` | Remove assignments to derived fields |

## Transaction Tracking

To calculate metrics, we need transaction history:

```typescript
interface Transaction {
  phase: number;
  type: 'sale' | 'wage' | 'rent' | 'dividend' | 'purchase';
  from: EntityRef;
  to: EntityRef;
  amount: number;
  goods?: { type: GoodsType; quantity: number };
  locationId?: LocationRef; // For location-level metrics
}

// Add transaction to history
function recordTransaction(state: WorldState, txn: Transaction): WorldState {
  return {
    ...state,
    transactions: [...state.transactions, txn].slice(-56 * 100), // Keep last week per entity
  };
}
```

## Migration Strategy

1. Add `transactions` array to WorldState
2. Update all payment functions to record transactions
3. Create MetricsCalculator with calculation logic
4. Create MetricsCache for performance
5. Update UI to use calculated metrics
6. Remove derived fields from entity types
7. Verify all systems still work

## Benefits

- **Clean state model**: Simulation state is minimal and serializable
- **Recalculable metrics**: Can recompute any metric from transaction log
- **Event sourcing foundation**: Transactions provide audit trail
- **Performance**: Cache only what's needed, when needed
- **Extensibility**: Add new metrics without changing entity types

## Success Criteria

- No derived/computed fields in Location, Org, or Agent types
- All metrics calculated on-demand from transaction history
- UI displays same metrics as before (verified visually)
- Performance is equal or better (verify with profiling)
- State snapshots are smaller (less data to serialize)
