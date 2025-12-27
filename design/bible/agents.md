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

### Getting Hired
- Agent must be unemployed
- Location must have open employee slots
- Cannot work at a business you own

### Being Employed
- Receive weekly salary from employer
- If employer can't pay, you're fired
- Can quit to start your own business (if wealthy enough)

## Entrepreneurship

When an agent starts a business:
- They create an organization to own it
- Most of their savings become business capital
- They become the organization's leader
- They now receive owner dividends instead of salary
