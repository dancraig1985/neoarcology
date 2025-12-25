# PLAN-001: Agent Slice of Life

**Status:** completed
**Priority:** P0 (critical)
**Dependencies:** PLAN-000
**Phase:** 1a
**Reference:** [GAME-DESIGN.md](../../GAME-DESIGN.md) - Phase 1a: Agent Slice of Life

## Goal

Establish the foundational agent behavior: basic needs (rest, eat), weekly routines, and survival mechanics. Agents start with money, buy provisions, and eventually starve if they can't eat.

## Context

Before building complex economies, we need agents that feel "alive" at the most basic level. This plan creates the simplest possible agent loop:

```
Agent wakes up → Goes about their day → Eats (consumes provisions) → Rests → Repeat
```

**Expected outcome**: Start 10 agents with some credits and provisions. Watch them consume provisions weekly. When provisions run out, they starve over 4 weeks. All agents eventually die. Success!

## Objectives

### Tick Engine (Minimal)
- [ ] Implement TickEngine with phase processing
- [ ] Time rollover: phase → day (4) → week (28)
- [ ] Track current phase, day, week
- [ ] Week rollover triggers weekly agent needs

### Balance Config (Data-Driven)
- [ ] Create `data/config/balance.json` for tunable parameters
- [ ] All survival/timing values come from config, not hardcoded
- [ ] Designers can tweak without code changes

```json
// data/config/balance.json - Designer-tunable gameplay parameters
{
  "agent": {
    "hungerPerPhase": 0.89,
    "hungerThreshold": 25,
    "hungerMax": 100,
    "provisionsPerMeal": 1,
    "startingHungerMin": 0,
    "startingHungerMax": 24,
    "startingProvisionsMin": 4,
    "startingProvisionsMax": 8
  }
}

// Time structure stays in data/config/simulation.json (not balance)
```

### Agent Needs System
- [ ] Agents have `needs.hunger` (0-100, starts at random 0-24 for staggering)
- [ ] Hunger increases by `hungerPerPhase` each phase (~0.89 = ~25 per week)
- [ ] When hunger >= `hungerThreshold` (25), agent is **compelled to eat**
- [ ] Eating (consuming `provisionsPerMeal`) resets hunger to 0
- [ ] If no food available, hunger keeps accumulating past threshold
- [ ] **Starvation**: At hunger >= `hungerMax` (100), agent dies
- [ ] ~4 weeks without food = death (accumulates to 100)
- [ ] Random starting hunger naturally staggers eating across agents
- [ ] All values loaded from balance config

### Agent Inventory
- [ ] Agents can hold goods (personal inventory)
- [ ] Start agents with some `provisions` (e.g., 4-8 weeks worth)
- [ ] Consuming provisions removes from inventory

### Agent Routine (Basic)
- [ ] Daily routine phases: dawn (wake), day (activity), dusk (wind down), night (rest)
- [ ] Each phase: check if hungry (hunger >= threshold)
- [ ] If hungry: attempt to eat (priority action)
- [ ] "Eat" action consumes `provisionsPerMeal` from inventory, resets hunger to 0
- [ ] If no provisions available, agent continues with hunger accumulating

### Agent Wallet (Minimal)
- [ ] Agents start with credits (e.g., 100-500)
- [ ] No spending yet (that's PLAN-002)
- [ ] Just track balance for now

### Test Harness
- [ ] Create 10 test agents with hardcoded data
- [ ] Each agent starts with: 100-500 credits, 4-8 provisions
- [ ] Run simulation and log daily activities
- [ ] Verify agents eventually starve when provisions depleted

### Activity Log
- [ ] Log: "Agent X consumed provisions (hunger: 25 → 0)"
- [ ] Log: "Agent X is hungry (hunger: 50)"
- [ ] Log: "Agent X is starving (hunger: 75)"
- [ ] Log: "Agent X died of starvation"

## Data Structures

```typescript
interface AgentNeeds {
  hunger: number;      // 0-100, 100 = death
  // Future: energy, health, etc.
}

interface AgentInventory {
  [goodsCategory: string]: number;  // e.g., { provisions: 5 }
}

// Agent routine (simple state machine)
type AgentActivity = 'resting' | 'idle' | 'eating' | 'working' | 'traveling';
```

## Verification

- [ ] 10 agents created with provisions
- [ ] Agents consume 1 provisions per week
- [ ] Hunger increases when no provisions
- [ ] Agents die at hunger >= 100
- [ ] All agents dead after ~12-16 weeks (4-8 provisions + 4 weeks starvation)
- [ ] Console logs show clear progression

## Non-Goals (Defer)

- No purchasing provisions (PLAN-002)
- No employment/income (PLAN-002)
- No locations (PLAN-002)
- No organizations (PLAN-003)
- No complex needs (energy, health, morale)

## Notes

- Keep it dead simple. One need (hunger), one good (provisions), one outcome (death).
- This is the foundation everything else builds on.
- Hardcoded test data is fine - proc-gen comes later.
