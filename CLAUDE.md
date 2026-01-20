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
- `src/simulation/systems/AgentEconomicSystem.ts` - Agent purchasing, job seeking, housing
- `src/simulation/systems/BusinessOpportunityService.ts` - Business creation, entrepreneurship
- `src/simulation/systems/SupplyChainSystem.ts` - Restocking, order fulfillment, B2B commerce
- `src/simulation/systems/PayrollSystem.ts` - Weekly payroll, rent, org dissolution
- `src/simulation/systems/OrgBehaviorSystem.ts` - Org-level procurement, expansion
- `src/simulation/systems/DemandAnalyzer.ts` - Market demand analysis for entrepreneurs
- `src/simulation/systems/TravelSystem.ts` - Distance, travel time
- `src/simulation/systems/ImmigrationSystem.ts` - Population sustainability

**Metrics, Logging & Validation:**
- `src/simulation/Metrics.ts` - Singleton metrics tracking (use `track*()` functions)
- `src/simulation/ActivityLog.ts` - Event logging
- `src/simulation/validation/InvariantChecker.ts` - Runtime state validation (enable in simulation.json)

**ID Generation:**
- `src/simulation/IdGenerator.ts` - Unified ID generation (use `idGen.next*()`, never manual IDs)

**Generation & Config:**
- `src/generation/CityGenerator.ts` - Procedural city generation
- `src/config/ConfigLoader.ts` - Config/template loading

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

**All tunable values live in JSON, no hardcoded constants (magic numbers).**

### Config Files (`data/config/`)

Configuration is split by concern:

- **Core Simulation:**
  - `simulation.json` - Time structure, phases, population limits
  - `economy.json` - Goods catalog, prices, production rates
  - `zones.json` - City zone types and densities
  - `transport.json` - Vehicle types, speeds, costs

- **Agent Tuning:**
  - `agents.json` - Hunger rates, inventory capacity, spawn values
  - `thresholds.json` - Decision thresholds (emergency hunger level, restock triggers)

- **Business & Economy:**
  - `business.json` - Entrepreneurship rates, capital requirements, expansion parameters
  - `logistics.json` - Delivery costs, trucking fleets, procurement triggers

- **Behavior System:**
  - `behaviors.json` - Data-driven behavior definitions (conditions, priorities, executors)

### Templates (`data/templates/`)

Entity templates define types through data:
- `orgs/` - Organization templates (corporations, shops, factories)
- `agents/` - Agent templates (civilians, workers)
- `locations/` - Location templates (retail, wholesale, offices)
- `buildings/` - Building templates (residential, commercial, industrial)

**Adding new entity types = adding new template JSON files.**

### No Magic Numbers

Never hardcode numeric constants. All tunable values in config files.

```typescript
// ❌ if (agent.hunger > 80)
// ✅ if (agent.hunger > thresholdsConfig.agent.emergencyHunger)
```

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

## System Organization

**Rules:**
- One responsibility per system. If handling multiple domains, split it.
- 800 lines max per file. Large files indicate mixed responsibilities.
- Circular dependencies? Extract to shared service/helper module.
- Preserve module-level state initial values when migrating code (seeded test reproducibility).
- Test incrementally when refactoring: 100 → 200 → 500 → 1000 ticks.

**Naming conventions:**
- `*System.ts` - Called by main simulation loop
- `*Service.ts` - Shared utilities for multiple systems
- `*Helpers.ts` - Pure functions for state transformations
- `*Analyzer.ts` - Compute derived data

## Behavior System

Data-driven via `data/config/behaviors.json`:
- `conditions` - when behavior can START (checked only when selecting new behavior)
- `completionConditions` - when behavior ENDS (checked every tick during behavior)
- `priority` - critical > high > normal > idle (higher can interrupt lower)
- `executor` - function that runs each tick

**Key rules:**
- Entry conditions NOT re-checked after start. `completionConditions: { never: true }` runs forever unless interrupted.
- Same-priority behaviors: first match in JSON wins.
- Scope conditions narrowly: use `atLocationWithTag` for specialized behaviors (truckers, guards).
- `hasEmployment: true` matches ALL employed agents, not specific jobs.
- Use `setEmployment()` / `clearEmployment()` - they manage shift state cleanup.

**Shift staggering pattern** (work, patrols, missions):
1. State: `{ phasesInActivity, lastEndPhase }`
2. Entry: `phasesSince<Activity>` cooldown condition
3. Exit: `phases<Activity>ThisSession` completion condition
4. Stagger: Initialize `phasesInActivity = random(0, duration/2)`

## Agent State Management

**Always use `AgentStateHelpers.ts` for agent state transitions.** Never directly mutate employment, travel, or location fields.

Key helpers: `setEmployment()`, `clearEmployment()`, `setTravel()`, `setLocation()`, `setDead()`, `onOrgDissolvedWithLocations()`

See the helpers file for full documentation.

## Common Pitfalls

**ID Generation:**
- Never create IDs manually. Always use `idGen.nextLocationId()` / `idGen.nextOrgId()`.
- CityGenerator and runtime share same IdGenerator to prevent collisions.

**State Management:**
- Use `AgentStateHelpers` for agent state (never direct mutation).
- Always return new state in tick processing (no mutations).
- Revenue goes to org wallet, not agent.

**Bidirectional Relationships:**
Must update both sides:
- `org.locations[]` ↔ `location.owner`
- `location.employees[]` ↔ `agent.employedAt`
- `agent.residence` ↔ `location.residents[]`

Use `setEmployment()` / `clearEmployment()` to maintain sync. Enable invariant checking in `simulation.json`.

**Behavior System:**
- `completionConditions: { never: true }` needs escape route (blocks lower priorities).
- Entry conditions not re-checked after start.
- JSON order matters (first match wins at same priority).
- Return updated locations/orgs from executors.

**System Organization:**
- 800 line max. Split before unmaintainable.
- One responsibility per system.
- Circular deps? Extract to shared module.
- Test incrementally during refactors.
- Preserve module state initial values (seeded tests).

**General:**
- Use tags, not hardcoded types.
- Log significant events to ActivityLog.
- No unused template fields (YAGNI).
- Use dynamic template lookup (`ownerOrgTemplate`).

## Metrics Instrumentation

Use `Metrics.ts` singleton to track events:
- Sales: `trackRetailSale()` / `trackWholesaleSale()` / `trackB2BSale()`
- Money: `trackWagePayment()` / `trackDividendPayment()`
- Agents: `trackDeath()` / `trackHire()` / `trackFire()` / `trackImmigrant()`
- Business: `trackBusinessOpened()` / `trackBusinessClosed()`

Safe to call anywhere (no-ops if metrics inactive).
