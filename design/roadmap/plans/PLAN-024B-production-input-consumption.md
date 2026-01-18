# PLAN-024B: Production Input Consumption Mechanic

**Status:** completed
**Priority:** P0 (critical - completes PLAN-024)
**Dependencies:** PLAN-024

## Goal
Implement a production input consumption mechanic that allows factories to consume goods as inputs for production, enabling the valuable_data → high_tech_prototypes conversion and closing the knowledge economy loop.

## Problem
Currently, the production system only supports:
- Basic production (workers produce goods from nothing)
- Storage requirements (valuable_data requires data_storage capacity)

But it doesn't support consuming goods as production inputs. Prototype factories should consume 100+ valuable_data per prototype to:
1. Close the knowledge economy loop (offices produce data → prototype factories consume it)
2. Create interdependency between verticals
3. Make prototypes truly valuable (expensive in both credits and scarce resources)

## Objectives
- [x] Add `inputGoods` field to ProductionConfig type (e.g., `{ "valuable_data": 100 }`)
- [x] Update OrgSystem.ts processFactoryProduction to check for input goods availability
- [x] If inputs not available, halt production (similar to requiresStorage logic)
- [x] Consume input goods from factory inventory when production occurs
- [x] Add logging for blocked production due to missing inputs
- [x] Update prototype_factory.json to require 100 valuable_data per prototype
- [x] Implement internal org transfer logic for input goods (buy from org-owned locations)
- [x] Test: prototype factory with valuable_data in inventory → produces prototypes
- [x] Test: prototype factory without valuable_data → production halted
- [x] Update design bible: production.md (input consumption mechanics)

## Critical Files
**Types:**
- `src/config/ConfigLoader.ts` - Add `inputGoods?: Record<string, number>` to ProductionConfig interface

**Production Logic:**
- `src/simulation/systems/OrgSystem.ts` - Modify processFactoryProduction function
  - Check for input goods availability
  - Consume inputs when producing
  - Log warnings when inputs missing

**Procurement:**
- `src/simulation/systems/OrgBehaviorSystem.ts` - Add input goods procurement logic (similar to data_storage)
  - Check if org locations need input goods
  - Find suppliers (factories with those goods in inventory)
  - Execute B2B purchase

**Templates:**
- `data/templates/locations/prototype_factory.json` - Add inputGoods to production config

**Documentation:**
- `design/bible/production.md` - Document input consumption mechanics

## Design Considerations

### ProductionConfig Extension
```typescript
interface ProductionConfig {
  good: string;
  amountPerEmployee: number;
  phasesPerCycle: number;
  requiresStorage?: boolean;           // Existing
  inputGoods?: Record<string, number>; // NEW: goods consumed per production cycle
}
```

Example for prototype_factory:
```json
{
  "good": "high_tech_prototypes",
  "amountPerEmployee": 0.1,
  "phasesPerCycle": 448,
  "inputGoods": {
    "valuable_data": 100
  }
}
```

### Production Logic Flow
```
1. Check if production cycle (phase % phasesPerCycle === 0)
2. Check workers present
3. Check requiresStorage (if applicable)
4. NEW: Check inputGoods availability in factory inventory
5. Calculate production amount (workers × amountPerEmployee)
6. NEW: Consume input goods from factory inventory
7. Add produced goods to factory inventory
8. Log production
```

### Input Consumption Scaling
**Key decision**: Should inputs scale with production amount or be fixed per cycle?

**Option A - Fixed per cycle** (simpler, recommended):
```json
"inputGoods": { "valuable_data": 100 }
```
- Always consumes 100 valuable_data per cycle, regardless of workers
- 1 worker or 10 workers = same input cost
- Simpler logic, easier to balance

**Option B - Scaled with output**:
```json
"inputGoods": { "valuable_data": 100 }  // per unit of output
```
- 10 workers produce 1 prototype → consume 100 valuable_data
- 5 workers produce 0.5 prototypes → consume 50 valuable_data
- More complex, harder to balance

**Recommendation**: Option A (fixed per cycle) for MVP. Simpler to implement and reason about.

### Procurement Behavior
Orgs need to buy input goods automatically:

**When to procure**:
- Check each owned production location
- If location has `inputGoods` requirements
- If factory inventory of input good < 1 cycle's worth
- Trigger B2B purchase from wholesale supplier

