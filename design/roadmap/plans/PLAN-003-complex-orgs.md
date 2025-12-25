# PLAN-003: Complex Organizations

**Status:** planned
**Priority:** P1 (high)
**Dependencies:** PLAN-002
**Phase:** 1c

## Goal

Introduce multi-agent organizations (corporations, gangs) with hierarchy, multiple locations, varied job tiers, and org-level decision making.

## Context

Building on the simple economy, we add organizational complexity:

- Organizations own multiple locations
- Orgs have leaders who make decisions
- Job tiers: unskilled → skilled → specialist
- Larger facilities (factories, research labs) with more employees
- Org-level income/expense tracking

This completes the "peaceful economy" - no combat yet, but a functioning multi-tier economic simulation.

## Objectives

### Organization Entity
- [ ] Orgs separate from individual agent-owned businesses
- [ ] Org has: leader (AgentRef), members, locations, wallet
- [ ] Org templates: `corporation`, `gang`, `small_business`
- [ ] Leader makes hiring/expansion decisions

### Organization Hierarchy
- [ ] Leader: top decision maker
- [ ] Members: employed by org
- [ ] Org wallet separate from leader's personal wallet
- [ ] Profits go to org wallet, leader takes salary/cut

### Multiple Location Types
- [ ] `retail_shop`: 1 employee, low income
- [ ] `restaurant`: 1 employee, low income
- [ ] `office`: 2 employees, medium income (skilled jobs)
- [ ] `factory`: 3-4 employees, high income (mix of unskilled/skilled)
- [ ] `research_lab`: 3-4 employees (specialist jobs)

### Job Tiers
- [ ] Unskilled: no stat requirements, 100-300/week
- [ ] Skilled: requires stat >= 40, 300-600/week
- [ ] Specialist: requires stat >= 60, 600-1500/week
- [ ] Hiring prefers qualified candidates for skilled/specialist roles

### Org Decision Making (Leader-driven)
- [ ] Each week, leader evaluates org status
- [ ] If understaffed: hire (randomly from qualified available)
- [ ] If profitable + enough capital: expand (open new location)
- [ ] If losing money: cut costs (close unprofitable locations)
- [ ] Decision style from org tags (autocratic = leader decides alone)

### Org Finances
- [ ] Income: sum of all location revenues
- [ ] Expenses: all salaries + all operating costs
- [ ] Weekly P&L calculation
- [ ] If wallet negative for 4 weeks: org dissolves

### Org Dissolution
- [ ] All locations transferred to... no one (abandoned) or sold
- [ ] All employees become available
- [ ] Leader becomes available agent
- [ ] Log dissolution event

### Agent Career Progression
- [ ] Agents can be promoted within org (unskilled → skilled)
- [ ] Promotion requires: tenure + stat growth
- [ ] Higher tier = higher salary

### Goods Expansion
- [ ] Add goods categories beyond provisions:
  - `provisions`: food/consumables
  - `supplies`: business supplies
- [ ] Different locations consume/produce different goods

### Test Harness
- [ ] Create 50 agents (varied stats)
- [ ] Create 2 corporations (multiple locations each)
- [ ] Create 1 gang (territorial, different behavior)
- [ ] Create several small businesses
- [ ] Run for 500+ weeks

## Verification

- [ ] Orgs hire agents into appropriate job tiers
- [ ] Skilled jobs go to high-stat agents
- [ ] Orgs expand when profitable
- [ ] Orgs contract/dissolve when unprofitable
- [ ] Leader decisions visible in logs
- [ ] Multi-tier economy stable over 500 weeks
- [ ] Some orgs grow, some shrink - interesting dynamics

## Non-Goals (Defer)

- No inter-org conflict (Phase 4)
- No missions (Phase 4)
- No agent personal goals
- No reputation/heat system
- No market pricing (still fixed)

## Notes

- This is the final "peaceful economy" plan
- After this, economy should feel alive and interesting
- Ready for proc-gen (Phase 2) or UI (Phase 3) or combat (Phase 4)
- Consider: do we need Phase 2 before Phase 3? Maybe UI helps debug economy.
