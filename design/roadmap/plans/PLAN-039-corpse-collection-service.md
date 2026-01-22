# PLAN-039: Public Health - Corpse Collection Service

**Status**: planned
**Priority**: P1 (high)
**Dependencies**: None

## Goal
Create a public health service that collects and disposes of dead agents' bodies, treating corpses as an economic good and establishing foundation for future government services and secondary corpse markets.

## Problem Statement

Currently when agents die, they simply vanish from the simulation. This is:
- **Unrealistic**: Bodies should persist in the world
- **Non-cyberpunk**: Dystopian cities have corpse cleanup crews
- **Missed opportunity**: Death has no visible consequences or economic impact
- **No foundation for public services**: Need government-funded services beyond private businesses

**Corpse collection service** solves multiple problems:
- Creates visible consequences of death (bodies pile up at locations)
- Adds 3-5 public sector jobs
- Establishes pattern for government services (sanitation, repair, security)
- Treats corpses as economic good (enables future markets: research labs, chop shops)
- Very cyberpunk/dystopian aesthetic

## Design Philosophy

**Corpses as an Economic Good:**
- Integrate death into the economy system (not special case)
- Corpses are inventory at locations (like provisions or luxury goods)
- Production: Agent death (not factories)
- Collection: Public health workers with ambulances (like logistics)
- Consumption: Disposal at clinics (for now)
- Future value: Research, spare parts, black market

**Reuse Existing Systems:**
- Corpses = inventory items (reuse inventory system)
- Collection = delivery pattern (reuse logistics/vehicle system)
- Public health org = specialized organization (existing org system)
- Clinic = depot analog (existing location system)

**City Government Preparation:**
- Public health funded by large initial budget (75,000 credits = 4 year runway)
- Future: City government will provide ongoing funding
- For now: Org slowly drains funds paying salaries

## Objectives

### Phase 1: Corpses as Economic Good
- [ ] Add "corpse" to economy.json
  - Size: 5.0 (large, bulky)
  - Wholesale price: 0 (free collection for now)
  - No production template (comes from death)
  - Demand type: public_service
  - Collection template: clinic

- [ ] Modify AgentSystem.ts death handling
  - When agent dies, add 1 corpse to location.inventory.corpse
  - Log death with location info
  - Remove agent from simulation as normal
  - Corpses persist at location until collected

### Phase 2: Organization & Locations
- [ ] Create public_health org template
  - Tags: ["public_health", "government", "legal"]
  - Starting credits: 75,000 (4-year runway)
  - Spawn: 1 at city generation
  - Owns: 1 clinic, 2 ambulances
  - Employs: 5 corpse cleaners (unskilled)

- [ ] Create clinic location template
  - Tags: ["public_health", "depot", "government"]
  - Employee slots: 5
  - Salary tier: unskilled
  - Acts as depot for corpse collection
  - Spawn: 1 at city generation

- [ ] Create ambulance vehicle template
  - Tags: ["vehicle", "emergency", "corpse_transport"]
  - Speed: 3 (same as cargo_truck)
  - Capacity: 25 (can carry 5 corpses at size 5.0 each)
  - Cost: 2000

### Phase 3: Corpse Collection Behavior
- [ ] Add "corpse_collection_shift" behavior
  - Similar to delivery driver pattern
  - Conditions: employed at clinic, at workplace, phasesSinceCorpseShift >= 8
  - Completion: after 16 phases or hunger > 80
  - Uses shift staggering (same as work shifts)

- [ ] Implement corpse collection executor
  - Scan city for locations with corpse inventory > 0
  - Travel to location with ambulance
  - Load corpses (transfer from location to vehicle cargo)
  - Return to clinic
  - Unload corpses (transfer to clinic inventory)
  - Repeat until shift ends or no corpses remain

### Phase 4: Disposal Mechanics
- [ ] Add corpse disposal system tick
  - Clinics dispose of X corpses per phase (config: 5)
  - Remove corpses from clinic inventory
  - Log disposal events
  - Acts as "corpse sink" removing them from simulation

- [ ] Add configuration for disposal rates
  - disposalRatePerPhase: 5
  - Can be tuned based on death rate

### Phase 5: UI & Metrics
- [ ] Update UI to show corpse inventory
  - Locations table: show corpse count column
  - Location details: show corpse inventory
  - Visual indicator for locations with corpses (skull icon?)

