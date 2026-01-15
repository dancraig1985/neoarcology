# Economy

Money flows in a circle through NeoArcology. Understanding this flow is key to understanding why agents live or die.

## Economic Verticals

The economy is organized into **verticals** - independent supply chains for different goods. Each vertical has its own production, distribution, and consumption.

### Food Vertical (Sustenance)
```
Provisions Factory → Retail Shop/Restaurant → Agent
         │                    │                  │
    produces food      restocks from       buys when hungry
    (wholesale)        wholesale           (survival need)
```

**Critical for survival.** Without food, agents starve.

### Alcohol Vertical (Discretionary)
```
Brewery → Pub → Agent
    │       │       │
 produces  restocks  buys for leisure
 alcohol   alcohol   (optional need)
```

**Not required for survival.** Provides additional employment and revenue stream.

### The Pattern

Each vertical follows the same structure:
1. **Production location** (wholesale tag) - Creates the good
2. **Retail location** (retail tag) - Sells to consumers
3. **Consumer behavior** - When/why agents buy
4. **Restock logic** - Wholesale → retail transfer

Adding a new vertical (e.g., weapons, luxury goods) requires all four components.

## The Money Circle

```
    PRODUCTION ──────► RETAIL ──────► AGENTS ◄────── APARTMENTS
       ▲                 │               │               │
       │                 │               │               │
       │            (wholesale)     (retail)         (rent)
       │                 │               │               │
       │                 ▼               ▼               ▼
       └──── WAGES ◄─────────────────────────────────────┘
```

1. **Production locations sell wholesale** to retail locations
2. **Retail locations sell** to agents (consumers)
3. **Apartments collect rent** from tenants
4. **All businesses pay wages** to their employees
5. **Employees spend wages** at shops and on rent
6. **Cycle repeats**

If any link breaks, people starve (or become homeless).

## Transaction Types

### Retail (Consumer)
When an agent buys food at a shop:
- Agent pays the retail price
- Money goes to the shop's organization
- Agent receives the goods

### Wholesale (Business-to-Business)
When a shop restocks from a factory:
- Shop's org pays the wholesale price
- Money goes to the factory's organization
- Shop receives the goods

Wholesale prices are lower than retail - this is how shops make profit.

### Rent (Tenant-to-Landlord)
When a tenant pays rent for an apartment:
- Tenant pays weekly rent
- Money goes to the landlord's organization
- Tenant retains residence

**Key insight**: Rent is just another form of revenue. It works identically to retail sales from an accounting perspective - money flows from an individual's wallet to an org's wallet in exchange for a service.

## Where Money Goes

### Revenue
All revenue goes to the **organization's wallet**, not directly to any person. This is true for retail sales, wholesale sales, and rent collection.

### Expenses
Organizations pay from their wallet:
- **Employee salaries** - Weekly, to each worker
- **Operating costs** - Weekly, for each location
- **Owner dividends** - Weekly, to the leader

### Personal Income
Agents only receive money through:
- **Salary** - If employed by an org
- **Dividends** - If they own an org

There's no other way to get money in the current simulation.

## The Universal Business Pattern

All businesses in NeoArcology follow the same pattern:

```
Customer/Tenant                 Business Org
    |                               |
    | pays (purchase/rent)          |
    +------------------------->  org.wallet (revenue)
                                    |
                                    v
                              Operating costs (weekly)
                                    |
                                    v
                              Employee salaries (weekly)
                                    |
                                    v
                              Owner dividend -> leader.wallet
```

This pattern applies universally:

| Business Type | Revenue Source | Same Pattern? |
|---------------|----------------|---------------|
| Retail Shop | Customer purchases | ✓ |
| Factory | Wholesale to shops | ✓ |
| Apartment | Tenant rent | ✓ |
| (Future) Hotel | Guest fees | ✓ |
| (Future) Service | Service charges | ✓ |

**The location template determines what kind of business it is**, not the org template. A `small_business` org can own a shop, an apartment, or a factory - the org just manages the finances. The business type emerges from the locations owned.

## Hiring

### How Hiring Works

Locations don't hire - the simulation matches unemployed agents to open positions each tick.

Each phase, unemployed agents (`status: 'available'`) look for jobs:
1. Find locations with open slots (`employees.length < employeeSlots`)
2. Get hired at the first available position
3. Salary is set randomly within the unskilled range (from `economy.json`)

### At City Generation

Locations start with **empty employee slots**. No workers are pre-assigned. The simulation's normal hiring process fills positions as agents seek jobs. This means:
- Factories won't produce on turn 1 (no workers yet)
- By turn 2-3, unemployed agents find jobs and production begins
- The economy bootstraps itself naturally

### Employee Slots

Each location template defines `employeeSlots`:
- Factory: 3 slots (more workers = more production)
- Shop: 1 slot (owner doesn't count - they're the leader, not an employee)
- Restaurant: 2 slots

Owners never occupy employee slots. A shop with 1 `employeeSlots` can have 1 worker plus the owner.

## Profit and Loss

For a business to survive:
```
Revenue > (Employee Salaries + Operating Costs + Owner Dividend)
```

If revenue falls short:
1. First, owner dividends get skipped
2. Then employees can't be paid (they quit)
3. Finally, the business becomes insolvent and closes

## Economic Death Spirals

Several things can kill an economy:

### No Customers
If agents don't have money, they can't buy. If they can't buy, shops have no revenue. If shops have no revenue, they can't pay workers. Workers have no money, can't buy...

### No Stock
If factories stop producing, shops can't restock. If shops have no stock, agents can't buy food. Agents starve.

### Too Much Competition
If too many shops open, customers are spread thin. Each shop gets less revenue. Shops become unprofitable and close. But if they all close at once, there's nowhere to buy food.

## Entrepreneurship

When agents accumulate enough savings (300+ credits), they may quit their job and start a business.

### Demand-Based Business Selection
Entrepreneurs choose what business to start based on current market demand:

1. **Calculate food demand**: Agents eating per week vs shop capacity
2. **Calculate housing demand**: Homeless agents vs available apartments
3. **Apply priority weights**: Food demand weighted 2x (survival critical)
4. **Choose highest demand**: Open a grocery store OR apartment building

This ensures entrepreneurs naturally fill gaps in the economy rather than oversaturating one market.

### Business Types
| Business | Location Template | Revenue Source |
|----------|-------------------|----------------|
| Grocery Store | `grocery_store` | Retail food sales |
| Apartment | `apartment` | Tenant rent |

### The Entrepreneur Loop
1. Agent accumulates 300+ credits
2. Agent quits current job
3. Agent evaluates food vs housing demand
4. Agent creates `small_business` org
5. Agent opens appropriate location
6. Agent receives weekly dividends as owner

## The Balancing Act

A healthy economy requires:
- **Enough production** - Factories making goods
- **Enough distribution** - Shops selling to consumers
- **Enough employment** - Workers earning wages
- **Enough spending** - Consumers buying goods

All four must stay in balance, or the system collapses.

## Money Conservation

For a stable long-term economy, money must be conserved:

### Money Sources
- **Initial credits**: Agents and orgs start with credits
- **Immigration**: New agents bring credits into the system

### Money Sinks (Avoided)
- **Operating costs**: Currently set to **0** in all location templates
  - If enabled, operating costs would drain money from the system
  - This causes deflation and eventual economic collapse
- **Death**: When agents die, their credits are lost (not redistributed)

### The Balance
Immigration adds money to offset deaths. With operating costs at zero, the economy can sustain itself indefinitely. If operating costs were re-enabled, a corresponding money creation mechanism would be needed (e.g., government stimulus, central bank).
