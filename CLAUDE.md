# NeoArcology - Development Guide

A cyberpunk city simulation that runs autonomously.

## Quick Reference

- **Stack**: TypeScript, Pixi.js, Zustand, Electron
- **Architecture**: Simulation-first (world runs autonomously)
- **Time Units**: Phase → Day (8) → Week (56) → Month (224) → Year (2688)

## Core Concepts

- **Simulation-first**: The world runs without player input
- **Agent-driven**: Agents are the atomic unit; orgs are emergent structures
- **Tags over types**: Entities use tags (strings) not hardcoded type enums
- **Templates are data**: "gang", "corporation" are template strings in JSON
- All significant events must be logged to ActivityLog
- Never mutate state directly, use store actions

## Documentation

**Read the Simulation Bible before working on any system:**

| Chapter | Topics |
|---------|--------|
| [agents.md](design/bible/agents.md) | Hunger, fatigue, rest, housing, death, employment |
| [orgs.md](design/bible/orgs.md) | Organizations, leadership, dissolution |
| [economy.md](design/bible/economy.md) | Money flow, transactions, entrepreneurship |
| [inventory.md](design/bible/inventory.md) | Goods, storage, capacity |
| [locations.md](design/bible/locations.md) | Location types, ownership, commerce |
| [production.md](design/bible/production.md) | Factories, production cycles |
| [city.md](design/bible/city.md) | Zones, procedural generation |

Other docs: `design/GAME-DESIGN.md` (high-level design), `design/roadmap/plans/` (implementation plans)

## Key Files

**Simulation Core:**
- `src/simulation/Simulation.ts` - Main simulation controller
- `src/simulation/TickEngine.ts` - Time/tick engine

**Agent Behavior System:**
- `src/simulation/behaviors/BehaviorProcessor.ts` - Main behavior loop
- `src/simulation/behaviors/ConditionEvaluator.ts` - Condition checking
- `src/simulation/behaviors/BehaviorRegistry.ts` - Executor registry
- `src/simulation/behaviors/executors/index.ts` - All behavior executors
- `data/config/behaviors.json` - Behavior definitions (data-driven)

**Systems:**
- `src/simulation/systems/AgentStateHelpers.ts` - Centralized state transitions (use this!)
- `src/simulation/systems/AgentSystem.ts` - Hunger, eating, death
- `src/simulation/systems/EconomySystem.ts` - Transactions, payroll, business
- `src/simulation/systems/OrgBehaviorSystem.ts` - Org-level procurement, expansion
- `src/simulation/systems/DemandAnalyzer.ts` - Market demand analysis for entrepreneurs
- `src/simulation/systems/TravelSystem.ts` - Distance, travel time
- `src/simulation/systems/ImmigrationSystem.ts` - Population sustainability

**Metrics & Logging:**
- `src/simulation/Metrics.ts` - Singleton metrics tracking (use `track*()` functions)
- `src/simulation/ActivityLog.ts` - Event logging

**Generation & Config:**
- `src/generation/CityGenerator.ts` - Procedural city generation
- `src/config/ConfigLoader.ts` - Config/template loading
- `src/types/*.ts` - Type definitions

**Planned:**
- Agent AI: `src/simulation/ai/AgentAI.ts` (advanced decision making)
- Encounter system: `src/simulation/systems/EncounterSystem.ts`

## UI (Observer Mode)

Pure Pixi.js with cyberpunk terminal aesthetic. Key files:
- `src/ui/UIConfig.ts` - Add/edit table columns and detail fields here
- `src/ui/UITheme.ts` - Colors, spacing, fonts

Keyboard: `Space` (+1 phase), `D` (+day), `W` (+week), `M` (+month), `Y` (+year)

## Headless Testing

```bash
npm run sim:test                   # 1000 ticks, random seed
npm run sim:test -- --ticks 5000   # Longer run
npm run sim:test -- --seed 42      # Reproducible
npm run sim:test -- --verbose      # Weekly details
```

**Healthy metrics**: Survival >90%, population ~200, stable credits.

## Configuration

All tunable values live in JSON, no hardcoded constants:
- `data/config/` - simulation.json, economy.json, zones.json, transport.json
- `data/templates/` - orgs/, agents/, locations/

