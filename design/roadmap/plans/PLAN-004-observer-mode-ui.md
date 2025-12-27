# PLAN-004: MVP Observer Mode UI

**Status:** completed
**Priority:** P1 (high)
**Dependencies:** PLAN-003 (completed)
**Phase:** 3
**Reference:** [GAME-DESIGN.md - Observer Mode](design/GAME-DESIGN.md#1-observer-mode-mvp)

## Goal

Build a pure Pixi.js Observer Mode UI that lets players browse the simulation like a Django admin - viewing entities, reading activity logs, and controlling tick advancement.

## Context

The simulation is running but invisible - all feedback is console logs. We need a cyberpunk terminal-style UI to:
- Browse entities (Agents, Orgs, Locations) in table format
- View entity details
- Read and filter the activity log
- Advance time: End Turn (1 phase) or batch advance (day/week/month/year)

**Design inspiration**: Django admin / ORM browser through a retro computer terminal. The player is an overlord managing their empire through a computer interface.

## Architecture

### Component System (Scalable/Extensible)

```
src/ui/
  components/          # Reusable primitives
    UIComponent.ts     # Base class (Container + width/height/layout)
    Panel.ts           # Bordered container with optional header
    ScrollableList.ts  # Scrollable content with scrollbar
    Table.ts           # Data-driven table (columns defined via config)
    DetailView.ts      # Key-value display for entity details
    Button.ts          # Clickable button with hover state

  panels/              # Composed UI regions
    HeaderPanel.ts     # Title + time display
    NavPanel.ts        # Entity type navigation (sidebar)
    MainPanel.ts       # Entity list + detail view
    LogPanel.ts        # Activity log with filtering
    ControlsPanel.ts   # Tick buttons

  UIController.ts      # Bridges simulation state to UI
  UITheme.ts           # Colors, spacing, fonts
  UIConfig.ts          # Column/field definitions (extensibility point)
```

### Adding New Entity Types / Columns

To add a new entity type (e.g., Vehicles):
1. Add column definitions to `UIConfig.ts`
2. Add detail field definitions to `UIConfig.ts`
3. Add nav button in `NavPanel.ts`
4. Add case in `UIController.ts`

No new components needed - just configuration.

### Color Palette (Cyberpunk Terminal)

```typescript
background: 0x0a0a12      // Deep dark
panel: 0x12121f           // Panel bg
hover: 0x1a1a2e           // Hover state
border: 0x00ff88          // Neon green (primary)
accent: 0xff0066          // Neon pink (secondary)
text: 0x00ff88            // Green text
textDim: 0x666666         // Dimmed
warning: 0xffcc00         // Yellow
critical: 0xff0066        // Pink/red
```

## UI Layout (from GAME-DESIGN.md)

```
┌─────────────────────────────────────────────────────────────────┐
│  NEOARCOLOGY OBSERVER │ Phase: 1,247 │ Day 311 │ Year 1        │ <- HeaderPanel
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌────────────────────────────────────────────┐  │
│  │ ENTITY   │  │              MAIN VIEW                     │  │
│  │ NAV      │  │                                            │  │
│  │          │  │  Table: [Name] [Status] [Credits] [...]    │  │
│  │ [Agents] │  │  Row 1...                                  │  │
│  │ [Orgs]   │  │  Row 2...                                  │  │
│  │ [Locs]   │  │  ────────────────────────────────────────  │  │
│  │          │  │  DETAIL VIEW (when row selected)           │  │
│  └──────────┘  └────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ACTIVITY LOG                                    [Filter: v] ││ <- LogPanel
│  │ [1247] Victoria Sterling bought 5 provisions                ││
│  │ [1246] Factory produced 10 provisions                       ││
│  └─────────────────────────────────────────────────────────────┘│
│  [End Turn]  [+Day]  [+Week]  [+Month]  [+Year]    Phase: 1247  │ <- ControlsPanel
└─────────────────────────────────────────────────────────────────┘
```

## Objectives

### Phase A: Foundation
- [x] Create `src/ui/UITheme.ts` - colors, spacing constants
- [x] Create `src/ui/components/UIComponent.ts` - base class
- [x] Create `src/ui/components/Panel.ts` - bordered container
- [x] Create `src/ui/UIController.ts` - layout skeleton
- [x] Modify `src/main.ts` - wire UIController to simulation

### Phase B: Header & Controls
- [x] Create `src/ui/panels/HeaderPanel.ts` - title + time display
- [x] Create `src/ui/components/Button.ts` - clickable button
- [x] Create `src/ui/panels/ControlsPanel.ts` - turn advance buttons
- [x] Wire buttons: End Turn (+1), +Day (+4), +Week (+28), +Month (+112), +Year (+1344)

### Phase C: Navigation & Tables
- [x] Create `src/ui/panels/NavPanel.ts` - entity type buttons
- [x] Create `src/ui/components/ScrollableList.ts` - scrolling (built into Table)
- [x] Create `src/ui/components/Table.ts` - data table
- [x] Create `src/ui/panels/MainPanel.ts` - hosts table
- [x] Create `src/ui/UIConfig.ts` - column definitions for Agents, Orgs, Locations

### Phase D: Detail Views
- [x] Create `src/ui/components/DetailView.ts` - key-value display
- [x] Add detail view to MainPanel (appears when row clicked)
- [x] Define detail fields in UIConfig for each entity type

### Phase E: Activity Log
- [x] Create `src/ui/panels/LogPanel.ts` - scrollable log
- [x] Render log entries with phase, icon, message
- [x] Color-code by level (info=gray, warning=yellow, critical=pink)
- [x] Add category filter buttons
- [x] Click entity name in log to navigate to that entity

### Phase F: Polish
- [x] Corner accents on panels (cyberpunk style)
- [x] Row hover highlighting
- [x] Keyboard shortcuts (Space=End Turn, D/W/M/Y for time jumps)
- [x] Window resize handling

## Key Files to Modify

| File | Change |
|------|--------|
| `src/main.ts` | Replace auto-tick with UIController, manual tick via buttons |
| `src/renderer/Renderer.ts` | Minimal - just create Pixi app, UI handles the rest |
| `src/simulation/ActivityLog.ts` | Already has getEntries(), getEntriesByCategory() - sufficient |

## Key Files to Create

| File | Purpose |
|------|---------|
| `src/ui/UITheme.ts` | Colors, fonts, spacing |
| `src/ui/UIConfig.ts` | Column/field definitions |
| `src/ui/UIController.ts` | Main controller |
| `src/ui/components/*.ts` | 6 component files |
| `src/ui/panels/*.ts` | 5 panel files |

## Non-Goals (Defer)

- City map visualization
- Relationships graph
- Power rankings
- Historical graphs/charts
- Statistics dashboard
- Timeline view
- Missions/Vehicles panels (entities not implemented yet)
- Search/filter text input
- Sound effects
- Full keyboard navigation (arrow keys, etc.)

## Verification

- [x] Header shows time (phase, day, week), updates after advance
- [x] Nav buttons switch between Agents/Orgs/Locations tables
- [x] Tables display all entities with correct columns
- [x] Clicking row shows detail view
- [x] Activity log shows entries, auto-scrolls to bottom
- [x] End Turn advances 1 phase, +Day/+Week/+Month/+Year advance by time unit
- [x] Log filtering by category works
- [x] Pure Pixi.js - no DOM overlays
- [x] Cyberpunk aesthetic: dark bg, neon accents, monospace feel

## Notes

- Use BitmapText for all dynamic text (performance)
- Tables are data-driven - columns defined in UIConfig, not hardcoded
- Component base class handles resize/layout pattern
- No React - vanilla Pixi.js + TypeScript
