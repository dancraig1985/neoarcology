# PLAN-038: Home Life & Leisure Behavior Hierarchy

**Status**: in-progress
**Priority**: P1 (high)
**Dependencies**: None

## Goal
Add home-based relaxation behaviors and clarify the leisure behavior hierarchy to make agents feel more alive during off-work time, creating a richer "slice of life" simulation.

## Problem Statement
Current agent behavior during non-work time:
- Agents wander to public spaces when idle
- No activities at home besides rest/sleep
- Agents feel like work robots, not living beings
- **Pubs exist but agents never visit them** (missing behavior)
- Existing "seeking_leisure" behavior is vague
- Unclear hierarchy: when do agents go to pubs vs parks vs stay home?
- Accumulated credits have limited use
- Leisure need management is simplistic

**From simulation data**: Agents spend 8 phases (1 day) on cooldown after each 16-phase work shift, but have minimal engaging activities during this downtime.

## Solution: Location-Based Leisure Hierarchy

Agents choose leisure activities based on:
1. **What they have** (luxury goods, entertainment media)
2. **Where they are** (home vs away from home)
3. **How much money they have** (rich → pub, poor → park/relax at home)

### Decision Tree

```
Agent has leisure > 30-50
├─ Has luxury_goods in inventory?
│  └─ YES → consume_luxury (anywhere, -70 leisure)
│  └─ NO → continue
│
├─ At home?
│  ├─ YES (at residence)
│  │  ├─ Has entertainment_media?
│  │  │  └─ YES → consume_entertainment (-30 leisure)
│  │  │  └─ NO → continue
│  │  ├─ Credits > 20?
│  │  │  └─ YES → buy_entertainment (then consume)
│  │  │  └─ NO → relax_at_home (free, slow -5/phase)
│  │
│  └─ NO (away from home)
│     ├─ Credits > 30 AND leisure > 50?
│     │  └─ YES → visit_pub (-40 leisure, costs 20)
│     │  └─ NO → continue
│     ├─ Leisure > 50?
│     │  └─ YES → hangout_at_public_space (park, free, slow)
│     │  └─ NO → wandering (aimless)
```

## Objectives

### Phase 1: Add Missing Pub Behavior
- [ ] Add "visiting_pub" behavior
  - Condition: leisure > 50, credits > 30, NOT at home, not traveling
  - Effect: Travel to pub, pay 20 credits (service fee), spend 4 phases, reduce leisure by 40
  - Priority: normal
  - Pubs already exist, just need the behavior to use them

### Phase 2: Home Entertainment System
- [ ] Add "entertainment_media" good to economy.json
  - Small size (0.1), retail price 15, wholesale price 8
  - Produced by offices (knowledge workers create media)
  - Sold at retail shops

- [ ] Add "consume_entertainment" behavior
  - Condition: At home, has entertainment_media, leisure > 35
  - Effect: Consume 1 media, instant leisure reduction by 30
  - Priority: normal (before buying more)

- [ ] Add "buy_entertainment" behavior
  - Condition: leisure > 40, credits > 20, inventory < 3 entertainment_media
  - Effect: Purchase from retail shops
  - Priority: normal (after consuming existing media)

- [ ] Add "relax_at_home" behavior
  - Condition: At home, leisure > 30, no entertainment_media
  - Effect: Passive leisure reduction (5 per phase), free
  - Priority: normal (fallback for broke agents at home)

### Phase 3: Clarify Existing Behaviors
- [ ] Rename "seeking_leisure" to "hangout_at_public_space"
  - Clearer name: agents go to parks/public spaces
  - Condition: leisure > 50, NOT at home, not traveling
  - Effect: Travel to park, hang out (slow leisure reduction)
  - Priority: normal (lower than pub, for broke agents)

- [ ] Update "wandering" conditions
  - Already has "notAtPublicSpace" condition
  - Lowest priority idle behavior

### Phase 4: Behavior Ordering
- [ ] Reorder behaviors in behaviors.json (first match wins at same priority)
  - Order: consume_luxury → visiting_pub → consume_entertainment → buy_entertainment → relax_at_home → hangout_at_public_space → wandering

