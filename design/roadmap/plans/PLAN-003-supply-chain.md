# PLAN-003: Provisions Supply Chain

**Status:** planned
**Priority:** P1 (high)
**Dependencies:** PLAN-002
**Phase:** 1c
**Reference:** [GAME-DESIGN.md](../../GAME-DESIGN.md) - Phase 1c

## Goal

Create a complete supply chain: Corporation produces provisions → sells wholesale to retail shops → shops sell to agents → agents eat.

## Context

Currently retail shops restock "from thin air". We need:
```
Factory (org-owned) produces provisions
    ↓
Wholesale: corp sells to shop owners
    ↓
Retail: shops sell to agents (already works)
    ↓
Consumption: agents eat (already works)
```

This removes the "magic restocking" and creates real economic flow.

## Objectives

### Inventory Capacity System
- [ ] Locations have `inventoryCapacity` (max goods they can hold)
- [ ] Agents have `carryingCapacity` (max goods they can carry)
- [ ] Production stops when location at capacity
- [ ] Purchases limited by buyer's available capacity
- [ ] Simple check: `currentInventory + amount <= capacity`

### Organization Entity (Minimal)
- [ ] Org has: id, name, leader (AgentRef), wallet
- [ ] Org owns locations (factory)
- [ ] Leader is an agent who makes decisions for the org
- [ ] Org template: `corporation` only (defer gangs)

### Factory Location
- [ ] Factory produces provisions each phase (if under capacity)
- [ ] Production rate from template balance (e.g., 10/phase)
- [ ] Provisions go to factory inventory (up to capacity)
- [ ] Factory has operating cost (paid weekly by org)

### Wholesale Commerce
- [ ] Shop owners can buy provisions from factories
- [ ] Wholesale price < retail price (margin for shops)
- [ ] Factory sells from inventory, credits go to org wallet
- [ ] Shop owners buy when inventory low (limited by shop capacity)
- [ ] Purchase quantity = min(desired, available, capacity remaining)

### Remove Magic Restocking
- [ ] Remove `restockSystemShops` - no more infinite supply
- [ ] Remove system-owned shops - all shops have real owners
- [ ] If no provisions available wholesale → shops run dry → agents can't buy

### Org Weekly Processing
- [ ] Org pays factory operating costs from org wallet
- [ ] Org pays employee salaries (if any) from org wallet
- [ ] If org wallet negative: org dissolves, factory closes

### Test Harness
- [ ] 1 corporation with 1 factory (produces provisions)
- [ ] 20 agents (some will open shops, others work/buy)
- [ ] No system shops - economy must bootstrap from factory
- [ ] Verify: factory → wholesale → retail → consumption loop

## Economic Flow

```
[Factory] --produces--> [Factory Inventory]
                              |
                    (wholesale purchase)
                              ↓
[Shop Owner Wallet] <--pays-- [Shop Inventory] --sells--> [Agent]
       |                           ↑                         |
       +-------(restocks from)-----+                    (eats)
```

## Parameters (add to templates/config)

**Factory template:**
```json
{
  "id": "factory",
  "balance": {
    "productionPerPhase": 10,
    "operatingCost": 100,
    "employeeSlots": 0,
    "inventoryCapacity": 500
  }
}
```

**Retail shop template (update):**
```json
{
  "id": "retail_shop",
  "balance": {
    "inventoryCapacity": 50
  }
}
```

**Agent balance (balance.json):**
```json
{
  "agent": {
    "carryingCapacity": 10
  }
}
```

**Wholesale pricing (balance.json):**
```json
{
  "economy": {
    "prices": {
      "provisions": 10,
      "provisionsWholesale": 7
    }
  }
}
```

## Verification

- [ ] Factory produces provisions (stops at capacity)
- [ ] Shop owners buy wholesale from factory (limited by shop capacity)
- [ ] Agents buy retail from shops (limited by carrying capacity)
- [ ] Credits flow: agents → shops → factory/org
- [ ] No magic restocking - real supply chain
- [ ] Capacity constraints create natural pressure/scarcity
- [ ] Economy survives 100+ weeks with real supply

## Non-Goals (Defer)

- Multiple corporations (just 1 for now)
- Warehouses (factory inventory is enough)
- Job tiers / skilled workers
- Org expansion decisions
- Multiple goods types
- Gangs

## Notes

- Keep it minimal - just enough to close the supply chain loop
- Capacity creates natural pressure points in the supply chain:
  - Factory at capacity → production stops → must sell to make room
  - Shop at capacity → can't restock → must sell to make room
  - Agent at capacity → can't hoard → must consume or not buy
- If factory can't produce enough → scarcity → agents starve
- If factory produces too much → backs up at factory → wasted production capacity
- If shops don't sell fast enough → can't restock → factory backs up
- Balance: productionPerPhase × phases vs (agents × consumption rate)
