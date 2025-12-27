# Economy

The economy is a closed-loop system where money circulates between agents and organizations through employment and commerce.

## Key Files
- `src/simulation/systems/EconomySystem.ts` - All economic processing
- `src/simulation/systems/LocationSystem.ts` - Purchase transactions
- `data/config/balance.json` - Price and salary configuration

## Money Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      MONEY CIRCULATION                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌──────────┐    wholesale (7)    ┌──────────┐             │
│   │ FACTORY  │ ──────────────────► │  SHOPS   │             │
│   │   ORG    │                     │   ORGS   │             │
│   └────┬─────┘                     └────┬─────┘             │
│        │                                │                    │
│        │ salaries                       │ salaries           │
│        │ + owner div                    │ + owner div        │
│        │ (30+60)                        │ (30+30)            │
│        ▼                                ▼                    │
│   ┌──────────────────────────────────────────┐              │
│   │              AGENT WALLETS               │              │
│   └──────────────────────────────────────────┘              │
│        │                                                     │
│        │ retail purchases (15 each)                         │
│        │                                                     │
│        └─────────────────► SHOPS ────────────►              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Transaction Types

### Retail Purchase (Agent → Shop)
When an agent buys provisions:
1. Agent pays `retailPrice` (15) from personal wallet
2. Shop location's inventory decreases by 1
3. Shop's owner org wallet increases by 15
4. Location's `weeklyRevenue` tracked (for stats)

```typescript
// In tryBuyProvisions()
agent.wallet.credits -= 15;
location.inventory['provisions'] -= 1;
ownerOrg.wallet.credits += 15;
```

### Wholesale Purchase (Shop → Factory)
When a shop restocks:
1. Shop org pays `wholesalePrice` (7) per unit
2. Factory location's inventory decreases
3. Shop location's inventory increases
4. Factory's owner org wallet increases

```typescript
// In tryRestockFromWholesale()
shopOrg.wallet.credits -= (quantity * 7);
factoryLocation.inventory['provisions'] -= quantity;
shopLocation.inventory['provisions'] += quantity;
factoryOrg.wallet.credits += (quantity * 7);
```

### Employee Salary (Org → Agent)
Weekly payroll:
1. Org pays each employee's salary from org wallet
2. Employee's personal wallet increases
3. If org can't pay, employee is released

```typescript
// In processOrgPayroll()
org.wallet.credits -= employee.salary;
employee.wallet.credits += employee.salary;
```

### Owner Dividend (Org → Leader)
Weekly owner payment:
1. Org pays 30 credits to leader
2. Leader's personal wallet increases
3. Only if org has sufficient funds

```typescript
// In processWeeklyEconomy()
org.wallet.credits -= 30;
leader.wallet.credits += 30;
```

## Price Configuration

From `data/config/balance.json`:
```json
{
  "goods": {
    "provisions": {
      "retailPrice": 15,    // Agent pays this
      "wholesalePrice": 7   // Shop pays this
    }
  },
  "economy": {
    "salary": {
      "unskilled": { "min": 20, "max": 40 }
    }
  }
}
```

### Profit Margins
- **Shop margin**: 15 - 7 = 8 credits (53%)
- **Factory margin**: 7 - 0 = 7 credits (100%, produces from nothing)

## Money Sinks

Operating costs are the only money sink (money destroyed):
- Shop operating: 10/week
- Factory operating: 20/week
- Total: ~70/week (with 2 shops + 1 factory)

## Money Sources

Currently, money is only created at simulation start:
- Agents: 100-500 each × 21 = ~6,300 credits
- Factory org: 10,000 credits
- Shop orgs: 700 each × 2 = 1,400 credits
- **Total: ~17,700 credits**

Factory production creates VALUE (provisions) but not MONEY.

## Economic Balance

### For Shops to be Profitable
Revenue must exceed costs:
- Revenue: sales × margin = 10.5 × 8 = 84/week
- Costs: employee(30) + owner(30) + operating(10) = 70/week
- **Net: +14/week** ✓

### For Factory to be Profitable
- Revenue: wholesale sales × price = 21 × 7 = 147/week
- Costs: employees(60) + owner(30) + operating(20) = 110/week
- **Net: +37/week** ✓

### For Agents to Survive
- Income: salary = 20-40/week
- Food cost: 15/week (eating ~once per week)
- **Net: +5-25/week savings** ✓

## Key Invariants

1. All revenue goes to ORG wallets, not agent wallets
2. Agents only receive money via salary or owner dividend
3. Operating costs are a money sink (destroyed)
4. Retail price > wholesale price (shops must profit)
5. Salary > food cost (employees can survive)
6. Weekly processing happens on week rollover only
