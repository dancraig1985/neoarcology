# PLAN-006: Agent Travel & Proximity Decisions

**Status:** planned
**Priority:** P1 (high)
**Dependencies:** PLAN-005 (city structure, distance calculation)
**Phase:** 3

## Goal

Make agents travel between locations and use proximity for decision-making.

## Context

PLAN-005 creates the city grid and distance calculations. This plan makes agents actually use that system:
- Agents have a current location
- Traveling takes time (phases)
- Decisions factor in distance (closest shop, nearest job)

## Agent Location State

```typescript
interface Agent {
  // ... existing fields
  currentLocation: LocationRef;   // Where agent is right now

  // Travel state (only set while traveling)
  travelingTo?: LocationRef;      // Destination
  travelMethod?: 'walk' | 'transit';
  travelPhasesRemaining?: number; // Phases until arrival
}
```

## Travel Flow

1. Agent decides to go somewhere (shop, work, home)
2. Calculate distance and travel phases
3. If phases > 0, agent enters "traveling" state
4. Each phase, decrement travelPhasesRemaining
5. When 0, agent arrives at destination

```typescript
function startTravel(
  agent: Agent,
  destination: Location,
  method: 'walk' | 'transit'
): Agent {
  const from = getLocation(agent.currentLocation);
  const distance = getDistance(from, destination);
  const phases = getTravelPhases(distance, method);

  if (phases === 0) {
    // Instant travel
    return { ...agent, currentLocation: destination.id };
  }

  return {
    ...agent,
    travelingTo: destination.id,
    travelMethod: method,
    travelPhasesRemaining: phases,
  };
}

function processTravelTick(agent: Agent): Agent {
  if (!agent.travelingTo) return agent;

  const remaining = (agent.travelPhasesRemaining ?? 1) - 1;

  if (remaining <= 0) {
    // Arrived
    return {
      ...agent,
      currentLocation: agent.travelingTo,
      travelingTo: undefined,
      travelMethod: undefined,
      travelPhasesRemaining: undefined,
    };
  }

  return { ...agent, travelPhasesRemaining: remaining };
}
```

## Proximity-Based Decisions

Update existing systems to prefer closer locations:

### Shopping
```typescript
// Before: random shop selection
// After: closest shop with stock
function findNearestShop(agent: Agent, locations: Location[]): Location | null {
  const shops = locations.filter(l => l.tags.includes('retail') && l.inventory.provisions > 0);
  return shops.sort((a, b) =>
    getDistance(agent.currentLocation, a) - getDistance(agent.currentLocation, b)
  )[0] ?? null;
}
```

### Restocking (Shop → Wholesale)
```typescript
// Shops buy from nearest wholesale location
function findNearestWholesale(shop: Location, locations: Location[]): Location | null {
  const wholesalers = locations.filter(l => l.tags.includes('wholesale'));
  return wholesalers.sort((a, b) =>
    getDistance(shop, a) - getDistance(shop, b)
  )[0] ?? null;
}
```

### Job Seeking
```typescript
// Prefer closer employers (but not exclusively)
function findJob(agent: Agent, locations: Location[]): Location | null {
  const hiring = locations.filter(l => l.employees.length < l.employeeSlots);
  // Sort by distance, but allow some randomness
  // Agents might take a slightly further job if it pays better
}
```

## Travel Costs

**Public transit:** 2 credits per trip (deducted when starting travel)
**Walking:** Free

Agents choose transit by default if they can afford it. Fall back to walking if broke.

```typescript
function chooseTransitMethod(agent: Agent): 'walk' | 'transit' {
  const transitCost = 2;
  if (agent.wallet.credits >= transitCost + 10) { // Keep buffer
    return 'transit';
  }
  return 'walk';
}
```

## Objectives

### Phase A: Agent Location Tracking
- [ ] Add currentLocation to Agent type
- [ ] Initialize agents at their residence (or random location)
- [ ] Track location in activity log

### Phase B: Travel Processing
- [ ] Implement startTravel() function
- [ ] Process travel each phase in tick
- [ ] Log travel start/arrival events
- [ ] Deduct transit cost when applicable

### Phase C: Proximity Shopping
- [ ] Update agent shopping to use nearest shop
- [ ] Agent travels to shop, then buys
- [ ] Handle "no nearby shop with stock" case

### Phase D: Proximity Restocking
- [ ] Shops restock from nearest wholesale
- [ ] Travel time for restock runs

### Phase E: Proximity Employment
- [ ] Job seeking prefers closer locations
- [ ] Commute distance as factor in job decisions

### Phase F: UI Updates
- [ ] Show agent's current location in table/detail
- [ ] Show "traveling to X" status
- [ ] Add travel phases remaining to detail view

## Key Files to Modify

| File | Change |
|------|--------|
| `src/types/entities.ts` | Add travel fields to Agent |
| `src/simulation/systems/AgentSystem.ts` | Process travel each phase |
| `src/simulation/systems/EconomySystem.ts` | Use proximity for commerce |
| `src/ui/UIConfig.ts` | Add location/travel columns |

## Non-Goals (Defer)

- Vehicle ownership
- Route optimization
- Traffic/congestion
- Fast travel / teleportation

## Notes

- Most trips are 0 phases (instant) - travel is a light cost, not tedious
- Transit vs walking is mostly about money, not major time difference
- Agents don't pathfind - they just "go" places (abstracted)
- Location proximity creates natural neighborhoods and commute patterns
