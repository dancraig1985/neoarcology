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
  zone: string;           // Zone ID (from config)
  maxHeight: number;      // Max floors buildings can have (1-120)
}

interface Location {
  // ... existing fields
  x: number;        // Grid x (0-31)
  y: number;        // Grid y (0-31)
  floor: number;    // Which floor (0 = ground, up to cell's maxHeight)
}
```

**Multiple locations per cell:** A single cell (city block) can have many locations at different floors, or even the same floor. We don't track individual buildings - just locations within the block.

## Data-Driven Zones

Zones defined in `data/config/zones.json` (not hardcoded):

```json
{
  "zones": {
    "downtown": {
      "name": "Downtown",
      "color": "#4a90d9",
      "heightRange": [80, 120],
      "spawnWeight": 0.05,
      "centerBias": 1.0,
      "description": "Central business district, tallest buildings"
    },
    "commercial": {
      "name": "Commercial",
      "color": "#9b59b6",
      "heightRange": [20, 60],
      "spawnWeight": 0.20,
      "centerBias": 0.6,
      "description": "Shops, offices, mixed use"
    },
    "industrial": {
      "name": "Industrial",
      "color": "#e67e22",
      "heightRange": [5, 20],
      "spawnWeight": 0.15,
      "centerBias": 0.2,
      "avoidZones": ["residential"],
      "description": "Factories, warehouses, workshops"
    },
    "residential": {
      "name": "Residential",
      "color": "#2ecc71",
      "heightRange": [10, 40],
      "spawnWeight": 0.35,
      "centerBias": 0.3,
      "description": "Apartments, condos"
    },
    "slums": {
      "name": "Slums",
      "color": "#7f8c8d",
      "heightRange": [5, 30],
      "spawnWeight": 0.15,
      "centerBias": 0.1,
      "edgeBias": 0.8,
      "description": "Cheap apartments, informal markets"
    },
    "government": {
      "name": "Government",
      "color": "#3498db",
      "heightRange": [10, 30],
      "spawnWeight": 0.10,
      "centerBias": 0.8,
      "description": "City hall, services, transit hubs"
    }
  }
}
```

**Zone properties:**
- `heightRange`: [min, max] floors for buildings in this zone
- `spawnWeight`: Relative probability during generation
- `centerBias`: 0-1, how much this zone prefers city center
- `edgeBias`: 0-1, how much this zone prefers city edges
- `avoidZones`: Zones this shouldn't be adjacent to
- `color`: For map visualization

## Data-Driven Location Spawn Constraints

Location templates specify where they can spawn in `data/templates/locations/*.json`:

```json
// data/templates/locations/factory.json
{
  "name": "Factory",
  "template": "factory",
  "tags": ["production", "wholesale"],
  "spawnConstraints": {
    "allowedZones": ["industrial"],
    "floorRange": [0, 5],
    "minDistanceFromCenter": 10,
    "maxPerCity": 5
  },
  "balance": { ... }
}

// data/templates/locations/retail_shop.json
{
  "name": "Retail Shop",
  "template": "retail_shop",
  "tags": ["retail", "commerce"],
  "spawnConstraints": {
    "allowedZones": ["commercial", "downtown", "residential"],
    "floorRange": [0, 3],
    "preferGroundFloor": true
  },
  "balance": { ... }
}

// data/templates/locations/luxury_apartment.json
{
  "name": "Luxury Apartment",
  "template": "luxury_apartment",
  "tags": ["residential", "housing"],
  "spawnConstraints": {
    "allowedZones": ["downtown", "commercial"],
    "floorRange": [20, 120],
    "preferHighFloor": true
  },
  "balance": { ... }
}

// data/templates/locations/shelter.json
{
  "name": "Public Shelter",
  "template": "shelter",
  "tags": ["residential", "public"],
  "spawnConstraints": {
    "allowedZones": ["slums", "industrial"],
    "floorRange": [0, 2],
    "maxPerCity": 2
  },
  "balance": { ... }
}
```

**Spawn constraint properties:**
- `allowedZones`: Which zones this location can spawn in
- `floorRange`: [min, max] floor this location can be on
- `preferGroundFloor`: Bias toward floor 0
- `preferHighFloor`: Bias toward max height
- `minDistanceFromCenter`: Minimum grid distance from center
- `maxDistanceFromCenter`: Maximum grid distance from center
- `maxPerCity`: Limit on how many can exist
- `minDistanceBetween`: Minimum distance between instances of this type

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

### Phase A: Data Config
- [ ] Create `data/config/zones.json` with zone definitions
- [ ] Add `spawnConstraints` to existing location templates
- [ ] Create config loader for zones
- [ ] Define CityCell type

### Phase B: Grid & Zone Generation
- [ ] Implement noise-based zone generation using zone config
- [ ] Generate height map per cell from zone heightRange
- [ ] Store grid in simulation state

### Phase C: Location Coordinates
- [ ] Add x, y, floor to Location type
- [ ] Implement location spawning that respects constraints
- [ ] Validate spawn constraints against zone config

### Phase D: City Generator
- [ ] Create `generateCity()` main function
- [ ] Generate zones and heights from config
- [ ] Place initial locations respecting constraints
- [ ] Create agents and orgs
- [ ] Replace hardcoded Simulation.ts bootstrap

### Phase E: Distance Calculation
- [ ] Implement distance calculation
- [ ] Implement travel phase calculation
- [ ] Export for use by PLAN-006

### Phase F: Map Visualization
- [ ] Create MapPanel component for Observer UI
- [ ] Render grid cells colored by zone (from config colors)
- [ ] Show location markers
- [ ] Add as new tab/panel in UI

## Key Files to Create

| File | Purpose |
|------|---------|
| `data/config/zones.json` | Zone definitions (data-driven) |
| `src/generation/CityGenerator.ts` | Main generation orchestrator |
| `src/generation/ZoneGenerator.ts` | Noise-based zone generation |
| `src/generation/LocationPlacer.ts` | Place locations respecting constraints |
| `src/simulation/systems/TravelSystem.ts` | Distance and travel calculations |
| `src/ui/panels/MapPanel.ts` | 2D map visualization |

## Key Files to Modify

| File | Change |
|------|--------|
| `src/types/entities.ts` | Add x, y, floor to Location |
| `src/config/ConfigLoader.ts` | Load zones.json |
| `data/templates/locations/*.json` | Add spawnConstraints |
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
