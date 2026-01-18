# PLAN-030: Wallets UI Tab

**Status:** planned
**Priority:** P3 (low)
**Dependencies:** None (can be done anytime)

## Goal
Add a Wallets navigation tab to track all credit flows and wallet states across agents and organizations.

## Objectives

- [ ] Add "Wallets" tab to Nav component
- [ ] Create WalletsTable component showing all entity wallets
- [ ] Display columns: Owner (Agent/Org), Type, Credits, Income (this week), Expenses (this week), Net Change
- [ ] Add filters: Entity Type (Agent/Org), Credit Range (0-100, 100-500, 500+), Status (Positive/Negative)
- [ ] Click to view wallet details panel showing transaction history
- [ ] Sort by: Credits (asc/desc), Net Change, Owner Name
- [ ] Show summary stats: Total Credits in System, Agent Total, Org Total, Avg per Agent, Avg per Org

## Critical Files

**UI:**
- `src/ui/components/Nav.tsx` (add Wallets tab)
- `src/ui/components/WalletsTable.tsx` (NEW)
- `src/ui/components/WalletDetailsPanel.tsx` (NEW)
- `src/ui/UIConfig.ts` (wallet column definitions)

## State Structure

Wallets already exist on Agent and Organization entities. This is purely a UI feature - no simulation changes needed.

## Notes

This completes the main entity browsing UI:
- ✅ Agents
- ✅ Organizations
- ✅ Locations
- ✅ Buildings
- ✅ Vehicles
- 🔲 Orders (PLAN-029)
- 🔲 Wallets (this plan)

After this, all key simulation entities are browsable in the UI, making debugging and observation much easier.

## Success Criteria

- [ ] Wallets tab shows all agent and org wallets with current balances
- [ ] Table is sortable and filterable by multiple criteria
- [ ] Summary stats accurately reflect total system credits
- [ ] Performance acceptable with 200+ agents and 50+ orgs (virtualization if needed)
- [ ] Wallet details panel provides useful transaction context
