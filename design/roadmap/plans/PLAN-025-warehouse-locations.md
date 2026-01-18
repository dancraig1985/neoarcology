# PLAN-025: Warehouse Locations & Storage System

**Status:** completed
**Priority:** P1 (high)
**Dependencies:** PLAN-023

## Goal
Create warehouse location type for bulk tangible goods storage with organic expansion as orgs need capacity.

## Objectives
- [x] Create warehouse.json location template (1000 capacity, 5-10x factory size)
- [x] Implement organic warehouse expansion (tryExpandToWarehouse)
- [x] Warehouse expansion triggers when factories >80% capacity
- [x] Multiple warehouses per org when capacity needs grow
- [x] Automatic factory→warehouse transfer in OrgBehaviorSystem.ts
- [x] Wholesale sales from warehouses (shops restock from any wholesale location)
- [x] Run sim for 1500 ticks, verify organic expansion and transfers working
- [x] Update design bible: locations.md (warehouse + storage section), inventory.md (capacity + overflow mechanics)

## Critical Files
**Configuration:**
- `data/templates/locations/warehouse.json` (new)
- `data/config/economy.json`
- `data/config/simulation.json`

**Code:**
- `src/simulation/systems/EconomySystem.ts`
- `src/types/Location.ts`
- `src/generation/CityGenerator.ts`

**Documentation:**
- `design/bible/locations.md`
- `design/bible/inventory.md`

## Notes
Warehouses are org-owned, can store any tangible good (provisions, alcohol, luxury_goods, high_tech_prototypes). Minimal staff (1-2 workers). Prepares for PLAN-026 (capacity constraints) and PLAN-027 (trucking).

## Implementation Summary

**Completed:** Warehouse storage system with organic expansion fully working.

**What was implemented:**
1. **Warehouse template** (`warehouse.json`): 1000 capacity, 2 unskilled workers, 800 opening cost
2. **Organic expansion** (`tryExpandToWarehouse()`): Corporations open warehouses when needed
3. **Expansion triggers**:
   - At least one factory >80% capacity
   - No existing warehouses OR existing warehouses >70% full (average)
   - Corporation has 1100+ credits (opening cost + buffer)
   - 5% random chance per phase when eligible
4. **Factory overflow management** (`tryTransferToWarehouse()`): Automatic transfer of surplus goods
   - Monitors factories for >80% capacity
   - Transfers up to 50% of tangible goods to warehouse
   - Handles: provisions, alcohol, luxury_goods, prototypes, data_storage
   - Excludes: valuable_data (intangible, stays at office/lab)
5. **Wholesale integration**: Warehouses participate in wholesale market (have 'wholesale' tag)
6. **Multi-warehouse support**: Orgs can open multiple warehouses as capacity needs scale

**Design decisions:**
- **No spawn at start**: Changed from spawning 2-4 warehouses at city generation to organic expansion
- **Capacity-driven**: Warehouses open when actually needed, not speculatively
- **Corporation-only**: Only orgs with 'corporation' tag and production facilities can expand
- **Average capacity check**: Allows multiple warehouses when existing ones fill up (>70% threshold)

**Test results (1500 ticks, seed 42):**
- 6 warehouses opened organically across 5 corporations
- First warehouse: Phase 128 (after factories had time to fill up)
- Multiple corps opened 2+ warehouses as production scaled
- Factory→warehouse transfers working correctly
- Shops restocking from warehouses successfully

**Technical notes:**
- Warehouses get generic factory names (e.g., "Apex Manufacturing") due to shared `nextFactoryName()` - cosmetic issue, doesn't affect functionality
- Warehouse expansion happens in step 2 of org behavior loop (after revenue, before R&D procurement)
- Internal org transfers are instant (same-tick) - trucking logistics deferred to PLAN-027