## Implementation Details

### New/Updated Behaviors (behaviors.json)

**1. Visiting Pub (NEW):**
```json
{
  "id": "visiting_pub",
  "name": "Drinking at Pub",
  "priority": "normal",
  "executor": "visit_pub",
  "conditions": {
    "needsAbove": { "leisure": 50 },
    "hasCreditsAbove": 29,
    "notAtResidence": true,
    "notTraveling": true
  },
  "completionConditions": {
    "or": [
      { "phasesAtPub": 4 },
      { "needsBelow": { "leisure": 30 } },
      { "needsAbove": { "hunger": 60 } }
    ]
  },
  "params": {
    "locationTag": "leisure",
    "pubFee": 20,
    "leisureSatisfaction": 40,
    "duration": 4
  }
}
```

**2. Consume Entertainment (NEW):**
```json
{
  "id": "consume_entertainment",
  "name": "Enjoying Entertainment",
  "priority": "normal",
  "executor": "consume_entertainment",
  "conditions": {
    "inventoryAbove": { "entertainment_media": 0 },
    "needsAbove": { "leisure": 35 },
    "atResidence": true,
    "notTraveling": true
  },
  "completionConditions": {
    "inventoryBelow": { "entertainment_media": 1 }
  },
  "params": {
    "leisureSatisfaction": 30
  }
}
```

**3. Buy Entertainment (NEW):**
```json
{
  "id": "buy_entertainment",
  "name": "Buy Entertainment Media",
  "priority": "normal",
  "executor": "purchase",
  "conditions": {
    "needsAbove": { "leisure": 40 },
    "inventoryBelow": { "entertainment_media": 3 },
    "hasCreditsAbove": 19,
    "notTraveling": true,
    "marketHasGoods": "entertainment_media"
  },
  "completionConditions": {
    "inventoryAbove": { "entertainment_media": 2 }
  },
  "params": {
    "goodsType": "entertainment_media",
    "locationTag": "retail"
  }
}
```

**4. Relax at Home (NEW):**
```json
{
  "id": "relax_at_home",
  "name": "Relaxing at Home",
  "priority": "normal",
  "executor": "relax_home",
  "conditions": {
    "atResidence": true,
    "needsAbove": { "leisure": 30 },
    "inventoryBelow": { "entertainment_media": 1 },
    "notTraveling": true
  },
  "completionConditions": {
    "needsBelow": { "leisure": 20 }
  },
  "params": {
    "leisureReductionPerPhase": 5
  }
}
```

**5. Hangout at Public Space (RENAMED from seeking_leisure):**
```json
{
  "id": "hangout_at_public_space",
  "name": "Hanging Out at Park",
  "priority": "normal",
  "executor": "leisure",
  "conditions": {
    "needsAbove": { "leisure": 50 },
    "notAtResidence": true,
    "notTraveling": true,
    "notAtWorkplace": true
  },
  "completionConditions": {
    "needsBelow": { "leisure": 30 }
  },
  "params": {}
}
```

### New Good (economy.json)

```json
{
  "goods": {
    "entertainment_media": {
      "size": 0.1,
      "retailPrice": 15,
      "wholesalePrice": 8,
      "vertical": {
        "demandType": "consumer",
        "needsField": "leisure",
        "needsThreshold": 40,
        "productionTemplate": "office",
        "retailTemplate": "retail_shop"
      }
    }
  }
}
```

**Integration with offices:**
- Offices currently produce "valuable_data"
- Update office production to also produce entertainment_media
- Offices become dual-purpose: B2B data + B2C entertainment

### New Executors

**1. visitPubExecutor.ts**

Pattern: Service-based venue visit (like future entertainment venues)

