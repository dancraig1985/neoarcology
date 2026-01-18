# PLAN-028: Logistics & Trucking Organizations

**Status:** planned
**Priority:** P1 (high)
**Dependencies:** PLAN-027

## Goal
Replace instant goods teleportation with realistic delivery mechanics via logistics companies and trucking.

## Objectives
- [ ] Create logistics_company.json org template
- [ ] Create depot.json location template (trucking hubs)
- [ ] Add truck_driver job type
- [ ] Design delivery queue system (DeliveryRequest entity)
- [ ] Implement delivery queue in EconomySystem.ts
- [ ] Add route planning for truckers in TravelSystem.ts
- [ ] Create logistics dispatch logic in OrgBehaviorSystem.ts
- [ ] Implement deliver_goods.ts behavior executor
- [ ] Replace instant factory→warehouse transfer with trucking requests
- [ ] Run sim for 500+ ticks, verify delivery queues populate
- [ ] Confirm truckers are employed and traveling between locations
- [ ] Monitor goods flow (retail shops still restock via trucking)
- [ ] Verify logistics companies are profitable (delivery fees > wages)
- [ ] Update design bible: orgs.md (logistics companies), locations.md (depots), economy.md (trucking revenue)

## Critical Files
**Configuration:**
- `data/templates/orgs/logistics_company.json` (new)
- `data/templates/locations/depot.json` (new)
- `data/config/behaviors.json`

**Code:**
- `src/simulation/systems/EconomySystem.ts`
- `src/simulation/systems/TravelSystem.ts`
- `src/simulation/systems/OrgBehaviorSystem.ts`
- `src/simulation/behaviors/executors/deliver_goods.ts` (new)

**Documentation:**
- `design/bible/orgs.md`
- `design/bible/locations.md`
- `design/bible/economy.md`

## Notes
HIGH RISK: New org type, movement mechanics, employment category. Delivery flow: Factory creates request → Logistics company assigns trucker → Trucker travels, loads, delivers → Uses TravelSystem for realistic times. Diversifies employment, future heist targets (truck robberies).
