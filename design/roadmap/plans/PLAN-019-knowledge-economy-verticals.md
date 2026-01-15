# PLAN-019: Knowledge Economy Verticals

**Status:** completed
**Priority:** P1 (high)
**Dependencies:** PLAN-018 (entrepreneurship overhaul)

## Goal

Add two new economic verticals that create a knowledge economy: data storage hardware and valuable data generation.

## New Verticals

### 1. Data Storage Vertical (B2B)

```
Server Factory → Corporation/Office
      │                  │
  produces          needs storage
  data_storage      for valuable_data
```

**Flow:**
- Server factories produce `data_storage` goods
- Corporations with `valuable_data` need at least 1 `data_storage` in inventory
- Orgs purchase from server factories (B2B wholesale transaction)
- No retail - purely business-to-business

### 2. Valuable Data Vertical (Production)

```
Office/Laboratory → valuable_data → stored in data_storage
       │                  │
  agents work         corporation
  doing R&D           accumulates data
```

**Flow:**
- Agents working at `office` or `laboratory` locations generate `valuable_data`
- Production rate: 1 valuable_data per X phases of work (configurable)
- Data must be stored: org needs `data_storage` item in location inventory
- If no storage available, data production blocked (activity log warning)

**Key Design**: Valuable data doesn't generate revenue (yet). The goal is for corporations to produce it as a marker of corporate capability/growth. Revenue from data (licensing, contracts) is deferred to a future plan.

### 3. Corporate Expansion Behavior

Corporations that already have revenue (from factories) should expand by acquiring offices:

```
Profitable Corporation → accumulates wealth → opens Office
         │                      │                   │
   has factory revenue    org wallet > threshold   hires professionals
                                                   produces valuable_data
```

**Org Expansion Behavior** (new concept - orgs have behaviors too):
- **Trigger**: Org has stable revenue (e.g., factory) AND wallet > expansion threshold (e.g., 1000 credits)
- **Action**: Org opens a new location (office or laboratory)
- **Result**: Corporation now produces valuable_data alongside its factory output

This creates a natural progression: Factory corp → Wealthy corp → Corp with R&D division

## New Location Templates

### server_factory.json
```json
{
  "name": "Server Factory",
  "tags": ["wholesale", "production", "tech"],
  "employeeSlots": 4,
  "salaryTier": "skilled",
  "produces": "data_storage",
  "productionRate": 3,
  "capacity": 50
}
```

### office.json
```json
{
  "name": "Corporate Office",
  "tags": ["office", "corporate"],
  "employeeSlots": 8,
  "salaryTier": "professional",
  "produces": "valuable_data",
  "productionRate": 0.5,
  "requiresStorage": true
}
```

### laboratory.json
```json
{
  "name": "Research Laboratory",
  "tags": ["laboratory", "corporate", "research"],
  "employeeSlots": 5,
  "salaryTier": "professional",
  "produces": "valuable_data",
  "productionRate": 1.0,
  "requiresStorage": true
}
```

## New Behaviors (Org-Level)

This plan introduces **org behaviors** - decisions made by organizations, not individual agents.

### procure_data_storage
- **Trigger**: Org has `valuable_data` but no `data_storage` in any location
- **Action**: Purchase data_storage from server factory (B2B)
- **Priority**: High (can't produce more data without storage)

### expand_to_office
- **Trigger**: Org has stable revenue (factory/retail) AND wallet > 1000 credits AND no office
- **Action**: Open office or laboratory location, hire professional workers
- **Result**: Org begins producing valuable_data

## Implementation Steps

### Phase 1: Data Storage Vertical
- [x] Create `server_factory.json` template
- [x] Add B2B procurement behavior for orgs needing storage
- [x] Add storage check in production system (block data generation without storage)

### Phase 2: Valuable Data Production
- [x] Create `office.json` and `laboratory.json` templates
- [x] Modify production system to handle `valuable_data` generation
- [x] Add `requiresStorage` check in production executor

### Phase 3: Org Expansion Behavior
- [x] Create org behavior system (similar to agent behaviors but for orgs)
- [x] Implement `expand_to_office` behavior for wealthy corps
- [x] Trigger: org wallet > threshold + has revenue-generating location
- [x] Result: org opens office, hires professionals, produces data

### Phase 4: City Generation
- [x] Update CityGenerator to spawn new location types (server_factory with spawnAtStart: true)
- [x] Balance initial counts (1-2 of each new type)
- [x] Starting corporations may or may not have offices (organic growth preferred)

## Economy Config Updates

```json
// economy.json updates
{
  "goods": {
    "data_storage": { "size": 0.5, "retailPrice": null, "wholesalePrice": 50 },
    "valuable_data": { "size": 0.1, "retailPrice": null, "wholesalePrice": null }
  }
}
```

Note: `valuable_data` has no price yet - monetization is deferred to a future plan.

## Files to Create

| File | Type |
|------|------|
| `data/templates/locations/server_factory.json` | NEW |
| `data/templates/locations/office.json` | NEW |
| `data/templates/locations/laboratory.json` | NEW |
| `src/simulation/systems/OrgBehaviorSystem.ts` | NEW - Org-level decisions |

## Files to Modify

| File | Changes |
|------|---------|
| `data/config/economy.json` | Update goods definitions |
| `src/simulation/systems/ProductionSystem.ts` | Add storage requirement check |
| `src/generation/CityGenerator.ts` | Spawn new location types |
| `src/simulation/Simulation.ts` | Add org behavior tick |

## Success Criteria

- [x] Server factories produce data_storage goods
- [x] Offices/laboratories produce valuable_data when storage available
- [x] Production blocked with warning when no storage
- [x] Corporations purchase data_storage when they have valuable_data (procurement system implemented)
- [x] Wealthy corporations expand by opening offices (org expansion behavior)
- [x] Corps with offices produce valuable_data over time
- [ ] All new businesses available to entrepreneurs (via PLAN-018) - deferred to PLAN-018
