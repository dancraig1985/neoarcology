# Economy

Money flows in a circle through NeoArcology. Understanding this flow is key to understanding why agents live or die.

## The Money Circle

```
    FACTORY ──────► SHOPS ──────► AGENTS
       ▲              │              │
       │              │              │
       │         (wholesale)    (retail)
       │              │              │
       │              ▼              ▼
       └──── WAGES ◄────────────────┘
```

1. **Factories sell wholesale** to shops
2. **Shops sell retail** to agents (consumers)
3. **Businesses pay wages** to their employees
4. **Employees spend wages** at shops
5. **Cycle repeats**

If any link breaks, people starve.

## Two Types of Transactions

### Retail (Consumer)
When an agent buys food at a shop:
- Agent pays the retail price
- Money goes to the shop's organization
- Agent receives the goods

### Wholesale (Business-to-Business)
When a shop restocks from a factory:
- Shop's org pays the wholesale price
- Money goes to the factory's organization
- Shop receives the goods

Wholesale prices are lower than retail - this is how shops make profit.

## Where Money Goes

### Revenue
All sales revenue goes to the **organization's wallet**, not directly to any person. This is true for both retail and wholesale.

### Expenses
Organizations pay from their wallet:
- **Employee salaries** - Weekly, to each worker
- **Operating costs** - Weekly, for each location
- **Owner dividends** - Weekly, to the leader

### Personal Income
Agents only receive money through:
- **Salary** - If employed by an org
- **Dividends** - If they own an org

There's no other way to get money in the current simulation.

## Hiring

### How Hiring Works

Locations don't hire - the simulation matches unemployed agents to open positions each tick.

Each phase, unemployed agents (`status: 'available'`) look for jobs:
1. Find locations with open slots (`employees.length < employeeSlots`)
2. Get hired at the first available position
3. Salary is set randomly within the unskilled range (from `economy.json`)

### At City Generation

Locations start with **empty employee slots**. No workers are pre-assigned. The simulation's normal hiring process fills positions as agents seek jobs. This means:
- Factories won't produce on turn 1 (no workers yet)
- By turn 2-3, unemployed agents find jobs and production begins
- The economy bootstraps itself naturally

### Employee Slots

Each location template defines `employeeSlots`:
- Factory: 3 slots (more workers = more production)
- Shop: 1 slot (owner doesn't count - they're the leader, not an employee)
- Restaurant: 2 slots

Owners never occupy employee slots. A shop with 1 `employeeSlots` can have 1 worker plus the owner.

## Profit and Loss

For a business to survive:
```
Revenue > (Employee Salaries + Operating Costs + Owner Dividend)
```

If revenue falls short:
1. First, owner dividends get skipped
2. Then employees can't be paid (they quit)
3. Finally, the business becomes insolvent and closes

## Economic Death Spirals

Several things can kill an economy:

### No Customers
If agents don't have money, they can't buy. If they can't buy, shops have no revenue. If shops have no revenue, they can't pay workers. Workers have no money, can't buy...

### No Stock
If factories stop producing, shops can't restock. If shops have no stock, agents can't buy food. Agents starve.

### Too Much Competition
If too many shops open, customers are spread thin. Each shop gets less revenue. Shops become unprofitable and close. But if they all close at once, there's nowhere to buy food.

## The Balancing Act

A healthy economy requires:
- **Enough production** - Factories making goods
- **Enough distribution** - Shops selling to consumers
- **Enough employment** - Workers earning wages
- **Enough spending** - Consumers buying goods

All four must stay in balance, or the system collapses.
