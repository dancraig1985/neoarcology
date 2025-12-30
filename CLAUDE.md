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
- Every org has exactly ONE leader (`leader` field) who receives owner dividends
- All significant events must be logged to ActivityLog
- Never mutate state directly, use store actions

### Business Ownership Model
- **Commercial locations** (shops, factories) are owned by orgs for clean accounting
- Orgs are defined by templates: `corporation` (large), `small_business` (owner-operated)
- When an agent starts a business, a `small_business` org is created to own it
- Revenue goes to **org wallet**, not agent wallet
- Owners extract profits via **weekly dividend** (30 credits/week)
- If owner dies, org dissolves automatically
- **Personal locations** (homes, hideouts) can be owned directly by agents via `ownerType: 'agent'`

### Supply Chain
- **Wholesale** (`wholesale` tag): Sells to businesses (factories)
- **Retail** (`retail` tag): Sells to consumers (shops)
- Money flows: Factory → (wholesale) → Shops → (retail) → Agents → (salary) → back to agents

## Key Documentation

- **Game Design**: `design/GAME-DESIGN.md` (source of truth for mechanics)
- **Roadmap**: `design/roadmap/plans/` (PLAN files for implementation)
- **Simulation Bible**: `design/bible/` (detailed system documentation)

### Simulation Bible

The `design/bible/` folder contains detailed documentation for each simulation system. **Read relevant chapters before working on a system:**

| Chapter | When to Read |
|---------|--------------|
| [agents.md](design/bible/agents.md) | Working on hunger, eating, death, agent behavior |
| [orgs.md](design/bible/orgs.md) | Working on organizations, leadership, dissolution |
| [economy.md](design/bible/economy.md) | Working on money flow, transactions, payroll |
| [inventory.md](design/bible/inventory.md) | Working on goods, storage, capacity |
| [locations.md](design/bible/locations.md) | Working on locations, templates, commerce |
| [production.md](design/bible/production.md) | Working on factories, production cycles |
| [city.md](design/bible/city.md) | Working on zones, map, procedural generation |

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
- City generation: `src/generation/` (zones, locations, procedural city)
- Activity log: `src/simulation/ActivityLog.ts`
- Config loader: `src/config/ConfigLoader.ts`
- Types: `src/types/*.ts`
- UI system: `src/ui/` (see UI Architecture below)

**Planned:**
- Agent AI: `src/simulation/ai/AgentAI.ts` (advanced decision making)
- Encounter system: `src/simulation/systems/EncounterSystem.ts`

## UI Architecture (Observer Mode)

Pure Pixi.js UI with cyberpunk terminal aesthetic. No DOM overlays.

### Structure
```
src/ui/
  components/           # Reusable primitives
    UIComponent.ts      # Base class (Container + width/height/layout)
    Panel.ts            # Bordered container with optional header
    Table.ts            # Data-driven table (columns from config)
    DetailView.ts       # Key-value display for entity details
    Button.ts           # Clickable button with hover state

  panels/               # Composed UI regions
    HeaderPanel.ts      # Title + time display
    NavPanel.ts         # Entity type navigation (sidebar)
    MainPanel.ts        # Table (left) + detail view (right)
    MapPanel.ts         # 2D city map visualization
    LogPanel.ts         # Activity log with filtering
    ControlsPanel.ts    # Time advance buttons

  UIController.ts       # Bridges simulation state to UI
  UITheme.ts            # Colors, spacing, fonts
  UIConfig.ts           # Column/field definitions (extensibility point)
```

### Adding New Entity Columns
Edit `src/ui/UIConfig.ts`:
- Table columns: Add to `AGENT_COLUMNS`, `ORG_COLUMNS`, or `LOCATION_COLUMNS`
- Detail fields: Add to `AGENT_DETAILS`, `ORG_DETAILS`, or `LOCATION_DETAILS`

### Keyboard Shortcuts
- `Space` - End Turn (+1 phase)
- `D` - +Day (+4 phases)
- `W` - +Week (+28 phases)
- `M` - +Month (+112 phases)
- `Y` - +Year (+1344 phases)