- [ ] Add corpse metrics tracking
  - trackCorpseGenerated() - when agent dies
  - trackCorpseCollected() - when picked up
  - trackCorpseDisposed() - when removed from simulation
  - Track total corpses in city at any time

## Implementation Details

### Corpses in economy.json

```json
{
  "goods": {
    "corpse": {
      "size": 5.0,
      "wholesalePrice": 0,
      "vertical": {
        "demandType": "public_service",
        "productionTemplate": null,
        "collectionTemplate": "clinic"
      }
    }
  }
}
```

### Public Health Org Template

File: `data/templates/orgs/public_health.json`

```json
{
  "id": "public_health",
  "name": "Public Health Services",
  "description": "Government-funded service collecting and disposing of corpses",
  "tags": ["public_health", "government", "legal"],
  "defaults": {
    "credits": { "min": 75000, "max": 75000 }
  },
  "generation": {
    "count": { "min": 1, "max": 1 },
    "spawnAtStart": true,
    "ownsLocations": ["clinic"],
    "ownsVehicles": [
      { "template": "ambulance", "count": 2 }
    ],
    "leaderBecomesEmployed": true
  }
}
```

**Budget Calculation:**
- 5 employees × 60 credits/week (unskilled avg) = 300 credits/week
- 48 weeks/year = 14,400 credits/year
- 4 years = 57,600 credits
- Buffer for vehicles, operating costs = 75,000 total

### Clinic Location Template

File: `data/templates/locations/clinic.json`

```json
{
  "id": "clinic",
  "name": "Public Health Clinic",
  "description": "Government facility for corpse collection and disposal",
  "tags": ["public_health", "depot", "government"],
  "spawnConstraints": {
    "allowedZones": ["industrial", "downtown"],
    "floorRange": [0, 2],
    "preferGroundFloor": true
  },
  "balance": {
    "openingCost": 0,
    "operatingCost": 0,
    "employeeSlots": 5,
    "salaryTier": "unskilled",
    "inventoryCapacity": 100
  },
  "generation": {
    "count": { "min": 1, "max": 1 },
    "spawnAtStart": true,
    "ownerOrgTemplate": "public_health"
  }
}
```

### Ambulance Vehicle Template

File: `data/templates/vehicles/ambulance.json`

```json
{
  "id": "ambulance",
  "name": "Ambulance",
  "description": "Emergency vehicle used for corpse transport",
  "tags": ["vehicle", "emergency", "corpse_transport"],
  "speed": 3,
  "capacity": 25,
  "cost": 2000
}
```

**Capacity math:** 25 capacity ÷ 5 size per corpse = 5 corpses per trip

### Agent Death Handler

Modify `src/simulation/systems/AgentSystem.ts`:

```typescript
// When agent dies (hunger >= 100, etc.):
const location = state.locations[agent.locationId];

// Add corpse to location inventory
location.inventory.corpse = (location.inventory.corpse || 0) + 1;

// Log death with location
ActivityLog.log({
  tick: ctx.tick,
  type: 'agent_death',
  agentId: agent.id,
  locationId: location.id,
  details: `${agent.name} died at ${location.name}, body left at scene`
});

// Track metric
Metrics.trackCorpseGenerated({
  agentId: agent.id,
  locationId: location.id,
  tick: ctx.tick
});

// Remove agent from simulation (as normal)
delete state.agents[agent.id];
```

### Corpse Collection Behavior

File: `data/config/behaviors.json`

```json
{
  "id": "corpse_collection_shift",
  "name": "Collecting Corpses",
  "priority": "normal",
  "executor": "collect_corpses",
  "conditions": {
    "hasEmployment": true,
    "atWorkplace": true,
    "atLocationWithTag": "depot",
    "needsBelow": { "hunger": 80 },
    "phasesSinceCorpseShift": 8
  },
  "completionConditions": {
    "or": [
      { "phasesWorkedThisShift": 16 },
      { "needsAbove": { "hunger": 80 } }
    ]
  },
  "params": {
    "shiftDuration": 16,
    "goodsType": "corpse"
  }
}
```

### Corpse Collection Executor

File: `src/simulation/behaviors/executors/collectCorpsesExecutor.ts`

**Pattern:** Nearly identical to delivery executor, but:
- Searches for locations with `inventory.corpse > 0`
- Loads corpses into ambulance
- Returns to clinic
- Unloads at clinic

