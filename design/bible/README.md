# NeoArcology Simulation Bible

This folder contains detailed documentation for each critical simulation system. These documents serve as context for development sessions and should be referenced when working on related systems.

## Chapters

| Chapter | Description | Key Files |
|---------|-------------|-----------|
| [Agents](./agents.md) | Agent behavior, needs, hunger, starvation | `AgentSystem.ts` |
| [Organizations](./orgs.md) | Orgs, leaders, micro-orgs, dissolution | `OrgSystem.ts` |
| [Economy](./economy.md) | Money flow, wallets, transactions, payroll | `EconomySystem.ts` |
| [Inventory](./inventory.md) | Goods, sizes, capacity, transfers | `InventorySystem.ts` |
| [Locations](./locations.md) | Locations, templates, tags, commerce | `LocationSystem.ts` |
| [Production](./production.md) | Factory production, cycles, labor | `OrgSystem.ts` |

## How to Use

When starting work on a system, read the relevant chapter(s) first to understand:
- Current implementation details
- Balance values and their rationale
- Key invariants that must be maintained
- Known issues and design decisions

## Quick Reference

### Money Flow
```
Factory produces → Wholesale to shops → Retail to agents
       ↑                                        ↓
  Factory pays                            Agents pay
  employees + owner                       for provisions
       ↑                                        ↓
       ← ← ← MONEY CIRCULATES ← ← ← ← ← ← ← ← ←
```

### Key Balance Values
- Retail price: 15 credits
- Wholesale price: 7 credits
- Employee salary: 20-40/week
- Owner dividend: 30/week
- Entrepreneur threshold: 600 credits

### Dissolution Conditions
An org dissolves if ANY:
- Bankrupt: credits < 0
- Insolvent: credits < 50
- Owner died: leader.status === 'dead'
