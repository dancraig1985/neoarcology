# Organizations

Organizations own businesses and employ workers. Every commercial enterprise - from a corner shop to a factory - is owned by an organization.

## Why Organizations?

Organizations separate personal and business finances. When you start a shop:
- The shop's money is the organization's money, not yours
- You extract profits through weekly dividends
- If the business fails, you don't lose your personal savings (what's left of them)

This also means your business can outlive you, or fail while you survive.

## Structure

Every organization has:
- **One leader** - The owner who makes decisions and receives dividends
- **A wallet** - Business funds, separate from the leader's personal money
- **Locations** - The properties (shops, factories, apartments) owned by this org

## Templates vs Business Type

**Important**: The org template (`small_business`, `corporation`, etc.) only affects initial setup - starting capital, leader assignment, etc. **What an org actually does is determined by the locations it owns.**

This means:
- A `small_business` can own a shop, an apartment, or a factory
- A `corporation` could buy apartments and become a landlord
- A `small_business` could expand from one shop to owning multiple locations of different types

The system is flexible. Don't think of orgs as having a fixed "business type" - they're just financial containers that own locations.

### Special Org Types

**Logistics Companies:**
- Template: `logistics_company`
- Tags: `corporation`, `logistics`, `legal`
- Owns depots and cargo trucks
- Employs drivers who fulfill delivery requests
- Revenue from delivery fees

**Public Health Service (PLAN-039):**
- Template: `public_health`
- Tags: `corporation`, `public_service`, `legal`
- Owns clinics and ambulances
- Employs corpse collectors who patrol for deceased agents
- Public service (no revenue, operates on fixed budget of 75k)
- Single city-wide service (1 org, 1 clinic, 2 ambulances)

## The Business Lifecycle

### Birth
When an agent starts a business:
1. A new organization is created
2. The agent becomes its leader
3. Most of their savings transfer to the org's wallet
4. A location (shop) is created, owned by the org

### Operation
While running:
- Revenue from sales goes to the org wallet
- The org pays employee salaries weekly
- The org pays operating costs weekly
- The owner receives a dividend weekly

### Succession

When an organization's leader dies, the business doesn't automatically fail. The **senior employee** (longest tenure) is promoted to become the new leader:

1. Leader dies
2. System finds the employee with the earliest hire date
3. That employee becomes the new leader
4. Business continues operating

This allows businesses to survive leadership changes and creates more stable economic infrastructure.

**If no employees exist** when the leader dies, the organization dissolves.

### Death

An organization dissolves when:
- **Leader dies with no employees** - No one to take over
- **Bankruptcy** - Wallet goes negative
- **Insolvency** - Not enough money to operate (can't pay bills or restock)

When an org dissolves:
- All employees are released (become unemployed)
- All locations become **orphaned** (not deleted)
- Orphaned locations are marked for sale at a discount
- Residents stay in orphaned apartments (but stop paying rent)
- Any remaining org money is lost

## Org Behaviors (OrgBehaviorSystem)

Organizations make decisions independently of their human members. The `OrgBehaviorSystem` processes org-level behaviors each phase.

### Expansion

Wealthy orgs can expand by opening offices or laboratories:

**Expansion Triggers:**
- Org has 1000+ credits
- Org has revenue-generating locations (wholesale, retail, or residential)
- Org doesn't already have an office/lab
- Random chance per phase (5%)

**What happens:**
1. Org pays opening cost (600 credits for office)
2. New office/lab is created in an available building
3. Office starts without storage - needs to procure data_storage
4. Once storage is acquired, office produces valuable_data

### Procurement

Orgs automatically procure resources needed for their operations:

**Data Storage Procurement**
Triggered when:
- Org has offices/labs that produce valuable_data
- Storage is empty OR storage is ≥80% full

**How it works:**
1. Org finds a server factory with stock
2. Org pays wholesale price (50 credits)
3. data_storage is delivered directly to the office/lab
4. Office can now produce (or produce more) valuable_data

**Capacity-based buying:**
- 1 data_storage = 10 valuable_data capacity
- Orgs buy more at 80% capacity threshold
- This creates sustained B2B demand (not just one-time purchases)

## Owner Dividends

The owner doesn't receive a salary - they receive **dividends** from profits. This happens weekly:
1. Org pays all employees first
2. Org pays operating costs
3. Org pays owner their dividend (if funds available)

If the org can't afford the dividend, the owner gets nothing that week. If this continues, the owner may starve while sitting on an unprofitable business.

## Personal vs Commercial Property

Not everything needs an organization:
- **Commercial locations** (shops, factories, rental apartments) → Owned by orgs
- **Personal locations** (agent-owned homes, hideouts) → Can be owned directly by agents
- **Public locations** (shelters, parks) → No owner, available to all

The distinction is about revenue and expenses:
- **Commercial**: Generates revenue (sales, rent) and has operating costs - needs org accounting
- **Personal**: No revenue, agent pays costs directly - no org needed
- **Public**: Free to use, maintained by the city (abstracted away)

**Note**: Most apartments are commercial - a landlord org owns them and collects rent. An agent's "home" is just a reference to where they live, not ownership. Agent-owned homes may exist in the future but are deferred.
