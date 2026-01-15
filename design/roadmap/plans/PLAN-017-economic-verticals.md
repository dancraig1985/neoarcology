# PLAN-017: Economic Verticals - Separate Food and Alcohol Supply Chains

**Status:** completed
**Priority:** P1 (high)
**Dependencies:** PLAN-016 (behavior system)

## Goal

Create separate economic verticals where food (sustenance) and alcohol (discretionary) have independent supply chains, enabling better economic balance and providing a template for future verticals.

## Objectives

- [x] Split `factory.json` into `provisions_factory.json` and `brewery.json`
- [x] Update corporation template to own both factory types
- [x] Increase pub count to scale with population (4 pubs)
- [x] Refactor CityGenerator to dynamically find production templates
- [x] Fix behavior system: agents stop working when hungry to buy food
- [x] Implement alcohol purchase in leisure behavior
- [x] Fix retail sales counter in sim-test

## Implementation Notes

### Economic Verticals Pattern

Each vertical has:
1. **Production location** (wholesale tag) - Creates the good
2. **Retail location** (retail tag) - Sells to consumers
3. **Consumer behavior** - When/why agents buy
4. **Restock logic** - Wholesale → retail transfer

### Food Vertical (Sustenance)
```
Provisions Factory → Retail Shop/Restaurant → Agent
      │                      │                   │
  2-3 factories         10-12 shops          ~200 agents
  3 employees each      Restock from         Eat when hungry
                        wholesale
```

### Alcohol Vertical (Discretionary)
```
Brewery → Pub → Agent
    │       │       │
3-4 breweries  4 pubs     Agents with
3 employees    Restock    leisure need
each           alcohol    buy drinks
```

### Behavior Fix

The critical fix was changing `working` behavior from `completionConditions: { never: true }` to `completionConditions: { needsAbove: { hunger: 50 } }`. This allows agents to stop working when hungry enough to buy food.

## Files Modified

| File | Changes |
|------|---------|
| `data/templates/locations/factory.json` | DELETED |
| `data/templates/locations/provisions_factory.json` | NEW |
| `data/templates/locations/brewery.json` | NEW |
| `data/templates/locations/pub.json` | Updated count to 4 |
| `data/templates/orgs/corporation.json` | Updated ownsLocations |
| `data/config/behaviors.json` | Added hunger thresholds to working/commuting |
| `src/simulation/behaviors/executors/index.ts` | Leisure executor buys alcohol |
| `src/generation/CityGenerator.ts` | Dynamic production template lookup |

## Verification

- [x] Provisions factories spawn correctly
- [x] Breweries spawn correctly
- [x] Retail shops restock provisions
- [x] Pubs restock alcohol from breweries
- [x] Agents buy alcohol when visiting pubs
- [x] Retail sales counter working (~23/week)
- [x] Food economy functional (agents survive)
