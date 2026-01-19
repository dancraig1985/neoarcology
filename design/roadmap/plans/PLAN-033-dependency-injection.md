# PLAN-033: Replace Global Singletons with Dependency Injection

**Status:** planned
**Priority:** P1 (high)
**Dependencies:** PLAN-032 (split systems first for cleaner interfaces)

## Goal

Replace global singleton state (Metrics, ActivityLog) with dependency injection to enable unit testing and concurrent simulations.

## Problem

Current architecture blocks testing:
```typescript
// Metrics.ts
let activeMetrics: SimulationMetrics | null = null;
export function setActiveMetrics(metrics: SimulationMetrics): void { ... }
export function trackDeath(name: string, cause: DeathCause): void {
  if (!activeMetrics) return; // Silent failure
}

// ActivityLog.ts
let currentActivityLog: ActivityLog | null = null;
export function setCurrentActivityLog(log: ActivityLog): void { ... }
export function logActivity(message: string): void {
  if (!currentActivityLog) return; // Silent failure
}
```

Issues:
- Systems depend on global state, can't test in isolation
- Can't run multiple simulations concurrently
- Silent failures if singletons not initialized
- Circular dependency risk (systems import Metrics, Metrics imports types from systems)

## Objectives

- [ ] Create `SimulationContext` interface
  ```typescript
  interface SimulationContext {
    metrics: SimulationMetrics;
    activityLog: ActivityLog;
    config: LoadedConfig;
    rng: () => number; // Seeded RNG
  }
  ```

- [ ] Update all system functions to accept `context` parameter
  ```typescript
  // BEFORE
  export function processAgentBehaviors(agents: Agent[], ...): Agent[] {
    trackHire(); // Global call
  }

  // AFTER
  export function processAgentBehaviors(
    agents: Agent[],
    context: SimulationContext,
    ...
  ): Agent[] {
    context.metrics.trackHire();
  }
  ```

- [ ] Convert Metrics to instance methods
  - Remove global `activeMetrics` variable
  - Change `trackDeath()` to `metrics.trackDeath()`
  - Pass metrics through context

- [ ] Convert ActivityLog to instance methods
  - Remove global `currentActivityLog` variable
  - Change `logActivity()` to `activityLog.log()`
  - Pass log through context

- [ ] Move seeded RNG into context
  - Currently using global `Math.random()` (non-deterministic)
  - Add `seedrandom` library for reproducible RNG
  - Pass RNG function through context

- [ ] Update Simulation.ts to create and pass context
  ```typescript
  const context: SimulationContext = {
    metrics: new Metrics(),
    activityLog: new ActivityLog(),
    config: loadedConfig,
    rng: seedrandom(seed),
  };

  // Pass to all systems
  const updatedAgents = processAgentBehaviors(agents, context, ...);
  ```

- [ ] Update all system imports to remove global function calls
  - AgentSystem: Remove `import { trackDeath } from '../Metrics'`
  - EconomySystem: Remove `import { trackWagePayment, ... } from '../Metrics'`
  - All systems: Remove `import { logActivity } from '../ActivityLog'`

- [ ] Add unit tests for systems using mock context
  ```typescript
  const mockContext: SimulationContext = {
    metrics: createMockMetrics(),
    activityLog: createMockActivityLog(),
    config: testConfig,
    rng: () => 0.5, // Deterministic for tests
  };

  // Test system in isolation
  const result = processAgentBehaviors([testAgent], mockContext, ...);
  ```

## Files to Modify

| File | Changes |
|------|---------|
| `src/simulation/Metrics.ts` | Convert to class, remove global singleton |
| `src/simulation/ActivityLog.ts` | Convert to class, remove global singleton |
| `src/simulation/Simulation.ts` | Create SimulationContext, pass to all systems |
| `src/simulation/systems/*.ts` | Accept context parameter, use context.metrics/activityLog |
| `src/types/Context.ts` | NEW - SimulationContext interface |
| `package.json` | Add `seedrandom` dependency |

## Migration Strategy

1. Create `SimulationContext` interface
2. Update Metrics.ts to be instance-based (keep global functions as deprecated wrappers)
3. Update ActivityLog.ts to be instance-based (keep global functions as deprecated wrappers)
4. Update Simulation.ts to create context
5. Update systems one at a time to accept context
6. Remove deprecated global wrappers
7. Add unit tests demonstrating isolated testing

## Benefits

- **Unit testing**: Systems can be tested in isolation with mock contexts
- **Concurrent simulations**: Multiple Simulation instances can run simultaneously
- **No silent failures**: Context always has valid metrics/log instances
- **Deterministic testing**: Seeded RNG makes tests reproducible
- **Clear dependencies**: Function signatures show what each system needs

## Success Criteria

- No global singleton state remains
- All systems accept SimulationContext parameter
- Can instantiate multiple Simulation objects concurrently
- Can run tests with mock metrics/log without affecting global state
- RNG is seeded and deterministic
