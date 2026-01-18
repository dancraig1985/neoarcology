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

### Luxury Goods Vertical (Wealth-based)
```
Luxury Factory → Luxury Boutique → Wealthy Agent
       │                │                │
   produces         restocks         buys for
   luxury_goods     luxury_goods     enhanced leisure
```

**Requires 250+ credits.** Provides ~1.75x leisure satisfaction vs alcohol. Agents only buy one at a time.

### Knowledge Economy Verticals (B2B)
```
Server Factory → Corporation (buys data_storage)
       │                │
   produces        delivered to office
   data_storage         │
                        ▼
               Office/Lab produces valuable_data
                   (uses data_storage capacity)
```

**Business-to-business demand with capacity mechanics:**
- 1 data_storage = 10 valuable_data capacity
- Orgs buy storage when empty OR when 80%+ full
- Production capped to available storage (can't overfill)
- Creates sustained demand - corps keep buying as they produce

**The flow:**
1. Org expands → opens office (no storage required)
2. Office tries to produce → blocked (no storage)
3. Org buys data_storage → delivered to office
4. Office produces valuable_data → storage fills
5. At 80% capacity → org buys more storage
6. Cycle continues...

### High-Tech Prototypes Vertical (End-Game B2B)
```
Prototype Factory → High-Tech Prototypes
       (ultra-rare, ultra-valuable)
```

**End-game content with extreme scarcity:**
- Opening cost: 5000 credits (12.5x more expensive than standard factories)
- Production cycle: 448 phases (2 months at 8 phases/day)
- Output: 1 prototype per cycle with 10 professional-tier workers
- Wholesale price: 10000 credits per prototype
- **Does not spawn at city generation** - only built by wealthy entrepreneurs/orgs later in simulation

**Why it's rare:**
1. Extremely expensive to build (entrepreneurship threshold: 500 credits, facility: 5000 credits)
2. High operating costs (10 professional salaries)
3. Very slow production (2 months per prototype)
4. No demand signal (demandCondition not implemented yet)
5. Only ultra-wealthy orgs can afford to open and sustain operations

**Future enhancements:**
- Consume 100+ valuable_data per prototype (closes knowledge economy loop)
- Secure vault storage requirements
- Target for heists/corporate espionage
- Black market trading

### The Pattern

Each vertical follows the same structure:
1. **Production location** (wholesale tag) - Creates the good
2. **Retail location** (retail tag) - Sells to consumers (or null for B2B)
3. **Consumer/business behavior** - When/why to buy
4. **Restock/procurement logic** - How goods flow through the chain

**B2C verticals** (provisions, alcohol, luxury): Production → Retail → Consumer
**B2B verticals** (data_storage): Production → Business buyer (no retail step)

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
3. Salary is set based on the location's **salary tier** (from template)

### Salary Tiers

Different jobs pay differently based on skill requirements:

| Tier | Range | Location Types |
|------|-------|----------------|
| `unskilled` | 70-90/week | retail_shop, pub, restaurant, luxury_boutique |
| `skilled` | 90-110/week | provisions_factory, brewery, server_factory, luxury_factory |
| `professional` | 120-160/week | office, laboratory |

Each location template specifies its `salaryTier` in the balance section. This creates natural economic stratification where factory workers earn more than retail workers, and office workers earn the most.

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

When agents accumulate enough savings (500+ credits), they may quit their job and start a business.

### DemandAnalyzer: Market-Driven Business Selection

The `DemandAnalyzer` system calculates demand signals for all economic verticals dynamically. Entrepreneurs choose businesses based on real market conditions:

**Consumer Demand (B2C)**
Calculated from agent needs:
- Agents with hunger > threshold who lack provisions → food retail demand
- Agents with leisure > threshold who can afford drinks → pub demand
- Wealthy agents (250+ credits) with leisure need → luxury boutique demand

**Business Demand (B2B)**
Calculated from org needs:
- Retail shops with low inventory → wholesale production demand
- Orgs with offices but no data_storage → server factory demand

**Supply Analysis**
- Count existing suppliers for each good
- Identify wholesale supply gaps (retail exists but production is scarce)

### Opportunity Selection

The DemandAnalyzer returns ranked `BusinessOpportunity` objects:
```typescript
{
  templateId: string;       // What to build
  demandScore: number;      // Market demand
  competitionScore: number; // Existing suppliers
  finalScore: number;       // Combined score
  reason: string;           // Why this opportunity
}
```

Selection uses weighted random - higher scores are more likely but not guaranteed. This creates variety while still responding to market needs.

### Business Types
| Business | Location Template | Demand Signal |
|----------|-------------------|---------------|
| Retail Shop | `retail_shop` | Hungry agents without food |
| Pub | `pub` | Agents with leisure need + credits |
| Luxury Boutique | `luxury_boutique` | Wealthy agents (250+ credits) |
| Apartment | `apartment` | Homeless agents with savings |
| Factory | Various | Wholesale supply shortage |
| Logistics Company | `depot` | Delivery request backlog |

### Logistics Companies (Special Case)

Logistics companies are unique in the entrepreneurship system:

**Demand Analysis**
- Calculated from pending delivery requests vs. available driver capacity
- Each depot supports ~5 drivers (employee slots)
- Demand score = pending deliveries exceeding capacity
- Minimum demand threshold: 3 unmet deliveries

**Free Truck Spawning**
When an agent opens a logistics company:
- 2-4 free trucks are spawned (owned by the new org)
- Trucks parked at the depot's building
- Each truck has 100 cargo capacity
- No purchase cost (until vehicle vertical is implemented)

**Org Structure**
- Org name: "{LastName} Logistics" (e.g., "Smith Logistics")
- Org tagged with 'logistics' for identification
- Depot location in industrial zones
- Drivers employed at depot (seek_job behavior assigns them)

**City Generation**
- Only 1 initial logistics company spawned
- Others appear organically based on delivery demand
- Prevents oversupply at game start

### The Entrepreneur Loop
1. Agent accumulates 500+ credits
2. DemandAnalyzer evaluates all market opportunities
3. Agent selects opportunity (weighted by demand score)
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
