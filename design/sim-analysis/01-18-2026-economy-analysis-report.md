# NeoArcology Economy Analysis Report
## 5 x 2000-Tick Tests (Seeds: 42, 100, 200, 300, 400)

---

## Executive Summary

### Overall Health: MODERATE with CRITICAL GAPS
- **Population**: Generally stable (94-116% survival rate)
- **Economy**: Inflationary pressure (16-40% credit growth)
- **Food Supply**: Highly variable (4.8 to 19.4 provisions/agent)
- **Employment**: High churn (1900-2200 fires per run)
- **Critical Issue**: Seed 400 showed signs of economic collapse (food scarcity, population decline)

---

## Test Results Comparison

| Metric | Seed 42 | Seed 100 | Seed 200 | Seed 300 | Seed 400 | Avg |
|--------|---------|----------|----------|----------|----------|-----|
| **Survival Rate** | 106% | 107% | 110% | 116% | **94%** | 107% |
| **Deaths (starvation)** | 169 | 167 | 163 | 159 | **182** | 168 |
| **Population (final)** | 109 | 120 | 128 | 118 | **113** | 118 |
| **Credits/agent** | 927 | 864 | 852 | 894 | 935 | 894 |
| **Food/agent** | 17.6 | 14.4 | 11.1 | 19.4 | **4.8** | 13.5 |
| **Credit inflation** | 27% | 16% | 16% | 20% | 16% | 19% |
| **Retail sales/week** | 11.5 | 12.6 | 13.2 | 11.4 | 13.1 | 12.4 |
| **Wholesale sales/week** | 3.5 | 4.1 | 10.6 | 4.3 | 13.7 | 7.2 |
| **Fires (total)** | 1920 | 1975 | 2232 | 1949 | 2203 | 2056 |
| **Businesses (final)** | 71 | 68 | 89 | 67 | 77 | 74 |

### Key Observations:
1. **Seed 400 is a warning sign**: Food scarcity (4.8/agent), population decline, highest death toll
2. **Massive employment churn**: Average ~2000 fires in 2000 ticks (1 fire per tick!)
3. **Credit inflation**: All runs show 16-40% inflation over 18 months
4. **Food supply volatility**: 4x variance between best and worst runs

---

## Strange/Unrealistic Behaviors

### 1. **CRITICAL: Extreme Employment Churn**
**Observation**: 1900-2200 workers fired over 2000 ticks (~1 per tick)

**Evidence**:
- Seed 200: 2232 fires
- Average agent population: ~120
- This means each agent is fired ~17 times on average over 18 months

**Why unrealistic**:
- In reality, employment relationships last months/years, not days
- Constant hiring/firing suggests deep instability
- No concept of "job security" or employee retention

**Likely cause**:
- Orgs running out of money → can't pay wages → workers quit
- Weekly payroll cycle too aggressive relative to revenue cycles
- No buffer/savings for temporary cash flow issues

### 2. **Production Halts from No Workers**
**Observation**: At phase 2000, 5-7 production facilities have "no workers - production halted"

**Evidence**:
```
⚠️ Phase 2000 [Grid Works] no workers - production halted (need 4 workers)
⚠️ Phase 2000 [Tech Hub] no workers - production halted (need 3 workers)
⚠️ Phase 2000 [Prototyping Facility] no workers - production halted (need 10 workers)
```

**Why unrealistic**:
- Profitable businesses should be able to attract/retain workers
- Mass walkouts don't happen without cause (unpaid wages)
- No hiring system to refill critical roles

**Root cause**:
- Orgs go broke → can't pay → all workers leave → production stops → can't earn revenue → death spiral

### 3. **Many Starving Agents at Endgame**
**Observation**: 10-25 agents starving (hunger >75%) at phase 2000 in every run

**Evidence**:
- Seed 42: 21 agents with hunger >75%
- Seed 400: 13 agents starving, population declining

**Why unrealistic**:
- Food supply is HEALTHY overall (13.5 provisions/agent average)
- Food exists but not reaching starving agents
- Distribution problem, not production problem

**Likely causes**:
- Agents unemployed → no income → can't buy food
- Shops have food but agents broke
- No "emergency food access" (shelters, charity, stealing)

