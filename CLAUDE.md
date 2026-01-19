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

### No Magic Numbers Policy

**NEVER hardcode numeric constants in system code.** All tunable values must live in config files:

❌ **Bad:**
```typescript
if (agent.hunger > 80) { // Magic number!
  seekFood();
}
```

✅ **Good:**
```typescript
if (agent.hunger > thresholdsConfig.agent.emergencyHunger) {
  seekFood();
}
```

This makes economic tuning possible without code changes and prevents scattered constants from becoming maintenance nightmares.

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

## System Organization & Architecture

### Single Responsibility Principle

**Each system should have ONE clear, focused responsibility.** If a system handles multiple domains, split it.

**File size limit: 800 lines max per system.** Large files are unmaintainable and indicate mixed responsibilities.

Example (PLAN-032):
- ❌ `EconomySystem.ts` (2243 lines) - handled payroll, restocking, agent decisions, business creation
- ✅ Split into:
  - `AgentEconomicSystem.ts` (~940 LOC) - agent decisions only
  - `PayrollSystem.ts` (~420 LOC) - weekly financial operations only
  - `SupplyChainSystem.ts` (~560 LOC) - B2B commerce only
  - `BusinessOpportunityService.ts` (~370 LOC) - business creation only

### Breaking Circular Dependencies

When splitting systems, watch for circular imports:
- System A calls System B
- System B calls System A
- TypeScript import cycle error

**Solution: Extract to shared service**

Example from PLAN-032:
- Problem: `AgentEconomicSystem` → `tryOpenBusiness()` → needs agent data → circular
- Solution: Create `BusinessOpportunityService.ts` as neutral ground
- Both `AgentEconomicSystem` and behavior executors can import from service

**Don't use callbacks or dependency injection for simple cases** - adds complexity. Prefer extracting to a shared module.

### Module State Preservation

When migrating code between files, preserve module-level state carefully:

```typescript
// OLD FILE (EconomySystem.ts)
let locationIdCounter = 1;
let orgIdCounter = 100;

// NEW FILE (BusinessOpportunityService.ts)
let locationIdCounter = 1;  // ✅ Same initial value
let orgIdCounter = 100;     // ✅ Preserves reproducibility
```

**Why this matters**: Seeded tests must produce identical results before/after migration.

### Incremental Migration Strategy

When refactoring large systems:

1. **Plan the split** - identify domains and dependencies first
2. **Create empty files** with exports
3. **Migrate one domain at a time** (not all at once)
4. **Test after each migration** with increasing tick counts:
   - 100 ticks (basic functionality)
   - 200 ticks (interactions)
   - 500 ticks (stability)
   - 1000 ticks (integration)
5. **Use git commits** - one commit per system migration for easy rollback
6. **Delete old file last** - only after full integration test passes

Example test progression from PLAN-032:
```bash
npm run sim:test -- --seed 42 --ticks 100  # BusinessOpportunityService
npm run sim:test -- --seed 42 --ticks 200  # + SupplyChainSystem
npm run sim:test -- --seed 42 --ticks 300  # + PayrollSystem
npm run sim:test -- --seed 42 --ticks 500  # + AgentEconomicSystem
npm run sim:test -- --seed 42 --ticks 1000 # Final integration
```

### System Naming Conventions

- **Systems**: End in `System.ts` (e.g., `PayrollSystem.ts`, `AgentSystem.ts`)
- **Services**: End in `Service.ts` (e.g., `BusinessOpportunityService.ts`)
- **Helpers**: End in `Helpers.ts` (e.g., `AgentStateHelpers.ts`)
- **Analyzers**: End in `Analyzer.ts` (e.g., `DemandAnalyzer.ts`)

**Systems** are called by the main simulation loop. **Services** are shared utilities called by multiple systems. **Helpers** provide pure functions for state transformations. **Analyzers** compute derived data.

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

**Behavior Condition Best Practices**:
- Always scope conditions as narrowly as possible to avoid unintended behavior matches
- Use `atLocationWithTag` to restrict behaviors to specific location types (e.g., `"atLocationWithTag": "depot"` for logistics-only behaviors)
- Test new behaviors by running headless sim and checking for unexpected warning spam
- When adding specialized worker behaviors (truckers, security guards, etc.), gate them with location tag conditions
- Remember: `hasEmployment: true` matches ALL employed agents, not just specific job types

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

### System Organization
- Letting systems grow beyond 800 lines (split before they become unmaintainable)
- Mixing multiple responsibilities in one system (payroll + restocking + agent decisions = bad)
- Creating circular dependencies between systems (extract to shared service instead)
- Not testing after each migration step (incremental testing catches errors early)
- Changing module-level state initial values during migration (breaks reproducibility)

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
