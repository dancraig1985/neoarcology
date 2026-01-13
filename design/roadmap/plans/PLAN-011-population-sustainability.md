# PLAN-011: Population Sustainability

**Status:** planned
**Priority:** P1 (high)
**Dependencies:** PLAN-010 (headless testing - for validation)
**Phase:** 3

## Goal

Ensure the simulation can sustain its population over time through agent spawning/immigration, preventing inevitable extinction.

## Context

Currently, agents can only die - none are created after initial generation. This means:
- Population can only decline
- Eventually everyone dies
- No long-term sustainability possible

For a self-sustaining city sim, we need population inflow to balance deaths.

**Design philosophy:** Simple and automatic. No complex birth/family mechanics - just "new people arrive in the city" when population drops.

## Immigration Mechanic

### Trigger Conditions

New agents spawn when population drops below a threshold:

```typescript
interface PopulationConfig {
  targetPopulation: number;     // Desired population (e.g., 15)
  minPopulation: number;        // Minimum before emergency spawning (e.g., 5)
  spawnCheckInterval: number;   // Phases between checks (e.g., 28 = weekly)
  spawnRate: number;            // Max new agents per check (e.g., 2)
}
```

### Spawning Logic

Each week (or configured interval):
1. Count living agents
2. If below `targetPopulation`, spawn 1-2 new agents
3. If below `minPopulation`, spawn more aggressively
4. New agents are "immigrants" arriving in the city

```typescript
function checkPopulationSpawning(
  agents: Agent[],
  config: PopulationConfig,
  phase: number
): Agent[] {
  const living = agents.filter(a => a.status !== 'dead').length;

  if (living >= config.targetPopulation) {
    return []; // No spawning needed
  }

  const deficit = config.targetPopulation - living;
  const emergency = living < config.minPopulation;

  // Spawn 1-2 normally, more in emergency
  const toSpawn = emergency
    ? Math.min(deficit, config.spawnRate * 2)
    : Math.min(deficit, config.spawnRate);

  return generateNewAgents(toSpawn, phase);
}
```

### New Agent Properties

Spawned agents arrive as "immigrants" with:
- **Starting credits**: Random within configured range (enough to survive a few weeks)
- **Starting provisions**: Small amount (1-3)
- **Status**: `available` (unemployed, seeking work)
- **Location**: Random public location or city edge
- **No residence**: Must find housing (when PLAN-012 is implemented)

```typescript
function generateNewAgents(count: number, phase: number): Agent[] {
  const agents: Agent[] = [];
  for (let i = 0; i < count; i++) {
    agents.push({
      id: generateId(),
      name: generateName(),
      template: 'civilian',
      status: 'available',
      wallet: { credits: randomInRange(50, 150) },
      inventory: { provisions: randomInRange(1, 3) },
      needs: { hunger: randomInRange(0, 20) },
      location: findSpawnLocation(),
      // ... other defaults
    });
  }
  return agents;
}
```

## Activity Log Integration

Log immigration events:

```typescript
ActivityLog.info(
  phase,
  'immigration',
  `arrived in the city seeking opportunity`,
  agent.id,
  agent.name
);
```

## Configuration

**In `data/config/simulation.json`:**
```json
{
  "population": {
    "target": 15,
    "minimum": 5,
    "spawnCheckInterval": 28,
    "spawnRate": 2,
    "immigrantCredits": { "min": 50, "max": 150 },
    "immigrantProvisions": { "min": 1, "max": 3 }
  }
}
```

## Objectives

### Phase A: Configuration
- [ ] Add population config to `simulation.json`
- [ ] Add types to ConfigLoader

### Phase B: Spawn Logic
- [ ] Implement `checkPopulationSpawning()` function
- [ ] Integrate into weekly tick in Simulation.ts
- [ ] Generate agents using existing agent generation code

### Phase C: Spawn Location
- [ ] Determine where new agents appear
- [ ] Option: Random public location
- [ ] Option: City edge / transit hub (future)

### Phase D: Logging
- [ ] Log immigration events to ActivityLog
- [ ] Include in headless test metrics

### Phase E: Validation
- [ ] Run headless tests to verify population stabilizes
- [ ] Tune parameters for balance
- [ ] Ensure economy handles population changes

## Key Files

| File | Change |
|------|--------|
| `data/config/simulation.json` | Add population config |
| `src/config/ConfigLoader.ts` | Add PopulationConfig type |
| `src/simulation/Simulation.ts` | Add spawn check to weekly tick |
| `src/generation/AgentGenerator.ts` | Reuse for spawning (or extract) |
| `src/simulation/Metrics.ts` | Track immigration in metrics |

## Balance Considerations

### Economy Impact
- New agents bring credits into the economy (immigrantCredits)
- New agents consume food (increase demand)
- New agents seek jobs (increase labor supply)

### Tuning Questions (Validate with PLAN-010)
- Does economy support more people?
- Do businesses scale with population?
- Is food production sufficient?

### Expected Behavior
With target=15, minimum=5, spawnRate=2:
- If 12 alive → spawn 1-2 agents
- If 5 alive → spawn up to 4 agents (emergency)
- Population should hover around target

## Non-Goals (Defer)

- Birth/reproduction mechanics
- Family relationships
- Age/aging
- Immigration from specific places
- Emigration (agents leaving)
- Population growth beyond target

## Notes

- Keep it simple: people arrive when needed
- No narrative explanation required (it's a city, people come and go)
- Spawned agents are identical to initial agents in capability
- This enables long-running simulations without extinction
- Works with housing (PLAN-012): immigrants start homeless, seek housing
- Emergency spawning prevents total collapse
