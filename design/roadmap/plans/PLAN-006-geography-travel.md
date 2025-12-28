# PLAN-006: Geography & Travel

**Status:** planned
**Priority:** P1 (high)
**Dependencies:** PLAN-005 (city structure)
**Phase:** 3

## Goal

Give locations spatial positions and make agents travel between them, enabling proximity-based decisions and future vehicle systems.

## Context

Currently locations exist in a void - no concept of distance or travel time. We need:
- Locations to have positions (including vertical/elevation for high-rises)
- Agents to have a current location
- Travel time between locations
- Decision-making based on proximity (closest shop, nearest factory)

**Not in scope:** Vehicles (future plan), 2D/3D grid maps, pathfinding algorithms.

## Coordinate System

Use a simple abstract coordinate system, not a grid:

```typescript
interface Coordinates {
  sector: string;        // e.g., "north", "industrial", "downtown"
  district: string;      // e.g., "block-7", "tower-district"
  distance: number;      // Distance from city center (0-100)
  elevation: number;     // Floor/level (0 = ground, 50+ = high-rise)
}
```

**Distance calculation:** Combine horizontal distance + sector penalties + elevation difference.
- Same sector: base distance only
- Adjacent sectors: +20 penalty
- Opposite sectors: +50 penalty
- Elevation difference: +1 per 10 floors (elevators, stairs)

## Agent Location

```typescript
interface Agent {
  // ... existing fields
  currentLocation?: LocationRef;  // Where agent currently is
  travelingTo?: LocationRef;      // If in transit
  travelProgress?: number;        // 0-100% of journey complete
}
```

## Travel Mechanics

**Walking:** Base speed, always available
- Speed: ~10 distance units per phase
- Cost: Free

**Public Transit:** Faster but costs credits
- Speed: ~30 distance units per phase
- Cost: 2 credits per trip
- Only available at ground level (elevation 0-5)

**Travel Time:** `ceil(distance / speed)` phases

## Objectives

### Phase A: Location Coordinates
- [ ] Add `coordinates` to Location type (already partially exists)
- [ ] Update location templates with meaningful coordinates
- [ ] Implement `calculateDistance(loc1, loc2)` function
- [ ] Add sector definitions to simulation config

### Phase B: Agent Location Tracking
- [ ] Add `currentLocation` to Agent type
- [ ] Initialize agents at a starting location
- [ ] Track agent location changes in activity log

### Phase C: Travel System
- [ ] Add `travelingTo`, `travelProgress` to Agent
- [ ] Implement `startTravel(agent, destination, method)` function
- [ ] Process travel progress each phase
- [ ] Log travel start/arrival events

### Phase D: Proximity-Based Decisions
- [ ] Update shop selection: agents go to closest retail location
- [ ] Update restock: shops buy from closest wholesale location
- [ ] Update job seeking: prefer closer employers
- [ ] Add travel time to activity considerations

### Phase E: UI Updates
- [ ] Show agent's current location in detail view
- [ ] Show location coordinates in detail view
- [ ] Add "traveling" status indicator

## Key Files to Modify

| File | Change |
|------|--------|
| `src/types/entities.ts` | Add travel fields to Agent |
| `src/simulation/systems/AgentSystem.ts` | Process travel each phase |
| `src/simulation/systems/EconomySystem.ts` | Use proximity for commerce |
| `data/config/simulation.json` | Add sector definitions |
| `data/templates/locations/*.json` | Add coordinates |

## Key Files to Create

| File | Purpose |
|------|---------|
| `src/simulation/systems/TravelSystem.ts` | Distance calculation, travel processing |

## Non-Goals (Defer)

- Vehicle ownership and driving
- Traffic/congestion simulation
- Visual map representation
- Pathfinding between obstacles
- Public transit routes/schedules

## Notes

- Keep distance abstract - not tied to real-world units
- Sectors are conceptual (industrial, residential, commercial) not geometric
- Elevation enables future aerial vehicles to skip ground travel
- Travel should feel like a cost/tradeoff, not tedious micromanagement
