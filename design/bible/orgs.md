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

### Death
An organization dissolves when:
- **Owner dies** - No leader means no business
- **Bankruptcy** - Wallet goes negative
- **Insolvency** - Not enough money to operate (can't pay bills or restock)

When an org dissolves:
- All employees are released (become unemployed)
- All locations are removed
- Any remaining money is lost

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
