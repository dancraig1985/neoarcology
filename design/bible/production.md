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

| Template | Good | Rate | Salary Tier | Input Required | Notes |
|----------|------|------|-------------|----------------|-------|
| `provisions_factory` | provisions | 1/2phases/worker | skilled | - | Food for survival |
| `brewery` | alcohol | 1/4phases/worker | skilled | - | Discretionary leisure |
| `server_factory` | data_storage | 1/8phases/worker | skilled | - | B2B infrastructure |
| `luxury_factory` | luxury_goods | 1/16phases/worker | skilled | - | High-end consumer goods |
| `office` | valuable_data | 1/16phases/worker | skilled | - | Requires data_storage capacity |
| `laboratory` | valuable_data | 1/8phases/worker | skilled | - | Requires data_storage capacity, faster |
| `prototype_factory` | high_tech_prototypes | 0.1/448phases/worker | professional | 100 valuable_data | End-game, consumes data (2 months/prototype) |

### Production Configuration

Each facility template defines:
```json
"production": [
  {
    "good": "provisions",
    "amountPerEmployee": 1,
    "phasesPerCycle": 2,
    "inputGoods": { "valuable_data": 100 }  // Optional: consumed per cycle
  }
]
```

- **good**: What's produced
- **amountPerEmployee**: Output per worker per cycle
- **phasesPerCycle**: 2 = every 2 phases, 4 = twice per day, 8 = daily, 56 = weekly
- **requiresStorage**: If true, org needs `data_storage` in inventory to produce (capacity-based)
- **inputGoods**: Optional map of goods consumed per production cycle (e.g., `{"valuable_data": 100}`)

### Production with Input Consumption

Some production requires **consuming goods as inputs**. This creates complex supply chains where one factory's output becomes another's input.

**How it works:**
1. Factory needs input goods to produce (e.g., prototype factory needs 100 valuable_data per cycle)
2. System checks factory inventory for required inputs before production
3. If inputs available → consume them → produce output
4. If inputs missing → production blocked with warning log

**Internal org transfers:**
- When a factory needs inputs, the org automatically searches its other locations for those goods
- If found, goods are transferred internally (no credits exchanged)
- This allows corporations to build integrated supply chains (offices produce data → factories consume data)

**Example: Prototype Production**
```
Prototype factory needs 100 valuable_data per cycle
  → Org owns Office A (has 150 valuable_data)
    → System transfers 100 valuable_data: Office A → Prototype Factory
      → Prototype factory produces 1 prototype, consumes 100 valuable_data
        → Office A has 50 valuable_data remaining
```

**Key mechanics:**
- Input consumption is **fixed per cycle** (not scaled with output)
- Inputs are consumed **after** successful production (not before)
- Orgs automatically manage internal transfers (no manual logistics yet)
- If no org locations have the needed goods, production is blocked

This creates interdependency between economic verticals - closing the loop on the knowledge economy.

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

### End-Game Production

**Prototype Factories** are the pinnacle of the knowledge economy - ultra-rare, ultra-expensive facilities that close the valuable_data loop:

**How it works:**
- Consumes: 100 valuable_data per production cycle
- Produces: 0.1 high_tech_prototypes per worker per 448 phases (2 months)
- Opens organically: Corporations expand to prototype factories after accumulating wealth

**The Knowledge Economy Loop (Complete):**
```
Server factories produce data_storage (B2B infrastructure)
  → Corporations buy data_storage for their offices
    → Offices produce valuable_data (R&D output)
      → Corporations sell surplus valuable_data for revenue (temporary B2B market)
        → Prototype factories consume 100 valuable_data per cycle
          → Produce high_tech_prototypes (end-game goods)
```

**Scarcity by Design:**
- Opening cost: 1500 credits (affordable for profitable corporations)
- Input requirement: 100 valuable_data per cycle (forces sustained R&D investment)
- Production cycle: 448 phases (2 months per prototype)
- Output: 10 workers = 1 prototype per 2 months (~6 per year max)
- Salary tier: professional (expensive to operate)
- Does NOT spawn at city start (`spawnAtStart: false`)

**Expansion conditions:**
- Corporation must own office/lab (producing valuable_data)
- Corporation must have 100+ valuable_data in inventory (proves R&D works)
- Corporation must have 2000+ credits (opening cost + buffer)
- 1% random chance per phase when eligible (rare expansion event)

**Why this creates scarcity:**
1. Only corporations with successful R&D operations can afford the input costs
2. Slow production (2 months/prototype) limits supply even with full staffing
3. Input consumption drains valuable_data reserves (must balance revenue sales vs production)
4. Random expansion chance means not all eligible corporations will build one

**Observed in simulation:** In a 3000-tick test, 4 corporations opened prototype factories organically, producing ~14 total prototypes - validating end-game rarity.

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
