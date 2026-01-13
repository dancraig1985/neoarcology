# PLAN-012: Housing & Rest

**Status:** planned
**Priority:** P1 (high)
**Dependencies:** PLAN-009 (buildings - completed), PLAN-010 (headless testing), PLAN-011 (population sustainability)
**Phase:** 3

## Goal

Add a rest need that encourages agents to have housing, creating demand for residential locations.

## Context

Agents currently only have hunger as a need. Rest adds another dimension:
- Creates demand for residential locations (apartments)
- Gives agents a "home" to return to
- Rewards stable housing vs. homelessness
- Sets up future systems (agent belongings, safe houses, etc.)

**Design philosophy:** Forgiving. Missing rest = suboptimal, not fatal.

## Rest Mechanic

### Fatigue Calculation

**Time structure:** 4 phases/day, 28 phases/week

For agents to need rest **once per ~7 days**:
- 100% fatigue / 28 phases = **~3.57% per phase**

```typescript
interface AgentNeeds {
  hunger: number;      // 0-100, ~0.89/phase (~25/day), death at 100
  fatigue: number;     // 0-100, ~3.57/phase (100/week), no death
}
```

### Behavior: Proactive Rest-Seeking

**Key insight:** Agents should seek rest BEFORE hitting 100%, not wait until forced.

| Fatigue Level | Behavior |
|---------------|----------|
| 0-69% | Normal activities (work, shop, leisure) |
| 70-89% | **Seek rest**: Travel home to sleep |
| 90-99% | **Urgent rest**: Drop everything, go home immediately |
| 100% | **Forced rest**: Rest wherever you are (worst outcome) |

**Priority order in decision-making:**
1. Emergency hunger (>80%) - redirect to food
2. **Urgent fatigue (>=90%)** - go home NOW
3. Regular hunger - buy food
4. **Rest-seeking fatigue (>=70%)** - head home after current activity
5. Job seeking / business
6. Leisure at public spaces

### Resting Outcomes

| Location Type | Fatigue Reset To | Notes |
|---------------|------------------|-------|
| Own residence | 0% | Full rest, proper bed |
| Public shelter | 30% | Partial rest, uncomfortable |
| Anywhere else (forced) | 60% | Poor rest, exposed/uncomfortable |

**Rest duration:** 1 phase (takes the place of other activities)

## Residence System

### Agent Changes

```typescript
interface Agent {
  // ... existing fields
  residence?: LocationRef;  // Agent's home (apartment they rent)
}
```

### Location Changes

```typescript
interface Location {
  // ... existing fields (already has building, floor, unit from PLAN-009)
  residents?: AgentRef[];   // Who lives here
  maxResidents?: number;    // Capacity (1 for apartment, more for shelter)
  rentCost?: number;        // Weekly rent
}
```

### Building Integration (from PLAN-009)

Apartments placed in buildings with `"residential"` in allowedLocationTags:
- `residential_tower` - allows ["residential", "commercial"]
- `low_rise` - allows ["residential", "commercial"]
- `arcology` - allows ["residential", "commercial", "office", "public", "industrial"]

**Apartment template must have `"residential"` tag** to match these buildings.

## Location Templates

### Apartment (new)

```json
{
  "id": "apartment",
  "name": "Apartment",
  "tags": ["residential"],
  "spawnConstraints": {
    "allowedZones": ["residential", "commercial", "downtown"],
    "floorRange": [1, 50]
  },
  "balance": {
    "operatingCost": 5,
    "maxResidents": 1,
    "rentCost": 50
  },
  "generation": {
    "count": { "min": 5, "max": 10 },
    "spawnAtStart": true,
    "ownerOrgTemplate": "small_business",
    "ownerCredits": { "min": 100, "max": 200 }
  }
}
```

### Shelter (new)

Shelters are **public locations** - no owning org, no rent. They exist as a safety net.

```json
{
  "id": "shelter",
  "name": "Public Shelter",
  "tags": ["public", "residential"],
  "spawnConstraints": {
    "allowedZones": ["residential", "industrial", "downtown"],
    "floorRange": [0, 2],
    "preferGroundFloor": true
  },
  "balance": {
    "maxResidents": 20,
    "rentCost": 0
  },
  "generation": {
    "count": { "min": 1, "max": 2 },
    "spawnAtStart": true
  }
}
```

**Note**: Shelters have no `ownerOrgTemplate` - they're public infrastructure, not businesses.

## Housing Economy

### Ownership Model (Consistent with Retail)

Apartments follow the **same ownership pattern as shops**:
- Every apartment location is owned by an org
- Any org can own apartments (not a special "landlord" type)
- Rent = revenue, flows to org wallet
- Leader extracts profits via weekly dividend

```
Tenant Agent                    Landlord Org
    |                               |
    | pays rent                     |
    +------------------------->  org.wallet (revenue)
                                    |
                                    v
                              Operating costs
                                    |
                                    v
                              Owner dividend -> leader.wallet
```

**Key insight**: The location template determines what kind of business it is (retail vs residential), not the org template. A `small_business` org can own a shop OR an apartment - the org just manages the finances.

### Rent Flow

Weekly rent processing (alongside payroll):
1. Agent pays `rentCost` from wallet → Location owner's org wallet
2. If agent can't afford rent → evicted (residence cleared)
3. Org pays `operatingCost` from wallet
4. Leader receives dividend (same as shop owners)

