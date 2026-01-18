# PLAN-025: Warehouse Locations & Storage System

**Status:** planned
**Priority:** P1 (high)
**Dependencies:** PLAN-023

## Goal
Create warehouse location type for bulk tangible goods storage, preparing infrastructure for factory capacity constraints and logistics.

## Objectives
- [ ] Create warehouse.json location template (5-10x factory capacity)
- [ ] Add warehouse rental/purchase costs to economy.json
- [ ] Update Location type to support warehouse characteristics
- [ ] Implement warehouse inventory management in EconomySystem.ts
- [ ] Update CityGenerator.ts - spawn warehouses in industrial zones
- [ ] Allow manual inventory transfer: factory → warehouse (same-tick, instant for now)
- [ ] Support wholesale sales from warehouses (shops can restock from warehouses)
- [ ] Run sim for 500+ ticks, verify orgs transfer surplus to warehouses
- [ ] Update design bible: locations.md (warehouse section), inventory.md (capacity mechanics)

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
