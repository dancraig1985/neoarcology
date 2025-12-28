# PLAN-005: City Structure & Procedural Generation

**Status:** planned
**Priority:** P1 (high)
**Dependencies:** PLAN-004 (completed)
**Phase:** 2 (was skipped, doing now)

## Goal

Define the city's spatial structure and procedurally generate the initial city layout.

## Context

We skipped procedural generation (Phase 2) to get the Observer UI working. Now we need to define:
- What sectors exist and how they relate to each other
- How locations are positioned within the city
- Initial city generation for a playable starting state

**Key insight:** Keep it simple. We don't need a 2D grid - just a conceptual structure that enables distance calculations and logical groupings.

## City Structure

### Sectors (Conceptual Zones)

The city is divided into **6 sectors** arranged in a ring around downtown:

```
        NORTH
    NW        NE
WEST  DOWNTOWN  EAST
    SW        SE
        SOUTH
```

**Sector relationships:**
```typescript
const SECTOR_ADJACENCY: Record<string, string[]> = {
  'downtown': ['north', 'south', 'east', 'west', 'ne', 'nw', 'se', 'sw'],
  'north': ['downtown', 'ne', 'nw'],
  'south': ['downtown', 'se', 'sw'],
  'east': ['downtown', 'ne', 'se'],
  'west': ['downtown', 'nw', 'sw'],
  'ne': ['downtown', 'north', 'east'],
  'nw': ['downtown', 'north', 'west'],
  'se': ['downtown', 'south', 'east'],
  'sw': ['downtown', 'south', 'west'],
};
```

**Sector character** (influences what spawns there):
| Sector | Character | Typical Locations |
|--------|-----------|-------------------|
| downtown | Commercial hub | Corporate HQs, luxury retail |
| north | Industrial | Factories, warehouses |
| south | Residential | Apartments, markets |
| east | Mixed commercial | Shops, offices |
| west | Working class | Affordable housing, local shops |
| ne/nw/se/sw | Transitional | Mix of adjacent sectors |

### Districts (Subdivisions)

Each sector contains **districts** - named neighborhoods:
- Downtown: "financial", "plaza", "tower-row"
- North: "factory-district", "warehouse-row", "freight-yard"
- South: "riverside", "old-town", "suburbs"
- etc.

Districts are generated procedurally with thematic names.

### Coordinates

```typescript
interface Coordinates {
  sector: string;       // Which sector (e.g., "north", "downtown")
  district: string;     // Which district within sector
  distance: number;     // 0-100, distance from downtown center
  elevation: number;    // 0 = ground, higher = upper floors
}
```

**Distance meaning:**
- 0-20: Downtown core
- 20-50: Inner city
- 50-80: Outer city
- 80-100: City edge/outskirts

## Procedural Generation

### Initial City Generation

Generate a starting city with:
1. **Core infrastructure** (always present)
   - City Hall (downtown)
   - Public transit hub (downtown)
   - Central market (downtown)

2. **Industrial sector** (north)
   - 1-2 factories (wholesale production)
   - 1 warehouse

3. **Commercial locations** (scattered)
   - 3-5 retail shops
   - Placed in various sectors

4. **Residential** (south, west)
   - 1 apartment building (multi-unit)
   - 1 public shelter

5. **Starting agents**
   - 10-15 agents with varied stats
   - Distributed across residential locations
   - Some employed, some available

### Generation Algorithm

```typescript
function generateCity(config: CityGenConfig): City {
  // 1. Create sectors
  // 2. Generate districts for each sector
  // 3. Place required locations (factory, shops, etc.)
  // 4. Generate agents
  // 5. Assign agents to residences
  // 6. Create initial orgs (corps, landlords)
  // 7. Establish initial employment
}
```

## Objectives

### Phase A: Sector System
- [ ] Define sector enum/constants
- [ ] Implement sector adjacency lookup
- [ ] Add sector character/tags

### Phase B: District Generation
- [ ] Create district name generator (thematic per sector)
- [ ] Generate 2-4 districts per sector
- [ ] Store districts in simulation state

### Phase C: Coordinate System
- [ ] Finalize Coordinates type
- [ ] Update Location type with required coordinates
- [ ] Implement coordinate generation for new locations

### Phase D: City Generator
- [ ] Create `generateCity()` function
- [ ] Generate required infrastructure
- [ ] Generate initial agents with distribution
- [ ] Create starting orgs (corps, landlords)

### Phase E: Bootstrap Integration
- [ ] Replace hardcoded Simulation.ts bootstrap with generator
- [ ] Make generation configurable (city size, agent count)
- [ ] Ensure economy is viable from start

## Key Files to Create

| File | Purpose |
|------|---------|
| `src/generation/CityGenerator.ts` | Main generation logic |
| `src/generation/DistrictNames.ts` | Thematic name generation |
| `src/generation/sectors.ts` | Sector definitions and adjacency |
| `data/config/cityGen.json` | Generation parameters |

## Key Files to Modify

| File | Change |
|------|--------|
| `src/types/entities.ts` | Ensure coordinates are complete |
| `src/simulation/Simulation.ts` | Use generator instead of hardcoded bootstrap |

## Non-Goals (Defer)

- Visual map rendering
- Dynamic city growth (new buildings over time)
- Terrain features (rivers, hills)
- Multiple cities/regions

## Notes

- Sectors are conceptual, not geometric - don't overthink spatial accuracy
- District names add flavor but don't affect mechanics
- Generation should be deterministic given a seed (for reproducibility)
- Start small: 20-30 locations, 10-15 agents
