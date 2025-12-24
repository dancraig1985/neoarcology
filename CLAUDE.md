# NeoArcology - Development Guide

A cyberpunk city simulation that runs autonomously. Game modes are different views/control schemes into the same living world.

## Quick Reference

- **Stack**: TypeScript, Pixi.js, Zustand, Electron
- **Architecture**: Simulation-first (world runs autonomously)
- **Time Units**: Phase → Day (4) → Week (28) → Month (112) → Year (1344)

## Core Concepts

- **Simulation-first**: The world runs without player input
- **Game modes are views**: Observer, Fixer, Agent modes view same simulation
- **Organizations drive the sim**: Orgs generate missions, agents execute them
- **Activity log**: All events logged for emergent narrative

## Agent Stats

| Category | Stats | Used For |
|----------|-------|----------|
| **Operations** | Force, Mobility, Tech | Missions, combat, infiltration |
| **Enterprise** | Social, Business, Engineering | Economy, politics, R&D |

## Critical Conventions

- Entity IDs are UUIDs
- Every org has exactly ONE leader (`leader` field) plus `leadership` array
- Locations have org-specific preferences (gangs → safehouses, corps → offices)
- All significant events must be logged to ActivityLog
- Never mutate state directly, use store actions

## Key Documentation

- **Game Design**: `design/GAME-DESIGN.md` (source of truth for mechanics)
- **Roadmap**: `design/roadmap/plans/` (PLAN files for implementation)

## Key Files (once implemented)

- Simulation loop: `src/simulation/TickEngine.ts`
- World state: `src/simulation/World.ts`
- Organization AI: `src/simulation/ai/OrgAI.ts`
- Agent AI: `src/simulation/ai/AgentAI.ts`
- Activity log: `src/simulation/ActivityLog.ts`
- Types: `src/types/*.ts`
- Balance: `data/config.json`

## Common Pitfalls

- Forgetting to log significant events to ActivityLog
- Not checking org.leader before leadership array operations
- Mutations in tick processing (always return new state)
- [Add as discovered during development]
