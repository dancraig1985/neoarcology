# Agents

Agents are the people of NeoArcology. They have needs, make decisions, and can die.

## Survival

### Hunger
Agents get hungrier over time. When hunger reaches a threshold, they need to eat.

- **Hunger accumulates** continuously as time passes
- **Eating resets hunger** to zero and consumes one provision
- **Starvation occurs** when hunger reaches maximum - the agent dies

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
