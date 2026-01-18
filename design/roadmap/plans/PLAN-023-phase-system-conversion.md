# PLAN-023: Phase System Conversion (4→8 Phases/Day)

**Status:** completed
**Priority:** P0 (critical)
**Dependencies:** None

## Goal
Convert the time system from 4 phases/day to 8 phases/day to allow more activity per day before adding new features.

## Objectives
- [x] Update time unit relationships (1 Day = 8 phases, 1 Week = 56 phases, 1 Month = 224 phases, 1 Year = 2688 phases)
- [x] Multiply all phase-based durations by 2 in simulation.json, agents.json (halved perPhase rates)
- [x] Update all location templates - multiply production cycle phases by 2 (6 templates updated)
- [x] Update code: TickEngine.ts (expanded phase names from 4 to 8)
- [x] Run baseline test before changes: `npm run sim:test -- --ticks 1000 --seed 42` (baseline: 138 agents, 82,781 credits)
- [x] Run verification test: `npm run sim:test -- --ticks 2000 --seed 42` (result: 161 agents, 82,440 credits - comparable)
- [x] Update documentation: CLAUDE.md time units, agents.md (hunger/fatigue rates), production.md (cycle tables)

## Critical Files
**Configuration:**
- `data/config/simulation.json`
- `data/config/economy.json`
- `data/config/behaviors.json`
- `data/templates/locations/*.json`

**Code:**
- `src/simulation/TickEngine.ts`
- `src/simulation/systems/AgentSystem.ts`
- `src/types/Config.ts`

**Documentation:**
- `CLAUDE.md`
- `design/bible/agents.md`
- `design/bible/production.md`

## Notes
This is a mechanical find-and-replace pattern. Low risk but extensive verification needed to ensure simulation equivalence. Better to change now than after adding warehouses/logistics systems.
