# PLAN-026: Factory Capacity Reduction & Warehouse Restocking

**Status:** planned
**Priority:** P1 (high)
**Dependencies:** PLAN-025

## Goal
Reduce factory inventory capacity to force warehouse usage, making warehouses essential instead of optional.

## Objectives
- [ ] Reduce factory capacity in economy.json (target: 2-3 production cycles worth of output)
- [ ] Add warehouse restocking behavior to behaviors.json (trigger at 80% factory capacity)
- [ ] Handle production blocking in ProductionSystem.ts when factory full
- [ ] Implement automated warehouse transfer in OrgBehaviorSystem.ts
- [ ] Create warehouse transfer executor in behaviors/executors/
- [ ] Run sim for 1000+ ticks with reduced capacity
- [ ] Verify factories overflow to warehouses without blocking production
- [ ] Monitor retail restocking still works (sourcing from warehouses)
- [ ] Update design bible: production.md (capacity constraints), inventory.md (factory→warehouse flow)

## Critical Files
**Configuration:**
- `data/config/economy.json`
- `data/config/behaviors.json`

**Code:**
- `src/simulation/systems/ProductionSystem.ts`
- `src/simulation/systems/OrgBehaviorSystem.ts`
- `src/simulation/behaviors/executors/` (new transfer executor)

**Documentation:**
- `design/bible/production.md`
- `design/bible/inventory.md`
- `design/bible/economy.md`

## Notes
Example: Provisions factory produces 50 units/cycle → capacity reduced to 150 units max → forces transfer every 2-3 cycles. Warehouses become essential, not optional. Orgs without warehouses bottleneck production, creating demand for warehouse construction.
