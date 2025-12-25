# PLAN-002: Simple Economy

**Status:** planned
**Priority:** P0 (critical)
**Dependencies:** PLAN-001
**Phase:** 1b

## Goal

Agents can purchase provisions from retail locations. Entrepreneurial agents can open small businesses (restaurant, retail shop) that employ 1 worker and sell goods to other agents.

## Context

Building on PLAN-001's survival mechanics, we add the simplest possible economy:

```
Agent needs provisions → Goes to shop → Pays credits → Gets provisions → Survives another week
```

And the business side:

```
Agent opens shop → Stocks provisions → Sells to customers → Pays employee → Earns profit (or goes broke)
```

**Expected outcome**: Some agents open shops, hire workers, sell provisions. Other agents buy provisions to survive. Shops that can't turn profit dissolve. Agents who can't afford provisions starve.

## Objectives

### Location System
- [ ] Locations exist at coordinates (sector, district)
- [ ] Location templates: `retail_shop`, `restaurant`
- [ ] Locations have: owner (AgentRef | OrgRef), inventory, employee slots
- [ ] Owner can be Agent (Phase 1b) or Org (Phase 1c) - design for both now
- [ ] Job capacity by template (from balance config):
  - `retail_shop`: 1 employee
  - `restaurant`: 1 employee
  - (Future: factory 3-4, research_lab 3-4)

### Location Inventory
- [ ] Locations hold goods (provisions, etc.)
- [ ] Owners can stock locations from personal inventory
- [ ] Customers purchase from location inventory

### Simple Commerce
- [ ] Agents can "buy" action: pay credits, receive goods
- [ ] Fixed prices for now (e.g., 10 credits per provisions)
- [ ] Transaction: buyer wallet → seller wallet, goods transfer
- [ ] Agents prioritize buying provisions when hungry and have credits

### Agent Entrepreneurship
- [ ] Agents with sufficient credits can "open business"
- [ ] Opening cost (e.g., 200 credits for retail_shop)
- [ ] Agent becomes owner, location created
- [ ] Owner stocks location with provisions (from personal inventory or purchased)

### Basic Employment
- [ ] Locations can hire agents for jobs
- [ ] Job = work at location, earn salary
- [ ] Salary tier: `unskilled` (100-300 credits/week)
- [ ] Hiring: randomly select from available agents
- [ ] Employee works at location (present during day phase)

### Weekly Payroll
- [ ] On week rollover, locations pay employees
- [ ] Payment: location owner wallet → employee wallet
- [ ] If owner can't pay: employee leaves, seeks other work

### Business Viability
- [ ] Locations have operating costs (rent/maintenance)
- [ ] Revenue: sales to customers
- [ ] Profit = revenue - salary - operating costs
- [ ] If owner wallet goes negative: business dissolves
- [ ] Dissolved: location removed, employees become available

### Agent Decision Making (Simple)
- [ ] Each phase, agent chooses action based on priority:
  1. If hungry + has credits: go buy provisions
  2. If employed: go to work
  3. If unemployed + shops hiring: seek job
  4. If has lots of credits + entrepreneurial: open business
  5. Else: idle

### Test Harness
- [ ] Create 20 agents (varied starting credits/provisions)
- [ ] Create 2 initial retail_shops with provisions stocked
- [ ] Run simulation for 100+ weeks
- [ ] Observe: purchases, employment, new businesses, failures, deaths

### Activity Log Additions
- [ ] Log: "Agent X purchased 2 provisions from Shop Y for 20 credits"
- [ ] Log: "Agent X opened retail_shop 'Corner Store'"
- [ ] Log: "Agent X hired by Shop Y (salary: 150/week)"
- [ ] Log: "Shop Y dissolved (owner bankrupt)"
- [ ] Log: "Agent X quit job at Shop Y (unpaid)"

## Economic Parameters (Data-Driven)

All values in `data/config/balance.json` - designers can tweak without code changes:

```json
{
  "economy": {
    "prices": {
      "provisions": 10
    },
    "salary": {
      "unskilled": { "min": 100, "max": 300 }
    },
    "entrepreneurThreshold": 500
  },
  "locations": {
    "retail_shop": {
      "openingCost": 200,
      "operatingCost": 50,
      "employeeSlots": 1
    },
    "restaurant": {
      "openingCost": 300,
      "operatingCost": 75,
      "employeeSlots": 1
    }
  }
}
```

## Verification

- [ ] Agents can purchase provisions and survive
- [ ] Shops sell provisions, earn revenue
- [ ] Employees get paid weekly
- [ ] Unprofitable shops dissolve
- [ ] Some agents open new businesses
- [ ] Economy reaches some equilibrium (or interesting collapse)
- [ ] Run 200 weeks stable

## Non-Goals (Defer)

- No complex org hierarchy (PLAN-003)
- No gangs/corps with multiple locations (PLAN-003)
- No skilled/specialist jobs (PLAN-003)
- No goods other than provisions
- No market pricing (fixed prices for now)
- No banks/loans

## Notes

- This is "lemonade stand" economics. One good, fixed prices, simple businesses.
- The interesting emergent behavior: do businesses survive? Does everyone starve? What equilibrium emerges?
- Entrepreneurship threshold ensures agents need capital to start businesses.