**Key logic:**
```typescript
// Find nearest location with corpses
const targetLocation = findNearestLocationWithInventory(
  agent.locationId,
  'corpse',
  state.locations
);

if (!targetLocation) {
  // No corpses to collect, idle at depot
  return agent;
}

// Travel to location
if (agent.locationId !== targetLocation.id) {
  return setTravel(agent, targetLocation.id, ctx);
}

// Load corpses
const vehicle = getAgentVehicle(agent, state);
const corpsesToLoad = Math.min(
  targetLocation.inventory.corpse,
  Math.floor((vehicle.capacity - vehicle.currentLoad) / 5) // 5 size per corpse
);

targetLocation.inventory.corpse -= corpsesToLoad;
vehicle.currentLoad += corpsesToLoad * 5;
vehicle.cargo.corpse = (vehicle.cargo.corpse || 0) + corpsesToLoad;

Metrics.trackCorpseCollected({
  agentId: agent.id,
  locationId: targetLocation.id,
  count: corpsesToLoad,
  tick: ctx.tick
});

// Return to clinic and unload (similar to delivery return)
```

### Disposal System

Create `src/simulation/systems/CorpseDisposalSystem.ts`:

```typescript
export function processCorpseDisposal(
  state: SimulationState,
  ctx: TickContext
): SimulationState {
  const config = ctx.context.config.publicHealth;

  for (const location of Object.values(state.locations)) {
    if (!location.tags.includes('public_health')) continue;

    const corpseCount = location.inventory.corpse || 0;
    if (corpseCount === 0) continue;

    // Dispose up to X corpses per phase
    const disposed = Math.min(corpseCount, config.disposalRatePerPhase);
    location.inventory.corpse -= disposed;

    if (disposed > 0) {
      ActivityLog.log({
        tick: ctx.tick,
        type: 'corpse_disposal',
        locationId: location.id,
        details: `Disposed of ${disposed} corpse(s) at ${location.name}`
      });

      Metrics.trackCorpseDisposed({
        locationId: location.id,
        count: disposed,
        tick: ctx.tick
      });
    }
  }

  return state;
}
```

Call from main simulation tick (after all other systems).

### Configuration

New file: `data/config/public_health.json`

```json
{
  "disposalRatePerPhase": 5,
  "ambulanceCapacity": 25,
  "corpseSize": 5.0,
  "collectionShiftDuration": 16,
  "collectionShiftCooldown": 8
}
```

Or add to existing config file.

## Expected Impact

### Employment
- **New jobs**: 5 corpse cleaners (unskilled public sector)
- **Employment rate**: 57% → 60% (small boost, foundation for more public services)

### Simulation Depth
- **Visible death**: Bodies persist at locations (can see death impact)
- **Economic integration**: Death creates economic activity (collection service)
- **Public sector**: First government-funded service (not profit-driven)
- **Atmosphere**: Very cyberpunk (corpse cleanup crews, bodies in streets)

### Economic Activity
- **No revenue**: Public health spends but doesn't earn (government service)
- **Credits drain**: Org slowly spends down 75k budget over 4 years
- **Foundation for city budget**: When city government added, can fund public health

### System Reuse
- **Logistics pattern**: Collection works like delivery system
- **Inventory system**: Corpses are just another inventory item
- **Vehicle system**: Ambulances work like cargo trucks
- **Shift system**: Uses same work shift pattern

## Testing Plan

### Unit Tests
1. Agent death adds corpse to location inventory
2. Corpse cleaners detect locations with corpses
3. Ambulances load/transport/unload corpses correctly
4. Clinics dispose of corpses at configured rate

### Integration Tests
1. **Small scale (100 ticks)**:
   - Kill 5-10 agents manually
   - Verify corpses appear at locations
   - Verify cleaners collect them
   - Verify disposal at clinic

2. **Medium scale (500 ticks)**:
   - Natural deaths occur
   - System keeps up with death rate
   - No corpse accumulation beyond reasonable levels

3. **Long scale (1000 ticks)**:
   - Public health org remains solvent (budget > 0)
   - Consistent collection service
   - Corpses don't pile up indefinitely

### Success Metrics
- Corpse collection within 50-100 phases of death
- Clinic inventory never exceeds 50 corpses (disposal keeps up)
- Public health org budget > 50,000 after 1000 ticks (~1.5 years)
- No performance issues from corpse tracking

## Future Extensions

### Phase 2: Corpse Markets (PLAN-04X)

