# Inventory

Everything physical in NeoArcology takes up space. Agents carry goods in their pockets; locations store goods in their warehouses.

## Goods

The simulation uses broad **categories** of goods, not individual items:
- Provisions (food)
- Small arms
- Heavy weapons
- Narcotics
- Electronics
- Vehicles
- And more...

Each category represents a class of items. "Provisions" might be ration packs, fresh food, or nutrient paste - the simulation doesn't distinguish.

## Size and Capacity

### Everything Has Size
Each type of goods takes up space:
- Small items (provisions, data chips) take little space
- Large items (vehicles, heavy weapons) take lots of space

### Everything Has Capacity
Both agents and locations have limited storage:
- **Agents** - Can carry a limited amount (pockets, backpack)
- **Locations** - Have warehouse/storage space based on type

### The Math
You can't carry more than your capacity allows. A tiny shop can't stock as much as a massive warehouse. An agent can't carry a vehicle in their pocket.

## Who Holds Inventory

### Agent Inventory
Personal belongings:
- Food for survival
- Weapons for combat
- Goods for sale/trade

Agents eat from their personal inventory when hungry.

### Location Inventory
Business stock:
- Shops hold goods for retail sale
- Factories hold produced goods for wholesale

When you buy from a shop, goods move from location inventory to your inventory.

## Movement of Goods

### Purchase
Buyer pays, goods transfer from seller to buyer.

### Production
Factories create goods from nothing (using labor).

### Consumption
Eating destroys provisions. They're gone.

## Running Out

### Agents
An agent with no provisions must buy food or starve.

### Shops
A shop with no stock can't sell. Customers go elsewhere. Revenue stops.

### Factories
A factory at capacity stops producing until goods are sold.

## Warehouse System

### Capacity Tiers
Different location types have different storage capacities:
- **Factories**: ~100-200 capacity (production-focused, limited storage)
- **Retail Shops**: ~50-150 capacity (front-of-store space)
- **Warehouses**: ~1000 capacity (bulk storage, 5-10x factory size)

### Factory Overflow Management
When factories fill up, organizations automatically transfer surplus to warehouses:

**Trigger**: Factory inventory exceeds 80% capacity
**Action**: Org transfers up to 50% of tangible goods to warehouse
**Goods**: provisions, alcohol, luxury_goods, high_tech_prototypes, data_storage
**Excluded**: valuable_data (intangible digital asset, stays at office/lab)

**Example:**
```
Brewery at 130/150 capacity (87% full)
  → Org finds warehouse with available space
    → Transfers 50% of alcohol stock (preserve local buffer for sales)
      → Brewery drops to ~80/150, warehouse gains ~50 alcohol
        → Production can resume
```

### Internal Org Transfers
Organizations move goods between their own locations without credit exchange:

**Use cases:**
1. **Factory → Warehouse**: Overflow management (surplus storage)
2. **Office/Lab → Prototype Factory**: Input goods for production (valuable_data)
3. **Warehouse → Shop** (future): Pre-positioning inventory for retail

**Mechanics:**
- No credits exchanged (internal logistics)
- Instant transfer (same-tick, no trucking yet - planned for PLAN-027)
- Logged for visibility (ActivityLog shows "internal transfer")
- Respects inventory capacity limits

### Wholesale Distribution
Warehouses participate in the wholesale market alongside factories:

**Retail shops restock from ANY wholesale location:**
- Factories with production surplus
- Warehouses with stored bulk goods
- Server factories with B2B goods (data_storage)

**How shops choose suppliers:**
1. Search all locations with 'wholesale' tag
2. Filter for locations with needed goods in stock
3. Exclude own org locations (can't buy from yourself)
4. Pick randomly from available suppliers
5. Purchase at wholesale price

Warehouses enable **buffered supply chains** - factories don't need to hold all inventory, shops can restock even when factories are at capacity.
