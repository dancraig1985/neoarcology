# PLAN-008: Agent Leisure Behavior

**Status:** completed
**Priority:** P2 (medium)
**Dependencies:** PLAN-007 (state management - cleaner state handling)
**Phase:** 3

## Goal

Give idle agents somewhere to go, making the city feel more alive and preventing agents from loitering at shops indefinitely.

## Problem Statement

Currently, agents with nothing to do stay wherever they are:
- Unemployed agent buys food at shop → stays at shop forever
- Agent finishes work → stays at workplace
- No concept of "going home" or "hanging out"

This creates unrealistic clustering at retail locations.

## Solution: Public Space Attraction

When an agent has no pressing task (not hungry, not working, not traveling), they go to a nearby public space to "hang out."

## Behavior Priority (Updated)

```
1. Emergency hunger (>80%) → find food immediately
2. Hungry + no food → go buy food
3. Employed + not at work → commute to work
4. Unemployed → try to get job
5. Wealthy → consider opening business
6. **NEW: Idle at non-public location → go to public space**
7. Otherwise → stay where you are
```

## Implementation

Simple check in `processAgentEconomicDecision()`:

```typescript
// 6. Idle agents go to public spaces (not loitering at shops)
if (
  updatedAgent.status === 'available' &&
  !isHungry &&
  !isTraveling(updatedAgent)
) {
  const currentLoc = updatedLocations.find(l => l.id === updatedAgent.currentLocation);
  const isAtPublicSpace = currentLoc?.tags.includes('public');

  if (currentLoc && !isAtPublicSpace) {
    const publicSpace = findNearestLocation(
      updatedAgent,
      updatedLocations,
      loc => loc.tags.includes('public')
    );
    if (publicSpace) {
      updatedAgent = startTravel(updatedAgent, publicSpace, ...);
      ActivityLog.info(phase, 'travel', `heading to ${publicSpace.name} to hang out`, ...);
    }
  }
}
```

## What "Hanging Out" Means (MVP)

For now, just presence at a public space. Future expansions could add:
- Social interactions with other agents
- Street vendors / informal economy
- Recruiting for jobs/gangs
- Chance encounters / events

## Objectives

### Phase A: Idle Detection
- [x] Add idle check after business consideration in `processAgentEconomicDecision()`
- [x] Check: `status === 'available' && !isHungry && !isTraveling && currentLocation not public`

### Phase B: Public Space Travel
- [x] If idle at non-public location, start travel to nearest public space
- [x] Log travel event: "heading to [public space] to hang out"

### Phase C: Activity Log Category
- [x] Add 'leisure' category to activity log
- [x] Use for hang-out travel and future leisure activities

### Phase D: UI Feedback
- [x] Add [LEIS] filter to activity log panel
- [ ] Agents at public spaces show "hanging out" or similar in status area (optional/deferred)

## Key Files to Modify

| File | Change |
|------|--------|
| `src/simulation/systems/EconomySystem.ts` | Add idle → public space logic |
| `src/simulation/ActivityLog.ts` | Add 'leisure' category (if not exists) |
| `src/ui/panels/LogPanel.ts` | Add leisure filter |

## Edge Cases

- Agent travels to public space, gets hungry mid-trip → emergency hunger takes over (existing behavior)
- All public spaces deleted → agent stays where they are (graceful degradation)
- Agent is employed but off-shift (future) → should also go to public space

## Non-Goals (Defer)

- Day/night cycle affecting leisure timing
- Social interactions at public spaces
- Leisure preferences (some agents prefer parks, others bars)
- Leisure satisfaction / happiness meter
- Events triggered by agents gathering

## Notes

- This is a light behavior addition, not a new system
- Sets foundation for future social/leisure features
- Makes city visually more realistic (agents distributed, not clustered at shops)
- Public spaces generated in PLAN-006 are now actually used
- Unemployed agents will naturally congregate at public spaces, making them feel like gathering spots
