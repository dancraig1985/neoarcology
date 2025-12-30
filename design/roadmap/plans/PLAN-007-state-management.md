# PLAN-007: Agent State Management Refactor

**Status:** completed
**Priority:** P1 (high)
**Dependencies:** PLAN-006 (completed)
**Phase:** 3

## Goal

Centralize agent state management to prevent inconsistent state bugs and make the system more maintainable as complexity grows.

## Problem Statement

Agent state is currently modified across 4+ systems with no coordination:
- **AgentSystem** - hunger, eating, death
- **EconomySystem** - employment, business, homeless checks
- **LocationSystem** - hiring, firing
- **TravelSystem** - movement

This leads to bugs where:
1. Related fields aren't updated together (employment triple, travel state)
2. Entity deletion doesn't clean up all references
3. Agents end up in impossible states (employed at deleted location, traveling to nowhere)

## Current Pain Points

| Issue | Example Bug |
|-------|-------------|
| Employment triple not atomic | Agent has `employedAt` but `status: 'available'` |
| Travel state (5 fields) scattered | Agent has `travelingTo` but destination deleted |
| No cleanup propagation | Location deleted, agents still reference it |
| Duplicated clearing logic | `clearTravel` done differently in 3+ places |
| No state validation | Inconsistent state goes undetected |

## Solution: Centralized State Helpers

Create `AgentStateHelpers.ts` with atomic state transition functions:

```typescript
// Employment management (atomic triple update)
function setEmployment(agent: Agent, location: Location, org: Organization, salary: number): Agent
function clearEmployment(agent: Agent): Agent

// Travel management (atomic 5-field update)
function setTravel(agent: Agent, from: Location, to: Location, method: TravelMethod, phases: number): Agent
function clearTravel(agent: Agent): Agent
function setLocation(agent: Agent, location: Location): Agent
function clearLocation(agent: Agent): Agent

// Death handling (clears all related state)
function handleDeath(agent: Agent, phase: number): Agent

// Entity deletion handlers (propagate cleanup)
function onLocationDeleted(locationId: string, agents: Agent[]): Agent[]
function onOrgDissolved(orgId: string, agents: Agent[]): Agent[]

// State validation (debug mode)
function validateAgentState(agent: Agent, locations: Location[], orgs: Organization[]): string[]
```

## Objectives

### Phase A: Create State Helper Module
- [x] Create `src/simulation/systems/AgentStateHelpers.ts`
- [x] Implement `setEmployment()` and `clearEmployment()`
- [x] Implement `setTravel()`, `clearTravel()`, `setLocation()`, `clearLocation()`
- [x] Implement `setDead()` consolidating all death cleanup

### Phase B: Entity Deletion Handlers
- [x] Implement `onLocationDeleted()` - clears all agent references to location
- [x] Implement `onOrgDissolved()` - clears all employment references to org
- [x] Call these from `processWeeklyEconomy()` when dissolving orgs

### Phase C: Migrate Existing Code
- [x] Update `AgentSystem.handleStarvation()` to use `setDead()`
- [x] Update `LocationSystem.hireAgent()` to use `setEmployment()`
- [x] Update `LocationSystem.releaseAgent()` to use `clearEmployment()`
- [x] Update `TravelSystem.startTravel()` to use `setTravel()`
- [x] Update `TravelSystem.processTravel()` arrival to use `setLocation()`
- [x] Update `EconomySystem` homeless check to use `setLocation()`

### Phase D: State Validation
- [x] Implement `validateAgentState()` that checks invariants
- [x] Implement `validateAllAgents()` for batch validation
- [x] Log warnings for any detected inconsistencies

### Phase E: Cleanup Zombie Code
- [x] Remove unused agent statuses (`on_mission`, `wounded`, `captured`, `retired`) - YAGNI
- [x] Remove unused `Location.occupants[]` field - YAGNI
- [x] Audit all places agent state is modified, ensure using helpers

## Key Invariants to Enforce

```typescript
// Employment invariants
status === 'employed' ⟺ (employer !== undefined AND employedAt !== undefined)
status !== 'employed' ⟹ salary === 0

// Travel invariants
currentLocation !== undefined ⟺ travelingTo === undefined
travelingTo !== undefined ⟹ (travelingFrom !== undefined AND travelPhasesRemaining !== undefined)

// Reference validity
employedAt !== undefined ⟹ location exists in locations[]
employer !== undefined ⟹ org exists in organizations[]
currentLocation !== undefined ⟹ location exists in locations[]
travelingTo !== undefined ⟹ location exists in locations[]
```

## Key Files to Create

| File | Purpose |
|------|---------|
| `src/simulation/systems/AgentStateHelpers.ts` | Centralized state management |

## Key Files to Modify

| File | Change |
|------|--------|
| `src/simulation/systems/AgentSystem.ts` | Use helpers for death |
| `src/simulation/systems/EconomySystem.ts` | Use helpers, deletion handlers |
| `src/simulation/systems/LocationSystem.ts` | Use helpers for hire/fire |
| `src/simulation/systems/TravelSystem.ts` | Use helpers for travel |
| `src/types/entities.ts` | Remove or document unused statuses |

## Benefits

1. **Single source of truth** - state transitions happen in one place
2. **Atomic updates** - related fields always updated together
3. **Automatic cleanup** - entity deletion propagates to all references
4. **Debuggable** - validation catches inconsistencies early
5. **Extensible** - new states/transitions added in one place

## Non-Goals (Defer)

- Full state machine with transition guards
- Event system / pub-sub for state changes
- Undo/redo support
- State serialization/persistence

## Notes

- Keep helpers pure functions (no side effects beyond the agent)
- Activity log calls stay in the calling code, not in helpers
- Validation is opt-in for performance (debug mode only)
- This is a refactor, not a feature - behavior should be unchanged
