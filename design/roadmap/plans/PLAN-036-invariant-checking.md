# PLAN-036: Add Invariant Checking System

**Status:** planned
**Priority:** P2 (medium)
**Dependencies:** PLAN-032, PLAN-035 (cleaner state after refactoring)

## Goal

Add automated state validation to catch bugs early and document business rules as code.

## Problem

**Current state: No validation**
- State can become inconsistent without detection
- Bugs only caught when they cause crashes
- No way to verify simulation invariants hold
- Business rules are implicit, not documented

**Real bugs this would have caught:**
1. Agent employed but employer org doesn't exist
2. Location inventory exceeds capacity
3. Agent in two places at once (residence + workplace mismatch)
4. Negative wallet balances
5. Orphaned orders (buyer/seller org no longer exists)

## Objectives

- [ ] Create `InvariantChecker` system
  ```typescript
  // src/simulation/validation/InvariantChecker.ts
  export class InvariantChecker {
    check(state: WorldState): InvariantViolation[] {
      const violations: InvariantViolation[] = [];

      violations.push(...this.checkAgentInvariants(state));
      violations.push(...this.checkLocationInvariants(state));
      violations.push(...this.checkOrgInvariants(state));
      violations.push(...this.checkInventoryInvariants(state));
      violations.push(...this.checkEmploymentInvariants(state));
      violations.push(...this.checkOrderInvariants(state));

      return violations;
    }
  }
  ```

- [ ] Define violation types
  ```typescript
  interface InvariantViolation {
    severity: 'error' | 'warning' | 'info';
    category: string;
    message: string;
    entityId?: string;
    phase: number;
  }
  ```

- [ ] Implement agent invariants
  ```typescript
  checkAgentInvariants(state: WorldState): InvariantViolation[] {
    const violations: InvariantViolation[] = [];

    for (const agent of state.agents) {
      // Employed agents must have valid employer
      if (agent.status === 'employed' && agent.employer) {
        const org = state.orgs.find(o => o.id === agent.employer);
        if (!org) {
          violations.push({
            severity: 'error',
            category: 'employment',
            message: `Agent ${agent.name} employed by non-existent org ${agent.employer}`,
            entityId: agent.id,
            phase: state.phase,
          });
        }
      }

      // Agents can't have negative needs
      if (agent.hunger < 0 || agent.fatigue < 0 || agent.leisure < 0) {
        violations.push({
          severity: 'error',
          category: 'agent_state',
          message: `Agent ${agent.name} has negative need (hunger:${agent.hunger}, fatigue:${agent.fatigue}, leisure:${agent.leisure})`,
          entityId: agent.id,
          phase: state.phase,
        });
      }

      // Agents must be somewhere
      if (!agent.location && agent.status !== 'dead') {
        violations.push({
          severity: 'error',
          category: 'location',
          message: `Living agent ${agent.name} has no location`,
          entityId: agent.id,
          phase: state.phase,
        });
      }

      // Wallet can't be negative
      if (agent.wallet.credits < 0) {
        violations.push({
          severity: 'warning',
          category: 'economy',
          message: `Agent ${agent.name} has negative credits: ${agent.wallet.credits}`,
          entityId: agent.id,
          phase: state.phase,
        });
      }
    }

    return violations;
  }
  ```

- [ ] Implement location invariants
  ```typescript
  checkLocationInvariants(state: WorldState): InvariantViolation[] {
    const violations: InvariantViolation[] = [];

    for (const location of state.locations) {
      // Inventory can't exceed capacity
      const totalGoods = Object.values(location.inventory).reduce((sum, qty) => sum + qty, 0);
      if (totalGoods > location.inventoryCapacity) {
        violations.push({
          severity: 'warning',
          category: 'inventory',
          message: `Location ${location.name} exceeds capacity: ${totalGoods}/${location.inventoryCapacity}`,
          entityId: location.id,
          phase: state.phase,
        });
      }

      // Inventory can't be negative
      for (const [good, qty] of Object.entries(location.inventory)) {
        if (qty < 0) {
          violations.push({
            severity: 'error',
            category: 'inventory',
            message: `Location ${location.name} has negative ${good}: ${qty}`,
            entityId: location.id,
            phase: state.phase,
          });
        }
      }
    }

    return violations;
  }
  ```

- [ ] Implement org invariants
  ```typescript
  checkOrgInvariants(state: WorldState): InvariantViolation[] {
    const violations: InvariantViolation[] = [];

    for (const org of state.orgs) {
      // Org must have valid leader
      const leader = state.agents.find(a => a.id === org.leader);
      if (!leader) {
        violations.push({
          severity: 'error',
          category: 'org',
          message: `Org ${org.name} has non-existent leader ${org.leader}`,
          entityId: org.id,
          phase: state.phase,
        });
      }

      // Org must have at least one location
      if (org.locations.length === 0) {
        violations.push({
          severity: 'warning',
          category: 'org',
          message: `Org ${org.name} has no locations (should dissolve?)`,
          entityId: org.id,
          phase: state.phase,
        });
      }

      // All org locations must exist
      for (const locId of org.locations) {
        const location = state.locations.find(l => l.id === locId);
        if (!location) {
          violations.push({
            severity: 'error',
            category: 'org',
            message: `Org ${org.name} references non-existent location ${locId}`,
            entityId: org.id,
            phase: state.phase,
          });
        }
      }

      // Negative wallet check
      if (org.wallet.credits < 0) {
        violations.push({
          severity: 'info',
          category: 'economy',
          message: `Org ${org.name} has negative credits: ${org.wallet.credits} (grace period?)`,
          entityId: org.id,
          phase: state.phase,
        });
      }
    }

    return violations;
  }
  ```