**Adding new entity types = adding new template JSON files.**

## Development Principles

### YAGNI
- Only implement what's currently used. No "for later" code.
- Data files should only contain used fields.
- Delete dead code immediately.

### DRY
- Extract shared logic into functions.
- Single source of truth: each config value lives in ONE place.
- Check if existing systems can be extended before writing new code.

### Data-Driven
- Template files are self-contained (all data for a type in one file).
- Code reads from config, never hardcodes tunable values.

## Behavior System

Agent decisions are **data-driven** via `data/config/behaviors.json`. Each behavior has:
- **conditions**: When the behavior can START (entry conditions)
- **completionConditions**: When the behavior ENDS
- **priority**: critical > high > normal > idle
- **executor**: Function that runs each tick while active

**Critical concept**: Entry conditions are only checked when selecting a NEW behavior. Once a task starts, only completionConditions are checked. A task with `completionConditions: { never: true }` runs forever unless interrupted by higher priority.

**Priority interrupts**: Critical can always interrupt. High can interrupt normal/idle. Same-priority behaviors are selected by JSON order (first match wins).

**Common pattern**: Use completion conditions that mirror the inverse of entry conditions:
```json
"conditions": { "needsBelow": { "hunger": 50 } },
"completionConditions": { "needsAbove": { "hunger": 50 } }
```

## Economic Verticals

The economy has separate supply chains (verticals):

**Food Vertical (Sustenance):**
```
Provisions Factory → Retail Shop/Restaurant → Agent
```

**Alcohol Vertical (Discretionary):**
```
Brewery → Pub → Agent
```

**Knowledge Economy (B2B):**
```
Server Factory → Corporation (buys data_storage)
                      ↓
               Office/Lab (produces valuable_data using data_storage capacity)
```
- 1 data_storage = 10 valuable_data capacity (configurable in economy.json)
- Production capped to available storage
- Orgs buy more storage when 80% full

Each vertical is independent. Adding a new vertical requires:
1. Production location template (wholesale tag)
2. Retail location template (retail tag + inventoryGood) - or null for B2B only
3. Consumer/business behavior (when/why to buy)
4. Restock logic (wholesale → retail) or procurement logic (B2B)

## Agent State Management

**Always use `AgentStateHelpers.ts` for agent state transitions.** Never directly mutate employment, travel, or location fields.

Key helpers: `setEmployment()`, `clearEmployment()`, `setTravel()`, `setLocation()`, `setDead()`, `onOrgDissolvedWithLocations()`

See the helpers file for full documentation.

## Common Pitfalls

### State Management
- Directly modifying agent state fields (use `AgentStateHelpers`)
- Mutations in tick processing (always return new state)
- Revenue to wrong wallet (always org wallet, not agent)

### Behavior System
- Using `completionConditions: { never: true }` without escape (blocks all lower-priority behaviors)
- Forgetting that entry conditions aren't re-checked after task starts
- Behavior order in JSON matters - first matching behavior wins at same priority
- Not returning updated locations/orgs from executors (state gets lost)

### General
- Using hardcoded types instead of tags
- Forgetting to log to ActivityLog
- Adding unused template fields (YAGNI violation)
- Hardcoding template names in CityGenerator (use dynamic lookup via `ownerOrgTemplate`)

## Metrics Instrumentation

Use the singleton pattern in `Metrics.ts` to track simulation events:

```typescript
import { trackRetailSale, trackB2BSale, trackDeath } from '../Metrics';

// When a transaction happens:
trackRetailSale('provisions');
trackB2BSale('data_storage');
trackDeath(agent.name, 'starvation');
```

Available tracking functions:
- `trackRetailSale(good)` / `trackWholesaleSale(good)` / `trackB2BSale(good)`
- `trackWagePayment(amount)` / `trackDividendPayment(amount)`
- `trackDeath(name, cause)` / `trackHire()` / `trackFire()`
- `trackBusinessOpened(name)` / `trackBusinessClosed(name)`
- `trackImmigrant()`

These are no-ops if metrics aren't active, so safe to call anywhere.