```typescript
export function executeVisitPubBehavior(
  agent: Agent,
  ctx: BehaviorContext
): Agent {
  const pub = findNearestLocationWithTag(
    agent.locationId,
    'leisure',
    ctx.state.locations
  );

  if (!pub) return agent; // No pub available

  // Initialize pub visit state
  if (!agent.pubVisitState) {
    agent.pubVisitState = {
      phasesAtPub: 0,
      pubId: pub.id
    };
  }

  // Travel to pub if not there
  if (agent.locationId !== pub.id) {
    return setTravel(agent, pub.id, ctx);
  }

  // First phase at pub: pay fee
  if (agent.pubVisitState.phasesAtPub === 0) {
    const fee = 20; // config
    if (agent.credits < fee) {
      delete agent.pubVisitState;
      return agent; // Can't afford
    }

    // Pay pub owner
    const ownerOrg = ctx.state.orgs[pub.owner];
    agent.credits -= fee;
    ownerOrg.credits += fee;

    ActivityLog.log({
      tick: ctx.tick,
      type: 'service_purchase',
      agentId: agent.id,
      locationId: pub.id,
      details: `${agent.name} paid ${fee} credits at ${pub.name}`
    });
  }

  // Stay at pub, reduce leisure
  agent.pubVisitState.phasesAtPub++;
  agent.leisure = Math.max(0, agent.leisure - 10); // -40 over 4 phases

  // Complete after 4 phases
  if (agent.pubVisitState.phasesAtPub >= 4) {
    delete agent.pubVisitState;
  }

  return agent;
}
```

**2. consumeEntertainmentExecutor.ts**

Pattern: Simple inventory consumption (like consume_luxury)

```typescript
export function executeConsumeEntertainmentBehavior(
  agent: Agent,
  ctx: BehaviorContext
): Agent {
  if (!agent.inventory.entertainment_media || agent.inventory.entertainment_media < 1) {
    return agent; // No media to consume
  }

  // Consume one media
  agent.inventory.entertainment_media--;
  agent.leisure = Math.max(0, agent.leisure - 30);

  ActivityLog.log({
    tick: ctx.tick,
    type: 'consumption',
    agentId: agent.id,
    details: `${agent.name} enjoyed entertainment media at home`
  });

  return agent;
}
```

**3. relaxHomeExecutor.ts**

Pattern: Passive need reduction over time

```typescript
export function executeRelaxHomeBehavior(
  agent: Agent,
  ctx: BehaviorContext
): Agent {
  // Slow leisure reduction
  const reduction = 5; // config
  agent.leisure = Math.max(0, agent.leisure - reduction);

  // Log periodically (not every phase)
  if (agent.leisure % 10 === 0) {
    ActivityLog.log({
      tick: ctx.tick,
      type: 'leisure_activity',
      agentId: agent.id,
      details: `${agent.name} relaxing at home`
    });
  }

  return agent;
}
```

### Configuration Updates

**agents.json - Add leisure config:**
```json
{
  "leisure": {
    "perPhase": 0.25,
    "threshold": 50,
    "max": 100,

    "pubFee": 20,
    "pubSatisfaction": 40,
    "pubDuration": 4,
    "pubMinCredits": 30,

    "parkSatisfactionPerPhase": 1,

    "entertainmentMediaCost": 15,
    "entertainmentMediaSatisfaction": 30,
    "entertainmentMediaMax": 3,

    "relaxAtHomeSatisfactionPerPhase": 5,

    "luxurySatisfaction": 70
  }
}
```

### Office Production Update

**Update office template or production system:**
- Offices produce both "valuable_data" (B2B) and "entertainment_media" (B2C)
- Production cycle outputs both goods
- Creates dual revenue stream for offices

### Behavior Execution Order in behaviors.json

Critical that these appear in this order (first match wins):

```json
{
  "behaviors": [
    // ... emergency_hunger, forced_rest, urgent_rest, seeking_job ...

    // ... commuting, working, delivering_goods ...

    // NORMAL PRIORITY - Consumption/Leisure
    { "id": "buying_food", ... },
    { "id": "buying_luxury", ... },
    { "id": "consume_luxury", ... },           // Use luxury first
    { "id": "visiting_pub", ... },             // Rich, away from home
    { "id": "consume_entertainment", ... },    // At home, has media
    { "id": "buy_entertainment", ... },        // At home, need media
    { "id": "relax_at_home", ... },           // At home, broke
    { "id": "hangout_at_public_space", ... },  // Away from home, broke
    { "id": "finding_housing", ... },
    { "id": "starting_business", ... },
    { "id": "purchasing_orphaned_location", ... },

    // IDLE
    { "id": "wandering", ... }
  ]
}
```

