# PLAN-021: Data Storage Capacity Mechanics

**Status:** completed
**Priority:** P2 (medium)
**Dependencies:** PLAN-019 (knowledge economy)

## Goal

Make data_storage a capacity-based infrastructure good so corporations continuously buy more as they produce valuable_data, creating sustained B2B demand.

## Problem

Current mechanics create no ongoing demand:
- data_storage is a binary gate (have any? produce forever)
- Buy 1 data_storage → produce infinite valuable_data
- No reason to ever buy more
- Server factories have no sustained market

## Design

### Capacity Model

```
1 data_storage = 10 valuable_data capacity (configurable via economy.json)
```

**Production check:**
```
total_storage_capacity = data_storage_count × capacity_per_unit
can_produce = total_storage_capacity > current_valuable_data
```

**Implemented flow:**
```
Corp opens office (can happen without storage)
  → Office tries to produce → blocked (no storage)
  → Corp buys data_storage from server factory → delivered to office
  → Office produces valuable_data each cycle
  → After 8-10 cycles: storage at 80%+
  → Corp buys another data_storage (80% threshold triggers repurchase)
  → Production continues
  → Cycle repeats...
```

### Where Storage Lives

- data_storage is purchased by corp, delivered directly to office/lab
- valuable_data produced at that location occupies local storage
- Storage check is per-location (not org-wide)

## Configuration

Added `storageCapacity` to goods config in `economy.json`:
```json
"data_storage": {
  "size": 0.5,
  "wholesalePrice": 50,
  "storageCapacity": 10,    // Each unit holds 10 valuable_data
  "vertical": { ... }
}
```

## Implementation Steps

- [x] Add `storageCapacity` field to GoodsConfig interface (ConfigLoader.ts)
- [x] Add `storageCapacity: 10` to data_storage in economy.json
- [x] Update `processFactoryProduction()` to check capacity, not just presence
- [x] Update `tryProcureDataStorage()` to buy when storage >= 80% full
- [x] Log meaningful messages: "storage at X/Y capacity (Z%)", "storage full"
- [x] Allow offices to open without storage (removed minStorageForExpansion requirement)
- [x] Verify corps continuously buy data_storage over simulation run

## Deferred to Future Plans

- Different types of valuable_data (research, financial, classified)
- Buying/selling valuable_data (market, black market)
- Data provenance tracking (who created it, stolen from whom)
- Heist/hacking mechanics
- Storage degradation

## Success Criteria

After running simulation for 1-2 years (1344-2688 ticks):
- [x] Corporations produce valuable_data until storage is full
- [x] When full, production pauses and corp buys more data_storage
- [x] Server factories have sustained demand (not just initial purchase)
- [x] Multiple buy cycles visible in activity log (corps buying 2nd, 3rd, 4th+ units)
- [x] B2B sales metric shows ongoing data_storage transactions

## Notes

This creates the foundation for the knowledge economy loop:
```
Server Factory produces data_storage
         ↓
Corporation opens office (expansion)
         ↓
Office needs storage → Corp buys data_storage (B2B)
         ↓
Office produces valuable_data
         ↓
Storage fills up (80% threshold)
         ↓
Corporation buys MORE data_storage
         ↓
(cycle continues)
```

Future plans will add value extraction from valuable_data (sales, theft, etc.)