Once corpse collection is working, add economic value:

**Research Labs Buy Corpses:**
```json
"corpse": {
  "wholesalePrice": 100,
  "vertical": {
    "demandType": "business",
    "demandCondition": "isResearchLab"
  }
}
```

Research labs place B2B orders for corpses (existing order system handles it). Public health becomes a supplier, earns revenue!

**Black Market Chop Shops:**
- Illegal orgs collect corpses, extract cyberware
- Compete with public health
- Sell cyberware at discount (stolen goods)
- Crime system integration

**Corpse Shortage:**
- If demand > supply, corpses pile up
- Public health can't keep up
- Opportunity for illegal body snatchers
- Or city needs to fund more clinics

### Phase 3: Expanded Public Services (PLAN-04X+)

Same pattern applies to:

**Sanitation Workers:**
- Locations accumulate "trash" over time
- Sanitation workers collect trash with trucks
- Dump at waste processing facility
- Trash disposal system

**Infrastructure Repair:**
- Buildings take damage (fires, neglect)
- Repair crews travel to damaged buildings
- Fix damage using materials
- Building maintenance system

**Security Patrols:**
- Security guards patrol zones
- Prevent crime (future crime system)
- Respond to incidents
- Foundation for law enforcement

All follow the same pattern: government-funded workers travel to locations to perform maintenance tasks.

### Phase 4: City Government (Major Plan)

Eventually:
- Create "city_government" mega-org
- Collects taxes from businesses/agents
- Funds public services (health, sanitation, repair, security)
- Player can eventually influence or control in Org Mode

## Risk Mitigation

### Risk: Corpses pile up, system can't keep up
- **Mitigation**: Start with low death rate, tune disposal rate
- **Mitigation**: 2 ambulances, 5 workers should handle 1-2 deaths per week
- **Fallback**: Increase disposal rate or spawn more workers

### Risk: Public health goes bankrupt before city government ready
- **Mitigation**: 75k budget lasts 4 sim-years
- **Mitigation**: Can manually add credits if needed
- **Fallback**: Allow org to run at negative balance temporarily

### Risk: Performance issues from corpse tracking
- **Mitigation**: Corpses are just inventory numbers (not entities)
- **Mitigation**: No more expensive than tracking provisions
- **Fallback**: Limit max corpses per location

### Risk: Too complex, scope creep
- **Mitigation**: Corpses reuse existing inventory system
- **Mitigation**: Collection reuses existing logistics pattern
- **Mitigation**: No new fundamental systems, just new templates

## Implementation Order

1. Add corpse to economy.json
2. Add ambulance, clinic, public_health templates
3. Modify agent death to add corpse inventory
4. Add corpse collection behavior (copy delivery pattern)
5. Add disposal system tick
6. Test with manual kills (100 ticks)
7. Test with natural deaths (500 ticks)
8. Add UI indicators for corpses
9. Long run test (1000 ticks)
10. Tune disposal rate based on results

## Dependencies

**Existing systems reused:**
- Inventory system (corpses are inventory)
- Vehicle system (ambulances)
- Logistics pattern (collection mimics delivery)
- Shift system (work shifts with cooldowns)
- Organization system (public health org)

**No new core systems required.**

## Lessons Applied

From PLAN-037 (Work Shifts):
- Use shift staggering (workers start shifts at different times)
- Duration-based shifts (16 phases work, 8 cooldown)
- Emergency exits (hunger > 80 ends shift early)

From logistics/delivery system:
- Depot pattern (clinic = depot)
- Vehicle-based transport (ambulance = cargo truck)
- Load/unload mechanics (transfer inventory)

## Success Criteria

After implementation:
- [ ] Agents leave corpses when they die
- [ ] Corpses visible in location inventory
- [ ] Public health workers collect corpses
- [ ] Ambulances transport corpses to clinic
- [ ] Clinic disposes of corpses steadily
- [ ] System keeps up with death rate
- [ ] Public health org stays solvent
- [ ] No performance degradation
- [ ] UI shows corpse counts clearly

## Next Steps

After PLAN-039 succeeds:
1. **PLAN-040**: Home Life Behaviors (the original PLAN-038 companion)
2. **PLAN-041**: Entertainment venues or media production
3. **PLAN-042**: Additional public services (sanitation, repair)
4. **PLAN-04X**: Corpse markets and secondary uses

This establishes the foundation for government services while keeping scope manageable and reusing proven systems.
