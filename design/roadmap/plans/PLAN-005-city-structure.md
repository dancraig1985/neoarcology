# PLAN-005: City Structure & Procedural Generation

**Status:** planned
**Priority:** P1 (high)
**Dependencies:** PLAN-004 (completed)
**Phase:** 2

## Goal

Create a 2D grid-based city with procedurally generated zones and a basic map visualization.

## City Grid

**32x32 grid** (1024 cells). Each cell represents a city block that can contain multiple locations at various floors.

```typescript
interface CityCell {
  x: number;              // 0-31
  y: number;              // 0-31
  zone: ZoneType;         // What type of area this is
  maxHeight: number;      // Max floors buildings can have (1-120)
}

type ZoneType =
  | 'downtown'      // Central business district, tallest buildings
  | 'commercial'    // Shops, offices, mixed use
  | 'industrial'    // Factories, warehouses
  | 'residential'   // Apartments, housing
  | 'slums'         // Cheap/informal housing, crime
  | 'government';   // City services, admin buildings

interface Location {
  // ... existing fields
  x: number;        // Grid x (0-31)
  y: number;        // Grid y (0-31)
  floor: number;    // Which floor (0 = ground, up to cell's maxHeight)
}
```

**Multiple locations per cell:** A single cell (city block) can have many locations at different floors, or even the same floor. We don't track individual buildings - just locations within the block.

## Zone Characteristics

| Zone | Max Height | Typical Locations |
|------|------------|-------------------|
| downtown | 80-120 | Corporate HQs, luxury retail, high-rise apartments |
| commercial | 20-60 | Shops, offices, restaurants |
| industrial | 5-20 | Factories, warehouses, workshops |
| residential | 10-40 | Apartments, condos |
| slums | 5-30 | Cheap apartments, informal markets |
| government | 10-30 | City hall, services, transit hubs |

## Procedural Generation

### Zone Generation (Noise/Blob Algorithm)

Use simplex noise or similar to create organic zone blobs:

1. **Downtown core**: Center of map (around 16,16), small radius
2. **Government**: Adjacent to downtown
3. **Commercial**: Rings around downtown, scattered pockets
4. **Industrial**: Cluster on one side (e.g., north/east)
5. **Residential**: Opposite side from industrial
6. **Slums**: Buffer between industrial and residential, city edges

```typescript
function generateZones(grid: CityCell[][]): void {
  // 1. Place downtown at center
  // 2. Use noise to create organic zone boundaries
  // 3. Apply rules (industrial away from residential, etc.)
  // 4. Fill remaining with residential/commercial mix
}
```

### Height Map Generation

After zones are assigned:
```typescript
function generateHeights(grid: CityCell[][]): void {
  // Base height from zone type
  // Add noise variation within zone
  // Downtown peaks at center, tapers toward edges
  // Industrial stays low
}
```

### Initial Location Placement

Generate starting locations in appropriate zones:
- Factories → industrial zone
- Retail shops → commercial/downtown
- Apartments → residential/downtown/slums
- Warehouses → industrial
- Shelters → slums/residential edges
- City hall → government

### Initial Agent & Org Generation

- 10-15 starting agents
- 2-3 corporations (factory owners, shop chains)
- 1-2 landlord orgs (apartment owners)
- Agents assigned residences and some employed

## Travel System

**Distance calculation:**
```typescript
function getDistance(from: Location, to: Location): number {
  const dx = from.x - to.x;
  const dy = from.y - to.y;
  const horizontal = Math.sqrt(dx*dx + dy*dy);
  const vertical = Math.abs(from.floor - to.floor) * 0.1; // floors add minor time
  return horizontal + vertical;
}
```

**Travel phases (public transit default):**
```typescript
function getTravelPhases(distance: number, method: 'walk' | 'transit'): number {
  if (method === 'transit') {
    if (distance <= 15) return 0;  // About half city - free
    if (distance <= 30) return 1;  // Most of city
    return 2;                       // Edge to edge (max)
  } else { // walking
    if (distance <= 5) return 0;
    if (distance <= 12) return 1;
    if (distance <= 20) return 2;
    return 3;
  }
}
```

**Future vehicles** will extend the "0 phase" range.

## Map Visualization (Observer UI)

Basic 2D map panel showing:
- Grid cells colored by zone type
- Location markers (dots/icons)
- Optional: height indicated by brightness/shade

```
┌─────────────────────────────┐
│ MAP VIEW                    │
│ ░░▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░ │  ░ = residential
│ ░░▓▓████▓▓░░░░░░░░░░░░░░░░ │  ▓ = commercial
│ ░░▓▓████▓▓▓▓░░░░▒▒▒▒░░░░░░ │  █ = downtown
│ ░░░▓▓▓▓▓▓▓▓░░░░▒▒▒▒▒▒░░░░░ │  ▒ = industrial
│ ░░░░░░░░░░░░░░░▒▒▒▒▒▒░░░░░ │  ▪ = slums
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│         • = location        │
└─────────────────────────────┘
```

Not interactive for now - just visualization. Click locations in tables, not map.

## Objectives

### Phase A: Grid & Zone System
- [ ] Define CityCell and zone types
- [ ] Implement noise-based zone generation
- [ ] Generate height map per cell
- [ ] Store grid in simulation state

### Phase B: Location Coordinates
- [ ] Add x, y, floor to Location type
- [ ] Update location templates with coordinate ranges
- [ ] Locations spawned in appropriate zones

### Phase C: City Generator
- [ ] Create `generateCity()` main function
- [ ] Generate zones and heights
- [ ] Place initial locations
- [ ] Create agents and orgs
- [ ] Replace hardcoded Simulation.ts bootstrap

### Phase D: Distance & Travel
- [ ] Implement distance calculation
- [ ] Implement travel phase calculation
- [ ] Add currentLocation to Agent
- [ ] Basic travel state (travelingTo, progress)

### Phase E: Map Visualization
- [ ] Create MapPanel component for Observer UI
- [ ] Render grid cells colored by zone
- [ ] Show location markers
- [ ] Add as new tab/panel in UI

## Key Files to Create

| File | Purpose |
|------|---------|
| `src/generation/CityGenerator.ts` | Main generation orchestrator |
| `src/generation/ZoneGenerator.ts` | Noise-based zone generation |
| `src/generation/LocationPlacer.ts` | Place locations in appropriate zones |
| `src/simulation/systems/TravelSystem.ts` | Distance and travel calculations |
| `src/ui/panels/MapPanel.ts` | 2D map visualization |

## Key Files to Modify

| File | Change |
|------|--------|
| `src/types/entities.ts` | Add x, y, floor to Location; currentLocation to Agent |
| `src/simulation/Simulation.ts` | Use generator instead of hardcoded bootstrap |
| `src/ui/UIController.ts` | Add MapPanel to layout |

## Non-Goals (Defer)

- Interactive map (clicking to select locations)
- 3D visualization
- Pathfinding/routing
- Dynamic city growth
- Terrain features (water, parks)

## Notes

- 32x32 = 1024 cells, but locations are sparse (maybe 50-100 initially)
- One cell = one city block, can have multiple buildings/locations
- Coordinates visible to agents and in UI
- Map visualization is read-only, just shows what was generated
- Travel mostly free (0 phases), max 2 phases across entire city