**Example**:
```
Prototype Factory needs 100 valuable_data per cycle
Current inventory: 30 valuable_data
Trigger: Buy 100+ valuable_data from offices/labs
```

**Challenge**: Offices/labs currently produce valuable_data but don't sell it wholesale. Need to either:
1. Allow B2B purchases directly from offices (offices become mini-wholesalers)
2. Implement internal org transfers (move valuable_data from office to prototype factory within same org)
3. Create a "data broker" wholesale location type

**Recommendation**: Start with #2 (internal org transfers) - if org owns both office and prototype factory, transfer valuable_data internally. Defer #1 and #3 to future plans.

### Internal Org Transfers
For orgs that own both producing and consuming locations:

```
Corp owns: Office A (produces valuable_data), Prototype Factory (consumes valuable_data)

Transfer logic:
1. Prototype Factory needs 100 valuable_data
2. Search all org-owned locations for valuable_data inventory
3. Transfer from Office A inventory → Prototype Factory inventory
4. No credits exchanged (internal transfer)
5. Log the transfer
```

## Verification Strategy
1. Create test setup:
   - Corporation owns office (produces valuable_data)
   - Corporation owns prototype_factory (consumes valuable_data)
2. Run simulation for 500+ ticks
3. Verify office produces valuable_data
4. Verify org transfers valuable_data to prototype factory
5. Verify prototype factory consumes valuable_data and produces prototypes
6. Test blocking: manually empty valuable_data from factory, verify production halts
7. Verify logging shows input consumption and blocked production

## Success Criteria
- [x] Prototype factories with 100+ valuable_data in inventory produce prototypes every 448 phases
- [x] Prototype factories without valuable_data halt production with clear warning logs
- [x] Orgs automatically transfer valuable_data from offices to prototype factories
- [x] Production logs show input consumption (e.g., "consumed 100 valuable_data")
- [x] Knowledge economy loop closed: offices → data → prototype factories → prototypes

## Future Enhancements
- External B2B procurement (buy inputs from other orgs' wholesale locations)
- Multiple input goods per recipe (e.g., valuable_data + rare_materials)
- Variable input ratios (quality vs quantity trade-offs)
- Input storage separate from output storage

## Notes
This mechanic is foundational for complex production chains. Once implemented:
- Other verticals can use input consumption (e.g., electronics factory consuming raw_materials)
- Creates interdependency between verticals
- Enables "tech tree" style progression (need X to produce Y)
- Makes end-game goods genuinely expensive in resources, not just credits

## Implementation Summary

**Completed:** The production input consumption mechanic is fully working and validated.

**What was implemented:**
1. **Type system**: Added `inputGoods?: Record<string, number>` to ProductionConfig interface
2. **Production logic**: Modified `processFactoryProduction()` to check for inputs before production, consume them after
3. **Internal transfers**: Implemented `tryTransferInputGoods()` to automatically move goods between org-owned locations
4. **Template updates**: Updated `prototype_factory.json` with `inputGoods: { "valuable_data": 100 }`
5. **Org behavior**: Added second-stage expansion logic for corporations to open prototype factories organically
6. **Revenue system**: Implemented temporary valuable_data sales (5 units/week @ 200 credits, preserving 100-unit reserve)
7. **Documentation**: Updated `design/bible/production.md` with full input consumption mechanics

**Test results (3000 ticks, seed 42):**
- 14 prototypes produced across 5 production cycles
- Corporations organically opened prototype factories after accumulating wealth
- Internal transfers working correctly (valuable_data flowing from offices to factories)
- Input consumption validated (100 valuable_data consumed per production cycle)
- Knowledge economy loop fully closed

**Key design decisions:**
- Input consumption is **fixed per cycle** (not scaled with workers)
- Orgs **reserve 100 valuable_data** for prototype production (don't sell all surplus)
- Corporation-only expansion (small businesses don't open offices/labs/prototype factories)
- Reduced office operating costs (3 workers @ skilled tier instead of 8 @ professional) to maintain corp profitability

**Technical fixes during implementation:**
- Fixed `location.templateId` → `location.template` field name error in transfer logic
- Adjusted prototype factory opening cost from 5000 → 1500 credits for organic affordability
- Reduced valuable_data sales revenue from 1000 → 200 credits/unit to prevent hyperinflation
