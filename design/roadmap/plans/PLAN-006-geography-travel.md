# PLAN-006: Agent Location & Travel

**Status:** planned
**Priority:** P1 (high)
**Dependencies:** PLAN-005 (completed)
**Phase:** 3

## Goal

Establish agents as physical entities in the world - they exist at a specific location or are in transit between locations. Certain actions require physical presence.

## Core Concept: Physical Presence

Agents are always either:
1. **At a location** - can perform location-specific actions
2. **In transit** - traveling between locations, can only eat from inventory

```typescript
interface Agent {
  // ... existing fields

  // Location state (exactly one of these is set)
  currentLocation?: LocationRef;  // Where agent IS (undefined = in transit)

  // Travel state (only set while in transit)
  travelingFrom?: LocationRef;
  travelingTo?: LocationRef;
  travelMethod?: 'walk' | 'transit';
  travelPhasesRemaining?: number;
}
```

## Actions Requiring Physical Presence

| Action | Requires Presence At | Notes |
|--------|---------------------|-------|
| Buy provisions (retail) | Retail shop | Must travel to shop |
| Work | Workplace | Must be at assigned location |
| Rest/sleep | Home (future) | When housing implemented |
| Eat from inventory | Anywhere | Including while traveling |

## Actions That Remain "Magical" (No Travel)

| Action | Why |
|--------|-----|
| Wholesale purchases | Simplified logistics until vehicles added |
| Getting paid | Direct deposit / automatic |
| Getting hired | Phone interview / remote process |

## Public Spaces

Agents need somewhere to "be" when not working, shopping, or at home. **Public spaces** serve as default locations:

| Zone | Public Space Examples |
|------|----------------------|
| Downtown | Plaza, transit hub |
| Commercial | Mall atrium, market square |
| Industrial | Factory yard (limited) |
| Residential | Park, community center |
| Slums | Street corner, informal market |
| Government | City hall steps, transit station |

**Location template:** `public_space`
```json
{
  "id": "public_space",
  "tags": ["public"],
  "spawnConstraints": {
    "allowedZones": ["downtown", "commercial", "residential", "slums", "government"],
    "floorRange": [0, 0],
    "preferGroundFloor": true
  },
  "balance": {
    "employeeSlots": 0,
    "inventoryCapacity": 0
  },
  "generation": {
    "spawnAtStart": true,
    "count": { "min": 1, "max": 2 },
    "perZone": true
  }
}
```

**Uses:**
- Default location for unemployed agents at city generation
- Where agents go when idle (no work, not hungry, not tired)
- Future: leisure activities, social encounters, recruiting

**Initial Agent Placement:**
| Agent Type | Starting Location |
|------------|-------------------|
| Business owner | Their business location |
| Employed worker | Workplace OR nearest public space |
| Unemployed | Nearest public space to spawn point |

## Survival Priority

**Critical**: Agents must not work themselves to death. Decision priority:

1. **Emergency hunger** (hunger > 80): Drop everything, find food immediately
2. **Hungry + no food** (hunger > threshold, no provisions): Go buy food
3. **Normal duties**: Go to work, etc.

```typescript
function getAgentPriority(agent: Agent): 'emergency' | 'hungry' | 'normal' {
  if (agent.needs.hunger > 80) return 'emergency';
  if (agent.needs.hunger >= HUNGER_THRESHOLD && !hasFood(agent)) return 'hungry';
  return 'normal';
}
```

When in 'emergency' or 'hungry' state, agent will:
- Leave work if at work
- Cancel current travel if not going to food source
- Travel to nearest shop with stock
- Buy and eat

## Daily Routine (Future Enhancement)

Simple day structure to prevent 24/7 work:
- **Morning**: Travel to work
- **Work period**: Stay at workplace (production happens)
- **Evening**: Travel home or to shop
- **Night**: Rest (no actions)

For MVP, we can simplify: agents work in bursts and handle hunger interruptions.

## Travel Flow

1. Agent decides to go somewhere (shop, work, public space)
2. Calculate distance and travel phases using TravelSystem
3. If phases > 0, enter "traveling" state
4. Each phase: decrement travelPhasesRemaining, increase hunger
5. When 0: arrive at destination, clear travel state

```typescript
function startTravel(agent: Agent, destination: Location): Agent {
  const from = locations.find(l => l.id === agent.currentLocation);
  const distance = getDistance(from, destination);
  const method = agent.wallet.credits >= 12 ? 'transit' : 'walk'; // Keep buffer
  const phases = getTravelPhases(distance, method);

  if (phases === 0) {
    return { ...agent, currentLocation: destination.id };
  }

  return {
    ...agent,
    currentLocation: undefined,  // No longer at old location
    travelingFrom: from?.id,
    travelingTo: destination.id,
    travelMethod: method,
    travelPhasesRemaining: phases,
  };
}
```

## Mid-Transit Destination Changes

Agents can **redirect** while traveling if priorities change (e.g., emergency hunger):

