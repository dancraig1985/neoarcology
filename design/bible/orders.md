# Orders System - B2B Commerce

## Overview

The Orders System provides a unified model for all business transactions in NeoArcology. Instead of instant "teleportation" of goods and credits, orders create a realistic multi-step process:

1. **Buyer places order** → Order entity created
2. **Seller produces/prepares goods** → Order status changes
3. **Logistics company delivers** → Separate delivery order
4. **Goods arrive, payment transfers** → Order completed

## Order Entity

All business transactions use a single `Order` interface with an `orderType` discriminator:

```typescript
interface Order {
  id: string;
  orderType: 'goods' | 'logistics';
  created: number;          // Phase when placed
  buyer: EntityRef;         // Org requesting
  seller: EntityRef;        // Org fulfilling
  status: 'pending' | 'assigned' | 'in_production' | 'ready' | 'in_transit' | 'delivered' | 'cancelled' | 'failed';
  fulfilled?: number;       // Phase when completed
  parentOrderId?: string;   // Links logistics orders to their parent goods orders

  // Type-specific fields (optional based on orderType)
  // ... (see types/entities.ts for full definition)
}
```

## Order Types

### Goods Orders (B2B Wholesale)

**Purpose**: Retail shops order inventory from wholesalers/factories.

**Lifecycle**:
1. **Pending**: Retail shop needs stock → places order
2. **Ready**: Wholesaler has produced enough goods to fulfill
3. **In Transit**: Logistics order created, trucker delivering
4. **Delivered**: Goods arrived, credits transferred

**Example**: Grocery store orders 30 provisions from factory.

**Fields**:
- `good`: Product type ('provisions', 'alcohol', 'luxury_goods', etc.)
- `quantity`: How many units ordered
- `totalPrice`: Total cost (quantity × wholesale price)
- `pickupLocation`: Wholesaler location ID
- `deliveryLocation`: Retail shop location ID

### Logistics Orders (Delivery Service)

**Purpose**: Trucking companies deliver goods between locations.

**Lifecycle**:
1. **Pending**: Delivery requested, awaiting driver assignment
2. **Assigned**: Driver claimed delivery, preparing to load
3. **In Transit**: Driver traveling with cargo
4. **Delivered**: Cargo unloaded at destination

**Example**: Trucker moves 30 provisions from factory to grocery store.

**Fields**:
- `cargo`: Goods being transported (Record<string, number>)
- `fromLocation`: Pickup location ID
- `toLocation`: Delivery destination ID
- `payment`: Delivery fee paid to logistics company
- `urgency`: Priority level ('low' | 'medium' | 'high')
- `assignedDriver`: Agent ID of the trucker
- `assignedVehicle`: Truck ID being used
- `parentOrderId`: Links back to the goods order (if created automatically)

## Order Placement (Goods Orders)

**Trigger**: Retail shops check inventory every phase. When stock is low (< 15 units), they attempt to place an order.

**Process** (from `tryPlaceGoodsOrder` in EconomySystem.ts):

1. **Check inventory threshold**: If stock >= 15, no order needed
2. **Check for existing orders**: Don't duplicate pending orders for the same good
3. **Find wholesalers**: Locate wholesale locations that can produce this good type
4. **Calculate quantity**: Based on shop capacity, credits available, desired stock level
5. **Create order entity**: Status 'pending', with buyer/seller org IDs
6. **Log to ActivityLog**: "OrgName placed order for X goods from SellerName (price credits)"

**Order quantity logic**:
```
desiredAmount = min(30, maxItemsThatFit)
affordableAmount = floor(buyerOrg.credits / wholesalePrice)
orderQuantity = min(desiredAmount, affordableAmount)
```

**Deduplication**: Only one pending order per shop per good type at a time.

## Order Fulfillment (Goods Orders)

**Trigger**: Every phase, `processGoodsOrders` checks all pending goods orders.

**Process**:

1. **Check wholesaler stock**: Does pickup location have enough inventory?
2. **If yes → Mark as READY**:
   - Update order status to 'ready'
   - Create logistics order (see below)
   - Log: "goods order X ready - created logistics order for delivery"
