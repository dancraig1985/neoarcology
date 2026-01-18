# PLAN-027: Vehicles MVP for Logistics

**Status:** planned
**Priority:** P1 (high)
**Dependencies:** PLAN-026

## Goal
Implement minimal viable vehicle system to support trucking logistics (cargo trucks for goods delivery).

## Objectives

**Core Vehicle System:**
- [ ] Remove unimplemented Vehicle interface from entities.ts
- [ ] Design MVP Vehicle type: simple state (id, owner, operator, location, cargo inventory)
- [ ] Parking mechanics: Each Building gets automatic parking location for vehicles
- [ ] Vehicle ownership: Orgs purchase/own vehicles, assign to driver agents
- [ ] Agent-vehicle interaction: claim vehicle, drive to building, release vehicle
- [ ] Cargo mechanics: load/unload goods from location → vehicle → location
- [ ] First vehicle template: cargo_truck.json (high cargo capacity, basic stats)
- [ ] Spawn initial trucks at logistics depots (preparation for PLAN-028)
- [ ] Test: Agent claims truck, loads cargo, drives to destination, unloads, returns

**UI Integration:**
- [ ] Add Vehicles tab to main UI (alongside Agents, Orgs, Locations, Buildings tabs)
- [ ] List view: scrollable table showing all vehicles (ID, type, owner, operator, cargo, status)
- [ ] Detail view: selected vehicle details (full stats, cargo inventory, current location)
- [ ] Recent activity: vehicle-specific actions (claimed, loaded, unloaded, traveled)
- [ ] Follow existing UI patterns from Agents/Orgs tabs

**Documentation:**
- [ ] Update design bible: Add vehicles.md (ownership, parking, cargo mechanics)

## Critical Files
**Configuration:**
- `data/templates/vehicles/cargo_truck.json` (new)
- `data/config/simulation.json` (vehicle spawn settings)

**Simulation Code:**
- `src/types/entities.ts` (replace Vehicle interface with MVP version)
- `src/simulation/systems/VehicleSystem.ts` (new - claim, release, load, unload)
- `src/generation/CityGenerator.ts` (spawn parking locations per building)
- `src/simulation/systems/TravelSystem.ts` (extend for vehicle travel)
- `src/simulation/Simulation.ts` (add vehicles array to SimulationState)

**UI Code:**
- `src/ui/UIController.ts` (add Vehicles tab)
- `src/ui/panels/VehiclesPanel.ts` (new - main vehicles view)
- `src/ui/tables/VehicleTable.ts` (new - vehicle list table)
- `src/ui/details/VehicleDetail.ts` (new - vehicle detail view)
- `src/ui/UIConfig.ts` (add vehicle table columns and detail fields)

**Documentation:**
- `design/bible/vehicles.md` (new)

## Design Decisions

### Parking Model
Instead of vehicles being "at locations", vehicles park at buildings:
- Each Building automatically has a parking area (virtual location)
- Vehicles travel **to buildings**, not specific locations within buildings
- When agent needs vehicle: goes to building → claims vehicle from parking
- When agent arrives: releases vehicle → parks at destination building

### MVP Vehicle Type
```typescript
interface Vehicle {
  id: string;
  template: string;  // 'cargo_truck'
  owner: OrgRef;     // Which org owns this vehicle
  operator?: AgentRef;  // Who's currently driving (undefined = parked)
  building: BuildingRef;  // Which building parking lot it's at
  cargo: Inventory;  // Goods being transported
  cargoCapacity: number;  // Max cargo space
}
```

### Scope Limitations (MVP)
- **No vehicle stats** (speed, armor, stealth) - all trucks are identical
- **No maintenance costs** - vehicles don't break down or need upkeep
- **No vehicle marketplace** - orgs spawn with trucks, can't buy/sell yet
- **No fuel/energy** - infinite range
- **Single vehicle type** - only cargo trucks exist

These can be added in future plans (combat vehicles, vehicle economy, etc.)

## Notes
This plan focuses on the **minimum needed for logistics**: orgs own trucks, drivers claim them, load cargo, drive to destination, unload. Everything else is deferred to future vehicle expansion plans.
