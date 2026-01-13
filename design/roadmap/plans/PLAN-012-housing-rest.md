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
    "operatingCost": 0,
    "openingCost": 100,
    "maxResidents": 1,
    "rentCost": 20
  },
  "generation": {
    "count": { "min": 120, "max": 150 },
    "spawnAtStart": true,
    "ownerOrgTemplate": "small_business",
    "ownerCredits": { "min": 100, "max": 200 }
  }
}
```

**Note:** Generate ~120-150 apartments for ~200 agents = ~60-75% initial housing. This creates immediate demand for more housing.

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
    "count": { "min": 2, "max": 3 },
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
    | pays rent (20/week)           |
    +------------------------->  org.wallet (revenue)
                                    |
                                    v
                              Owner dividend -> leader.wallet
```

**Key insight**: The location template determines what kind of business it is (retail vs residential), not the org template. A `small_business` org can own a shop OR an apartment - the org just manages the finances.

### Rent Flow

Weekly rent processing (alongside payroll):
1. Agent pays `rentCost` (20) from wallet → Location owner's org wallet
2. If agent can't afford rent → evicted (residence cleared)
3. Leader receives dividend (same as shop owners)

**Rent is just another form of revenue** - it works identically to retail sales from an accounting perspective.

### Housing Search

Homeless agents with sufficient credits seek housing:
1. Find available apartment (`residents.length < maxResidents`)
2. Check affordability (`credits >= rentCost * 4` = 80 credits buffer)
3. Move in (add to `residents`, set agent's `residence`)

### Immigration and Housing

**Immigrants always arrive homeless.** They must find housing through the normal housing search process. This creates ongoing demand for apartments and incentivizes entrepreneurs to build more.

### Initial Generation

At city generation:
1. Generate ~120-150 apartments (fewer than ~200 agents)
2. For each apartment, create an owning org (using `small_business` template)
3. Assign agents to apartments **until apartments run out**
4. Remaining ~50-80 agents start homeless (creates initial demand)
5. Create shelter locations (public, no org) as safety net

## Demand-Based Entrepreneurship

Entrepreneurs choose what business to open based on market demand.

### Demand Signals

```typescript
interface DemandSignal {
  type: string;              // 'food', 'housing', future: 'medical', etc.
  demand: number;            // count of agents with unmet need
  businessTemplate: string;  // what location template to open
  priority: number;          // weight (fatal needs > comfort needs)
}

function calculateDemands(agents: Agent[], locations: Location[]): DemandSignal[] {
  return [
    {
      type: 'food',
      demand: agents.filter(a =>
        a.status !== 'dead' &&
        a.needs.hunger > 50 &&
        (a.inventory.provisions ?? 0) === 0
      ).length,
      businessTemplate: 'retail_shop',
      priority: 2,  // Fatal - starvation kills
    },
    {
      type: 'housing',
      demand: agents.filter(a =>
        a.status !== 'dead' &&
        !a.residence &&
        a.wallet.credits >= 80
      ).length,
      businessTemplate: 'apartment',
      priority: 1,  // Non-fatal - just inconvenient
    },
    // Future: medical, entertainment, etc.
  ];
}
```

### Entrepreneur Decision

```typescript
function chooseBusiness(demands: DemandSignal[]): string {
  // Score = demand × priority
  // Food: 10 hungry agents × 2 = 20
  // Housing: 15 homeless agents × 1 = 15
  // → Open food shop (higher score)

  const scored = demands
    .map(d => ({ ...d, score: d.demand * d.priority }))
    .sort((a, b) => b.score - a.score);

  return scored[0]?.businessTemplate ?? 'retail_shop';
}
```

### Balance

- Food priority (2) > Housing priority (1)
- Equal demand → entrepreneurs open shops (starvation is fatal)
- Low food demand → entrepreneurs become landlords
- System self-balances based on actual needs

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
- [ ] Homeless agents seek available housing (80+ credits buffer)
- [ ] Log housing events (rent paid, evicted, moved in)

### Phase F: Demand-Based Entrepreneurship
- [ ] Create DemandSignal interface
- [ ] Implement calculateDemands() function
- [ ] Update tryOpenBusiness() to use demand signals
- [ ] Add apartment as valid business type for entrepreneurs

### Phase G: Initial Generation
- [ ] Generate apartments during city creation (with owning orgs)
- [ ] Generate fewer apartments than agents (~70% coverage)
- [ ] Assign agents to apartments until full, rest start homeless
- [ ] Create shelter locations (public, no org)
- [ ] Immigrants arrive homeless (handled by ImmigrationSystem)

### Phase H: UI Updates
- [ ] Add fatigue to agent table (column)
- [ ] Add fatigue to agent detail view
- [ ] Add residence to agent detail view
- [ ] Show residents in location detail

### Phase I: Validation
- [ ] Run headless tests to verify:
  - [ ] Agents seek rest appropriately
  - [ ] Homeless agents find housing
  - [ ] Rent is paid and collected
  - [ ] Entrepreneurs open apartments when housing demand is high
  - [ ] Food businesses still get created (not all apartments)
  - [ ] Immigrants eventually get housed

## Key Files

| File | Change |
|------|--------|
| `src/types/entities.ts` | Add fatigue, residence, residents, maxResidents, rentCost |
| `src/simulation/systems/AgentSystem.ts` | Fatigue accumulation, rest processing |
| `src/simulation/systems/EconomySystem.ts` | Rest-seeking behavior, rent payments, demand-based entrepreneurship |
| `src/generation/CityGenerator.ts` | Generate apartments with owning orgs, partial housing assignment |
| `src/ui/UIConfig.ts` | Add fatigue column, residence/residents fields |
| `data/config/agents.json` | Add fatigue config |
| `data/templates/locations/apartment.json` | New template |
| `data/templates/locations/shelter.json` | New template |

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
  "housing": {
    "bufferWeeks": 4,
    "rentCost": 20
  },
  "inventoryCapacity": 10
}
```

**In `data/config/economy.json`:**
```json
{
  "demands": {
    "food": { "priority": 2 },
    "housing": { "priority": 1 }
  }
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

## Notes

- Rest is forgiving by design - no death, just inefficiency
- Homelessness is a state, not a failure condition
- Housing creates natural economic pressure to earn money
- Agents travel home to rest (uses PLAN-006 travel system)
- Buildings already exist (PLAN-009), apartments just fill them
- Shelter provides a free fallback but with worse rest quality
- 70% threshold gives agents time to travel home before hitting 100%
- Immigrants arrive homeless, creating ongoing housing demand
- Entrepreneurs respond to demand - if housing is scarce, they become landlords

### Architecture Consistency

**Apartments follow the exact same pattern as retail shops:**

| Aspect | Retail Shop | Apartment |
|--------|-------------|-----------|
| Owned by | Org (any type) | Org (any type) |
| Revenue source | Customer purchases | Tenant rent (20/week) |
| Revenue goes to | org.wallet | org.wallet |
| Operating costs | 0 | 0 |
| Owner profit | Weekly dividend | Weekly dividend |
| Template determines | It's a "retail" business | It's a "residential" business |
| Entrepreneur trigger | High food demand | High housing demand |

**The org template (small_business, corporation, etc.) is just for initial setup** - it determines starting capital, leader assignment, etc. What the org actually *does* is determined by the locations it owns.

This means:
- A corporation could buy apartments and become a landlord
- A small_business could expand from one shop to owning apartments
- Entrepreneurs choose business type based on market demand
- The system is extensible without hardcoding business types
