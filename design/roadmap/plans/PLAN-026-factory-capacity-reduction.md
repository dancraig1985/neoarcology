# PLAN-026: Factory Capacity Reduction & Warehouse Restocking

**Status:** completed
**Priority:** P1 (high)
**Dependencies:** PLAN-025

## Goal
Reduce factory inventory capacity to force warehouse usage, making warehouses essential instead of optional.

## Objectives
- [x] Reduce factory capacity in location templates (target: 3-4 production cycles worth of output)
- [x] Warehouse transfer already implemented in PLAN-025 (tryTransferToWarehouse @ 80% factory capacity)
- [x] Production blocking handled by InventorySystem.ts capacity checks
- [x] Automated warehouse transfer already in OrgBehaviorSystem.ts (PLAN-025)
- [x] Transfer logic implemented in tryTransferToWarehouse (no separate executor needed)
- [x] Run sim for 500 ticks with reduced capacity
- [x] Verified factories overflow to warehouses every 6-16 phases (transfers working)
- [x] Retail restocking works (shops source from warehouses via wholesale tag)
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