### 4. **Credit Inflation Without Drain**
**Observation**: Total credits grow 16-40% over 18 months in all runs

**Why unrealistic**:
- Real economies need money sinks
- Credits accumulate without major purchases (housing is cheap, no luxuries matter)
- No taxes, asset purchases, or destruction of wealth

**Consequence**:
- Credits become meaningless over time
- No scarcity → no economic pressure

### 5. **Instant Teleportation Still Exists**
**Observation**: Agents still teleport when buying goods

**Evidence**:
- Agent at Location A decides to buy food
- Instantly appears at shop Location B, buys, returns to A
- No travel time, no realistic journey

**Why unrealistic**:
- Breaks immersion
- No cost/time for shopping trips
- No "local economy" effect (agents should prefer nearby shops)

### 6. **No Business Loans or Credit**
**Observation**: Orgs die immediately when cash hits zero

**Why unrealistic**:
- Real businesses use credit lines, loans, delayed payments
- No grace period for temporary cash flow issues
- One bad week = instant death

### 7. **Warehouse Transfers Are Instant**
**Observation**: "Internal transfer: 3 luxury_goods from Vertex Production to Storage Warehouse" happens instantly

**Why unrealistic (debatable)**:
- We explicitly chose this for simplicity (Option A)
- But means no internal logistics, no time cost
- Large corps should have some friction

**Note**: This was a conscious design choice to avoid logistics overflow. Acceptable for now.

---

## System Gaps (Not Working Well)

### GAP 1: **No Hiring System**
**Problem**: Orgs don't actively hire when understaffed

**Evidence**:
- Production facilities sit idle with "no workers"
- No "help wanted" mechanic
- Agents don't seek employment at understaffed locations

**Impact**: Businesses fail not from unprofitability, but from inability to find workers

**Solution needed**: Active hiring behavior (orgs post jobs, unemployed agents apply)

### GAP 2: **No Loan/Credit System**
**Problem**: Orgs die instantly when cash flow is temporarily negative

**Evidence**:
- High business closure rate (6-9 closures per run)
- "not paid by X (insufficient funds)" → workers leave → death spiral

**Impact**: Viable businesses die from short-term cash flow issues

**Solution needed**:
- Credit lines (orgs can go slightly negative)
- Delayed payments (pay wages next week if short this week)
- Bankruptcy grace period (3 weeks of losses before dissolution)

### GAP 3: **No Emergency Food Access**
**Problem**: Unemployed/broke agents have no way to survive

**Evidence**:
- 150-180 starvation deaths per run
- Many agents starving despite healthy overall food supply
- No charity, shelters, or "steal food" fallback

**Impact**: Unrealistic death rate, breaks immersion

**Solution needed**:
- Public shelters (free food, low quality)
- Desperation behaviors (stealing, begging)
- Social safety net

### GAP 4: **No Travel Cost for Shopping**
**Problem**: Agents teleport to shops instantly

**Impact**:
- No "local economy" concept
- Distance doesn't matter
- Unrealistic behavior

**Solution needed**: Use TravelSystem for shopping trips (agents must travel to shop, buy, travel back)

### GAP 5: **Wholesale Restocking Still Uses Instant Teleportation**
**Problem**: `tryRestockFromWholesale` still exists and teleports goods

**Evidence**: Looking at EconomySystem.ts, instant restocking still runs in parallel with orders

**Impact**: Orders system is bypassed by instant fallback

**Solution needed**: Remove instant restocking entirely, trust orders system

### GAP 6: **No Demand-Responsive Production**
**Problem**: Factories produce at max capacity regardless of demand

**Evidence**:
- Seed 300: "Factory inventory: 1,101 provisions" (massive oversupply)
- Seed 400: "Factory inventory: 0 provisions" (massive undersupply)
- No dynamic adjustment

**Impact**: Supply/demand imbalances

**Solution needed**: Factories should scale production based on order backlog

### GAP 7: **No Price Discovery**
**Problem**: All prices are fixed in config files

**Impact**:
- No market forces
- Can't respond to scarcity/surplus
- Inflation has no meaning

**Solution needed** (long-term): Dynamic pricing based on supply/demand

