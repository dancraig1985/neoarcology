# PLAN-018: Entrepreneurship System Overhaul

**Status:** completed
**Priority:** P1 (high)
**Dependencies:** PLAN-017 (economic verticals)

## Goal

Create a scalable, market-driven entrepreneurship system where agents make informed business decisions based on real demand signals, designed to support 20+ economic verticals.

## Problem

Current entrepreneurship logic in `EconomySystem.chooseBestBusiness()` has hardcoded demand checks for food/housing/leisure. This doesn't scale as we add new verticals (data storage, luxury goods, weapons, medical, etc.).

## Objectives

- [x] Create `DemandAnalyzer` system that calculates demand for ANY good dynamically
- [ ] Implement "pondering" phase where agents research the market before deciding (deferred)
- [x] Make business selection data-driven via config (not hardcoded if-statements)
- [x] Add stratified salary tiers: office > factory > retail
- [x] Support vertical-specific demand signals (B2B vs B2C)

## Architecture

### Demand Signal Types

```typescript
interface DemandSignal {
  vertical: string;           // 'food', 'alcohol', 'data_storage', etc.
  demandType: 'consumer' | 'business';  // Who wants it
  score: number;              // Calculated demand intensity
  supplierCount: number;      // Existing businesses serving this
  consumerCount: number;      // Agents/orgs wanting this
}
```

### Consumer Demand (B2C)
Agents want goods when:
- **Sustenance**: hunger > threshold, no provisions
- **Discretionary**: leisure need + can afford
- **Luxury**: high wealth + not recently purchased
- **Housing**: homeless + has savings

### Business Demand (B2B)
Orgs want goods when:
- **Wholesale**: retail locations with low inventory
- **Data Storage**: orgs with valuable_data but no storage
- **Raw Materials**: factories with low input stock

### Extend Goods Config (no separate verticals file)

A vertical IS a good - extend `economy.json` goods with supply chain metadata:

```json
// data/config/economy.json - extended goods
{
  "goods": {
    "provisions": {
      "size": 0.1,
      "retailPrice": 10,
      "wholesalePrice": 3,
      "vertical": {
        "demandType": "consumer",
        "needsField": "hunger",
        "needsThreshold": 50,
        "productionTemplate": "provisions_factory",
        "retailTemplate": "retail_shop"
      }
    },
    "data_storage": {
      "size": 0.5,
      "wholesalePrice": 50,
      "vertical": {
        "demandType": "business",
        "demandCondition": "hasValuableDataWithoutStorage",
        "productionTemplate": "server_factory",
        "retailTemplate": null
      }
    }
  }
}
```

**Key principle**: Goods and verticals are the same concept. Each good optionally has a `vertical` object describing its supply chain and demand signals. No duplication.

### Pondering Behavior

New behavior: `pondering_business`
- **Entry**: unemployed, credits > threshold, not already pondering
- **Duration**: 4-8 phases (configurable)
- **Each tick**: Agent observes market, accumulates demand knowledge
- **Exit**: Agent selects best business opportunity OR gives up

```json
{
  "id": "pondering_business",
  "priority": "normal",
  "executor": "ponderBusiness",
  "conditions": {
    "isEmployed": false,
    "hasCreditsAbove": 500,
    "notPondering": true
  },
  "completionConditions": {
    "ponderingComplete": true
  }
}
```

### Stratified Salaries

```json
// data/config/economy.json
{
  "salary": {
    "unskilled": { "min": 50, "max": 70 },      // retail, warehouse
    "skilled": { "min": 80, "max": 100 },       // factory workers
    "professional": { "min": 120, "max": 160 }  // office, laboratory
  }
}
```

Location templates specify salary tier:
```json
// office.json
{ "salaryTier": "professional", "employeeSlots": 5 }
```

## Implementation Steps

1. **Extend `economy.json` goods** with vertical metadata (supply chain, demand signals)
2. **Create `DemandAnalyzer.ts`** that reads goods config and calculates demand
3. **Refactor `chooseBestBusiness()`** to use DemandAnalyzer
4. **Add `pondering_business` behavior** with multi-phase duration
5. **Add salary tiers** to economy config and hiring logic
6. **Update location templates** with salaryTier field

## Files to Create/Modify

| File | Changes |
|------|---------|
| `src/simulation/systems/DemandAnalyzer.ts` | NEW - Demand calculation |
| `src/simulation/systems/EconomySystem.ts` | Refactor chooseBestBusiness |
| `src/simulation/behaviors/executors/index.ts` | Add ponderBusiness executor |
| `data/config/behaviors.json` | Add pondering_business behavior |
| `data/config/economy.json` | Add salary tiers + vertical metadata to goods |
| `data/templates/locations/*.json` | Add salaryTier to all |

## Success Criteria

- [x] Adding a new vertical requires only JSON config (no code changes)
- [ ] Agents visibly "ponder" before opening businesses (activity log) - deferred
- [x] Business selection correlates with actual market gaps
- [x] Office workers earn more than factory workers

## Files Created

| File | Type |
|------|------|
| `src/simulation/systems/DemandAnalyzer.ts` | NEW |

## Files Modified

| File | Changes |
|------|---------|
| `data/config/economy.json` | Added vertical metadata to goods, added skilled/professional salary tiers |
| `src/config/ConfigLoader.ts` | Added VerticalConfig, SalaryTier types, salaryTier to LocationTemplate |
| `src/simulation/systems/EconomySystem.ts` | Refactored chooseBestBusiness() to use DemandAnalyzer |
| `data/templates/locations/*.json` | Added salaryTier to all location templates |

## Notes

The pondering behavior was deferred as the core functionality (DemandAnalyzer + salary tiers) provides the main value. The existing entrepreneur behavior works well with the new demand-driven selection. Pondering can be added later for immersion.
