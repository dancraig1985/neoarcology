# PLAN-001: Peaceful Economy

**Status:** planned
**Priority:** P0 (critical)
**Dependencies:** PLAN-000
**Phase:** 1

## Goal

Build a "normal" cyberpunk economy with no hostile actions. The world runs, money flows, agents work jobs.

## Context

This phase proves the core simulation loop works. No UI, no combat, no missions - just economic activity observable via console logs. We want to see:
- Orgs owning locations that generate income
- Agents getting hired, working jobs, earning salaries
- Money flowing correctly (income in, expenses out)
- The simulation stable over hundreds/thousands of ticks

**No hostile actions yet.** That's Phase 4.

## Objectives

### Tick Engine
- [ ] Implement TickEngine that processes phases
- [ ] Time rollover: phase → day (4) → week (28) → month (112) → year (1344)
- [ ] Phase-of-day tracking (dawn, day, dusk, night)
- [ ] Tick processing order (agents → economy → locations → world)

### Entity System
- [ ] Entity factory (create entities from templates)
- [ ] Tag system (entities get behaviors from tags)
- [ ] Entity registry (lookup by ID, query by tags)

### Location System
- [ ] Locations generate income based on `timing` (per_phase, per_day, per_week)
- [ ] Locations track occupants (agents present)
- [ ] Location ownership by organizations

### Agent System
- [ ] Agent creation from templates
- [ ] Agent employment state (employed/available)
- [ ] Agents assigned to jobs at locations
- [ ] Unemployed agents seek work each tick
- [ ] Job matching: stat requirements vs agent stats

### Organization System
- [ ] Org creation from templates
- [ ] Orgs own locations
- [ ] Orgs employ agents
- [ ] Basic leader decisions: hire when understaffed
- [ ] Org income: sum of location incomes
- [ ] Org expenses: salaries, location operating costs

### Economy System
- [ ] Wallet operations (credit, debit, transfer)
- [ ] Income timing system (per-phase, daily, weekly, monthly)
- [ ] Weekly payroll processing (on week rollover)
- [ ] Salary payment: org → agent wallets
- [ ] Operating costs: deducted from org wallets

### Activity Log
- [ ] Log significant events (hiring, payments, etc.)
- [ ] Structured log entries with phase, entity refs, event type
- [ ] Console output for debugging

### Verification
- [ ] Run 1000+ ticks without crashes
- [ ] Verify money conservation (total credits stable, just moving between wallets)
- [ ] Verify agents get hired over time
- [ ] Verify orgs pay salaries weekly
- [ ] Verify locations generate income on correct timing
- [ ] Console logs show economic activity

## Open Questions

These need answers before/during implementation:

1. **Starting state**: How do we seed the initial world? Hardcoded test data, or minimal proc-gen?
2. **Job capacity**: How many jobs per location? Based on size? Fixed per template?
3. **Hiring logic**: How do orgs decide who to hire? Best stats? First available?
4. **Bankruptcy**: What happens when an org can't pay salaries? Defer to later phase?
5. **Agent spending**: Do agents spend money in Phase 1, or just accumulate?

## Non-Goals (Defer)

- No procedural generation (Phase 2)
- No UI (Phase 3)
- No combat, missions, or hostile actions (Phase 4)
- No agent personal goals
- No org goals beyond "stay solvent"
- No inter-org relationships
- No market/trading system

## Technical Notes

- All state changes go through Zustand store actions
- Never mutate state directly
- Log all significant events to ActivityLog
- Use templates from `data/templates/` - don't hardcode entity properties

## Success Criteria

When complete:
1. `npm run dev` starts simulation that ticks automatically
2. Console shows economic activity (hiring, payments, income)
3. Running for 1000 phases shows stable economy
4. Multiple orgs, agents, and locations interacting
5. Ready for Phase 2 (proc-gen) or Phase 3 (UI)
