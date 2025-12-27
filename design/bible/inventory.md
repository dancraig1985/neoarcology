# Inventory System

The inventory system handles storage of goods at locations and in agent inventories, with size-based capacity limits.

## Key Files
- `src/simulation/systems/InventorySystem.ts` - Core inventory operations
- `data/config/balance.json` - Goods sizes and prices
- `src/types/entities.ts` - Inventory type definitions

## Goods Categories

The simulation uses ~16 broad goods categories (not granular items):

| Good | Size | Retail | Wholesale | Notes |
|------|------|--------|-----------|-------|
| provisions | 0.1 | 15 | 7 | Food, essential for survival |
| small_arms | 1.0 | 100 | 70 | Weapons |
| heavy_weapons | 2.0 | 500 | 350 | Large weapons |
| narcotics | 0.1 | 50 | 30 | Illegal goods |
| electronics | 0.5 | 80 | 50 | Tech items |
| vehicles | 10.0 | 5000 | 3500 | Large, expensive |
| data_storage | 0.1 | 20 | 12 | Digital storage |
| medical | 0.2 | 40 | 25 | Medical supplies |
| luxury_goods | 0.5 | 200 | 120 | High-end items |
| raw_materials | 1.0 | 15 | 10 | Manufacturing inputs |
| fuel | 0.5 | 30 | 20 | Energy |
| cyberware | 0.3 | 300 | 200 | Cybernetic implants |

## Size-Based Capacity

Inventory capacity is measured in **space units**, not item count.

### Example
A location with `inventoryCapacity: 50` can hold:
- 500 provisions (50 / 0.1 = 500)
- 50 small_arms (50 / 1.0 = 50)
- 25 heavy_weapons (50 / 2.0 = 25)
- Or any combination that fits

### Calculations

```typescript
// Get space used by inventory
function getInventorySpaceUsed(holder, sizes): number {
  let total = 0;
  for (const [goodsType, count] of Object.entries(holder.inventory)) {
    const size = sizes.goods[goodsType]?.size ?? sizes.defaultGoodsSize;
    total += count * size;
  }
  return total;
}

// Get available space
function getAvailableCapacity(holder, sizes): number {
  return holder.inventoryCapacity - getInventorySpaceUsed(holder, sizes);
}
```

## Inventory Holders

Both agents and locations can hold inventory:

### Agent Inventory
```typescript
interface Agent {
  inventory: Record<string, number>;  // { provisions: 3, ... }
  inventoryCapacity: number;          // Default: 10
}
```

### Location Inventory
```typescript
interface Location {
  inventory: Record<string, number>;
  inventoryCapacity: number;  // From template: 50 (shop), 500 (factory)
}
```

## Inventory Operations

### Adding Items
```typescript
function addToInventory(
  holder: InventoryHolder,
  goodsType: string,
  amount: number,
  sizes?: GoodsSizes
): { holder: InventoryHolder; added: number }
```
- Respects capacity limits
- Returns actual amount added (may be less than requested)

### Removing Items
```typescript
function removeFromInventory(
  holder: InventoryHolder,
  goodsType: string,
  amount: number
): { holder: InventoryHolder; removed: number }
```
- Can't remove more than available
- Returns actual amount removed

### Transferring Items
```typescript
function transferInventory(
  from: InventoryHolder,
  to: InventoryHolder,
  goodsType: string,
  amount: number,
  sizes?: GoodsSizes
): { from: InventoryHolder; to: InventoryHolder; transferred: number }
```
- Respects both source availability and destination capacity
- Used for wholesale restocking

## Capacity Configuration

### From Templates
```json
// retail_shop.json
{ "inventoryCapacity": 50 }

// factory.json
{ "inventoryCapacity": 500 }
```

### From Balance Config
```json
// balance.json
{
  "agent": {
    "inventoryCapacity": 10
  },
  "defaultGoodsSize": 1
}
```

## Restocking Logic

Shops restock from wholesale when:
1. `currentStock < restockThreshold` (15)
2. Wholesale location has stock
3. Shop org can afford wholesale price

Restock amount:
```typescript
const desiredAmount = Math.min(30, maxItemsThatFit);
const affordableAmount = Math.floor(orgCredits / wholesalePrice);
const amountToBuy = Math.min(desiredAmount, wholesalerStock, affordableAmount);
```

## Key Invariants

1. Inventory can never exceed capacity
2. Inventory quantities are always >= 0
3. Size is always > 0 (default: 1.0)
4. Transfers are atomic (both sides update or neither)
5. Only provisions are currently produced/consumed
