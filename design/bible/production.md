# Production

Factories create goods. Without production, there's nothing to sell, nothing to eat, nothing.

## How Production Works

Production requires **labor**:
- Factories have employee slots
- Workers show up and produce goods
- More workers = more production

**No workers = no production.** An empty factory sits idle.

## The Production Cycle

Each cycle (which could be every phase, daily, or weekly depending on the good):
1. Count how many workers are present
2. Each worker produces their share
3. Goods appear in the factory's inventory

Production continues until the factory is full. Then it stops until goods are sold.

## Labor Dependency

This is crucial: **production scales with employment**.

- 0 workers → 0 output
- 1 worker → some output
- 2 workers → twice as much
- Full staff → maximum output

A factory owner who can't attract or retain workers will watch their business grind to a halt.

## Capacity Limits

Factories can only hold so much:
- Every factory has a storage capacity
- Production stops when storage is full
- Goods must be sold (wholesale) to make room

A factory with no buyers will fill up and stop producing.

## What Gets Produced

Production is defined in location templates via the `production` array:

### Current Production Facilities

| Template | Good | Rate | Salary Tier | Notes |
|----------|------|------|-------------|-------|
| `provisions_factory` | provisions | 1/phase/worker | skilled | Food for survival |
| `brewery` | alcohol | 1/2phases/worker | skilled | Discretionary leisure |
| `server_factory` | data_storage | 1/4phases/worker | skilled | B2B infrastructure |
| `luxury_factory` | luxury_goods | 1/8phases/worker | skilled | High-end consumer goods |
| `office` | valuable_data | 1/8phases/worker | professional | Requires data_storage |
| `laboratory` | valuable_data | 1/4phases/worker | professional | Requires data_storage, faster |

### Production Configuration

Each facility template defines:
```json
"production": [
  { "good": "provisions", "amountPerEmployee": 1, "phasesPerCycle": 1 }
]
```

- **good**: What's produced
- **amountPerEmployee**: Output per worker per cycle
- **phasesPerCycle**: 1 = every phase, 2 = every other phase, 28 = weekly
- **requiresStorage**: If true, org needs `data_storage` in inventory to produce

### Production with Dependencies

Some production requires infrastructure goods:

**Offices and Laboratories** produce `valuable_data` but require `data_storage` infrastructure at the same location. Storage is **capacity-based**:

```
1 data_storage = 10 valuable_data capacity (configurable in economy.json)
```

**How it works:**
1. Office opens (can start without storage)
2. Office tries to produce → blocked (no data_storage)
3. Org buys data_storage from server factory → delivered to office
4. Office produces valuable_data (capped to available storage)
5. Storage fills up → production halts when full
6. Org buys more data_storage (triggered at 80% capacity)
7. Production resumes

**Key mechanics:**
- Storage is per-location (not org-wide)
- Production is capped to available storage (can't overfill)
- Orgs automatically buy more storage when 80% full
- Storage delivered directly to office/lab (not to random org location)

This creates sustained B2B demand - server factories have ongoing customers, not just one-time sales.

### Adding New Production

To add a new production vertical:
1. Create location template with `production` config
2. Add `wholesale` and `production` tags
3. Set `ownerOrgTemplate: "corporation"` for city generation
4. Create corresponding retail location to sell the good (if B2C)
5. Add vertical metadata to `economy.json` goods config

## The Supply Chain

Production is just the start:

```
PRODUCTION → WHOLESALE → RETAIL → CONSUMPTION
  (factory)   (to shops)  (to agents)  (eating)
```

If any link breaks:
- No production → Shops can't restock → Agents starve
- No wholesale buyers → Factory fills up → Production stops
- No retail buyers → Shops fail → Wholesale stops → Factory fails

## Worker Incentives

Workers need reasons to work:
- **Salary** - Paid weekly by the factory's org
- **Survival** - Money buys food

If a factory can't pay competitive wages, workers will:
- Leave for better jobs
- Start their own businesses
- (Or starve if there's nowhere else to go)

## Factory Economics

For a factory to survive:
- Wholesale revenue must exceed costs
- Costs = worker salaries + operating costs + owner dividend
- If revenue < costs, the factory eventually closes

A factory that can't sell its goods is doomed.
