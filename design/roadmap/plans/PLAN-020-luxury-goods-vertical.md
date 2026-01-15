# PLAN-020: Luxury Goods Vertical

**Status:** completed
**Priority:** P2 (medium)
**Dependencies:** PLAN-018 (entrepreneurship overhaul)

## Goal

Add a luxury goods vertical where wealthy agents (office workers, business owners) can purchase high-end goods for a significant one-time leisure boost.

## Vertical Structure

```
Luxury Factory → Luxury Boutique → Wealthy Agent
      │                │                │
  produces        sells at          buys for
  luxury_goods    high markup       leisure boost
  (wholesale)     (200 credits)     (discretionary)
```

## Design

### Target Audience
- Agents with professional salaries (120-160/week from PLAN-018)
- Business owners receiving dividends
- Agents with 250+ credits who want faster leisure recovery

### Satisfaction Model
Luxury goods provide a **larger one-time leisure reduction** than alcohol:
- Alcohol at pub: ~15-20 leisure reduction per drink
- Luxury purchase: ~40-50 leisure reduction (configurable)
- Makes sense: expensive shiny object provides more lasting satisfaction

### Purchase Frequency
Unlike food (constant need) or alcohol (frequent), luxury goods are:
- Purchased infrequently (when leisure need is moderate AND wealthy)
- Don't stack in inventory (1 max - "you already have a nice thing")
- Represent status/comfort purchases, not survival

## New Location Templates

### luxury_factory.json
```json
{
  "name": "Luxury Goods Factory",
  "tags": ["wholesale", "production", "luxury"],
  "employeeSlots": 3,
  "salaryTier": "skilled",
  "produces": "luxury_goods",
  "productionRate": 2,
  "capacity": 30,
  "openingCost": 600
}
```

### luxury_boutique.json
```json
{
  "name": "Luxury Boutique",
  "tags": ["retail", "luxury"],
  "employeeSlots": 2,
  "salaryTier": "skilled",
  "inventoryGood": "luxury_goods",
  "capacity": 20,
  "openingCost": 400
}
```

## New Behavior

### buying_luxury
```json
{
  "id": "buying_luxury",
  "name": "Buy Luxury Goods",
  "priority": "normal",
  "executor": "purchase",
  "conditions": {
    "needsAbove": { "leisure": 40 },
    "hasCreditsAbove": 250,
    "inventoryBelow": { "luxury_goods": 1 },
    "notTraveling": true
  },
  "completionConditions": {
    "inventoryAbove": { "luxury_goods": 0 }
  },
  "executorParams": {
    "goodsType": "luxury_goods",
    "locationTag": "luxury"
  }
}
```

## Executor Changes

The purchase executor needs to handle luxury goods consumption:
- When agent has `luxury_goods` in inventory
- Consume the item (remove from inventory)
- Apply large leisure reduction (from config)
- This could happen automatically when agent has leisure need

Alternative: Create `consume_luxury` behavior that triggers when:
- Agent has luxury_goods in inventory
- Agent has leisure need > 30
- Instantly consumes item and reduces leisure

## Config Updates

### agents.json (leisure section)
```json
{
  "leisure": {
    "pubSatisfaction": 20,
    "parkSatisfactionPerPhase": 5,
    "luxurySatisfaction": 45
  }
}
```

### economy.json
Already has luxury_goods defined:
```json
"luxury_goods": { "size": 0.5, "retailPrice": 200, "wholesalePrice": 120 }
```

## Implementation Steps

- [x] Create `luxury_factory.json` template
- [x] Create `luxury_boutique.json` template
- [x] Add `buying_luxury` behavior to behaviors.json
- [x] Update purchase executor to check stock at luxury boutiques before travel (existing fix from leisure)
- [x] Add `luxurySatisfaction` config value (70, ~1.75x alcohol's 40)
- [x] Add consumption logic (separate `consume_luxury` behavior and executor)
- [x] Update CityGenerator to spawn luxury locations
- [x] Test: wealthy agents should buy luxury goods

## Files Created

| File | Type |
|------|------|
| `data/templates/locations/luxury_factory.json` | NEW |
| `data/templates/locations/luxury_boutique.json` | NEW |

## Files Modified

| File | Changes |
|------|---------|
| `data/config/behaviors.json` | Add buying_luxury and consume_luxury behaviors |
| `data/config/agents.json` | Add luxurySatisfaction: 70 |
| `src/simulation/behaviors/executors/index.ts` | Add consume_luxury executor |
| `src/simulation/systems/EconomySystem.ts` | Update restock to handle luxury tag |
| `src/generation/CityGenerator.ts` | Spawn luxury boutiques |

## Success Criteria

- [x] Luxury factories produce luxury_goods
- [x] Luxury boutiques restock from factories
- [x] Wealthy agents (250+ credits) buy luxury goods
- [x] Purchase provides ~1.75x satisfaction vs alcohol (70 vs 40)
- [x] Agents don't hoard luxury goods (max 1 in inventory via behavior conditions)
- [x] Economy remains balanced (luxury is optional, not required)