### GAP 8: **High-Tech Prototypes Not Functional**
**Problem**: Prototypes are produced but have no use

**Evidence**:
```
Phase 2000 [Lennox Hassan's Shop] needs 21 valuable_data for high_tech_prototypes production, but no org locations have stock
```

**Impact**: End-game vertical incomplete

**Solution needed**: Define what prototypes do (sold to whom? for what purpose?)

### GAP 9: **Driver Errors**
**Problem**: Logistics drivers occasionally fail with "location not found"

**Evidence**:
```
⚠️ Phase 2000 [Driver] failed: location not found
```

**Impact**: Deliveries fail silently, goods don't arrive

**Solution needed**: Debug deliver_goods executor, ensure location IDs are valid

### GAP 10: **No Inventory Decay**
**Problem**: Food lasts forever

**Impact**:
- No urgency to sell perishables
- Warehouses hoard indefinitely
- Unrealistic

**Solution needed** (low priority): Goods decay over time (provisions spoil, tech becomes obsolete)

---

## Architectural Improvements for Scaling

### PRINCIPLE 1: **Separate Simulation State from Derived Metrics**

**Current problem**:
- Metrics like "weeklyRevenue" and "weeklyCosts" are stored in entity state
- Mixed concerns: simulation state + analytics

**Improvement**:
```typescript
// CURRENT (mixed concerns)
interface Location {
  weeklyRevenue: number;  // Analytics
  weeklyCosts: number;    // Analytics
  inventory: Inventory;   // Simulation state
}

// BETTER (separate concerns)
interface Location {
  inventory: Inventory;   // Pure state
}

interface LocationMetrics {
  locationId: string;
  weeklyRevenue: number;
  weeklyCosts: number;
}

// Metrics calculated on-demand or tracked separately
```

**Benefits**:
- Cleaner state model
- Easier to serialize/save
- Metrics can be recalculated from event log

### PRINCIPLE 2: **Event Sourcing for Auditability**

**Current problem**:
- ActivityLog is write-only, not used for anything
- Can't replay history or debug issues
- No way to answer "why did this agent starve?"

**Improvement**:
```typescript
// Structured event stream
type SimulationEvent =
  | { type: 'agent_hired', agentId: string, orgId: string, salary: number, phase: number }
  | { type: 'agent_fired', agentId: string, reason: 'unpaid' | 'downsizing', phase: number }
  | { type: 'transaction', from: EntityRef, to: EntityRef, amount: number, reason: string, phase: number }
  | { type: 'goods_transfer', from: LocationRef, to: LocationRef, goods: Inventory, phase: number }
  // ... etc

// Events stored in append-only log
const eventLog: SimulationEvent[] = [];

// Can replay to any point in time
function replayToPhase(targetPhase: number): WorldState {
  let state = initialState;
  for (const event of eventLog) {
    if (event.phase > targetPhase) break;
    state = applyEvent(state, event);
  }
  return state;
}
```

**Benefits**:
- Full audit trail
- Time-travel debugging
- Can analyze "why did agent X starve?" by replaying their history
- Enables save/load system

### PRINCIPLE 3: **Decouple Systems via Queues**

**Current problem**:
- Systems directly modify each other's state
- Hard to reason about execution order
- Circular dependencies (EconomySystem imports OrgBehaviorSystem, etc.)

**Improvement**:
```typescript
// Systems emit "commands" instead of directly modifying state
interface Command {
  type: string;
  payload: unknown;
}

class CommandQueue {
  private queue: Command[] = [];

  enqueue(cmd: Command) { this.queue.push(cmd); }

  process(state: WorldState): WorldState {
    let newState = state;
    for (const cmd of this.queue) {
      newState = applyCommand(newState, cmd);
    }
    this.queue = [];
    return newState;
  }
}

// Example:
// AgentSystem emits { type: 'need_food', agentId: '123' }
// EconomySystem handles it in next tick
```

**Benefits**:
- Clear execution order
- No circular dependencies
- Easier to test systems in isolation
- Can defer expensive operations

### PRINCIPLE 4: **Separate Reads from Writes (CQRS-lite)**

**Current problem**:
- UI queries directly access simulation state
- No indexes, slow queries
- Hard to optimize

