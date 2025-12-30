# PLAN-009: Building System

**Status:** planned
**Priority:** P1 (high)
**Dependencies:** PLAN-008 (leisure - completed)
**Phase:** 3

## Goal

Introduce buildings as containers for locations, enabling multi-tenant structures like apartment towers, office complexes, and mixed-use arcologies.

## Problem Statement

Currently, locations have direct grid coordinates (x, y, floor). This works for standalone buildings but doesn't model:
- Multiple apartments on the same floor
- Mixed-use buildings (shops on ground floor, apartments above)
- Massive cyberpunk arcologies with hundreds of units
- Efficient intra-building travel (elevator vs walking across city)

## Solution: Building Entity

Buildings own grid coordinates. Locations exist within buildings and reference:
- Their parent building
- Floor number within the building
- Unit/slot on that floor (optional, for multi-unit floors)

```
Building (x: 15, y: 22, maxFloors: 50)
├── Floor 0: [Shop A, Shop B, Lobby]
├── Floor 1: [Office 1, Office 2]
├── Floor 2-49: [Apt 2A, Apt 2B, Apt 2C, ...]
└── Floor 50: [Penthouse]
```

## Data Model

### Building Entity

```typescript
interface Building extends Entity {
  // Grid position (building footprint)
  x: number;           // Grid x coordinate
  y: number;           // Grid y coordinate

  // Vertical extent
  floors: number;      // Total floors (0 to floors-1)

  // Capacity per floor (how many locations can fit)
  unitsPerFloor: number;

  // Current locations housed here
  locations: LocationRef[];

  // Building properties
  condition: number;   // 0-100, affects desirability
  security: number;    // Building-wide security level
}
```

### Location Changes

```typescript
interface Location extends Entity {
  // Remove direct grid coords, add building reference
  building: BuildingRef;    // Parent building
  floor: number;            // Floor within building
  unit?: number;            // Unit on floor (0 to unitsPerFloor-1)

  // Derived (computed from building):
  // x, y coordinates come from building.x, building.y
}
```

## Travel System Updates

### Intra-Building Travel
Travel within the same building is very fast:
- Same floor: 0 phases (instant)
- Different floors: 0-1 phases depending on floor distance
- Elevators assumed for tall buildings

### Inter-Building Travel
Travel between buildings uses existing distance calculation based on building coordinates.

```typescript
function getTravelPhases(from: Location, to: Location, buildings: Building[]): number {
  const fromBuilding = buildings.find(b => b.id === from.building);
  const toBuilding = buildings.find(b => b.id === to.building);

  if (from.building === to.building) {
    // Same building - very fast
    const floorDiff = Math.abs(from.floor - to.floor);
    return floorDiff > 10 ? 1 : 0;  // Elevator time for tall trips
  }

  // Different buildings - use grid distance
  const distance = getGridDistance(fromBuilding.x, fromBuilding.y, toBuilding.x, toBuilding.y);
  return getTravelPhasesForDistance(distance);
}
```

## Building Templates

```json
{
  "id": "residential_tower",
  "name": "Residential Tower",
  "tags": ["residential", "high_rise"],
  "floors": { "min": 20, "max": 50 },
  "unitsPerFloor": { "min": 4, "max": 8 },
  "groundFloorTags": ["commercial"],  // Ground floor reserved for shops
  "upperFloorTags": ["residential"],
  "securityRange": { "min": 30, "max": 70 }
}

{
  "id": "arcology",
  "name": "Arcology Complex",
  "tags": ["mixed_use", "mega_structure"],
  "floors": { "min": 80, "max": 150 },
  "unitsPerFloor": { "min": 10, "max": 20 },
  "groundFloorTags": ["commercial", "public"],
  "midFloorTags": ["office", "commercial"],
  "upperFloorTags": ["residential"],
  "securityRange": { "min": 50, "max": 90 }
}

{
  "id": "low_rise",
  "name": "Low-Rise Building",
  "tags": ["residential", "low_rise"],
  "floors": { "min": 2, "max": 5 },
  "unitsPerFloor": { "min": 2, "max": 4 },
  "securityRange": { "min": 10, "max": 40 }
}
```

## City Generation Updates

1. **Generate buildings first** - Place buildings on grid based on zone
2. **Fill buildings with locations** - Create locations within buildings based on templates
3. **Ground floor bias** - Commercial locations prefer ground floors
4. **Residential upper** - Apartments go on upper floors

```typescript
function generateCity() {
  // 1. Place buildings based on zone density
  const buildings = generateBuildings(zones, buildingTemplates);

  // 2. Fill buildings with locations
  const locations = [];
  for (const building of buildings) {
    const buildingLocations = fillBuilding(building, locationTemplates);
    locations.push(...buildingLocations);
  }

  return { buildings, locations };
}
```

## Standalone Locations

Some locations don't need buildings:
- Public plazas (outdoor)
- Parks
- Street markets

These keep direct (x, y) coordinates with `building: null`.

```typescript
interface Location {
  building?: BuildingRef;  // Optional - null for outdoor locations
  x?: number;              // Direct coords if no building
  y?: number;
  floor: number;           // 0 for outdoor
}
```

## Objectives

### Phase A: Building Entity
- [ ] Create Building interface in `src/types/entities.ts`
- [ ] Add BuildingRef type
- [ ] Create building templates in `data/templates/buildings/`

### Phase B: Location Refactor
- [ ] Add `building` field to Location
- [ ] Make `x`, `y` optional (derived from building or direct)
- [ ] Add helper to get location coordinates

### Phase C: Travel System Update
- [ ] Update `getDistance()` to handle building-based locations
- [ ] Add intra-building travel logic (fast/instant)
- [ ] Update `startTravel()` and `processTravel()`

### Phase D: City Generation
- [ ] Create building generator
- [ ] Update `CityGenerator.ts` to create buildings first
- [ ] Update location creation to assign to buildings
- [ ] Handle standalone outdoor locations

### Phase E: UI Updates
- [ ] Show building info in location details
- [ ] Update map to show buildings (optional: building footprints)

## Key Files

| File | Change |
|------|--------|
| `src/types/entities.ts` | Add Building interface, update Location |
| `src/simulation/systems/TravelSystem.ts` | Handle building-based travel |
| `src/generation/CityGenerator.ts` | Generate buildings, assign locations |
| `data/templates/buildings/*.json` | Building templates |

## Migration Strategy

1. Add Building entity with buildings containing existing locations
2. Update Location to reference buildings
3. Compute x, y from building for backwards compatibility
4. Update travel system to use new model
5. Regenerate cities with new structure

## Non-Goals (Defer)

- Building ownership (who owns the building vs units)
- Building damage/destruction
- Building upgrades/renovation
- Vertical zoning enforcement
- Building-wide events (fire, power outage)

## Notes

- Buildings are containers, not actors - they don't make decisions
- A building with one location is valid (small standalone shop)
- Floor 0 is always ground level
- Security can be per-building or per-location (location overrides building default)
- Consider: should agents "know" about buildings or just locations?