### Derived Fields
Some display fields are computed, not stored:
- `Organization.leaderName` - Computed from `agents.find(a => a.id === org.leader).name`
- Don't store derived data; compute in UI layer (MainPanel)

## Configuration (Data-Driven)

- Simulation params: `data/config/simulation.json`
- Balance config: `data/config/balance.json` (hunger, prices, salaries, goods)
- Zone config: `data/config/zones.json` (zone types, colors, sizes for city generation)
- Transport config: `data/config/transport.json` (travel modes, distance thresholds)

**Templates (define entity defaults + tags):**
- Org templates: `data/templates/orgs/*.json`
- Agent archetypes: `data/templates/agents/*.json`
- Location templates: `data/templates/locations/*.json` (includes production config, spawn constraints)

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

## Agent State Management

Agent state is managed through centralized helpers in `AgentStateHelpers.ts`. **Always use these helpers instead of directly mutating agent fields.**

### Why Centralized Helpers?
- **Atomic updates**: Related fields are always updated together (e.g., employment requires updating `status`, `employer`, `employedAt`, and `salary` atomically)
- **Automatic cleanup**: Entity deletion propagates to all agent references
- **Single source of truth**: State transitions happen in one place, not scattered across systems

### Available Helpers

| Helper | Purpose |
|--------|---------|
| `setEmployment(agent, locationId, orgId, salary)` | Hire an agent (sets status, employer, employedAt, salary) |
| `clearEmployment(agent)` | Fire/quit (clears all employment fields, sets status to available) |
| `setTravel(agent, fromId, toId, method, phases)` | Start travel (clears currentLocation, sets travel fields) |
| `setLocation(agent, locationId)` | Arrive at location (sets currentLocation, clears travel fields) |
| `setDead(agent, phase)` | Kill an agent (clears all state, sets status to dead) |
| `onLocationDeleted(locationId, agents)` | Clean up all agents referencing a deleted location |
| `onOrgDissolved(orgId, agents)` | Clean up all agents employed by a dissolved org |
| `onOrgDissolvedWithLocations(orgId, locationIds, agents)` | Combined cleanup for org + its locations |

### State Invariants

These invariants are enforced by the helpers and checked by `validateAgentState()`:

```
// Employment: all-or-nothing
status === 'employed' ⟺ (employer AND employedAt AND salary > 0)
status !== 'employed' ⟹ salary === 0

// Location: either at a location OR traveling, never both
currentLocation !== undefined ⟺ travelingTo === undefined
travelingTo !== undefined ⟹ (travelingFrom AND travelPhasesRemaining)
```

### When NOT to Use Helpers

- **Reading state**: Use predicates like `isAgentTraveling()`, `isAgentEmployed()`, `isAgentAlive()`
- **Incremental updates**: Things like hunger accumulation can directly update `agent.needs.hunger`
- **Non-agent state**: Helpers are for agent state; location/org state is managed separately

## Common Pitfalls

- Using hardcoded types instead of tags
- Forgetting to log significant events to ActivityLog
- Mutations in tick processing (always return new state)
- Adding template fields that no code uses (YAGNI violation)
- Duplicating data between balance.json and template files (DRY violation)
- Copy-pasting logic instead of extracting shared functions (DRY violation)
- **Directly modifying agent state fields** instead of using `AgentStateHelpers` (causes inconsistent state)

### Economy Pitfalls
- **Revenue to wrong wallet**: Revenue must go to ORG wallet, not agent/leader wallet
- **Forgetting owner dividends**: Owners need weekly dividend payment to survive
- **Unbalanced economics**: Ensure revenue > (operating costs + salaries + owner dividend)
- **Not handling owner death**: Org must dissolve when leader dies
- **Zombie businesses**: Orgs with <50 credits should dissolve (insolvent)
- **Too many competing businesses**: Entrepreneur threshold too low = shops dilute customer base
