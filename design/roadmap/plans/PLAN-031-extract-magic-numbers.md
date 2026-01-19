# PLAN-031: Extract Magic Numbers to Configuration

**Status:** planned
**Priority:** P1 (high)
**Dependencies:** None

## Goal

Move all hardcoded constants from code into centralized config files for easy economic tuning.

## Objectives

- [ ] Create `data/config/thresholds.json` with agent behavior thresholds
  - Emergency hunger threshold (currently 80 in EconomySystem.ts:130)
  - Urgent rest threshold (currently 90)
  - Restocking threshold (currently 15, appears in two places)
  - Agent buy quantity limit (currently 5 provisions max)
  - Agent inventory capacity (currently 10, hardcoded in EconomySystem.ts:455)

- [ ] Create `data/config/business.json` with business parameters
  - Minimum capital for production business (currently 500)
  - Minimum capital for retail business (currently 200)
  - Owner dividend amount (currently 75 in EconomySystem.ts:1803)
  - Truck cargo capacity (currently 100 in EconomySystem.ts:1227)

- [ ] Create `data/config/logistics.json` with delivery parameters
  - Base delivery payment (currently 10)
  - Per-good rate (currently 1)
  - Per-distance rate (currently 0.5)
  - Formula: `Math.max(basePayment, goods * perGoodRate + distance * perDistanceRate)`

- [ ] Update `ConfigLoader.ts` to load new config files
- [ ] Update all systems to read from config instead of hardcoded values
- [ ] Update simulation tests to verify config values are used
- [ ] Document all thresholds in config files with comments explaining purpose

## Files to Modify

| File | Changes |
|------|---------|
| `src/simulation/systems/EconomySystem.ts` | Remove 20+ magic numbers, read from config |
| `src/config/ConfigLoader.ts` | Add loading for thresholds.json, business.json, logistics.json |
| `src/types/Config.ts` | Add type definitions for new config sections |
| `data/config/thresholds.json` | NEW - agent behavior thresholds |
| `data/config/business.json` | NEW - business parameters |
| `data/config/logistics.json` | NEW - delivery calculations |

## Magic Numbers Identified

From EconomySystem.ts:
- Line 130: `EMERGENCY_HUNGER = 80`
- Line 207: `provisionsPrice ?? 10` (default price fallback)
- Line 455: `inventoryCapacity = 10`
- Line 460: `Math.min(..., 5)` (buy limit)
- Line 1156: `isProduction ? 500 : 200` (min business capital)
- Line 1227: `100` (truck cargo capacity)
- Line 1282, 1473: `restockThreshold = 15` (appears twice!)
- Line 1625-1626: `totalGoods * 1 + distance * 0.5` and `Math.max(10, ...)`
- Line 1803: `ownerDividend = 75`

## Success Criteria

- All hardcoded numeric constants moved to config files
- Economic tuning possible without code changes
- No magic numbers remain in EconomySystem.ts
- All thresholds documented with clear comments