3. **If no → Keep PENDING**: Wait for more production

**Automatic Logistics Order Creation**:

When a goods order becomes ready, a logistics order is auto-created:
```typescript
{
  id: `logistics_for_${goodsOrderId}`,
  orderType: 'logistics',
  parentOrderId: goodsOrderId,  // Links back
  buyer: goodsOrder.buyer,      // Retail shop pays delivery fee
  seller: '',                   // Logistics company assigned later
  fromLocation: wholesaler.id,
  toLocation: retailShop.id,
  cargo: { [goodType]: quantity },
  payment: calculatedDeliveryFee,
  urgency: 'medium'
}
```

**Delivery fee calculation**:
```
distance = manhattanDistance(pickup, delivery)
payment = max(10, totalGoods * 1 + distance * 0.5)
```

## Logistics Order Execution

**Assignment**: `deliver_goods` behavior executor (agents at depots with `atLocationWithTag: "depot"`)

**Workflow** (multi-phase process managed by behavior system):

1. **Claim order**: Driver finds pending logistics order, assigns to self
2. **Board truck**: Driver enters company-owned vehicle
3. **Travel to pickup**: Drive to fromLocation
4. **Load cargo**: Transfer goods from location to vehicle
5. **Travel to delivery**: Drive to toLocation
6. **Unload cargo**: Transfer goods from vehicle to location
7. **Complete**: Pay logistics company, update order status to 'delivered'

**See**: `behaviors/executors/index.ts` - `executeDeliverGoodsBehavior` for full state machine

## Goods Order Completion

**Trigger**: When a logistics order with a `parentOrderId` is marked 'delivered', `completeGoodsOrder` is called.

**Process** (from EconomySystem.ts):

1. **Find parent goods order**: Using `parentOrderId`
2. **Transfer credits**: buyer org → seller org (total price of goods, NOT delivery fee)
3. **Mark goods order as 'delivered'**: Status update, set `fulfilled` phase
4. **Log**: "goods order X completed - BuyerOrg paid Y credits to SellerOrg"
5. **Track metrics**: `trackWholesaleSale(good)`

**Note**: The inventory transfer happened during logistics execution (load/unload steps). This function only handles the payment and status update.

## Order Lifecycle Summary

### Goods Order Full Cycle:
```
Retail shop low on stock
  → placeGoodsOrder (status: pending)
    → Wholesaler produces goods
      → processGoodsOrders (status: ready)
        → Auto-create logistics order
          → Driver executes delivery
            → completeDelivery (logistics order: delivered)
              → completeGoodsOrder (goods order: delivered, credits transferred)
```

### Logistics Order Full Cycle:
```
Delivery requested (goods order ready, OR factory warehouse transfer)
  → createDeliveryRequest (status: pending)
    → Driver claims delivery
      → assignDeliveryToDriver (status: assigned)
        → startDelivery (status: in_transit)
          → Driver completes delivery
            → completeDelivery (status: delivered, logistics company paid)
              → If parentOrderId exists: completeGoodsOrder
```

## Parallel Systems (Transition Phase)

**Current State**: The simulation runs BOTH systems in parallel during Phase 2 testing:

1. **Instant Restocking** (`tryRestockFromWholesale`):
   - Still runs every phase
   - Instant inventory + credit transfer
   - Used when shops are critically low on stock

2. **Goods Orders** (`tryPlaceGoodsOrder`):
   - Runs every phase
   - Creates Order entities
   - Realistic multi-phase fulfillment

**Why**: Ensures economy stability while testing the new system.

**Future (Phase 3)**: Gradually reduce instant restocking frequency, eventually disable for all but emergency hunger cases (hunger > 80%).

## Data Locations

**Simulation State**:
```typescript
SimulationState {
  deliveryRequests: Order[]  // All orders (goods + logistics)
  // Note: "deliveryRequests" name kept for backward compatibility
  //       but now holds all order types via DeliveryRequest = Order alias
}
```

**Configuration**:
- `data/config/economy.json`: Wholesale prices, delivery fee parameters
- `data/config/behaviors.json`: `deliver_goods` behavior for logistics execution

