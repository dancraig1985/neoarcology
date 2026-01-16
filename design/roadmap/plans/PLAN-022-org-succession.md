# PLAN-022: Organization Succession & Location Survival

**Status:** completed
**Priority:** P1 (high)
**Dependencies:** None

## Terminology

| Term | Meaning |
|------|---------|
| **Leader** | The agent who runs an organization (receives dividends, makes decisions) |
| **Owner** | The organization that owns a location (pays costs, receives revenue) |
| **Orphaned** | A location with no owning org (`location.owner = null`) |

**Ownership chain:** `Agent (leader) → Organization (owner) → Location(s)`

## Goal

When an organization's leader dies, handle succession gracefully: multi-member orgs transfer leadership, single-member orgs dissolve, but **locations always survive** and enter a resale market.

## Problem

Currently when an org leader dies:
- The entire org dissolves
- **All locations are deleted** (factories, apartments, shops)
- Employees lose jobs, tenants lose homes
- Creates economic death spirals (food factories dissolve → more starvation → more dissolutions)

This is especially problematic for:
- Property management (13 orgs owning 146 apartments all dissolve)
- Essential factories (provisions factories dissolve, causing mass starvation)

## Design

### Core Principle: Locations Outlive Orgs

**Locations are infrastructure.** Buildings don't vanish when the owning org dissolves - they become available for purchase.

```
Org Leader Dies
      ↓
Multi-member org? → Leadership succession (employee takes over)
      ↓
Single-member org? → Org dissolves
      ↓
Locations become orphaned (owner = null)
      ↓
Orphaned locations enter resale market
      ↓
Entrepreneurs can purchase orphaned locations
```

### 1. Location Orphaning (Not Deletion)

When an org dissolves:
- ~~Locations are removed~~ → Locations become orphaned
- `location.owner = null`
- Location retains: inventory, employees (who become unemployed), residents (who stop paying rent)
- Location is flagged as `forSale: true`

### 2. Auto-Succession (Multi-Member Orgs)

When an org leader dies, check if org has employees:
- **Find all employees** across all org-owned locations (factories, shops, offices)
- **Senior employee** (earliest hire date) becomes new leader
- New leader continues running the business
- If no employees: org dissolves (locations become orphaned)

**Example - Factory org leader dies:**
```
Petrov Industries (org) owns Helix Factory (3 workers)
         ↓
Org leader dies from starvation
         ↓
Find employees: [Worker A (hired phase 5), Worker B (hired phase 12), Worker C (hired phase 20)]
         ↓
Worker A becomes new leader of Petrov Industries
         ↓
Factory continues operating, production uninterrupted
```

### 3. Resale Market

Orphaned locations can be purchased:
- **New entrepreneurship behavior**: `purchase_location`
- Agent evaluates: "Buy orphaned shop for 500cr vs build new for 800cr?"
- Purchase price = `location.openingCost * 0.6` (discount for used/orphaned)
- Purchaser creates new org (or adds to existing org)
- Location transfers ownership

### 4. Tenant Handling for Orphaned Apartments

When rental apartments become orphaned:
- Tenants stop paying rent (no org to pay)
- Tenants keep living there (not evicted)
- When apartment is purchased by new org, rent collection resumes
- Alternative: tenants can purchase the apartment themselves (becomes owner-occupied)

## Implementation Steps

### Phase 1: Location Orphaning
- [x] On org dissolution, set `location.owner = null` instead of deleting
- [x] Add `forSale: boolean` field to Location type
- [x] Orphaned locations marked `forSale: true`
- [x] Update `processWeeklyEconomy` to skip rent/operating costs for orphaned locations
- [x] Employees at orphaned locations become unemployed (existing behavior, just without deletion)

### Phase 2: Auto-Succession
- [x] Add helper: `findOrgEmployees(org, locations)` - returns all employees at org-owned locations
- [x] Add helper: `findSeniorEmployee(employees, agents)` - returns employee with earliest hire date
- [x] On leader death: check for employees, promote senior if found
- [x] If no employees: dissolve org (orphan locations, not delete)
- [x] New leader inherits org wallet and all locations

### Phase 3: Resale Market
- [x] Add `purchase_orphaned_location` behavior to behaviors.json
- [x] Implement executor: find orphaned location, evaluate price, create/update org, transfer ownership
- [ ] Update DemandAnalyzer to factor in orphaned locations (reduce "build new" incentive if orphaned available) - DEFERRED

### Phase 4: Data & Config
- [x] Add resale pricing to economy.json: `resaleDiscount: 0.6`
- [x] Update bible/orgs.md with succession rules
- [x] Update bible/locations.md with orphaning behavior

## Deferred to Future Plans

- **Explicit successor designation** - Leader picks specific successor (vs auto-promotion)
- Complex org politics (power struggles, hostile takeovers)
- Board of directors / multiple leaders
- Inheritance to family members (requires relationship system)
- Wills and estate planning
- Org types with different succession rules (family business vs corporation)
- Location maintenance decay (orphaned locations degrade over time)

## Success Criteria

Run simulation for 2 years with seed 42:
- [x] Factory with employees: leader dies → senior employee promoted → production continues uninterrupted
- [x] Factory without employees: leader dies → org dissolves → factory orphaned (not deleted) → available for purchase
- [x] Orphaned locations purchased by entrepreneurs within ~4 weeks
- [x] Apartments survive property org leader death, get purchased by new property manager
- [ ] Provisions production more stable (succession prevents instant factory loss) - PARTIAL: Succession works but food supply still scarce due to pre-existing factory staffing issues
- [ ] Death spiral significantly reduced (fewer cascading failures) - PARTIAL: Cascading failures reduced but not eliminated

**Note:** The simulation still shows economic collapse by year 2, but this is due to a pre-existing city generation bug (factories spawning without workers), not the succession/orphaning system. PLAN-022 features are working correctly:
- Auto-succession promotes employees when leaders die (many observed in logs)
- Orphaned locations are purchased for correct prices (60 credits)
- Businesses continue operating through leadership transitions

## Notes

This is MVP org succession. The system should be extensible for future complexity:
- Succession field can expand to a ranked list
- Resale can evolve into real estate market with bidding
- Org dissolution can have wind-down period instead of instant

Key insight: **separate entity lifecycle from physical infrastructure**. Orgs come and go, but buildings remain.
