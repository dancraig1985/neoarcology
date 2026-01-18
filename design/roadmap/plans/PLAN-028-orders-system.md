# PLAN-028: Orders System (B2B Commerce Formalization)

**Status:** planned
**Priority:** P2 (medium)
**Dependencies:** PLAN-027

## Goal
Formalize B2B commerce by replacing ad-hoc restocking with an orders system that drives production based on demand backlogs.

## Objectives
- [ ] Create Order entity type (Order.ts) with lifecycle states
- [ ] Add orders array to WorldState in state.ts
- [ ] Implement order placement in EconomySystem.ts (retail shops place orders to wholesalers)
- [ ] Implement order backlog system for wholesalers/factories
- [ ] Update ProductionSystem.ts - prioritize production for order fulfillment over speculative production
- [ ] Integrate logistics: orders trigger delivery requests
- [ ] Add order placement behaviors to behaviors.json
- [ ] MIGRATION STRATEGY: Implement orders alongside existing ad-hoc restocking (parallel systems)
- [ ] Run sim for 1000+ ticks with both systems active, compare effectiveness
- [ ] Gradually reduce ad-hoc restocking frequency, increase order usage
- [ ] Final test: disable ad-hoc restocking entirely, verify economy functions
- [ ] Monitor: order backlogs grow/shrink reasonably, delivery times acceptable
- [ ] Update design bible: economy.md (orders system, backlog-driven production), orgs.md (wholesale model)

## Critical Files
**Configuration:**
- `data/config/economy.json`
- `data/config/behaviors.json`

**Code:**
- `src/types/Order.ts` (NEW)
- `src/simulation/state.ts`
- `src/simulation/systems/EconomySystem.ts` (MAJOR REFACTOR)
- `src/simulation/systems/ProductionSystem.ts`
- `src/simulation/systems/OrgBehaviorSystem.ts`

**Documentation:**
- `design/bible/economy.md` (major section)
- `design/bible/orgs.md`
- `design/bible/production.md`

## Notes
VERY HIGH RISK: New entity type, state model changes, wholesale commerce refactor. Order lifecycle: Placement → Production → Ready → In-Transit → Delivered. Careful migration: keep both systems during testing, phase out old one gradually. May need UI components to visualize order queues (scope risk).

## Risks
- State model complexity (orders array, lifecycle management)
- Performance (hundreds of orders per tick?)
- Breaking existing economy if bugs exist
- Testing complexity without order queue visualization