**Improvement**:
```typescript
// Write model (simulation)
interface WorldState {
  agents: Agent[];
  locations: Location[];
  // ... minimal state
}

// Read model (UI / analytics)
interface QueryCache {
  agentsByLocation: Map<LocationRef, AgentRef[]>;
  orgsByTag: Map<string, OrgRef[]>;
  locationsByZone: Map<string, LocationRef[]>;
  // ... pre-computed indexes
}

// Update read model incrementally
function updateQueryCache(cache: QueryCache, event: SimulationEvent): QueryCache {
  // Update indexes based on event type
}
```

**Benefits**:
- Fast UI queries
- Simulation state stays small
- Can rebuild indexes from event log

### PRINCIPLE 5: **Use Algebraic Data Types (ADTs) for State Machines**

**Current problem**:
- Agent status represented as optional fields
- Unclear what combinations are valid
```typescript
interface Agent {
  status: 'employed' | 'available' | 'dead';
  employer?: OrgRef;        // When is this set?
  employedAt?: LocationRef; // What if status is 'available'?
  inVehicle?: VehicleRef;   // Can be employed AND in vehicle?
}
```

**Improvement**:
```typescript
type AgentState =
  | { tag: 'available'; residence?: LocationRef }
  | { tag: 'employed'; employer: OrgRef; workplace: LocationRef; salary: number }
  | { tag: 'in_transit'; from: LocationRef; to: LocationRef; phasesRemaining: number }
  | { tag: 'in_vehicle'; vehicleId: VehicleRef }
  | { tag: 'dead'; diedAtPhase: number; cause: DeathCause }

interface Agent {
  id: AgentRef;
  name: string;
  state: AgentState; // Only valid combinations possible
  // ... other fields
}
```

**Benefits**:
- Impossible states are unrepresentable
- Type system enforces correctness
- Clear what fields are available in each state

### PRINCIPLE 6: **Batch Processing for Performance**

**Current problem**:
- Systems iterate over all entities every tick
- O(n) operations repeated unnecessarily

**Improvement**:
```typescript
// Instead of checking every agent every tick:
for (const agent of agents) {
  if (agent.hunger > 50) {
    // Find food...
  }
}

// Use priority queues or scheduled events:
const nextHungerCheckPhase = new Map<AgentRef, number>();

function processHunger(agents: Agent[], currentPhase: number) {
  const hungryAgents = agents.filter(a => nextHungerCheckPhase.get(a.id) === currentPhase);

  for (const agent of hungryAgents) {
    // Handle hunger
    nextHungerCheckPhase.set(agent.id, currentPhase + 10); // Check again in 10 ticks
  }
}
```

