# Locations

Locations are physical places in NeoArcology - shops, factories, homes, hideouts. They're where things happen.

## Types of Locations

Locations are classified by **tags**, not rigid types:

### Wholesale Locations
Tagged with `wholesale`. These sell to businesses:
- Factories
- Warehouses
- Distributors

### Retail Locations
Tagged with `retail`. These sell to consumers:
- Shops
- Restaurants
- Markets

A location can have multiple tags. A general store might be both retail (sells to public) and have a back room for wholesale.

## Ownership

### Commercial Locations
Shops, factories, and other businesses are owned by **organizations**. This keeps business and personal finances separate.

### Personal Locations
Homes, hideouts, and private property can be owned directly by **agents**. No organization needed for a place that doesn't generate revenue.

## Employment

Locations have **employee slots** - how many workers they can hire:
- A small shop might have 1 slot
- A factory might have several

### Hiring
Unemployed agents look for work at locations with open slots. When hired:
- Agent becomes employed at that location
- Agent receives weekly salary from the owning org

### Firing
Employees are released when:
- The org can't afford to pay them
- The business closes
- (Future: Performance issues, conflicts)

## Commerce

### Retail Sales
Agents buy directly from retail locations:
1. Agent approaches shop
2. Agent pays retail price
3. Goods transfer from shop to agent
4. Revenue goes to shop's org

### Wholesale Sales
Organizations buy from wholesale locations:
1. Shop org needs to restock
2. Shop org pays wholesale price
3. Goods transfer from factory to shop
4. Revenue goes to factory's org

### No Stock, No Sale
A location with empty inventory can't sell. Customers will go elsewhere (or starve trying).

## Operating Costs

Every commercial location has ongoing costs:
- Rent/maintenance
- Utilities
- Supplies

These are paid weekly from the owning org's wallet. A business that can't pay operating costs is failing.

## Restocking

Shop owners must actively restock their inventory:
- Monitor stock levels
- Purchase from wholesale suppliers
- Pay wholesale prices

A shop owner who forgets to restock (or can't afford to) will watch customers walk away hungry.
