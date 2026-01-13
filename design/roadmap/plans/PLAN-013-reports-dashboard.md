# PLAN-013: Reports Dashboard

**Status:** completed
**Priority:** P1 (high)
**Dependencies:** PLAN-010 (headless testing - provides Metrics infrastructure)

## Goal

Add a "Reports" tab to the Observer UI that displays real-time simulation metrics - population, economy, businesses, and supply chain health.

## Background

The headless testing infrastructure (PLAN-010) created a robust `Metrics.ts` system that tracks simulation health. Currently this data is only visible in CLI output. Exposing it in the UI would help players understand the simulation's macro-level dynamics.

## Objectives

- [x] A. Add "Reports" tab to NavPanel
- [x] B. Create ReportsPanel component with sections for each metric category
- [x] C. Integrate metrics tracking into live simulation (call takeSnapshot each tick/phase)
- [x] D. Display current snapshot data in ReportsPanel
- [ ] E. Add historical tracking (last N snapshots) for trend indicators (deferred)
- [x] F. Show transaction counts (retail sales, wages paid, deaths this session)

## Design

### ReportsPanel Layout

```
┌─────────────────────────────────────────────────────────┐
│ POPULATION                    │ ECONOMY                 │
│ ───────────                   │ ───────                 │
│ Alive:     187                │ Total Credits:  45,230  │
│ Dead:       13                │ Agent Credits:  28,150  │
│ Employed:  142                │ Org Credits:    17,080  │
│ Unemployed: 45                │                         │
│ Owners:     23                │                         │
├─────────────────────────────────────────────────────────┤
│ BUSINESSES                    │ SUPPLY CHAIN            │
│ ───────────                   │ ────────────            │
│ Active Orgs:    23            │ Factory Stock:    1,240 │
│ Retail Shops:   18            │ Shop Stock:         890 │
│ Wholesalers:     5            │ Agent Inventory:    456 │
│                               │ Total Provisions: 2,586 │
├─────────────────────────────────────────────────────────┤
│ SESSION ACTIVITY                                        │
│ ────────────────                                        │
│ Retail Sales: 1,247  │ Wages Paid: 8,420               │
│ Wholesale:      89   │ Dividends:  2,340               │
│ Deaths:         13   │ Immigrants:    28               │
│ Businesses +12 / -3  │ Hires: 156 / Fires: 23          │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

1. `Simulation.ts` creates metrics tracker on init
2. Each tick, call `takeSnapshot()` to update current metrics
3. Store last N snapshots for history (configurable, default 28 = 1 week)
4. ReportsPanel reads from simulation state and renders

### Key Files

| File | Change |
|------|--------|
| `src/ui/panels/NavPanel.ts` | Add "Reports" tab |
| `src/ui/panels/ReportsPanel.ts` | New - renders metrics data |
| `src/simulation/Simulation.ts` | Add metrics to SimulationState, update each tick |
| `src/ui/UIController.ts` | Pass metrics to ReportsPanel |

## Non-Goals

- Graphical charts/sparklines (keep it terminal aesthetic with numbers)
- Exporting reports to files
- Comparing across simulation runs

## Notes

- Match the existing cyberpunk terminal aesthetic
- Use the same Panel/Table components where applicable
- Consider using a simple grid layout rather than Table component