- [ ] Implement employment relationship invariants
  ```typescript
  checkEmploymentInvariants(state: WorldState): InvariantViolation[] {
    const violations: InvariantViolation[] = [];

    // Build employment index
    const employmentByOrg = new Map<string, string[]>();
    for (const agent of state.agents) {
      if (agent.status === 'employed' && agent.employer) {
        const employees = employmentByOrg.get(agent.employer) || [];
        employees.push(agent.id);
        employmentByOrg.set(agent.employer, employees);
      }
    }

    // Check org.workers matches actual employment
    for (const org of state.orgs) {
      const actualEmployees = employmentByOrg.get(org.id) || [];
      const declaredWorkers = org.workers || [];

      if (actualEmployees.length !== declaredWorkers.length) {
        violations.push({
          severity: 'warning',
          category: 'employment',
          message: `Org ${org.name} employment mismatch: ${actualEmployees.length} agents employed but org.workers lists ${declaredWorkers.length}`,
          entityId: org.id,
          phase: state.phase,
        });
      }
    }

    return violations;
  }
  ```

- [ ] Implement order system invariants
  ```typescript
  checkOrderInvariants(state: WorldState): InvariantViolation[] {
    const violations: InvariantViolation[] = [];

    for (const order of state.goodsOrders || []) {
      // Buyer must exist
      const buyer = state.orgs.find(o => o.id === order.buyer);
      if (!buyer) {
        violations.push({
          severity: 'error',
          category: 'orders',
          message: `Order ${order.id} references non-existent buyer org ${order.buyer}`,
          phase: state.phase,
        });
      }

      // Seller must exist
      const seller = state.orgs.find(o => o.id === order.seller);
      if (!seller) {
        violations.push({
          severity: 'error',
          category: 'orders',
          message: `Order ${order.id} references non-existent seller org ${order.seller}`,
          phase: state.phase,
        });
      }

      // Source and destination locations must exist
      const source = state.locations.find(l => l.id === order.source);
      const dest = state.locations.find(l => l.id === order.destination);
      if (!source || !dest) {
        violations.push({
          severity: 'error',
          category: 'orders',
          message: `Order ${order.id} has invalid locations`,
          phase: state.phase,
        });
      }

      // If in_transit, must have assigned driver
      if (order.status === 'in_transit' && !order.assignedDriver) {
        violations.push({
          severity: 'error',
          category: 'orders',
          message: `Order ${order.id} in transit but has no driver`,
          phase: state.phase,
        });
      }
    }

    return violations;
  }
  ```

- [ ] Integrate into simulation tick
  ```typescript
  // Simulation.ts
  tick(): SimulationState {
    // ... normal tick processing

    if (process.env.NODE_ENV === 'development' || this.config.enableInvariantChecking) {
      const violations = this.invariantChecker.check(this.state);

      // Log violations
      for (const violation of violations) {
        const prefix = violation.severity === 'error' ? '❌' :
                      violation.severity === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`${prefix} [${violation.category}] ${violation.message}`);
      }

      // Fail fast on errors in dev mode
      const errors = violations.filter(v => v.severity === 'error');
      if (errors.length > 0 && process.env.FAIL_ON_INVARIANT_ERRORS) {
        throw new Error(`Invariant violations: ${errors.length} errors found`);
      }
    }

    return this.state;
  }
  ```

- [ ] Add configuration option
  ```typescript
  // simulation.json
  {
    "invariantChecking": {
      "enabled": true,
      "failOnErrors": true,
      "logWarnings": true,
      "checkEveryNPhases": 1 // Check every tick, or less frequently for performance
    }
  }
  ```

## Files to Create

| File | Purpose |
|------|---------|
| `src/simulation/validation/InvariantChecker.ts` | Main checker class |
| `src/simulation/validation/AgentInvariants.ts` | Agent-specific checks |
| `src/simulation/validation/OrgInvariants.ts` | Org-specific checks |
| `src/simulation/validation/InventoryInvariants.ts` | Inventory checks |
| `src/simulation/validation/OrderInvariants.ts` | Order system checks |
| `src/types/InvariantViolation.ts` | Violation type definitions |

## Files to Modify

| File | Changes |
|------|---------|
| `src/simulation/Simulation.ts` | Integrate invariant checking into tick |
| `data/config/simulation.json` | Add invariantChecking config section |

## Benefits

- **Catch bugs early**: Violations detected immediately, not when they cause crashes
- **Self-documenting**: Invariants serve as living documentation of business rules
- **Confidence**: Know the simulation state is always valid
- **Debugging**: Violations pinpoint exactly what broke and when
- **Testing**: Can assert no violations in test runs

## Success Criteria

- InvariantChecker class with 50+ checks across all entity types
- Violations logged in development mode
- Can run tests with `FAIL_ON_INVARIANT_ERRORS=true` to enforce correctness
- No false positives (all warnings are legitimate issues)
- Performance impact < 5% (check can be disabled in production)
