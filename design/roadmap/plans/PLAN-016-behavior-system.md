# PLAN-016: Data-Driven Agent Behavior System

**Status:** completed
**Priority:** P1 (high)
**Dependencies:** None (refactor of existing code)

## Goal

Replace hardcoded if-statement chains with a data-driven behavior selection system defined in JSON.

## Objectives

- [x] Create `src/simulation/behaviors/BehaviorProcessor.ts` - Main behavior loop
- [x] Create `src/simulation/behaviors/ConditionEvaluator.ts` - Condition checking
- [x] Create `src/simulation/behaviors/BehaviorRegistry.ts` - Executor registry
- [x] Create `src/simulation/behaviors/executors/index.ts` - All behavior executors
- [x] Create `data/config/behaviors.json` - Behavior definitions (data-driven)
- [x] Implement priority-based behavior selection (critical > high > normal > idle)
- [x] Add task persistence with entry/completion conditions
- [x] Add debug logging for behavior selection

## Implementation Notes

### Key Concepts
- **Entry conditions**: Only checked when selecting a NEW behavior
- **Completion conditions**: Checked every tick while behavior is active
- **Priority levels**: critical, high, normal, idle
- **Executors**: Functions that run each tick while a behavior is active

### Behaviors Implemented
| ID | Priority | Trigger |
|----|----------|---------|
| emergency_hunger | critical | hunger > 80%, no food |
| forced_rest | critical | fatigue > 99% |
| urgent_rest | high | fatigue > 90% |
| commuting | normal | employed, not at work |
| working | normal | employed, at work |
| buying_food | normal | hungry, no food, has money |
| seeking_leisure | normal | leisure > 50% |
| finding_housing | normal | homeless, has savings |
| starting_business | normal | unemployed, wealthy |
| seeking_job | normal | unemployed |
| wandering | idle | nothing else to do |

## Files Created

| File | Purpose |
|------|---------|
| `src/simulation/behaviors/BehaviorProcessor.ts` | Main tick processing |
| `src/simulation/behaviors/ConditionEvaluator.ts` | Condition evaluation |
| `src/simulation/behaviors/BehaviorRegistry.ts` | Executor registration |
| `src/simulation/behaviors/executors/index.ts` | All executor implementations |
| `data/config/behaviors.json` | Behavior definitions |
