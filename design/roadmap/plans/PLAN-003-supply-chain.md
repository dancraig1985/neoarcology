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

### Organization Entity (Minimal)
- [ ] Org has: id, name, leader (AgentRef), wallet
- [ ] Org owns locations (factory, warehouse)
- [ ] Leader is an agent who makes decisions for the org
- [ ] Org template: `corporation` only (defer gangs)

### Factory Location
- [ ] Factory produces provisions each phase
- [ ] Production rate from template balance (e.g., 10/phase)
- [ ] Provisions go to factory inventory
- [ ] Factory has operating cost (paid weekly by org)

### Wholesale Commerce
- [ ] Shop owners can buy provisions from factories/warehouses
- [ ] Wholesale price < retail price (margin for shops)
- [ ] Factory sells from inventory, credits go to org wallet
- [ ] Shop owners buy when inventory low (replaces magic restock)

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

## Parameters (add to templates)

**Factory template:**
```json
{
  "id": "factory",
  "balance": {
    "productionPerPhase": 10,
    "operatingCost": 100,
    "employeeSlots": 0
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

- [ ] Factory produces provisions over time
- [ ] Shop owners buy wholesale from factory
- [ ] Agents buy retail from shops
- [ ] Credits flow: agents → shops → factory/org
- [ ] No magic restocking - real supply chain
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
- If factory can't produce enough → scarcity → agents starve (interesting!)
- If factory produces too much → oversupply → shop owners can't sell (interesting!)
- Balance productionPerPhase vs consumption rate for stability
