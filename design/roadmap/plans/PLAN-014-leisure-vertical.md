# PLAN-014: Leisure Vertical (Pubs & Alcohol Economy)

**Status:** completed
**Priority:** P1 (high)
**Dependencies:** PLAN-008 (basic leisure behavior)
**Phase:** 3

## Goal

Add a leisure "need" so agents seek entertainment (pubs, restaurants) beyond survival, creating richer daily life cycles and a new economic vertical.

## Problem Statement

Currently agents only:
- Work → earn credits
- Buy food → survive
- Rest → recover fatigue
- Sit in parks → do nothing

Missing: Agents wanting to *enjoy* life, spending discretionary income on entertainment.

## Solution: Leisure Need + Pubs

### Leisure Need
- New agent need: `leisure` (0-100, like hunger/fatigue)
- Accumulates slowly over time (~0.5/phase = 14/week)
- Threshold at 50 triggers leisure-seeking behavior
- Satisfied by: drinking at pub, eating at restaurant, hanging at park (least effective)

### Pubs/Bars
- New location template with tags: `leisure`, `retail`, `commercial`
- Sells `alcohol` good to consumers
- Visiting a pub + buying alcohol = leisure satisfaction
- More satisfying than parks, costs credits

### Alcohol Supply Chain
- Factories can produce alcohol (new production config)
- Wholesale → Pub (retail) → Consumer
- Price: ~15 credits retail, ~8 wholesale

## Behavior Priority (Updated)

```
1. Emergency hunger (>80%) → find food
2. Forced rest (100% fatigue) → rest in place
3. Urgent rest (90%+ fatigue) → go home
4. Hungry + no food → buy food
5. Employed + not at work → commute
6. Unemployed → seek job
7. Homeless + can afford → find housing
8. **NEW: High leisure need (>50) → seek entertainment**
9. Wealthy → consider business
10. Rest-seeking (70%+ fatigue) → go home
11. Idle at non-public → go to public space
```

## Leisure Decision Logic (Credits-Based)

When leisure need > threshold, agent chooses activity based on what they can afford:

```
if credits >= alcoholPrice (15):
    go to nearest pub with stock → buy drink → leisure -= 40
else:
    go to nearest park → hang out → leisure -= 10 (passive, over time)
```

This creates natural class stratification:
- Employed agents with disposable income → pubs
- Broke/unemployed agents → parks (free but less satisfying)

## Leisure Satisfaction Sources

| Activity | Leisure Reduction | Cost | When Chosen |
|----------|------------------|------|-------------|
| Drink at pub | -40 (instant) | 15 credits | Can afford alcohol |
| Hang at park | -2/phase | Free | Can't afford pub |

## Objectives

### Phase A: Leisure Need Infrastructure
- [ ] Add `leisure` to agent needs (AgentNeeds type)
- [ ] Initialize at 0-20 randomly on spawn
- [ ] Accumulate leisure need in AgentSystem (~0.5/phase)
- [ ] Add leisure config to agents.json (perPhase, threshold)

### Phase B: Pub Location Template
- [ ] Create `data/templates/locations/pub.json`
- [ ] Tags: `leisure`, `retail`, `commercial`
- [ ] Balance: employeeSlots: 1, startingInventory: 20 alcohol
- [ ] Generation: 6-10 pubs at start, small_business org

### Phase C: Alcohol Good
- [ ] Add `alcohol` to economy.json goods
- [ ] Size: 0.2, retailPrice: 15, wholesalePrice: 8
- [ ] Add alcohol production to factory template (or new brewery?)

### Phase D: Leisure-Seeking Behavior
- [ ] Add leisure check to processAgentEconomicDecision
- [ ] If can afford alcohol: find nearest pub with stock, travel, buy drink
- [ ] If can't afford: go to nearest park (free leisure)
- [ ] Log activity: "relaxing at [pub name]" or "hanging out at [park]"

### Phase E: Park Passive Leisure
- [ ] Being at a park slowly reduces leisure (-2/phase while present)
- [ ] Free but slow - poor man's entertainment

### Phase F: Simulation Testing
- [ ] Run sim:test for 2000+ ticks
- [ ] Verify population stable
- [ ] Verify alcohol economy flowing
- [ ] Verify agents visiting pubs

## Key Files to Modify

| File | Change |
|------|--------|
| `src/types/Agent.ts` | Add leisure to AgentNeeds |
| `data/config/agents.json` | Add leisure config |
| `data/config/economy.json` | Add alcohol good |
| `data/templates/locations/pub.json` | New file |
| `data/templates/locations/factory.json` | Add alcohol production |
| `src/simulation/systems/AgentSystem.ts` | Accumulate leisure need |
| `src/simulation/systems/EconomySystem.ts` | Leisure-seeking behavior |
| `src/generation/CityGenerator.ts` | Generate pubs at start |

## Economic Balance Considerations

- Agents need ~30 credits/week for survival (rent + food)
- Leisure spending is discretionary
- Employees earn 25-45/week → ~5-15 credits leisure budget
- Pub visits ~1/week for employed agents
- Business owners (30/week) have minimal leisure budget
- Unemployed agents use parks (free)

## Non-Goals (Defer)

- Multiple alcohol types (beer, wine, spirits)
- Drunkenness effects on stats
- Social interactions at pubs
- Entertainment venues (clubs, theaters)
- Leisure preferences per agent

## Notes

- First "want" vs "need" system - agents can survive without leisure
- Creates economic demand beyond survival goods
- Makes agent daily life more realistic and watchable
- Foundation for future entertainment/social systems
