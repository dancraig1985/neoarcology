# PLAN-024: High-Tech Prototypes Vertical

**Status:** completed
**Priority:** P1 (high)
**Dependencies:** PLAN-023

## Goal
Close the valuable_data loop by creating an extremely rare/expensive end-game vertical that produces high-tech prototypes.

## Objectives
- [x] Add `high_tech_prototypes` good to economy.json (wholesalePrice: 10000, ultra-valuable)
- [x] Create prototype_factory.json location template
- [x] Design scarcity mechanics: 448 phases/cycle (2 months), 0.1 per worker, 10 professional workers
- [x] Set spawnAtStart: false (end-game content, not spawned at city generation)
- [x] Extreme opening cost (5000 credits) ensures only wealthy entrepreneurs build them
- [x] ProductionSystem.ts already handles slow production cycles (no changes needed)
- [x] CityGenerator correctly filters template (debugged - not spawning is intentional design)
- [x] Update design bible: economy.md (high-tech prototypes section), production.md (end-game production section)

## Critical Files
**Configuration:**
- `data/config/economy.json`
- `data/templates/locations/prototype_factory.json` (new)

**Code:**
- `src/simulation/systems/ProductionSystem.ts`
- `src/simulation/systems/EconomySystem.ts`
- `src/generation/CityGenerator.ts`

**Documentation:**
- `design/bible/economy.md`
- `design/bible/production.md`

## Notes
Economic loop: Offices produce valuable_data → Prototype facility consumes in bulk → Produces ultra-rare high_tech_prototypes → Stored in secure vaults → Future heist targets. Target ~20 verticals for whole game; this closes knowledge economy loop.

## Implementation Summary

### Template Configuration
```json
{
  "id": "prototype_factory",
  "tags": ["wholesale", "production", "industrial"],
  "balance": {
    "openingCost": 5000,           // 12.5x more than standard factory
    "employeeSlots": 10,            // Large workforce
    "salaryTier": "professional",   // Expensive to run
    "inventoryCapacity": 20,        // Small (prototypes are rare/valuable)
    "production": [{
      "good": "high_tech_prototypes",
      "amountPerEmployee": 0.1,     // 10 workers = 1 prototype per cycle
      "phasesPerCycle": 448         // 2 months
    }]
  },
  "generation": {
    "spawnAtStart": false           // End-game only - built by entrepreneurs
  }
}
```

### Scarcity Mechanics
1. **Cost barrier**: 5000 credit opening cost vs 500 entrepreneurship threshold = only ultra-wealthy can build
2. **No demand signal**: Template has no demandCondition, so DemandAnalyzer won't suggest it
3. **Slow production**: 448 phases/cycle = 2 months per prototype batch
4. **Low output**: 0.1 per worker means 1 prototype per cycle even with 10 workers
5. **High operating costs**: Professional salaries drain profits

**Result**: If 1-2 facilities exist in city, expect ~6-12 prototypes/year max

### Deferred Enhancements
- **Input consumption**: Consuming 100+ valuable_data per prototype (requires new production mechanic)
- **Demand condition**: Dynamic demand based on valuable_data surplus
- **Secure storage**: Vault requirements for storing prototypes
- **Black market**: Trading mechanics for ultra-valuable goods
