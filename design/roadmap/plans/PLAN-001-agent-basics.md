# PLAN-001: Agent Slice of Life

**Status:** planned
**Priority:** P0 (critical)
**Dependencies:** PLAN-000
**Phase:** 1a

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

### Agent Needs System
- [ ] Agents have `needs.hunger` (0-100, starts at 0)
- [ ] Each week, hunger increases by 25 (starves at 100 after 4 weeks without food)
- [ ] Eating (consuming 1 provisions) resets hunger to 0
- [ ] At hunger >= 100, agent dies (status = 'dead')

### Agent Inventory
- [ ] Agents can hold goods (personal inventory)
- [ ] Start agents with some `provisions` (e.g., 4-8 weeks worth)
- [ ] Consuming provisions removes from inventory

### Agent Routine (Basic)
- [ ] Daily routine phases: dawn (wake), day (activity), dusk (eat), night (rest)
- [ ] "Eat" action during dusk phase consumes 1 provisions (if available)
- [ ] If no provisions, hunger accumulates

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
