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

## Key Concept: Grid Cell = City Block

A grid cell (x, y) represents a **city block**, not a single building. Each block can contain **multiple buildings** of varying sizes. In a dense cyberpunk city, a single block might have:
- One massive arcology dominating the block
- OR several mid-rise towers
- OR many low-rise buildings

## Solution: Building Entity

Buildings exist within city blocks and contain locations:

```
City Block (x: 15, y: 22)
├── Building A (40 floors, 6 units/floor)
│   ├── Floor 0: [Shop, Shop, Lobby]  (3 occupied, 3 empty)
│   ├── Floor 1-39: [...apartments...]
│   └── Floor 40: [Penthouse]
├── Building B (5 floors, 4 units/floor)
│   └── Floor 0-4: [...offices...]
└── Building C (3 floors, 2 units/floor)
    └── [...small retail...]
```

## Data Model

### Building Entity

```typescript
interface Building extends Entity {
  // Grid position (which city block)
  x: number;           // Grid x coordinate (city block)
  y: number;           // Grid y coordinate (city block)

  // Vertical extent
  floors: number;      // Total floors (0 to floors-1)

  // Capacity per floor (how many location units can fit)
  unitsPerFloor: number;

  // Current locations housed here (derived, not stored)
  // Use: locations.filter(l => l.building === building.id)
}
```

### Location Changes

```typescript
interface Location extends Entity {
  // Building reference (required for indoor locations)
  building?: BuildingRef;   // Parent building (undefined for outdoor)
  floor: number;            // Floor within building (0 for outdoor)
  unit?: number;            // Unit on floor (0 to unitsPerFloor-1)

  // Direct coords only for outdoor locations (parks, plazas)
  // For building locations, coords derived from building.x, building.y
  x?: number;
  y?: number;
}
```

### Zone Config: Allowed Building Templates

Zones specify which building types can spawn there (data-driven):

```json
{
  "id": "downtown",
  "name": "Downtown",
  "color": "#4488ff",
  "buildingTemplates": ["arcology", "office_tower", "residential_tower"],
  "buildingsPerBlock": { "min": 1, "max": 3 },
  "density": "high"
}

{
  "id": "residential",
  "name": "Residential District",
  "color": "#88ff88",
  "buildingTemplates": ["residential_tower", "low_rise", "apartment_block"],
  "buildingsPerBlock": { "min": 2, "max": 5 },
  "density": "medium"
}

{
  "id": "industrial",
  "name": "Industrial Zone",
  "color": "#ff8844",
  "buildingTemplates": ["warehouse", "factory_building"],
  "buildingsPerBlock": { "min": 1, "max": 2 },
  "density": "low"
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
  "floorTags": {
    "ground": ["commercial", "residential"],
    "upper": ["residential"]
  }
}

{
  "id": "arcology",
  "name": "Arcology Complex",
  "tags": ["mixed_use", "mega_structure"],
  "floors": { "min": 80, "max": 150 },
  "unitsPerFloor": { "min": 10, "max": 20 },
  "floorTags": {
    "ground": ["commercial", "public"],
    "mid": ["office", "commercial"],
    "upper": ["residential"]
  }
}

{
  "id": "low_rise",
  "name": "Low-Rise Building",
  "tags": ["residential", "low_rise"],
  "floors": { "min": 2, "max": 5 },
  "unitsPerFloor": { "min": 2, "max": 4 },
  "floorTags": {
    "ground": ["commercial", "residential"],
    "upper": ["residential"]
  }
}
```

## City Generation: Two-Phase Approach

### Phase 1: Generate Buildings (Infrastructure)

During city generation, create empty buildings based on zone config:

```typescript
function generateBuildings(zones: Zone[], buildingTemplates: BuildingTemplate[]): Building[] {
  const buildings: Building[] = [];

  for (const zone of zones) {
    for (const cell of zone.cells) {
      // How many buildings in this block?
      const count = random(zone.buildingsPerBlock.min, zone.buildingsPerBlock.max);

      for (let i = 0; i < count; i++) {
        // Pick a random allowed template for this zone
        const templateId = randomChoice(zone.buildingTemplates);
        const template = buildingTemplates[templateId];

        const building = createBuilding(template, cell.x, cell.y);
        buildings.push(building);
      }
    }
  }

  return buildings;
}
```

### Phase 2: Place Locations into Buildings

When creating a location (during gen or when agent starts business), find a suitable building:

```typescript
function placeLocation(
  location: Location,
  buildings: Building[],
  existingLocations: Location[]
): Location {
  // Find buildings that:
  // 1. Have space (occupied units < total capacity)
  // 2. Allow this location type on some floor (check floorTags)

  const suitable = buildings.filter(b => {
    const hasSpace = getBuildingOccupancy(b, existingLocations) < b.floors * b.unitsPerFloor;
    const allowsType = buildingAllowsLocationType(b, location.tags);
    return hasSpace && allowsType;
  });

  if (suitable.length === 0) return location; // No building found, outdoor?

  // Pick building (could be nearest, random, or best fit)
  const building = pickBuilding(suitable, location);

  // Find available floor + unit
  const { floor, unit } = findAvailableSlot(building, location.tags, existingLocations);

  return {
    ...location,
    building: building.id,
    floor,
    unit,
    x: undefined,  // Coords derived from building
    y: undefined,
  };
}
```

## Travel System Updates

### Intra-Building Travel
Travel within the same building is very fast:
- Same floor: 0 phases (instant)
- Different floors: 0-1 phases depending on floor distance
- Elevators assumed for tall buildings

### Inter-Building Travel
Travel between buildings uses grid distance between their city blocks.

```typescript
function getTravelPhases(from: Location, to: Location, buildings: Building[]): number {
  const fromBuilding = buildings.find(b => b.id === from.building);
  const toBuilding = buildings.find(b => b.id === to.building);

  // Same building - very fast
  if (from.building && from.building === to.building) {
    const floorDiff = Math.abs(from.floor - to.floor);
    return floorDiff > 10 ? 1 : 0;  // Elevator time for tall trips
  }

  // Different buildings (or outdoor) - use grid distance
  const fromX = fromBuilding?.x ?? from.x ?? 0;
  const fromY = fromBuilding?.y ?? from.y ?? 0;
  const toX = toBuilding?.x ?? to.x ?? 0;
  const toY = toBuilding?.y ?? to.y ?? 0;

  const distance = getGridDistance(fromX, fromY, toX, toY);
  return getTravelPhasesForDistance(distance);
}
```

## Standalone Outdoor Locations

Some locations don't need buildings:
- Public plazas
- Parks
- Street markets

These have direct (x, y) coordinates with `building: undefined`.

## Objectives

### Phase A: Building Entity
- [ ] Create Building interface in `src/types/entities.ts`
- [ ] Add BuildingRef type
- [ ] Create building templates in `data/templates/buildings/`

### Phase B: Zone Config Updates
- [ ] Add `buildingTemplates` array to zone config
- [ ] Add `buildingsPerBlock` range to zone config
- [ ] Update zone template validation

### Phase C: Location Refactor
- [ ] Add `building` field to Location (optional)
- [ ] Add `unit` field to Location
- [ ] Make `x`, `y` optional (derived from building or direct for outdoor)
- [ ] Add helper: `getLocationCoordinates(location, buildings)`

### Phase D: Building Generation
- [ ] Create `generateBuildings()` function
- [ ] Update `CityGenerator.ts` to generate buildings per zone
- [ ] Buildings start empty (no locations pre-filled)

### Phase E: Location Placement
- [ ] Create `placeLocationInBuilding()` function
- [ ] Update location creation to find suitable building
- [ ] Respect building floor tags (commercial on ground, residential above)
- [ ] Handle "no suitable building" gracefully

### Phase F: Travel System Update
- [ ] Update `getDistance()` to handle building-based locations
- [ ] Add intra-building travel logic (fast/instant for same building)
- [ ] Update `startTravel()` and `processTravel()`

### Phase G: UI Updates
- [ ] Show building info in location details
- [ ] Update map to show building density per block (optional)

## Key Files

| File | Change |
|------|--------|
| `src/types/entities.ts` | Add Building interface, update Location |
| `data/config/zones.json` | Add buildingTemplates, buildingsPerBlock |
| `data/templates/buildings/*.json` | Building templates (new) |
| `src/generation/CityGenerator.ts` | Generate buildings, place locations |
| `src/simulation/systems/TravelSystem.ts` | Handle building-based travel |

## Migration Strategy

1. Add Building entity type
2. Update zone config with building template lists
3. Create building templates
4. Update CityGenerator to create buildings first
5. Update location creation to place into buildings
6. Update travel system
7. Regenerate cities with new structure

## Non-Goals (Defer)

- Building condition/maintenance
- Building security level
- Building ownership (who owns the building vs units)
- Building damage/destruction
- Building upgrades/renovation
- Rent payments to building owners
- Building-wide events (fire, power outage)
- Visual building footprints on map

## Notes

- Buildings are infrastructure containers, not actors
- A building with one location is valid (small standalone shop)
- Floor 0 is always ground level
- Empty buildings are fine - they represent available real estate
- When agent starts business, it finds a building with space
- Agents should "know" about buildings (can query which building they're in, etc.)