```typescript
function redirectTravel(agent: Agent, newDestination: Location, locations: Location[]): Agent {
  if (!agent.travelingTo) return agent; // Not traveling

  // Calculate position "in transit" - approximate as midpoint or use travelingFrom
  const fromLoc = locations.find(l => l.id === agent.travelingFrom);
  const distance = getDistance(fromLoc, newDestination);
  const phases = getTravelPhases(distance, agent.travelMethod ?? 'walk');

  return {
    ...agent,
    travelingTo: newDestination.id,
    travelPhasesRemaining: phases, // Reset travel time to new destination
  };
}
```

**When to redirect:**
- Emergency hunger while going to work → redirect to nearest shop
- Job acquired while going to public space → redirect to workplace
- Better opportunity discovered mid-transit

**No redirect needed for:**
- Eating from inventory (can do while traveling)
- Getting paid (magical/automatic)

## Proximity-Based Decisions

Agents prefer closer locations:

### Shopping
```typescript
function findNearestShop(agent: Agent, locations: Location[]): Location | null {
  const shops = locations.filter(l =>
    l.tags.includes('retail') && (l.inventory['provisions'] ?? 0) > 0
  );
  const agentLoc = locations.find(l => l.id === agent.currentLocation);
  if (!agentLoc) return shops[0] ?? null; // If traveling, just pick any

  return shops.sort((a, b) =>
    getDistance(agentLoc, a) - getDistance(agentLoc, b)
  )[0] ?? null;
}
```

### Job Seeking
Prefer closer employers, but not exclusively - agents might take a further job for better pay.

## Travel Costs

- **Public transit**: 2 credits per trip
- **Walking**: Free but slower

Agents use transit if they can afford it (credits > transit cost + buffer).

## Objectives

### Phase A: Public Spaces
- [ ] Create `public_space` location template
- [ ] Generate 1-2 public spaces per zone at city creation
- [ ] Public spaces have no owner (ownerType: 'none')

### Phase B: Agent Location State
- [ ] Add currentLocation to Agent type
- [ ] Add travel fields (travelingTo, travelingFrom, travelMethod, travelPhasesRemaining)
- [ ] Initialize agents at starting locations:
  - Owners → their business
  - Others → nearest public space
- [ ] Update CityGenerator to assign initial locations

### Phase C: Travel Processing
- [ ] Implement startTravel() function in TravelSystem
- [ ] Implement redirectTravel() for mid-transit destination changes
- [ ] Process travel each phase (decrement phases, complete arrival)
- [ ] Log travel start/arrival/redirect events to ActivityLog
- [ ] Deduct transit cost when applicable

### Phase D: Presence-Required Actions
- [ ] Retail purchases require agent at shop location
- [ ] Agent must travel to shop before buying
- [ ] Traveling agents can redirect if priorities change

### Phase E: Survival Priority
- [ ] Implement hunger priority check
- [ ] Emergency hunger triggers redirect to nearest shop
- [ ] Agent leaves work when hungry and out of food
- [ ] Prevent death-by-overwork

### Phase F: Work Presence
- [ ] Workers must travel to workplace to "work"
- [ ] Track time spent at workplace
- [ ] Production only happens when workers are present
- [ ] Commute factors into daily routine

### Phase G: UI Updates
- [ ] Show agent's current location in table/detail view
- [ ] Show "Traveling to [location]" status when in transit
- [ ] Show travel phases remaining
- [ ] Add [TRAV] filter to activity log

## Key Files to Create

| File | Purpose |
|------|---------|
| `data/templates/locations/public_space.json` | Public space template (parks, plazas) |

## Key Files to Modify

| File | Change |
|------|--------|
| `src/types/entities.ts` | Add location/travel fields to Agent |
| `src/simulation/systems/TravelSystem.ts` | Add startTravel, redirectTravel, processTravel |
| `src/simulation/systems/AgentSystem.ts` | Process travel each phase, hunger priority |
| `src/simulation/systems/EconomySystem.ts` | Check presence before retail purchase |
| `src/simulation/systems/LocationSystem.ts` | Track worker presence for production |
| `src/generation/CityGenerator.ts` | Generate public spaces, assign initial agent locations |
| `src/ui/UIConfig.ts` | Add location/travel columns to agent table |
| `src/config/ConfigLoader.ts` | Add public_space to known templates |

## Non-Goals (Defer)

- Vehicle ownership (PLAN for later with cargo/logistics)
- Route optimization / pathfinding
- Traffic / congestion
- Housing / homes (separate plan)
- Day/night cycle (simplify for MVP)

## Notes

- Most trips are 0-1 phases - travel is a light friction, not tedious
- Agents can eat from inventory while traveling (no presence required)
- Agents can redirect mid-transit if priorities change (no forced arrival)
- Wholesale remains instant/magical until we add cargo vehicles
- Location proximity creates natural neighborhoods and commute patterns
- Public spaces give agents somewhere to "be" when idle
- Config is in `data/config/city.json` (zones) and `data/config/transport.json` (travel modes)
- Future: public spaces can host leisure activities, social encounters, street vendors