**Benefits**:
- Scales to thousands of agents
- Reduces unnecessary computations
- More realistic (agents don't re-evaluate every second)

### PRINCIPLE 7: **Immutable Data Structures**

**Current problem**:
- Systems mutate state directly
- Hard to track changes
- Can't implement undo/redo

**Improvement**:
```typescript
// Use Immer or similar library for structural sharing
import produce from 'immer';

function agentEatsFood(state: WorldState, agentId: string): WorldState {
  return produce(state, draft => {
    const agent = draft.agents.find(a => a.id === agentId);
    if (agent && agent.inventory.provisions > 0) {
      agent.hunger = 0;
      agent.inventory.provisions -= 1;
    }
  });
}
```

**Benefits**:
- Can't accidentally mutate state
- Easier to implement time-travel
- Better debugging (can compare old vs new state)

### PRINCIPLE 8: **Extract Magic Numbers to Config**

**Current problem**:
- Hardcoded constants scattered throughout code
```typescript
if (hunger > 50) { /* find food */ }
if (inventory.provisions < 15) { /* restock */ }
const payment = Math.max(10, totalGoods * 1 + distance * 0.5);
```

**Improvement**:
```typescript
// centralized config
const THRESHOLDS = {
  hunger: {
    findFood: 50,
    starving: 75,
    death: 100,
  },
  inventory: {
    restockThreshold: 15,
    minimumStock: 5,
  },
  delivery: {
    basePayment: 10,
    perGoodRate: 1,
    perDistanceRate: 0.5,
  },
};

// Used in code
if (hunger > THRESHOLDS.hunger.findFood) { /* ... */ }
```

**Benefits**:
- Easier to tune balance
- All constants in one place
- Can be overridden per-scenario

### PRINCIPLE 9: **Dependency Injection for Testing**

**Current problem**:
- Systems directly import and call each other
- Hard to test in isolation

**Improvement**:
```typescript
// Instead of:
import { calculateDeliveryPayment } from './DeliverySystem';

// Use dependency injection:
interface EconomyDependencies {
  calculateDeliveryPayment: (goods: Inventory, distance: number) => number;
  getLocationById: (id: LocationRef) => Location | undefined;
  // ... other dependencies
}

export function processGoodsOrders(
  orders: Order[],
  deps: EconomyDependencies
): { orders: Order[] } {
  // Use deps.calculateDeliveryPayment instead of direct import
}

// Easy to test with mocks:
const mockDeps = {
  calculateDeliveryPayment: () => 100, // Always returns 100 for testing
  getLocationById: (id) => mockLocation,
};
```

**Benefits**:
- Testable in isolation
- No circular dependencies
- Can swap implementations (test vs prod)

### PRINCIPLE 10: **Invariant Checking**

**Current problem**:
- State can become inconsistent
- Hard to catch bugs early

**Improvement**:
```typescript
function validateWorldState(state: WorldState): string[] {
  const errors: string[] = [];

  // Check: Every employed agent has a valid employer
  for (const agent of state.agents) {
    if (agent.status === 'employed' && agent.employer) {
      const org = state.orgs.find(o => o.id === agent.employer);
      if (!org) {
        errors.push(`Agent ${agent.id} employed by non-existent org ${agent.employer}`);
      }
    }
  }

  // Check: Location inventory doesn't exceed capacity
  for (const loc of state.locations) {
    const total = Object.values(loc.inventory).reduce((sum, n) => sum + n, 0);
    if (total > loc.inventoryCapacity) {
      errors.push(`Location ${loc.id} exceeds capacity: ${total}/${loc.inventoryCapacity}`);
    }
  }

  // ... more checks

  return errors;
}

// Run after every tick in dev mode
if (process.env.NODE_ENV === 'development') {
  const errors = validateWorldState(newState);
  if (errors.length > 0) {
    console.error('Invariant violations:', errors);
    throw new Error('State consistency check failed');
  }
}
```

**Benefits**:
- Catch bugs immediately
- Enforce business rules
- Self-documenting constraints

---

## Recommended Priority Order

### Immediate (Fix Critical Bugs):
1. **Fix driver "location not found" errors** (GAP 9)
2. **Add emergency food access** (GAP 3) - prevents mass starvation
3. **Implement active hiring system** (GAP 1) - prevents production halts

### Short-term (Improve Realism):
4. **Add credit lines / grace period** (GAP 2) - reduces business churn
5. **Remove instant restocking** (GAP 5) - trust orders system
6. **Add travel cost for shopping** (GAP 4) - local economy effect

### Medium-term (Scale Architecture):
7. **Separate state from metrics** (PRINCIPLE 1)
8. **Add event sourcing** (PRINCIPLE 2)
9. **Extract magic numbers** (PRINCIPLE 8)
10. **Add invariant checking** (PRINCIPLE 10)

### Long-term (Advanced Features):
11. **Demand-responsive production** (GAP 6)
12. **Price discovery** (GAP 7)
13. **CQRS read models** (PRINCIPLE 4)
14. **Immutable state** (PRINCIPLE 7)

---

## Conclusion

The simulation is **stable but fragile**:
- Works for most seeds (42, 100, 200, 300)
- Seed 400 shows it can collapse under stress
- High employment churn and starvation are unrealistic
- Architecture needs reinforcement before adding complexity

**Biggest risks**:
1. **No hiring system** → businesses die unnecessarily
2. **No credit system** → cash flow shocks are fatal
3. **No emergency food** → broke agents starve despite abundant food
4. **State management getting messy** → bugs will multiply as features grow

**Key architectural principles** to adopt now:
- Event sourcing for debugging
- Separate state from derived metrics
- Decouple systems via queues
- Invariant checking to catch bugs early

These changes will make the simulation more robust and easier to extend without breaking existing systems.
