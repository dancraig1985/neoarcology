# Organizations

Organizations (orgs) own businesses and employ agents. Every business is owned by an org, even sole proprietorships (micro-orgs).

## Key Files
- `src/simulation/systems/OrgSystem.ts` - Org creation, production
- `src/simulation/systems/EconomySystem.ts` - Weekly processing, dissolution
- `src/types/entities.ts` - Organization type definition

## Micro-Org Model

**Commercial businesses (shops, factories) are owned by organizations** for clean separation of personal and business finances.

Note: Personal locations (homes, hideouts) CAN be owned directly by agents via `ownerType: 'agent'`. The micro-org model is specifically for commercial operations with revenue/expenses.

When an agent opens a shop:
1. A new "micro-org" is created (e.g., "Alex Chen's Shop")
2. The agent becomes the org's `leader`
3. The shop location is added to `org.locations`
4. Business capital goes to `org.wallet`, not agent's wallet

This model enables:
- Clean separation of personal and business finances
- Consistent payroll and revenue handling
- Future expansion to multi-person companies

## Organization Structure

```typescript
interface Organization {
  id: string;
  name: string;
  leader: AgentRef;           // The owner/CEO
  wallet: Wallet;             // Business finances
  locations: LocationRef[];   // Owned properties
  // ... other fields
}
```

### Leader
- Every org has exactly ONE leader
- Leader receives weekly dividend (30 credits)
- If leader dies, org dissolves
- Leader is NOT in the location's `employees` array

### Wallet
- Separate from leader's personal wallet
- Receives revenue from sales
- Pays employee salaries and operating costs
- Pays owner dividend

### Locations
- Array of location IDs owned by this org
- Can include factories, shops, etc.
- All employees at these locations are paid by the org

## Weekly Processing

During weekly rollover, for each org:

### 1. Pay Employees
For each location owned by org:
- Find employees at that location
- Pay each employee's salary from org wallet
- If can't afford, employee is released (fired)

### 2. Pay Operating Costs
For each location:
- Deduct `operatingCost` from org wallet
- If can't afford, warning logged but location stays

### 3. Pay Owner Dividend
- Transfer 30 credits from org to leader's personal wallet
- Only if org has sufficient funds
- This is how owners "extract" profits

### 4. Check Dissolution
Org dissolves if ANY:
- **Bankrupt**: `wallet.credits < 0`
- **Insolvent**: `wallet.credits < 50`
- **Owner died**: `leader.status === 'dead'`

## Dissolution Process

When an org dissolves:

1. **Log critical event** with reason (bankrupt/insolvent/owner died)
2. **Release all employees** - status → 'available', clear employment
3. **Release leader** (if alive) - status → 'available'
4. **Remove all locations** from simulation
5. **Remove org** from simulation

## Creating Organizations

### Via Code (Initial Setup)
```typescript
const org = createOrganization(
  'org-1',           // id
  'Sterling Inc.',   // name
  'agent-0',         // leader id
  'Victoria',        // leader name
  10000,             // starting credits
  0                  // phase
);
```

### Via Agent Action (Starting Business)
When agent starts business:
- Business capital = 70% of agent's credits
- Opening cost = 200 credits (from template)
- Total deducted from agent = capital + opening cost

## Balance Considerations

### Shop Org Economics (per week)
- Revenue: ~157 credits (10.5 sales × 15)
- Wholesale cost: ~73 credits (10.5 × 7)
- Employee salary: ~30 credits
- Owner dividend: 30 credits
- Operating cost: 10 credits
- **Net: ~14 credits profit**

### Factory Org Economics (per week)
- Revenue: ~147 credits (21 wholesale × 7)
- Employee salary: ~60 credits (2 workers)
- Owner dividend: 30 credits
- Operating cost: 20 credits
- **Net: ~37 credits profit**

## Key Invariants

1. Every business location has exactly one owner org
2. Org leader is always an agent (never another org)
3. Leader death triggers org dissolution
4. Employees are paid from org wallet, not leader's wallet
5. Revenue goes to org wallet, not leader's wallet
6. Owner extracts profits via weekly dividend only
