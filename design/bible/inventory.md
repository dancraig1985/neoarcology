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
