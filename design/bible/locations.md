# Locations

Locations are physical places in the simulation where goods are stored, commerce happens, and agents work.

## Key Files
- `src/simulation/systems/LocationSystem.ts` - Location operations
- `data/templates/locations/*.json` - Location templates
- `src/types/entities.ts` - Location type definition

## Location Types (via Tags)

Locations are classified by **tags**, not hardcoded types:

| Tag | Description | Examples |
|-----|-------------|----------|
| `wholesale` | Sells to businesses (B2B) | Factory |
| `retail` | Sells to consumers | Shop, Restaurant |

A location can have multiple tags. Behavior attaches to tags.

## Location Templates

Templates define defaults for location types:

### Factory (`data/templates/locations/factory.json`)
```json
{
  "id": "factory",
  "name": "Factory",
  "tags": ["wholesale"],
  "balance": {
    "openingCost": 1000,
    "operatingCost": 20,
    "employeeSlots": 2,
    "startingInventory": 0,
    "inventoryCapacity": 500,
    "production": [
      { "good": "provisions", "amountPerEmployee": 2, "phasesPerCycle": 1 }
    ]
  }
}
```

### Retail Shop (`data/templates/locations/retail_shop.json`)
```json
{
  "id": "retail_shop",
  "name": "Retail Shop",
  "tags": ["retail"],
  "balance": {
    "openingCost": 200,
    "operatingCost": 10,
    "employeeSlots": 1,
    "startingInventory": 20,
    "inventoryCapacity": 50
  }
}
```

## Location Structure

```typescript
interface Location {
  id: string;
  name: string;
  template: string;           // e.g., "factory", "retail_shop"
  tags: string[];             // e.g., ["wholesale"], ["retail"]

  // Ownership
  owner: string;              // Org ID that owns this
  ownerType: 'org' | 'agent'; // Always 'org' now

  // Employment
  employees: string[];        // Agent IDs working here
  employeeSlots: number;      // Max employees

  // Finances
  operatingCost: number;      // Weekly cost
  weeklyRevenue: number;      // Tracked for stats
  weeklyCosts: number;        // Tracked for stats

  // Inventory
  inventory: Record<string, number>;
  inventoryCapacity: number;
}
```

## Location Operations

### Creating a Location
```typescript
function createLocation(
  id: string,
  name: string,
  template: LocationTemplate,
  orgId: string,
  orgName: string,
  phase: number
): Location
```

### Purchasing from Location
```typescript
function purchaseFromLocation(
  location: Location,
  buyer: Agent,
  goodsType: string,
  quantity: number,
  balance: BalanceConfig,
  phase: number
): { location: Location; buyer: Agent; success: boolean }
```
- Checks availability and buyer funds
- Updates inventory and wallets
- Returns success/failure

### Hiring at Location
```typescript
function hireAgent(
  location: Location,
  agent: Agent,
  salary: number,
  phase: number
): { location: Location; agent: Agent }
```
- Adds agent to `employees` array
- Sets agent's `employedAt` and `salary`

### Releasing from Location
```typescript
function releaseAgent(
  location: Location,
  agent: Agent,
  reason: string,
  phase: number
): { location: Location; agent: Agent }
```
- Removes from `employees` array
- Clears agent's employment fields

## Commerce Flow

### Retail (Consumer Purchase)
1. Agent finds retail location with stock
2. Calls `purchaseFromLocation`
3. Agent's wallet decreases, inventory increases
4. Location's inventory decreases
5. Owner org's wallet increases (in `EconomySystem`)

### Wholesale (B2B Purchase)
1. Shop org finds wholesale location with stock
2. Transfers inventory using `InventorySystem`
3. Credits transfer between org wallets
4. Logged as wholesale transaction

## Employment

### Hiring Locations
A location is "hiring" if:
```typescript
location.employees.length < location.employeeSlots
```

### Who Can Work
- Any `available` agent can seek employment
- Agents can't work at locations owned by their own org
- Getting hired sets `status: 'employed'`

### Payroll
- Paid weekly from owner org's wallet
- If org can't pay, employee is released
- Salary range: 20-40/week (unskilled)

## Weekly Processing

For each location:
1. Pay employee salaries (from org wallet)
2. Pay operating costs (from org wallet)
3. Reset `weeklyRevenue` and `weeklyCosts`

## Key Invariants

1. Every location has exactly one owner org
2. Location template determines default values
3. Tags determine behavior (retail vs wholesale)
4. Employees array never exceeds employeeSlots
5. Owner is always an org ID, never an agent ID
