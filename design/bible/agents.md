# Agents

Agents are the people of NeoArcology. They have needs, make decisions, and can die.

## Survival

Agents have two needs that drive behavior: hunger and fatigue.

### Hunger
Agents get hungrier over time. When hunger reaches a threshold, they need to eat.

- **Hunger accumulates** continuously as time passes (~25% per day)
- **Eating resets hunger** to zero and consumes one provision
- **Starvation occurs** when hunger reaches 100% - the agent dies

### Fatigue
Agents get tired over time. Unlike hunger, fatigue doesn't kill - it forces rest.

- **Fatigue accumulates** continuously (~3.57% per phase, 100% per week)
- **Resting resets fatigue** based on where the agent rests (see Rest Quality below)
- **At 100% fatigue** the agent must rest wherever they are (worst outcome)

Agents **proactively seek rest** before hitting 100%:
- At 70%+ fatigue: seek rest after current activity
- At 90%+ fatigue: urgent rest (go home immediately)
- At 100%: forced rest wherever you are

**Important**: Employed agents commuting to work are NOT interrupted by urgent rest. They complete their commute and work before resting. Only forced rest (100%) stops them.

### Eating Priority
When hungry, an agent will:
1. First, eat from their personal inventory (if they have provisions)
2. If no food, try to buy from a shop (if they have money)
3. If no money or no shops have stock, continue starving

### Death
Death is permanent. A dead agent:
- No longer participates in the simulation
- Loses all possessions (credits, inventory)
- If they owned a business, it closes (see Organizations)
- **Use `setDead()` from AgentStateHelpers** - it clears all state atomically

## Housing

Agents have a residence - where they live and rest.

### Residence
- `residence` - Reference to the location (apartment) where the agent lives
- Agents pay weekly rent (20 credits) to their landlord (the org that owns the apartment)
- If rent can't be paid, the agent is evicted and becomes homeless

### Rest Quality
Where an agent rests determines how well they recover:

| Location | Fatigue Reset | Notes |
|----------|---------------|-------|
| Own residence | 0% | Full rest, proper bed |
| Public shelter | 30% | Partial rest, uncomfortable |
| Anywhere else | 60% | Poor rest, exposed |

### Homelessness
Homeless agents (no residence) must use public shelters or rest wherever they are. They actively seek housing when they can afford it.

**Housing search**: Homeless agents with enough savings (80+ credits = 4 weeks rent buffer) will look for available apartments. If found, they move in and start paying rent.

### Immigrants Arrive Homeless
New immigrants arrive without housing. They must find an apartment through the normal housing search process, competing with other homeless agents for available units.

### Configuration
Rent and housing thresholds are defined in location templates:
- `apartment.json`: `rentCost: 20`, `maxResidents: 1`
- `shelter.json`: `rentCost: 0`, `maxResidents: 20`

## Economic Behavior

Agents make decisions each phase based on their situation:

### Priority 1: Feed the Business
Shop owners restock their inventory from wholesale suppliers before doing anything else. A shop owner who lets their store run empty will lose customers.

### Priority 2: Feed Yourself
Hungry agents with no food will try to buy provisions. They need both money and a shop with stock.

### Priority 3: Find Work
Unemployed agents look for jobs at locations that are hiring. Jobs provide steady income (weekly salary).

### Priority 4: Start a Business
Agents who accumulate enough savings may quit their job and open their own shop. This requires significant capital and creates a new organization to own the business.

## Employment

### Employment Status

The `status` field indicates the agent's economic situation:
- `available` - Unemployed, seeking work
- `employed` - Has an income source (job or business ownership)
- `dead` - No longer active

**Important**: `status: 'employed'` means "has income" - both employees and business owners are "employed".

### Employees vs Owners

| Aspect | Employee | Owner |
|--------|----------|-------|
| `status` | employed | employed |
| `employer` | org ID | org ID |
| `employedAt` | location ID | undefined |
| In `location.employees[]` | Yes | No |
| Income source | Weekly salary | Weekly dividend |
| Loses job if org bankrupt | Yes (fired) | N/A (org dissolves) |

Key distinction:
- **Employees** work at a specific location and appear in `location.employees[]`
- **Owners** lead an org but don't occupy an employee slot - they receive dividends, not salary

### Getting Hired
- Agent must have `status: 'available'`
- Location must have open employee slots (`employees.length < employeeSlots`)
- Hiring sets: `status: 'employed'`, `employer: orgId`, `employedAt: locationId`, `salary: amount`
- Agent is added to `location.employees[]`
- **Use `setEmployment()` from AgentStateHelpers** - never set these fields individually

### Being Employed
- Receive weekly salary from employer's org wallet
- If employer can't pay, you're fired (back to `available`)
- Can quit to start your own business (if wealthy enough)

## Entrepreneurship

When an agent starts a business:
- They create an organization to own it
- Most of their savings become business capital (transferred to org wallet)
- They become the organization's leader (`org.leader = agent.id`)
- `status` becomes `employed`, `employer` set to new org ID
- They are NOT added to any location's employee list
- They now receive owner dividends instead of salary

### Owner Dividend
Org leaders receive a weekly dividend (30 credits) drawn from the org wallet. This is their income for running the business. Unlike salary, dividends are paid regardless of whether the org is profitable - though an insolvent org will dissolve.

## Immigration

Population is sustained through immigration. When population drops below target, new agents arrive in the city.

### How It Works
Each week, the simulation checks the living population:
1. If below `target`, spawn up to `spawnRate` immigrants
2. If below `minimum`, spawn more aggressively (2x rate)
3. Immigrants arrive at random public locations

### Immigrant Properties
Immigrants arrive with:
- **Credits**: 80-200 (configurable, enough to survive while job-seeking)
- **Provisions**: 3-6 (small food buffer)
- **Hunger**: 0-20% (arrive hungry but not starving)
- **Status**: `available` (immediately seek work)
- **Tags**: `civilian`, `immigrant`

### Configuration
Set in `data/config/simulation.json`:
```json
{
  "population": {
    "target": 200,
    "minimum": 50,
    "spawnCheckInterval": 28,
    "spawnRate": 5,
    "immigrantCredits": { "min": 80, "max": 200 },
    "immigrantProvisions": { "min": 3, "max": 6 }
  }
}
```

### Economic Impact
Immigration brings new money into the economy (immigrant credits), offsetting deaths which remove money. This keeps the total money supply stable over time.