**Rent is just another form of revenue** - it works identically to retail sales from an accounting perspective.

### Housing Search

Homeless agents with sufficient credits seek housing:
1. Find available apartment (`residents.length < maxResidents`)
2. Check affordability (`credits > rentCost * 4` weeks buffer)
3. Move in (add to `residents`, set agent's `residence`)

### Initial Generation

At city generation:
1. Generate apartments in residential buildings
2. For each apartment, create an owning org (using `small_business` template)
3. Assign each agent to a random available apartment
4. All agents start housed (can become homeless later)

**Note**: Using `small_business` template for initial apartment owners keeps things simple. The org template is just for initial setup - what matters is the org owns the apartment location.

## Objectives

### Phase A: Fatigue Need
- [ ] Add `fatigue` to Agent.needs (default: 0)
- [ ] Add fatigue config to agents.json
- [ ] Accumulate fatigue each phase in AgentSystem
- [ ] Cap at 100%

### Phase B: Rest Action
- [ ] Implement `processRest(agent, location)` in AgentSystem
- [ ] Calculate fatigue reset based on location type
- [ ] Rest takes 1 phase (agent stays in place)
- [ ] Log rest events to activity log

### Phase C: Rest-Seeking Behavior
- [ ] Add rest priority to decision-making (EconomySystem)
- [ ] At 70%+ fatigue: travel home after current activity
- [ ] At 90%+ fatigue: urgent, go home immediately
- [ ] At 100%: forced rest wherever agent is

### Phase D: Residence System
- [ ] Add `residence` to Agent type
- [ ] Add `residents`, `maxResidents`, `rentCost` to Location
- [ ] Create apartment template (with "residential" tag)
- [ ] Create shelter template

### Phase E: Housing Economy
- [ ] Process rent in weekly tick (tenant wallet → org wallet)
- [ ] Eviction if can't pay rent (clear residence, remove from residents)
- [ ] Homeless agents seek available housing
- [ ] Log housing events (rent paid, evicted, moved in)

### Phase F: Initial Generation
- [ ] Generate apartments during city creation (with owning orgs)
- [ ] Assign each apartment to a `small_business` org (same as shops)
- [ ] Assign all agents to apartments at start (set residence + residents)
- [ ] Create shelter locations (public, no org)

### Phase G: UI Updates
- [ ] Add fatigue to agent table (column)
- [ ] Add fatigue to agent detail view
- [ ] Add residence to agent detail view
- [ ] Show residents in location detail

## Key Files

| File | Change |
|------|--------|
| `src/types/entities.ts` | Add fatigue, residence, residents, maxResidents, rentCost |
| `src/simulation/systems/AgentSystem.ts` | Fatigue accumulation, rest processing |
| `src/simulation/systems/EconomySystem.ts` | Rest-seeking behavior, rent payments (reuse existing weekly economy flow) |
| `src/generation/CityGenerator.ts` | Generate apartments with owning orgs (same pattern as shops) |
| `src/ui/UIConfig.ts` | Add fatigue column, residence/residents fields |
| `data/config/agents.json` | Add fatigue config |
| `data/templates/locations/apartment.json` | New template (with ownerOrgTemplate like shops) |
| `data/templates/locations/shelter.json` | New template (public, no org) |

## Config Parameters

**In `data/config/agents.json`:**
```json
{
  "hunger": { ... },
  "fatigue": {
    "perPhase": 3.57,
    "seekRestThreshold": 70,
    "urgentRestThreshold": 90,
    "forceRestThreshold": 100,
    "homeRestReset": 0,
    "shelterRestReset": 30,
    "forcedRestReset": 60
  },
  "inventoryCapacity": 10
}
```

## Non-Goals (Defer)

- Sleep quality affecting stats
- Roommates/shared apartments (apartments are 1-person for MVP)
- Furniture/amenities
- Hotels (temporary housing)
- Squatting in abandoned buildings
- Property management companies (multi-property orgs)
- Agent buying/owning apartments (rent only for MVP)
- Agents starting their own rental businesses (defer to later)

## Notes

- Rest is forgiving by design - no death, just inefficiency
- Homelessness is a state, not a failure condition
- Housing creates natural economic pressure to earn money
- Agents travel home to rest (uses PLAN-006 travel system)
- Buildings already exist (PLAN-009), apartments just fill them
- Shelter provides a free fallback but with worse rest quality
- 70% threshold gives agents time to travel home before hitting 100%

### Architecture Consistency

**Apartments follow the exact same pattern as retail shops:**

| Aspect | Retail Shop | Apartment |
|--------|-------------|-----------|
| Owned by | Org (any type) | Org (any type) |
| Revenue source | Customer purchases | Tenant rent |
| Revenue goes to | org.wallet | org.wallet |
| Operating costs | Weekly from org.wallet | Weekly from org.wallet |
| Owner profit | Weekly dividend | Weekly dividend |
| Template determines | It's a "retail" business | It's a "residential" business |

**The org template (small_business, corporation, etc.) is just for initial setup** - it determines starting capital, leader assignment, etc. What the org actually *does* is determined by the locations it owns.

This means:
- A corporation could buy apartments and become a landlord
- A small_business could expand from one shop to owning apartments
- The system is extensible without hardcoding business types
