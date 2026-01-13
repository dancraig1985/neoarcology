# NeoArcology - Development Guide

A cyberpunk city simulation that runs autonomously.

## Quick Reference

- **Stack**: TypeScript, Pixi.js, Zustand, Electron
- **Architecture**: Simulation-first (world runs autonomously)
- **Time Units**: Phase → Day (4) → Week (28) → Month (112) → Year (1344)

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

**Implemented:**
- Simulation controller: `src/simulation/Simulation.ts`
- Time/tick engine: `src/simulation/TickEngine.ts`
- Agent state helpers: `src/simulation/systems/AgentStateHelpers.ts` (centralized state transitions)
- Agent system: `src/simulation/systems/AgentSystem.ts` (hunger, eating, death)
- Economy system: `src/simulation/systems/EconomySystem.ts` (transactions, payroll, business)
- Org system: `src/simulation/systems/OrgSystem.ts` (production, org operations)
- Location system: `src/simulation/systems/LocationSystem.ts` (commerce, hiring)
- Inventory system: `src/simulation/systems/InventorySystem.ts` (goods, capacity)
- Travel system: `src/simulation/systems/TravelSystem.ts` (distance, travel time)
- Immigration system: `src/simulation/systems/ImmigrationSystem.ts` (population sustainability)
- City generation: `src/generation/` (zones, locations, procedural city)
- Activity log: `src/simulation/ActivityLog.ts`
- Config loader: `src/config/ConfigLoader.ts`
- Types: `src/types/*.ts`
- UI system: `src/ui/` (see UI Architecture below)

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

## Agent State Management

**Always use `AgentStateHelpers.ts` for agent state transitions.** Never directly mutate employment, travel, or location fields.

Key helpers: `setEmployment()`, `clearEmployment()`, `setTravel()`, `setLocation()`, `setDead()`, `onOrgDissolvedWithLocations()`

See the helpers file for full documentation.

## Common Pitfalls

- Using hardcoded types instead of tags
- Forgetting to log to ActivityLog
- Mutations in tick processing (always return new state)
- Directly modifying agent state fields (use `AgentStateHelpers`)
- Revenue to wrong wallet (always org wallet, not agent)
- Adding unused template fields (YAGNI violation)
