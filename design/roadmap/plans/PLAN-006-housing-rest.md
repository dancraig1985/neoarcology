# PLAN-006: Housing & Rest

**Status:** planned
**Priority:** P1 (high)
**Dependencies:** PLAN-005 (geography - agents need to travel home)
**Phase:** 3

## Goal

Add a rest need that encourages agents to have housing, without harsh death penalties.

## Context

Agents currently only have hunger as a need. Rest adds another dimension:
- Creates demand for residential locations (apartments)
- Gives agents a "home" to return to
- Rewards stable housing vs. homelessness
- Sets up future systems (agent belongings, safe houses, etc.)

**Design philosophy:** Forgiving. Missing rest = suboptimal, not fatal.

## Rest Mechanic

Similar to hunger but weekly cycle:

```typescript
interface AgentNeeds {
  hunger: number;      // 0-100, +~3.5/phase, death at 100
  fatigue: number;     // 0-100, +~0.5/phase (~14/day), no death
}
```

**Fatigue accumulation:** ~14% per day (0.5% per phase)
- After 7 days without rest: 100% fatigue
- At 100% fatigue: agent must rest (cannot do other actions)

**Resting outcomes:**
| Location | Fatigue Reset | Notes |
|----------|---------------|-------|
| Own residence | 0% | Full rest, agent has a bed |
| Public shelter | 25% | Partial rest, uncomfortable |
| Street | 50% | Poor rest, exposed to elements |

**Forced rest:** At 100% fatigue, agent rests wherever they are (street if no housing).

## Residence System

**Residence ownership:** Agents can own or rent residential locations.

```typescript
interface Agent {
  // ... existing fields
  residence?: LocationRef;  // Agent's home (where they rest)
}

interface Location {
  // ... existing fields
  residents?: AgentRef[];   // For shared housing (apartments)
  maxResidents?: number;    // Capacity
  rentCost?: number;        // Weekly rent (if rented, not owned)
}
```

**Location types:**
- `apartment` - Single-agent residence, can be owned or rented
- `shelter` - Public, free, partial rest only
- Future: `luxury_apartment`, `safehouse`, `hotel`

## Weekly Cycle

Integrated with existing weekly tick:
1. Fatigue accumulates each phase (+0.5%)
2. When fatigue >= 80%, agent prioritizes going home
3. At 100% fatigue, agent must rest immediately
4. Resting takes 1 phase, resets fatigue based on location
5. Rent is paid weekly (like salaries)

## Objectives

### Phase A: Fatigue Need
- [ ] Add `fatigue` to Agent.needs
- [ ] Accumulate fatigue each phase
- [ ] Cap at 100%, force rest action

### Phase B: Residence System
- [ ] Add `residence` to Agent type
- [ ] Create `apartment` location template
- [ ] Create `shelter` location template
- [ ] Add `residents`, `maxResidents`, `rentCost` to Location

### Phase C: Rest Action
- [ ] Implement `restAgent(agent, location)` function
- [ ] Calculate fatigue reset based on location type
- [ ] Log rest events to activity log

### Phase D: Housing Economy
- [ ] Agents pay rent weekly
- [ ] Landlords receive rent (org or agent owners)
- [ ] Homeless agents seek housing when affordable
- [ ] Eviction if rent unpaid

### Phase E: AI Integration
- [ ] Agents travel home when fatigue >= 80%
- [ ] Agents seek housing if homeless and can afford
- [ ] Balance rest timing with work/shopping

### Phase F: UI Updates
- [ ] Add fatigue to agent table/detail
- [ ] Add residence to agent detail
- [ ] Show residents in location detail

## Key Files to Modify

| File | Change |
|------|--------|
| `src/types/entities.ts` | Add fatigue, residence fields |
| `src/simulation/systems/AgentSystem.ts` | Process fatigue, rest |
| `src/simulation/systems/EconomySystem.ts` | Process rent payments |
| `src/ui/UIConfig.ts` | Add fatigue column, residence fields |
| `data/config/balance.json` | Add rest parameters |

## Key Files to Create

| File | Purpose |
|------|---------|
| `data/templates/locations/apartment.json` | Residential template |
| `data/templates/locations/shelter.json` | Public shelter template |

## Balance Parameters

```json
{
  "rest": {
    "fatiguePerPhase": 0.5,
    "restThreshold": 80,
    "forceRestThreshold": 100,
    "fullRestReset": 0,
    "shelterRestReset": 25,
    "streetRestReset": 50,
    "baseRent": 50
  }
}
```

## Non-Goals (Defer)

- Sleep quality affecting stats
- Roommates/shared apartments
- Furniture/amenities
- Hotels (temporary housing)
- Squatting in abandoned buildings

## Notes

- Rest is forgiving by design - no death, just inefficiency
- Homelessness is a state, not a failure condition
- Housing creates natural economic pressure to earn money
- Residence location matters for travel (commute to work)