**Code**:
- `src/types/entities.ts`: Order interface definition
- `src/simulation/systems/EconomySystem.ts`: Goods order placement, fulfillment, completion
- `src/simulation/systems/DeliverySystem.ts`: Logistics order creation, management
- `src/simulation/behaviors/executors/index.ts`: `executeDeliverGoodsBehavior` (logistics execution)
- `src/simulation/Simulation.ts`: Tick loop integration (goods order processing)

**UI**:
- Orders tab in Nav panel
- `src/ui/UIConfig.ts`: ORDER_COLUMNS and ORDER_DETAILS
- `src/ui/panels/MainPanel.ts`: OrdersTable and detail view

## Key Design Decisions

### Why Unified Order Entity?

**Problem**: Previously had separate DeliveryRequest type. Adding goods orders would create two similar but disconnected systems.

**Solution**: Single Order type with `orderType` discriminator. Benefits:
- Single source of truth for all commerce
- Easier to track order flow (goods → logistics → completion)
- Simpler UI (one Orders tab for everything)
- Extensible (future: 'services', 'construction' order types)

### Why Link Logistics to Goods Orders?

**Problem**: When a goods order is ready, how does the system know to create a delivery? How does delivery completion trigger payment?

**Solution**: `parentOrderId` field links logistics orders back to their originating goods orders. Enables:
- Automatic logistics order creation when goods ready
- Automatic credit transfer when delivery completes
- Order tracking in UI (see which delivery belongs to which goods order)

### Why Separate Logistics Payment from Goods Payment?

**Goods payment**: Retail shop → Wholesaler (for the goods themselves)
**Logistics payment**: Retail shop → Trucking company (for delivery service)

**Reasoning**: Realistic separation of costs. Logistics companies earn revenue independently. Allows for:
- Market pricing of delivery services
- Multiple logistics companies competing on price/speed
- Future: Buyers choosing delivery options (cheap slow vs. expensive fast)

## Order Statuses Explained

| Status | Meaning | Next Step |
|--------|---------|-----------|
| **pending** | Order placed, awaiting fulfillment | Seller produces goods (goods order) or driver assigns (logistics) |
| **assigned** | Driver claimed logistics order | Driver boards truck, travels to pickup |
| **in_production** | (Future) Seller actively producing to fulfill | Production completes → 'ready' |
| **ready** | Goods produced, awaiting pickup/delivery | Create logistics order |
| **in_transit** | Driver traveling with cargo | Driver completes delivery |
| **delivered** | Successfully completed | Credits transfer, order archived |
| **cancelled** | Order cancelled before completion | Usually due to buyer/seller org dissolved |
| **failed** | Order failed during execution | Driver died, locations deleted, etc. |

## Future Enhancements (Not Yet Implemented)

### Backlog-Driven Production
- Wholesalers prioritize orders over speculative production
- Producers check order backlog before deciding what to make
- Prevents overproduction of unwanted goods

### Order Expiration
- Orders older than X phases auto-cancel
- Prevents stale orders clogging the system

### Order Priorities
- Critical (hunger-related): Instant processing
- High urgency: Bonus delivery payment
- Low urgency: Cheaper delivery, slower fulfillment

### Order Negotiation
- Buyers can counter-offer on price
- Sellers can reject orders if unprofitable

### Delivery Options
- Standard (cheap, slow)
- Express (expensive, fast)
- Bulk (discount for large orders)

## Debugging Tips

**Check order creation**:
```bash
grep "placed order" logs  # See goods orders
grep "created delivery request" logs  # See logistics orders
```

**Check order completion**:
```bash
grep "goods order.*completed" logs  # See payment transfers
grep "completed delivery" logs  # See logistics deliveries
```

**Find stuck orders**:
Look for orders with status 'pending' or 'ready' for many phases without progressing.

**Verify linking**:
Check that logistics orders have correct `parentOrderId` pointing to their goods orders.

## Related Documentation

- [economy.md](economy.md) - Overall economic systems, wholesale vs retail
- [orgs.md](orgs.md) - Organization behaviors, logistics companies
- [production.md](production.md) - Factory production cycles
- [agents.md](agents.md) - Agent behaviors, truck drivers
