# PLAN-029: Orders System (Unified Commerce Model)

**Status:** planned
**Priority:** P2 (medium)
**Dependencies:** PLAN-028

## Goal
Unify all business transactions under a single Order entity type, replacing ad-hoc restocking with formal orders and merging DeliveryRequest into Order as a specific order type.

## Conceptual Model

**Order = Universal business transaction**
- OrderType: 'goods' (retail→wholesale), 'logistics' (delivery service), (future: 'services', 'construction')
- Goods orders drive production: Buyer places order → Seller produces → Ready → Creates logistics order → Delivery → Completed
- Logistics orders (formerly DeliveryRequest): Requester orders delivery → Logistics company assigns driver → Driver executes → Completed

## Objectives

### Phase 1: Entity Refactor
- [ ] Create unified Order entity type in types/entities.ts
- [ ] Add `orderType: 'goods' | 'logistics'` discriminator
- [ ] Migrate DeliveryRequest → Order with type='logistics'
- [ ] Update all references: DeliverySystem, VehicleSystem, deliver_goods executor
- [ ] Test: Existing deliveries still work after refactor

### Phase 2: Goods Orders (Retail→Wholesale)
- [ ] Implement order placement: retail shops place goods orders to wholesalers
- [ ] Add order backlog tracking for wholesalers/factories
- [ ] Update ProductionSystem: prioritize order fulfillment over speculative production
- [ ] When order ready: auto-create logistics order for delivery
- [ ] Keep emergency instant restocking for critical hunger (hunger > 80)

### Phase 3: Migration & Testing
- [ ] Run parallel systems: new orders + old ad-hoc restocking (1000+ ticks)
- [ ] Compare: order-based vs instant restocking reliability
- [ ] Gradually reduce ad-hoc frequency if orders work well
- [ ] Monitor: order backlogs reasonable, delivery times acceptable, no starvation spikes

### Phase 4: UI Integration
- [ ] Add "Orders" tab to Nav (src/ui/components/Nav.tsx)
- [ ] Create OrdersTable component (similar to AgentsTable, OrgsTable)
- [ ] Display columns: Type, Buyer, Seller, Good, Quantity, Status, Created, Fulfilled
- [ ] Add filter by orderType and status
- [ ] Click to view order details panel

### Phase 5: Documentation
- [ ] Update economy.md: unified orders system, backlog-driven production
- [ ] Update orgs.md: wholesale order processing
- [ ] Update production.md: order-driven production scheduling
- [ ] Add orders.md: full order lifecycle documentation

## Critical Files

**Refactor:**
- `src/types/entities.ts` (Order type, merge DeliveryRequest)
- `src/simulation/systems/DeliverySystem.ts` (rename/refactor to OrderSystem?)
- `src/simulation/systems/VehicleSystem.ts` (update to use Order)
- `src/simulation/behaviors/executors/index.ts` (deliver_goods executor)

**New Commerce Logic:**
- `src/simulation/systems/EconomySystem.ts` (order placement)
- `src/simulation/systems/ProductionSystem.ts` (order-driven production)
- `src/simulation/systems/OrgBehaviorSystem.ts` (order processing)

**UI:**
- `src/ui/components/Nav.tsx` (add Orders tab)
- `src/ui/components/OrdersTable.tsx` (NEW)
- `src/ui/components/OrderDetailsPanel.tsx` (NEW)

**Documentation:**
- `design/bible/economy.md`
- `design/bible/orgs.md`
- `design/bible/production.md`
- `design/bible/orders.md` (NEW)

## State Structure

```typescript
interface Order {
  id: string;
  orderType: 'goods' | 'logistics';
  buyer: EntityRef;           // Org placing order
  seller: EntityRef;          // Org fulfilling order
  status: 'placed' | 'in_production' | 'ready' | 'in_transit' | 'delivered' | 'cancelled';
  created: number;            // Phase
  fulfilled?: number;         // Phase when completed

  // For goods orders
  good?: string;              // 'provisions', 'alcohol', etc.
  quantity?: number;
  totalPrice?: number;
  pickupLocation?: LocationRef;
  deliveryLocation?: LocationRef;

  // For logistics orders (formerly DeliveryRequest)
  cargo?: Inventory;          // Goods being transported
  fromLocation?: LocationRef;
  toLocation?: LocationRef;
  payment?: number;           // Delivery fee
  assignedDriver?: AgentRef;
  assignedVehicle?: VehicleRef;
}
```

## Risks

**Medium-High Risk:**
- DeliveryRequest migration could break existing delivery system
- New order placement logic might destabilize economy
- UI performance if displaying thousands of orders (need pagination/virtualization)

**Mitigation:**
- Phase 1 is pure refactor (no behavior change) - test immediately
- Phase 2 runs parallel to existing system - gradual transition
- Phase 4 UI can be implemented independently, won't affect sim stability

## Success Criteria

- [ ] All existing deliveries work after DeliveryRequest→Order migration
- [ ] Retail shops successfully place and receive goods orders
- [ ] Production responds to order backlogs (not just capacity)
- [ ] Economy remains stable over 2000+ tick runs
- [ ] Orders UI displays all order types and allows filtering/inspection
- [ ] No increase in starvation rate compared to baseline
