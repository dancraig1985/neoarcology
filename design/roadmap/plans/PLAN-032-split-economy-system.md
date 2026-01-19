# PLAN-032: Split EconomySystem into Domain Systems

**Status:** planned
**Priority:** P0 (critical)
**Dependencies:** PLAN-031 (extract magic numbers first)

## Goal

Break the 2243-line EconomySystem.ts into focused, single-responsibility systems for maintainability.

## Problem

EconomySystem.ts currently handles 8+ distinct responsibilities:
1. Agent economic decisions (buying food, housing, leisure)
2. Business opening logic
3. Restocking logic (both instant and order-based)
4. Goods order placement
5. Goods order fulfillment
6. Weekly payroll processing
7. Weekly org dissolution
8. Homelessness fixes

This makes it impossible to understand, test, or modify safely.

## Objectives

- [ ] Create `src/simulation/systems/AgentEconomicSystem.ts`
  - Extract: `handleEmergencyHunger()`, `handleUrgentRest()`, `handleRestSeeking()`
  - Extract: `tryBuyProvisions()`, `tryFindHousing()`, `trySeekLeisure()`
  - Extract: `tryGetJob()`, agent-level decision making
  - ~600 lines

- [ ] Create `src/simulation/systems/BusinessSystem.ts`
  - Extract: `tryOpenBusiness()`, business opportunity selection
  - Extract: Business creation logic, initial capital, owner assignment
  - ~300 lines

- [ ] Create `src/simulation/systems/SupplyChainSystem.ts`
  - Extract: `tryRestockFromWholesale()`, `tryPlaceGoodsOrder()`, `processGoodsOrders()`
  - Extract: Delivery job creation, order fulfillment, transfer logistics
  - ~500 lines

- [ ] Create `src/simulation/systems/PayrollSystem.ts`
  - Extract: `processWeeklyEconomy()`, wage payments, rent collection
  - Extract: Owner dividend logic, business profitability checks
  - Extract: Org dissolution logic (move to OrgSystem?)
  - ~400 lines

- [ ] Update `Simulation.ts` to call new systems
  - Replace monolithic EconomySystem calls with specific system calls
  - Ensure correct tick ordering (payroll weekly, restocking per-tick, etc.)

- [ ] Update tests to verify each system works independently
- [ ] Remove old EconomySystem.ts once all logic is migrated

## New System Responsibilities

### AgentEconomicSystem
- Agent biological needs (hunger, rest)
- Agent purchasing decisions (food, housing, leisure)
- Agent job-seeking behavior
- Emergency interventions (free food when broke)

### BusinessSystem
- Business opportunity analysis (uses DemandAnalyzer)
- Business creation (capital, location, owner assignment)
- Entrepreneur selection logic

### SupplyChainSystem
- Retail restocking (both instant and orders)
- Goods order placement and tracking
- Delivery job creation
- Order fulfillment and completion

### PayrollSystem
- Weekly wage payments
- Weekly rent collection
- Owner dividends
- Org profitability checks
- Org dissolution (or delegate to OrgSystem)

## Migration Strategy

1. Create new files with empty exports
2. Copy functions one domain at a time, starting with AgentEconomicSystem
3. Update imports in Simulation.ts incrementally
4. Test after each domain migration
5. Delete EconomySystem.ts when empty

## Success Criteria

- No single file exceeds 800 lines
- Each system has a single, clear responsibility
- Systems can be understood and tested independently
- All original functionality preserved (verified by `npm run sim:test`)
