# Agents

Agents are the atomic unit of the simulation. They have needs, make economic decisions, and can own businesses through organizations.

## Key Files
- `src/simulation/systems/AgentSystem.ts` - Hunger, eating, starvation
- `src/simulation/systems/EconomySystem.ts` - Economic decisions
- `src/types/entities.ts` - Agent type definition

## Agent Lifecycle

### Creation
Agents are created with randomized starting values:
- `hunger`: 0 to `startingHungerMax` (24)
- `credits`: `startingCreditsMin` (100) to `startingCreditsMax` (500)
- `provisions`: `startingProvisionsMin` (2) to `startingProvisionsMax` (4)

### Status Values
- `available` - Unemployed, can seek jobs or start businesses
- `employed` - Has a job at a location OR runs own business
- `dead` - Died (from starvation)

### Death
When `hunger >= hungerMax` (100), agent dies:
- Status set to `dead`
- `destroyed` field set to current phase
- Dead agents are skipped in all processing

## Hunger System

### Accumulation
Each phase, hunger increases by `hungerPerPhase` (0.89):
```
newHunger = agent.needs.hunger + 0.89
```

### Eating
When hunger >= `hungerThreshold` (25), agent tries to eat:
1. Check if has provisions in inventory
2. If yes: consume 1 provision, reset hunger to 0
3. If no: hunger stays high, agent will try to buy

### Starvation Warnings
- 50%+ of max: "is very hungry"
- 75%+ of max: "is starving!"
- 100% of max: Death

### Timeline
With hungerPerPhase=0.89 and threshold=25:
- ~28 phases (1 day) until first hunger event
- If no food for ~84 phases (3 days), death from starvation

## Economic Behavior

Each phase, agents make economic decisions in this priority:

### 1. Shop Owner Restocking
If agent leads an org with retail locations:
- Check each shop's inventory
- If below threshold (15), try to restock from wholesale

### 2. Buy Provisions
If hungry AND has no food AND has credits:
- Find retail locations with provisions
- Purchase 1 provision at retail price (15)
- Revenue goes to shop's owner org

### 3. Seek Employment
If `status === 'available'` and no job:
- Find locations with open employee slots
- Cannot work at own business
- Get hired with random salary (20-40)

### 4. Start Business
If credits >= `entrepreneurThreshold` (600) AND not already an owner:
- Can quit current job to start business
- Creates a micro-org to own the shop
- 70% of credits go to business capital
- 200 credits opening cost

## Balance Configuration

From `data/config/balance.json`:
```json
{
  "agent": {
    "hungerPerPhase": 0.89,
    "hungerThreshold": 25,
    "hungerMax": 100,
    "provisionsPerMeal": 1,
    "startingHungerMin": 0,
    "startingHungerMax": 24,
    "startingCreditsMin": 100,
    "startingCreditsMax": 500,
    "startingProvisionsMin": 2,
    "startingProvisionsMax": 4,
    "entrepreneurThreshold": 600,
    "inventoryCapacity": 10
  }
}
```

## Key Invariants

1. Dead agents are never processed
2. Agents eat from personal inventory before buying
3. Only `available` status agents seek employment
4. Business owners (org leaders) can't work as employees at their own business
5. Employed agents CAN quit to start a business if wealthy enough
