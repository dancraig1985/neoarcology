# Locations

Locations are physical places in NeoArcology - shops, factories, apartments, shelters. They're where things happen.

## Buildings and Locations

Locations exist inside **buildings**. A building is a physical structure (tower, warehouse, low-rise) that contains multiple locations on different floors and units.

```
Building (residential_tower)
├── Floor 1, Unit 1: Retail Shop
├── Floor 1, Unit 2: Restaurant
├── Floor 2, Unit 1: Apartment
├── Floor 2, Unit 2: Apartment
└── ...
```

Each location has:
- `building` - Reference to parent building
- `floor` - Which floor (0 = ground)
- `unit` - Which unit on that floor

**Travel optimization**: Locations in the same building are faster to reach than locations across the city.

## Types of Locations

Locations are classified by **tags**, not rigid types:

### Production Locations
Tagged with `wholesale` and `production`. These create goods:
- `provisions_factory` - Produces food (provisions)
- `brewery` - Produces alcohol
- `server_factory` - Produces data_storage (B2B infrastructure)
- `luxury_factory` - Produces luxury_goods
- `office` - Produces valuable_data (knowledge economy)
- `laboratory` - Produces valuable_data (faster than offices)
- `prototype_factory` - Produces high_tech_prototypes (consumes valuable_data)

### Storage Locations
Tagged with `wholesale` and `storage`. These store bulk goods for distribution:
- `warehouse` - Large-capacity storage for tangible goods (1000+ capacity)
  - Owned by corporations
  - Receives surplus from factories when they exceed 80% capacity
  - Supplies wholesale goods to retail shops
  - 5-10x larger inventory than factories
  - Stores provisions, alcohol, luxury_goods, high_tech_prototypes, data_storage
  - Does NOT store valuable_data (intangible digital asset)

**Warehouse Flow:**
```
Factory produces goods → Factory reaches 80% capacity
  → Org transfers surplus to warehouse (internal, no credits)
    → Warehouse holds bulk inventory
      → Retail shop restocks from warehouse (pays wholesale price)
```

### Logistics Locations
Tagged with `depot`. These handle goods delivery:
- `depot` - Logistics hub for truck drivers
  - Owned by logistics companies (special org type with 'logistics' tag)
  - Employs truck_drivers who make deliveries
  - Houses company trucks (vehicles parked at depot building)
  - ~5 employee slots per depot (driver capacity)
  - Creates delivery requests for factory→warehouse and warehouse→retail transfers
  - Revenue from delivery fees paid by requesting orgs

**Depot Employment:**
- Only agents employed at depots can deliver goods (gated by `atLocationWithTag: "depot"` behavior condition)
- Drivers use company trucks to pick up and deliver cargo
- Delivery workflow: claim truck → drive to pickup → load cargo → drive to delivery → unload → return to depot

### Retail Locations
Tagged with `retail`. These sell to consumers:
- `retail_shop` - Sells provisions
- `restaurant` - Sells provisions (food service)
- `pub` - Sells alcohol (leisure venue, also has `leisure` tag)

### Residential Locations
Tagged with `residential`. These house agents:
- Apartments (commercial - owned by orgs, rent collected)
- Shelters (public - free, lower quality rest)

A location can have multiple tags. A general store might be both retail (sells to public) and have a back room for wholesale. An apartment building's ground floor might have commercial retail space.

## Ownership

### Commercial Locations
Shops, factories, and rental apartments are owned by **organizations**. This keeps business and personal finances separate.

Revenue flows to the org wallet:
- **Shops**: Customer purchases
- **Factories**: Wholesale sales
- **Apartments**: Tenant rent

All follow the same pattern: revenue → org wallet → operating costs → owner dividend.

### Public Locations
Shelters and public spaces have no owner. They're city infrastructure available to everyone.

### Personal Locations (Future)
Agent-owned homes and hideouts may exist in the future. For now, agents rent from landlord orgs.

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

### Residential (Rent)
Agents rent apartments from landlord orgs:
1. Agent becomes a resident of the apartment
2. Agent pays weekly rent
3. Rent goes to the apartment's owning org
4. Agent can rest at their residence

If an agent can't pay rent, they're evicted (lose residence, must find new housing or use public shelters).

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

## Orphaned Locations

When an organization dissolves, its locations become **orphaned** rather than being deleted. This preserves the economic infrastructure and allows recovery.

### What Happens to Orphaned Locations

- `owner` becomes undefined
- `ownerType` becomes `'none'`
- `forSale` is set to `true`
- Employees are released (no longer employed there)
- Residents **stay** in orphaned apartments (but stop paying rent since there's no landlord)
- Production halts (no employees)
- Sales stop (no owner to receive revenue)

### Purchasing Orphaned Locations

Unemployed agents with sufficient credits can purchase orphaned locations:

1. Agent finds an orphaned location (`forSale: true`)
2. Agent pays the **resale price** (60% of original opening cost by default)
3. A new organization is created with the agent as leader
4. The location becomes owned by the new org
5. The agent becomes employed at their new business

**Resale Price**: Configured via `economy.resaleDiscount` (default 0.6 = 60%). An apartment with 100 credit opening cost sells for 60 credits orphaned.

### Behavior Priority

The behavior order for unemployed agents is:
1. Start new business (if wealthy: 300+ credits)
2. **Purchase orphaned location** (if 150+ credits and orphaned locations exist)
3. Seek regular employment

This means agents will prefer buying existing infrastructure over starting from scratch when affordable orphaned locations are available.
