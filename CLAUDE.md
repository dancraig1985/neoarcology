# NeoArcology - Development Guide

A cyberpunk city simulation that runs autonomously. Game modes are different views/control schemes into the same living world.

## Quick Reference

- **Stack**: TypeScript, Pixi.js, Zustand, Electron
- **Architecture**: Simulation-first (world runs autonomously)
- **Time Units**: Phase → Day (4) → Week (28) → Month (112) → Year (1344)

## Core Concepts

- **Simulation-first**: The world runs without player input
- **Agent-driven**: Agents are the atomic unit; orgs are emergent structures run by agents
- **Game modes are views**: Observer, Org, Agent modes view same simulation
- **Leaders drive orgs**: Org "decisions" are actually the leader's decisions
- **Activity log**: All events logged for emergent narrative

## MVP Foundation (4 Pillars)

1. **Tags**: Everything classified by tags, not hardcoded types
2. **Wallets**: Credits flow between entities (agents and orgs have wallets)
3. **Stats + RNG**: 6 agent stats + dice roll = task outcomes
4. **Locations**: Everything physical exists at a location (goods, data, agents)

## Agent Stats

| Category | Stats | Used For |
|----------|-------|----------|
| **Operations** | Force, Mobility, Tech | Missions, combat, infiltration |
| **Enterprise** | Social, Business, Engineering | Economy, politics, R&D |

## Critical Conventions

- Entity IDs are UUIDs
- **Tags over types**: Entities use tags (strings) not hardcoded type enums
- **Behaviors attach to tags**: Adding a tag to an entity gives it that behavior
- **Templates are data**: "gang", "corporation" are template strings, defined in JSON
- **~16 goods categories**: Broad categories (small_arms, narcotics, etc.), not granular items
- **Tangible at locations**: Physical goods stored at locations, non-tangible data on data_storage
- **Agents have personal goals** that may conflict with org goals
- Every org has exactly ONE leader (`leader` field) plus `leadership` array
- Org decisions flow through leader → council (decision style is a tag)
- All significant events must be logged to ActivityLog
- Never mutate state directly, use store actions

## Key Documentation

- **Game Design**: `design/GAME-DESIGN.md` (source of truth for mechanics)
- **Roadmap**: `design/roadmap/plans/` (PLAN files for implementation)

## Key Files (once implemented)

- Simulation loop: `src/simulation/TickEngine.ts`
- World state: `src/simulation/World.ts`
- Agent AI: `src/simulation/ai/AgentAI.ts` (primary behavior driver)
- Leadership AI: `src/simulation/ai/LeadershipAI.ts` (org decisions via leader)
- Encounter system: `src/simulation/systems/EncounterSystem.ts`
- Economy system: `src/simulation/systems/EconomySystem.ts`
- Market system: `src/simulation/systems/MarketSystem.ts`
- Activity log: `src/simulation/ActivityLog.ts`
- Config loader: `src/config/ConfigLoader.ts`
- Types: `src/types/*.ts`

## Configuration (Data-Driven)

- Simulation params: `data/config/simulation.json`
- Economy balance: `data/config/economy.json`
- Scenarios: `data/scenarios/*.json`

**Templates (define entity defaults + tags):**
- Org templates: `data/templates/orgs/*.json`
- Agent archetypes: `data/templates/agents/*.json`
- Location templates: `data/templates/locations/*.json`
- Mission templates: `data/templates/missions/*.json`
- Goods data: `data/templates/goods/*.json`

**Tags & Behaviors:**
- Tag registry: `data/registry/tags.json`
- Behaviors: `data/behaviors/*.json`

**Adding new "types" = adding new template JSON files, no code changes required.**

## Implementation Phases

0. Stack Setup → 1. Peaceful Economy → 2. Proc Gen → 3. Observer UI → 4. Combat/Missions → 5. Org Mode → 6. Agent Mode

**Iterative design**: Each phase refines the design doc. Don't over-design future phases.

## Development Principles

### YAGNI (You Aren't Gonna Need It)
- **Only implement what's currently used**. Don't add fields, parameters, or code "for later".
- **Data files should only contain used fields**. If `security` isn't checked by any code, don't include it in templates. Set unused fields to `null` or omit entirely.
- **Add features when needed**. When implementing security checks, add the `security` field then.
- **Delete dead code**. If something becomes unused, remove it immediately.

### DRY (Don't Repeat Yourself)
- **Extract shared logic into functions**. If the same pattern appears twice, it should be a function.
- **Single source of truth for data**. Each piece of configuration lives in ONE place:
  - Location-specific data → `data/templates/locations/<name>.json`
  - Global game balance → `data/config/balance.json`
  - Time/simulation structure → `data/config/simulation.json`
- **Shared types in one place**. Entity types in `src/types/`, config types in `src/config/ConfigLoader.ts`.
- **Reuse existing systems**. Before writing new code, check if an existing system can be extended.

### Data Organization
- **Template files are self-contained**. All data for a location type lives in its template file.
- **Balance.json is for global parameters only**. Hunger rates, price multipliers, salary ranges—not per-entity config.
- **Code reads from config, never hardcodes tunable values**. Designers should be able to tweak gameplay by editing JSON.

## Common Pitfalls

- Using hardcoded types instead of tags
- Forgetting that org behavior = Leader Agent Tags + Org Tags
- Forgetting to log significant events to ActivityLog
- Not checking org.leader before leadership array operations
- Mutations in tick processing (always return new state)
- Adding template fields that no code uses (YAGNI violation)
- Duplicating data between balance.json and template files (DRY violation)
- Copy-pasting logic instead of extracting shared functions (DRY violation)