## Expected Impact

### Agent Behavior Variety

**Rich Agent Journey (500 credits):**
- At work → leisure builds to 50
- Shift ends, away from home
- Goes to pub, spends 20 credits, 4 phases
- Pub owner earns revenue
- Agent returns home to rest

**Middle Class Agent (150 credits):**
- At home after work → leisure at 40
- Buys entertainment media from shop (15 credits)
- Stays home, consumes media
- Leisure drops quickly, satisfied
- Saves money vs going to pub

**Poor Agent (50 credits):**
- At home, leisure at 35
- No media, can't afford
- Relaxes at home (free, slow)
- Eventually satisfied but takes longer
- Never visits pubs (too expensive)

**Unemployed Wanderer:**
- Away from home, leisure high, broke
- Goes to park (hangout_at_public_space)
- Free outdoor leisure
- Slower satisfaction than pub/media

### Economic Impact
- **Pub revenue**: ~10-20 visits per week × 20 credits = 200-400 credits/week
- **Entertainment media sales**: ~50 agents × 15 credits/week = 750 credits/week
- **Office production**: New B2C demand (entertainment_media)
- **Retail shops**: New product to stock

### Simulation Depth
- Agents make economic choices (pub vs media vs free relaxation)
- Location matters (different behaviors at home vs away)
- Wealth visible through behavior (rich agents at pubs, poor at parks)
- Realistic daily routines (work → pub/home → relax → sleep)

## Testing Plan

### Phase 1: Individual Behaviors (50 ticks)
1. Test pub visiting: Agent travels to pub, pays fee, stays 4 phases
2. Test entertainment consumption: Agent consumes media, leisure drops
3. Test entertainment purchase: Agent buys from retail shop
4. Test relax at home: Agent at home, leisure slowly drops
5. Test public space: Agent away from home goes to park

### Phase 2: Hierarchy (100 ticks)
1. Rich agent with high leisure → should visit pub
2. Agent at home with media → should consume media
3. Broke agent at home → should relax at home
4. Broke agent away from home → should go to park
5. No behavior loops (agents don't oscillate)

### Phase 3: Economic Flow (500 ticks)
1. Pubs receive revenue from visits
2. Retail shops stock entertainment_media
3. Offices produce entertainment_media
4. Supply chain works (offices → shops → agents)
5. Agents manage leisure effectively

### Phase 4: Long Run (1000 ticks)
1. Leisure needs well-managed across population
2. Pubs profitable (receive regular customers)
3. Entertainment media circulates in economy
4. No behavior deadlocks or infinite loops
5. Agent behaviors feel realistic

## Implementation Order

1. Add entertainment_media to economy.json
2. Update office production to include entertainment_media
3. Add new condition types to ConditionEvaluator if needed
4. Create executors: visitPub, consumeEntertainment, relaxHome
5. Add/update behaviors in behaviors.json (correct order!)
6. Rename seeking_leisure → hangout_at_public_space
7. Add pub visit state to Agent interface
8. Test each behavior individually
9. Test hierarchy with different agent types
10. Long run test

## Success Criteria

- [ ] Agents visit pubs when away from home with credits
- [ ] Agents consume entertainment media at home
- [ ] Agents buy entertainment media when needed
- [ ] Broke agents relax at home for free
- [ ] Broke agents away from home go to parks
- [ ] No behavior loops or conflicts
- [ ] Pubs earn revenue from visits
- [ ] Entertainment media flows through economy
- [ ] Leisure needs well-managed
- [ ] Agent behavior feels realistic and varied

## Future Extensions

Once this works:
- **Media production vertical** (PLAN-040+): Dedicated media studios (skilled jobs)
- **Social visiting**: Agents visit friends at their homes
- **Home upgrades**: Better furniture = faster leisure reduction
- **Subscription services**: Netflix-style streaming for recurring revenue
- **Entertainment preferences**: Agents favor certain media types
- **Social venues**: Nightclubs, theaters (cyberpunk entertainment)
