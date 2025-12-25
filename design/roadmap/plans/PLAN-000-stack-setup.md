# PLAN-000: Stack Setup

**Status:** completed
**Priority:** P0 (critical)
**Dependencies:** None
**Phase:** 0
**Reference:** [GAME-DESIGN.md](../../GAME-DESIGN.md) - Phase 0: Stack Setup

## Goal

Set up the development environment and project structure so we can start building the simulation.

## Context

This is the foundation. We need:
- A working TypeScript project with proper tooling
- Pixi.js for future rendering (but not building UI yet)
- Zustand for state management
- Data loading infrastructure (JSON templates/configs)
- Type definitions based on the game design doc

We're starting **web-only** for faster iteration. Electron can be added later.

## Objectives

### Project Scaffold
- [x] Initialize npm project with TypeScript
- [x] Configure TypeScript (strict mode, ES modules)
- [x] Set up Vite as build system (fast HMR, good TS support)
- [x] Create basic folder structure matching design doc

### Dependencies
- [x] Install and configure Pixi.js v8
- [x] Install and configure Zustand
- [x] Install dev dependencies (vitest for testing, prettier, eslint)

### Folder Structure
```
neoarcology/
├── src/
│   ├── main.ts              # Entry point
│   ├── types/               # TypeScript interfaces from design doc
│   │   ├── entities.ts      # Entity, Agent, Organization, Location, etc.
│   │   ├── economy.ts       # Wallet, Job, IncomeStream, etc.
│   │   └── index.ts         # Re-exports
│   ├── simulation/          # (stub for Phase 1)
│   │   └── World.ts         # Empty world container stub
│   ├── config/              # Config loading
│   │   └── ConfigLoader.ts  # Load JSON files
│   ├── store/               # Zustand stores
│   │   └── worldStore.ts    # Main world state store (stub)
│   └── renderer/            # (stub for Phase 3)
│       └── Renderer.ts      # Pixi.js setup stub
├── data/
│   ├── config/              # Simulation parameters
│   │   └── simulation.json  # Time, economy basics
│   └── templates/           # Entity templates
│       ├── orgs/
│       │   ├── corporation.json
│       │   └── gang.json
│       ├── agents/
│       │   └── combat.json
│       └── locations/
│           └── factory.json
├── index.html               # Vite entry HTML
├── vite.config.ts
├── tsconfig.json
├── package.json
└── CLAUDE.md                # Already exists
```

### Type Definitions
- [x] Define base `Entity` interface with tags, template, relationships
- [x] Define `Agent` interface (stats, wallet, employment, morale)
- [x] Define `Organization` interface (leader, members, resources)
- [x] Define `Location` interface (sector, owner, inventory)
- [x] Define `Wallet` interface (credits, accounts, stashes)
- [x] Define `Job` interface (requirements, salary tier, output)
- [x] Define time-related types (IncomeTiming, etc.)
- [x] Define reference types (AgentRef, OrgRef, LocationRef)

### Data Loading
- [x] Create ConfigLoader that reads JSON from `data/` folder
- [x] Create sample template files (1-2 per entity type)
- [x] Create sample simulation.json config
- [x] Verify templates load correctly at startup

### Dev Tooling
- [x] Configure Vite for hot reload
- [x] Add npm scripts: `dev`, `build`, `test`, `lint`
- [x] Create a simple "hello world" that renders to canvas
- [x] Verify Pixi.js initializes (just show a colored background)
- [x] Add basic console logging for loaded config

### Verification
- [x] `npm run dev` starts dev server with HMR
- [x] TypeScript compiles without errors
- [x] Pixi.js canvas renders (colored background)
- [x] Config files load and log to console
- [x] Zustand store initializes (empty world state)

## Non-Goals (Defer to Later Phases)

- No simulation logic (Phase 1)
- No procedural generation (Phase 2)
- No real UI (Phase 3)
- No Electron (can add anytime later)
- No testing setup beyond vitest installation

## Technical Decisions

### Why Vite?
- Fast HMR for rapid iteration
- Native ES modules
- Good TypeScript support out of the box
- Simple configuration

### Why web-only first?
- Faster dev cycle (no Electron rebuild)
- Can add Electron later with minimal changes
- Browser dev tools are excellent

### Why Zustand over Redux?
- Simpler API, less boilerplate
- Good TypeScript support
- Easy to use with Pixi.js (subscribe to state changes)

## Success Criteria

When this phase is complete:
1. Running `npm run dev` opens a browser with a Pixi.js canvas
2. Console shows loaded config data
3. All type definitions compile
4. Project structure matches the design doc architecture
5. Ready to start Phase 1 (simulation logic)

## Notes

- Keep it minimal. This is scaffolding, not features.
- Types should match GAME-DESIGN.md but can be refined in Phase 1.
- Sample data files are just for testing the loader, not final content.
