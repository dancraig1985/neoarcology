# NeoArcology - Game Design Document

**Core Concept**: A cyberpunk city simulation that runs autonomously. Game modes are different views/control schemes into the same living world.

**Inspirations**: Dwarf Fortress (simulation depth), Django Admin (interface), Syndicate, Shadowrun
**Stack**: TypeScript, Pixi.js, Electron (same as Chrome Fixer)

---

## Design Philosophy

### Simulation First

The city simulation is the **primary artifact**. It runs whether a player is watching or not. Every entity has autonomous behavior driven by goals, resources, and relationships.

### MVP Foundation (Keep It Simple)

The simulation is built on **four simple pillars**:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MVP FOUNDATION                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. TAGS           Everything classified by tags, not hardcoded     │
│                    types. Add new "types" via data files.           │
│                                                                      │
│  2. WALLETS        Credits flow between entities. Simple in/out.    │
│                    Agents have wallets. Orgs have wallets.          │
│                                                                      │
│  3. STATS + RNG    6 agent stats determine task outcomes.           │
│                    stat + roll = success/failure. That's it.        │
│                                                                      │
│  4. LOCATIONS      Everything physical exists at a location.        │
│                    Goods, data storage, agents. Attack the          │
│                    location to get the stuff.                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Behaviors require code; types don't.**
- Adding a tag behavior (e.g., "what happens when something is 'violent'") = code
- Adding a new entity template that uses existing tags = just data
- Most variety comes from combining existing behaviors via tags

**~16 goods categories, not 1000 items.**
- Broad categories: small_arms, narcotics, data_storage, etc.
- Inventory is quantity per category, not individual items
- Differentiates orgs by what they stock without Rimworld complexity

**Tangible at locations, non-tangible on data_storage.**
- Physical goods stored at locations (can be raided)
- Secrets/intel stored on data_storage goods (which are at locations)
- Want the data? Steal the storage device. Cyberpunk.

### Agents Drive Everything

**Agents are the atomic unit of the simulation.** Organizations don't think—their leaders do. When we say "the Yakuza decided to attack," what actually happens is:

1. The Yakuza's leader evaluates their personal goals + org situation
2. Leadership council members may advise or dissent
3. The leader makes a decision based on their personality
4. Agents execute (or subvert) that decision

This means:
- A cautious leader makes cautious org decisions
- A greedy lieutenant might embezzle org funds
- A disloyal agent might leak mission details to enemies
- Ambitious agents can found new organizations
- Org culture emerges from agent personalities, not the other way around

```
┌─────────────────────────────────────────────────────────────────┐
│                     NEOARCOLOGY ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                    ┌──────────────────────┐                      │
│                    │   CITY SIMULATION    │                      │
│                    │   (Autonomous Core)  │                      │
│                    └──────────┬───────────┘                      │
│                               │                                  │
│              ┌────────────────┼────────────────┐                 │
│              │                │                │                 │
│              ▼                ▼                ▼                 │
│     ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│     │  OBSERVER   │  │     ORG     │  │   AGENT     │           │
│     │    MODE     │  │    MODE     │  │    MODE     │           │
│     │ (view only) │  │ (control    │  │ (control    │           │
│     │             │  │  one org)   │  │  one agent) │           │
│     └─────────────┘  └─────────────┘  └─────────────┘           │
│                                                                  │
│     Game modes are VIEWS into the simulation, not separate games │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### The World Runs Without You

- Tick the simulation 500 times → A city with history emerges
- Organizations rise and fall
- Agents are born, work, retire, die
- Missions are created, accepted, completed, failed
- Power dynamics shift
- All of this happens with NO player input

### Player Modes = Control Override

When a player enters "Org Mode":
- They take control of ONE organization (any type: corp, gang, cult, fixer crew, etc.)
- They become the "leader agent" of that org
- That org's AI is replaced by player decisions
- Everything else continues autonomously
- The player is just one actor in a living world

---

## Time System

### Phase-Based Ticks

```
PHASE = Basic unit of simulation time

1 Day    = 4 phases  (Dawn, Day, Dusk, Night)
1 Week   = 28 phases
1 Month  = 112 phases (4 weeks)
1 Year   = 1344 phases (12 months)
```

### Tick Processing Order

Each phase tick processes in this order (agent-first):

```
1. AGENT TICK (Primary Driver)
   └─> Each agent processes their current action
   └─> Agents on missions contribute progress
   └─> Agents heal, age, gain experience
   └─> Agent-to-agent interactions resolve
   └─> Unemployed agents seek work or found orgs
   └─> Personal goals evaluated and pursued

2. ENCOUNTER TICK
   └─> Check for agent proximity at locations
   └─> Mission collisions detected
   └─> Confrontations resolved (combat/social/tech)
   └─> Relationship changes applied

3. LEADERSHIP TICK (Org decisions via agents)
   └─> Leaders evaluate org + personal goals
   └─> Leadership council consulted (per decisionStyle)
   └─> Missions generated based on leader decisions
   └─> Agent assignments made by leader
   └─> Internal politics processed (challenges, betrayals)

4. MISSION TICK
   └─> Active missions progress (team dynamics applied)
   └─> Missions resolve (success/failure)
   └─> Rewards/penalties distributed to agents AND orgs

5. ECONOMY TICK
   └─> Location income processed (timing varies by location/operation)
   └─> Business deals executed
   └─> Weekly: Salaries, rent, maintenance paid (on week rollover)
   └─> Personal wealth updated

6. LOCATION TICK
   └─> Location ownership changes
   └─> Location income generated
   └─> Location security updates
   └─> Agent presence tracked

7. WORLD TICK
   └─> Random events (affect agents, ripple to orgs)
   └─> Day/Week/Month/Year rollovers
   └─> Global stat updates
   └─> Activity log finalization
```

---

## Entity System

### Tags Over Types

Instead of hardcoded types (OrgType, LocationType, MissionType), entities use **tags**. Tags are strings defined in data files, and behaviors are attached to tags.

```typescript
// BAD: Hardcoded types requiring code changes
type OrgType = "corporation" | "gang" | "syndicate";  // Adding new type = code change

// GOOD: Tag-based system, fully data-driven
interface Entity {
  id: string;
  name: string;
  template: string;           // "gang", "corporation" - but just a string, not an enum
  tags: string[];             // ["criminal", "violent", "territorial", "street-level"]
  created: number;
  destroyed?: number;
  relationships: Relationship[];
}
```

**Why tags?**
- Adding a new "type" = adding a new template JSON file
- Behaviors attach to tags, not types
- Entities can have multiple overlapping behaviors
- Designers can experiment without code changes

### Template System

Templates are JSON files that define defaults for entity creation:

```typescript
// Templates are DATA, not CODE
interface EntityTemplate {
  id: string;                    // "gang", "corporation", etc.
  name: string;                  // Display name
  description: string;

  // What tags entities of this template get
  tags: string[];

  // Default values (all overridable)
  defaults: Record<string, any>;

  // Constraints (for validation)
  constraints?: Record<string, Constraint>;
}

// The simulation doesn't know about "gangs" or "corporations"
// It only knows about entities with tags and behaviors
```

### Behavior System

Behaviors are attached to **tags**, not types:

```typescript
interface Behavior {
  id: string;
  name: string;

  // Which tags trigger this behavior
  triggerTags: string[];         // e.g., ["violent"] or ["criminal", "territorial"]
  matchMode: "any" | "all";      // Any tag matches, or all tags required

  // What the behavior does
  type: "modifier" | "action" | "reaction" | "constraint";

  // Behavior-specific config
  config: Record<string, any>;
}

// Example behaviors in data/behaviors/*.json:
const EXAMPLE_BEHAVIORS = {
  aggressive_expansion: {
    triggerTags: ["territorial"],
    matchMode: "any",
    type: "modifier",
    config: {
      missionPreference: { raid: 1.5, negotiate: 0.5 },
      goalWeight: { expand_territory: 2.0 }
    }
  },

  heat_averse: {
    triggerTags: ["legitimate"],
    matchMode: "any",
    type: "constraint",
    config: {
      maxHeat: 30,
      heatReductionPriority: 2.0
    }
  },

  violent_confrontation: {
    triggerTags: ["violent"],
    matchMode: "any",
    type: "reaction",
    config: {
      confrontationType: "combat",
      escalationThreshold: 0.3
    }
  }
};
```

### How It Works in Practice

```
DESIGNER WANTS TO ADD: "Techno-Cult" organization type

OLD WAY (type-based):
1. Add "techno_cult" to OrgType enum in code
2. Add behavior weights in code
3. Add location preferences in code
4. Rebuild and deploy
5. Hope you didn't break anything

NEW WAY (tag-based):
1. Create data/templates/orgs/techno_cult.json:
   {
     "id": "techno_cult",
     "name": "Techno-Cult",
     "tags": ["criminal", "ideological", "tech-focused", "secretive"],
     "defaults": {
       "decisionStyle": "consensus",
       "startingCredits": { "min": 10000, "max": 30000 }
     }
   }
2. Existing behaviors already apply:
   - "criminal" tag → existing criminal behaviors
   - "ideological" tag → existing loyalty/fanaticism behaviors
   - "tech-focused" tag → existing tech preference behaviors
3. Optionally add new behaviors specific to this combo
4. Reload config, generate new world, see how it plays

NO CODE CHANGES REQUIRED.
```

### Relationship Types Are Also Tags

```typescript
interface Relationship {
  targetId: string;
  tags: string[];              // ["employer", "trusted"] or ["enemy", "blood-feud"]
  strength: number;            // -100 to +100
  since: number;
}

// Relationship behaviors trigger on relationship tags
// e.g., "blood-feud" tag might prevent any negotiation
// e.g., "mentor" tag might boost skill growth
```

### Tag Registry

Designers manage all tags in a central registry:

```json
// data/registry/tags.json
{
  "organization": {
    "structure": ["hierarchical", "flat", "cellular", "networked"],
    "legality": ["legitimate", "criminal", "gray-market"],
    "methods": ["violent", "diplomatic", "technical", "economic"],
    "focus": ["territorial", "ideological", "profit-driven", "service-based"],
    "scale": ["street-level", "city-wide", "regional", "global"]
  },
  "agent": {
    "role": ["combat", "tech", "social", "support", "leadership"],
    "background": ["military", "corporate", "street", "academic", "government"],
    "traits": ["loyal", "ambitious", "cautious", "reckless", "greedy"]
  },
  "location": {
    "function": ["income", "storage", "operations", "residence", "front"],
    "security": ["fortified", "hidden", "public", "monitored"],
    "legality": ["legal", "questionable", "illegal"]
  },
  "mission": {
    "approach": ["violent", "stealth", "social", "technical"],
    "risk": ["low-risk", "moderate-risk", "high-risk", "suicide-mission"],
    "duration": ["quick", "extended", "ongoing"]
  },
  "relationship": {
    "professional": ["employer", "employee", "contractor", "partner"],
    "personal": ["friend", "rival", "mentor", "family"],
    "adversarial": ["enemy", "target", "blood-feud"]
  }
}
```

### Designer Tools for Tags

```typescript
interface TagManager {
  // Browse all tags
  listTags(category?: string): Tag[];

  // See what behaviors a tag triggers
  getBehaviorsForTag(tag: string): Behavior[];

  // See all entities with a tag
  getEntitiesWithTag(tag: string): Entity[];

  // Add a new tag (just data, no code)
  addTag(category: string, tag: string, description: string): void;

  // Deprecate a tag (warn if used, suggest replacement)
  deprecateTag(tag: string, replacement?: string): void;

  // Analyze tag usage
  getTagStats(): TagUsageReport;
}

// Example: "What happens if I tag an org as 'violent'?"
tagManager.getBehaviorsForTag("violent");
// Returns:
// - violent_confrontation: Prefers combat over negotiation
// - aggressive_response: Retaliates against slights
// - intimidation_bonus: +20% to extortion missions
// - heat_generation: +50% heat from all activities
```

### Composable Behaviors

The power of tags is **composition**. An entity's behavior emerges from its tag combination:

```
Gang "Black Dragons":
  tags: ["criminal", "violent", "territorial", "street-level"]

Behaviors applied:
  From "criminal":     → Cannot use legal income streams, attracts heat
  From "violent":      → Prefers combat, intimidation bonus
  From "territorial":  → Prioritizes location control, aggressive expansion
  From "street-level": → Lower resources, faster recruitment, local knowledge

These combine to create emergent "gang behavior" without hardcoding "gang" anywhere.
```

```
Corporation "NeoSynth":
  tags: ["legitimate", "hierarchical", "profit-driven", "technical"]

Behaviors applied:
  From "legitimate":    → Legal income only, low heat tolerance
  From "hierarchical":  → Clear chain of command, slower decisions
  From "profit-driven": → Prioritizes wealth goals
  From "technical":     → Research bonuses, tech mission preference

These combine to create emergent "corp behavior" without hardcoding "corporation".
```

### Removing/Changing Types

```
DESIGNER WANTS TO: Split "gang" into "street gang" and "biker gang"

1. Create two new templates:
   data/templates/orgs/street_gang.json
   data/templates/orgs/biker_gang.json

2. Give them different tag combinations:
   street_gang: ["criminal", "violent", "territorial", "street-level", "urban"]
   biker_gang: ["criminal", "violent", "territorial", "mobile", "rural-capable"]

3. Optionally add new behaviors for new tags:
   "mobile": Vehicle bonuses, can relocate easily
   "urban": City navigation bonus, public transit access

4. Deprecate old template (optional):
   Set "gang" template to deprecated, suggest replacements

5. Existing "gang" entities keep working
   New generation uses new templates

NO MIGRATION REQUIRED. Old and new coexist.
```

---

## Core Entities

### 1. Organizations

Organizations are **emergent structures** created and run by agents. They provide:
- Shared resources (credits, locations, equipment)
- Collective identity and reputation
- Hierarchical command structure
- Legal/illegal cover for activities

**Key insight**: An org's "behavior" is actually its leader's behavior, modified by leadership dynamics and the org's tags.

```typescript
interface Organization extends Entity {
  // template: string (inherited from Entity) - e.g., "gang", "corporation"
  // tags: string[] (inherited) - e.g., ["criminal", "violent", "territorial"]

  // Resources
  resources: {
    credits: number;
    influence: number;    // Political/social power
    territory: number;    // Physical control (locations owned)
    reputation: number;   // Public perception (-100 to +100)
    heat: number;         // Law enforcement attention
  };

  // Leadership structure
  leader: AgentRef;       // Single leader (CEO, boss, chief, etc.)
  leadership: AgentRef[]; // Lieutenants, executives, captains (includes leader)
  members: AgentRef[];    // All members (includes leadership)

  // Assets
  vehicles: VehicleRef[];
  locations: LocationRef[]; // Owned/controlled locations

  // Behavior (derived from leadership)
  goals: OrgGoal[];       // Set by leader, may conflict with agent goals
  enemies: OrgRef[];      // Org-level enmity (agents may have personal enemies)
  allies: OrgRef[];

  // Economics
  income: IncomeSource[];
  expenses: Expense[];

  // Decision Making is determined by tags, not a separate field
  // e.g., tags might include "autocratic" or "council-led" or "consensus-driven"
}

// NOTE: Everything is tags. Templates like "gang", "corporation" are defined
// in data/templates/orgs/ and specify which tags the org gets.
//
// Decision style tags (org picks one):
//   "autocratic"      - Leader decides alone
//   "council-led"     - Leadership votes
//   "consensus-driven" - All leadership must agree
//   "democratic"      - All members vote
//
// These are just tags with attached behaviors, not special enums.

interface OrgGoal {
  type: GoalType;
  target?: EntityRef;
  priority: number;
  progress: number;
}

type GoalType =
  | "expand_territory"
  | "increase_wealth"
  | "destroy_enemy"
  | "protect_asset"
  | "recruit_talent"
  | "reduce_heat"
  | "gain_influence"
  | "complete_mission_chain"; // Win condition for fixer mode
```

### Organization Behavior (Leader Tags + Org Tags)

Org behavior emerges from **combining leader agent tags with org tags**:

```
EFFECTIVE BEHAVIOR = Leader Agent Tags + Org Tags
```

**Org Tags** (what the organization is):
| Tag | Effect |
|-----|--------|
| `legitimate` | Legal income only, low heat tolerance |
| `criminal` | Illegal income available, attracts heat |
| `violent` | Combat missions available, intimidation bonus |
| `territorial` | Prioritizes location control |
| `tech-focused` | Research bonuses, cyber warfare |
| `street-level` | Local knowledge, limited resources |

**Leader Agent Tags** (who is running it):
| Tag | Effect on Decisions |
|-----|---------------------|
| `aggressive` | +weight to violent missions, faster escalation |
| `cautious` | -weight to risky missions, more planning |
| `greedy` | +weight to profit goals, may embezzle |
| `ambitious` | +weight to expansion, may overreach |
| `loyal` | Prioritizes org goals over personal |
| `charismatic` | Better recruitment, alliance success |
| `paranoid` | More security spending, suspects betrayal |
| `ruthless` | Willing to sacrifice agents, no mercy |

**How they combine:**

```typescript
// Leader with "aggressive" + Org with "violent"
// → Very high combat preference, rapid escalation

// Leader with "cautious" + Org with "violent"
// → Still capable of violence, but picks battles carefully

// Leader with "greedy" + Org with "legitimate"
// → Looks for legal profit, but might cut corners

// Leader with "greedy" + Org with "criminal"
// → Goes for big scores, high risk tolerance
```

**The simulation calculates effective weights:**
```typescript
function getEffectiveBehavior(org: Organization, leader: Agent): BehaviorWeights {
  const orgBehaviors = getBehaviorsForTags(org.tags);
  const leaderBehaviors = getBehaviorsForTags(leader.tags);

  // Merge: leader modifies org baseline
  return mergeBehaviors(orgBehaviors, leaderBehaviors);
}

// Example output:
// {
//   missionPreference: { violent: 1.8, stealth: 0.9, social: 0.6 },
//   riskTolerance: 0.7,
//   expansionDrive: 1.2,
//   loyaltyExpectation: 0.5
// }
```

**Leadership changes = behavior changes.** When a new leader takes over, the org's effective behavior shifts based on who they are.

### Organization Infrastructure Preferences

Location preferences are determined by **tag matching**, not hardcoded tables:

```json
// data/behaviors/location_preferences.json
{
  "legitimate_locations": {
    "triggerTags": ["legitimate"],
    "config": {
      "preferred": ["office", "retail", "factory", "research-lab"],
      "avoided": ["safehouse", "drug-lab", "chop-shop"],
      "bonus": 1.2  // 20% efficiency bonus at preferred locations
    }
  },
  "criminal_hideouts": {
    "triggerTags": ["criminal"],
    "config": {
      "preferred": ["safehouse", "warehouse", "nightclub"],
      "avoided": ["government-building", "precinct"],
      "bonus": 1.2
    }
  },
  "tech_infrastructure": {
    "triggerTags": ["tech-focused"],
    "config": {
      "preferred": ["server-farm", "research-lab", "workshop"],
      "bonus": 1.5  // Higher bonus for specialized infrastructure
    }
  },
  "territorial_presence": {
    "triggerTags": ["territorial"],
    "config": {
      "preferred": ["street-corner", "bar", "nightclub"],
      "reason": "visible_presence"
    }
  }
}
```

**Locations are also tag-based.** A location template might have:
```json
{
  "id": "nightclub",
  "tags": ["income", "front", "social", "public", "legal"],
  "defaults": { "baseIncome": 500, "security": 20 }
}
```

The simulation matches org tags to location tags for compatibility.

**Organization Decision Loop** (each tick, driven by leader):
```
1. LEADER evaluates org goals vs personal goals
   └─> Leader's personality affects priority weighting
   └─> High-ambition leaders may prioritize personal gain

2. LEADERSHIP COUNCIL consulted (based on decisionStyle)
   └─> autocratic: Leader decides alone
   └─> council: Lieutenants vote, leader breaks ties
   └─> Dissenters may reduce execution quality or leak info

3. Generate missions to achieve chosen goals
   └─> Mission type influenced by leader's preferred stats
   └─> Aggressive leaders favor combat missions

4. Assign agents to missions
   └─> Leader's relationships affect assignments
   └─> Favorites get plum jobs, rivals get dangerous ones

5. Process completed missions
   └─> Success/failure affects leader's standing
   └─> Repeated failures may trigger leadership challenges

6. Update relationships based on events
   └─> Leader tracks who succeeded/failed
   └─> Grudges and favorites emerge

7. Recruit if understaffed
   └─> Leader's Social stat affects recruitment success

8. Handle internal politics
   └─> Ambitious lieutenants may scheme
   └─> Low-loyalty agents may defect
   └─> Leadership challenges if leader is weak/unpopular
```

### 2. Agents

Individual actors in the simulation. Agents have **stats** (capabilities) and **tags** (personality/traits).

```typescript
interface Agent extends Entity {
  // template: string (inherited) - e.g., "combat_specialist", "hacker", "executive"
  // tags: string[] (inherited) - personality + role tags like ["aggressive", "greedy", "combat"]

  // Status (could also be a tag, but kept as field for quick filtering)
  status: string;         // "available", "employed", "on_mission", "wounded", etc.
  age: number;            // In phases (or years for display)

  // Stats - 6 numbers that determine task outcomes
  stats: {
    force: number;        // Combat, intimidation, physical power
    mobility: number;     // Stealth, infiltration, agility, escape
    tech: number;         // Hacking, electronics, digital systems
    social: number;       // Negotiation, leadership, manipulation
    business: number;     // Economics, trade, management, logistics
    engineering: number;  // Research, manufacturing, repair, construction
  };

  // Employment
  employer?: OrgRef;
  salary: number;

  // Wallet (personal finances)
  wallet: Wallet;

  // Current activity
  currentAction?: Action;

  // Mood (simple numbers, not personality - personality is in tags)
  morale: number;         // -100 to +100
}
```

**Stats** (capabilities - what they CAN do):
| Stat | Used For |
|------|----------|
| Force | Combat, intimidation, physical tasks |
| Mobility | Stealth, escape, infiltration |
| Tech | Hacking, electronics, cyber |
| Social | Negotiation, leadership, recruitment |
| Business | Trade, economics, management |
| Engineering | R&D, manufacturing, repair |

**Tags** (personality - what they WANT to do, how they do it):
| Tag | Effect on Agent Behavior |
|-----|--------------------------|
| `aggressive` | Prefers violent solutions, quick to fight |
| `cautious` | Avoids risk, plans carefully |
| `greedy` | Prioritizes money, may steal from employer |
| `ambitious` | Wants advancement, may scheme for leadership |
| `loyal` | Sticks with employer, resists bribes |
| `reckless` | Takes big risks, ignores danger |
| `paranoid` | Suspects everyone, hard to recruit |
| `charismatic` | Influences others, good at recruitment |
| `ruthless` | No moral limits, will do anything |
| `idealistic` | Driven by beliefs, may refuse certain jobs |

**Role tags** (what they specialize in):
| Tag | Meaning |
|-----|---------|
| `combat` | Specialist in violence |
| `infiltrator` | Specialist in stealth |
| `hacker` | Specialist in tech |
| `face` | Specialist in social |
| `fixer` | Generalist, can do many things |
| `leadership` | Can run an org or team |

**Combining stats and tags:**
```typescript
// Agent with high Force stat + "aggressive" tag
// → Very effective in combat AND prefers combat solutions

// Agent with high Force stat + "cautious" tag
// → Very effective in combat BUT avoids fights unless necessary

// Agent with low Force stat + "aggressive" tag
// → Prefers fighting but not good at it (dangerous to self)
```

**Agent Decision Loop** (when unemployed):
```
1. Evaluate offers from organizations
2. Consider org reputation, pay, risk
3. Accept best offer matching personality
4. OR become freelance (take odd jobs)
5. OR retire if old/wealthy enough
6. OR turn to crime if desperate
7. OR found own organization (if high ambition + resources)
```

### Agent Founding Organizations

Agents can found new orgs if they have the right **tags** and **resources**:

```typescript
// Requirements defined in data, checked via tags
interface OrgFoundingCheck {
  // Must have these tags
  requiredTags: ["ambitious", "leadership"];

  // Must have minimum stats
  minStats: { social: 40 };

  // Must have resources
  minCredits: 10000;

  // Must be free
  status: "available";

  // Must have contacts (positive relationships)
  minPositiveRelationships: 3;
}

// Different org templates may have different requirements (in data):
// gang template: requiredTags includes "violent" or "street"
// corp template: minStats.business >= 50
// fixer_crew template: completedMissions >= 10
```

The new org inherits some tags from its founder's personality.

---

## Agent Interaction System

Agents interact through multiple channels. Every interaction affects relationships and can trigger cascading effects.

### Interaction Types

```typescript
type InteractionType =
  // Cooperative
  | "mission_teamwork"     // Working together on a mission
  | "negotiation"          // Business deal, treaty, trade
  | "mentorship"           // Senior teaching junior
  | "collaboration"        // Joint research/project
  | "social"               // Casual interaction at location

  // Competitive
  | "mission_opposition"   // On opposing sides of a mission
  | "confrontation"        // Direct conflict (combat or social)
  | "rivalry"              // Competing for same goal/position
  | "negotiation_adversarial" // Hostile negotiation

  // Hierarchical
  | "command"              // Leader giving orders
  | "report"               // Subordinate reporting to leader
  | "recruitment"          // Trying to hire/poach agent
  | "challenge"            // Challenging for leadership position

  // Information
  | "intel_share"          // Sharing information
  | "intel_trade"          // Trading secrets
  | "betrayal"             // Leaking info to enemies
  | "deception";           // Lying in negotiation

interface Interaction {
  id: string;
  phase: number;
  type: InteractionType;
  participants: AgentRef[];      // All agents involved
  initiator: AgentRef;           // Who started it
  location?: LocationRef;        // Where it happened
  context?: MissionRef | OrgRef; // What prompted it

  outcome: InteractionOutcome;
  relationshipChanges: RelationshipDelta[];
}

interface InteractionOutcome {
  success: boolean;              // Did initiator achieve their goal?
  winner?: AgentRef;             // For competitive interactions
  consequences: Consequence[];   // What happened as a result
}
```

### Encounter System

When agents are in proximity (same location, same mission, or through org business), encounters can occur:

```typescript
interface Encounter {
  phase: number;
  location: LocationRef;
  agents: AgentRef[];
  trigger: EncounterTrigger;
  interactions: Interaction[];
}

type EncounterTrigger =
  | "mission_collision"    // Opposing teams meet during mission
  | "location_presence"    // Agents happen to be at same location
  | "scheduled_meeting"    // Planned negotiation/trade
  | "pursuit"              // One agent chasing another
  | "ambush"               // Deliberate trap
  | "random";              // Chance meeting

// Example: Mission Collision
// Agent team from Yakuza doing "theft" mission at NeoSynth warehouse
// Agent team from NeoSynth doing "patrol" mission at same warehouse
// → Encounter triggered with type "mission_collision"
// → Confrontation interaction occurs
// → Combat or social resolution based on agent stats/personality
```

### Mission Team Dynamics

When multiple agents work together on a mission:

```typescript
interface MissionTeam {
  members: AgentRef[];
  teamLead: AgentRef;          // Highest-ranking or best Social

  // Team dynamics affect mission success
  dynamics: {
    cohesion: number;          // Average mutual relationship strength
    skillSynergy: number;      // How well skills complement
    leadershipQuality: number; // Team lead's Social + relationships
    conflictRisk: number;      // Chance of internal problems
  };
}

// During mission execution:
// - High cohesion → bonus to all rolls
// - Low cohesion → chance of complications
// - Negative relationships → may sabotage each other
// - One agent may betray team if loyalty is low and reward is high
```

### Confrontation Resolution

When agents directly oppose each other:

```typescript
interface Confrontation {
  type: "combat" | "social" | "technical";
  attackers: AgentRef[];
  defenders: AgentRef[];

  // Resolution based on confrontation type
  combatResolution: {
    attackerForce: number;      // Sum of Force stats + equipment
    defenderForce: number;
    environmentMod: number;     // Location security, terrain
    // Winner determined by stat comparison + roll
    // Losers may be: wounded, captured, killed, or flee
  };

  socialResolution: {
    attackerSocial: number;     // Persuasion/Intimidation attempt
    defenderSocial: number;     // Resistance
    reputationMod: number;      // Known reputation affects leverage
    // Winner determined by stat comparison + roll
    // Loser may: concede, retreat, escalate to combat, or hold firm
  };

  technicalResolution: {
    attackerTech: number;       // Hacking/counter-hacking
    defenderTech: number;
    systemDifficulty: number;   // Target system's security
    // Winner gains/denies access
    // Loser may: be traced, locked out, or data corrupted
  };
}
```

### Business Interactions

Agents conduct business both for their org and personally:

```typescript
interface BusinessDeal {
  parties: AgentRef[];           // Agents negotiating (may represent orgs)
  representingOrgs?: OrgRef[];   // If acting on org's behalf

  dealType:
    | "trade"           // Exchange goods/services
    | "contract"        // Ongoing arrangement
    | "loan"            // Credit extended
    | "alliance"        // Org-level agreement (requires authority)
    | "bribe"           // Illicit payment for favor
    | "extortion"       // Payment under duress
    | "recruitment";    // Job offer

  terms: {
    creditFlow: number;          // Money changing hands
    servicesExchanged: string[];
    duration?: number;           // Phases (for ongoing deals)
    penalties: PenaltyTerms;     // What happens on breach
  };

  // Negotiation uses Social stat
  // High Business stat understands value better (won't get cheated)
  // Personality affects willingness to accept terms
  negotiationRounds: NegotiationRound[];
  finalOutcome: "accepted" | "rejected" | "escalated";
}
```

### Research & Collaboration

Agents with high Engineering or Tech can collaborate on projects:

```typescript
interface ResearchProject {
  id: string;
  name: string;
  type: "tech_development" | "intel_analysis" | "equipment_design" | "strategy_planning";

  // Requirements
  requiredSkills: {
    engineering?: number;
    tech?: number;
    business?: number;  // For market research
  };

  // Team
  leadResearcher: AgentRef;
  collaborators: AgentRef[];

  // Progress
  progressRequired: number;
  currentProgress: number;

  // Each phase, collaborators contribute:
  // progress += sum(relevant_stat * efficiency_modifier)
  // Efficiency affected by:
  // - Relationship between collaborators (friends work better together)
  // - Location quality (research lab vs safehouse)
  // - Interruptions (being on missions reduces contribution)

  outcome?: ResearchOutcome;
}

// Collaboration can lead to:
// - New equipment designs
// - Intel on enemy organizations
// - Improved processes (org efficiency bonuses)
// - Personal bonds between researchers
```

### Relationship Evolution

Relationships change through interactions:

```typescript
interface RelationshipDelta {
  agent1: AgentRef;
  agent2: AgentRef;
  phase: number;

  previousStrength: number;
  newStrength: number;

  cause: {
    interaction: InteractionRef;
    reason: RelationshipChangeReason;
  };
}

type RelationshipChangeReason =
  // Positive
  | "mission_success_together"   // +5 to +15
  | "saved_life"                 // +20 to +40
  | "mentored"                   // +10 to +20
  | "fair_deal"                  // +5 to +10
  | "shared_enemy_defeated"      // +10 to +20
  | "promoted_by"                // +15 to +25

  // Negative
  | "mission_failure_blamed"     // -10 to -30
  | "betrayed"                   // -50 to -100
  | "cheated_in_deal"            // -20 to -40
  | "rival_for_position"         // -10 to -20
  | "killed_friend"              // -40 to -80
  | "demoted_by"                 // -15 to -25

  // Decay
  | "time_passed"                // Gradual drift toward neutral
  | "no_contact";                // Faster drift if never interact

// Strong relationships (>50) decay slowly
// Weak relationships (<-50) can become permanent grudges
// Neutral relationships (-20 to +20) are volatile
```

### Agent Personal Goals

Agents have personal goals independent of their org:

```typescript
interface PersonalGoal {
  type: PersonalGoalType;
  priority: number;           // 1-100, affects decision weighting
  target?: EntityRef;
  progress: number;

  // Goals may conflict with org goals
  // High loyalty → suppress personal goals
  // Low loyalty + high ambition → pursue personal goals
}

type PersonalGoalType =
  | "wealth_accumulation"     // Save X credits personally
  | "revenge"                 // Harm specific agent/org
  | "protection"              // Keep specific agent/location safe
  | "advancement"             // Rise in org hierarchy
  | "independence"            // Leave org, go freelance
  | "found_org"               // Start own organization
  | "retire"                  // Leave the life safely
  | "mastery"                 // Max out a specific stat
  | "reputation"              // Become famous/infamous
  | "romance"                 // Form bond with specific agent
  | "family"                  // Protect family members (if any)
  | "ideology";               // Advance a cause (for cult members, idealists)
```

### 3. Locations

Physical places in the city. Like all entities, locations use **tags** instead of hardcoded types.

```typescript
interface Location extends Entity {
  // template: string (inherited) - e.g., "nightclub", "safehouse"
  // tags: string[] (inherited) - e.g., ["income", "front", "social", "public"]

  // Position (no visual map, but logical positioning)
  sector: string;
  district: string;
  coordinates: {
    distance: number;     // From city center
    vertical: number;     // Building floor (0 = ground)
  };

  // Properties (from template defaults, can be overridden)
  size: number;           // 1-5 scale, affects capacity
  security: number;       // 0-100

  // Ownership
  owner?: OrgRef;
  previousOwners: { org: OrgRef; from: number; to: number }[];

  // Economics
  baseIncome: number;
  operatingCost: number;

  // Capacity
  agentCapacity: number;
  vehicleCapacity: number;

  // Current state
  occupants: AgentRef[];
  vehicles: VehicleRef[];
}

// NOTE: LocationType is NOT an enum - it's a template string
// Templates are defined in data/templates/locations/*.json
// Example location template:
// {
//   "id": "nightclub",
//   "name": "Nightclub",
//   "tags": ["income", "front", "social", "public", "legal", "entertainment"],
//   "defaults": {
//     "size": 3,
//     "security": 20,
//     "baseIncome": 500,
//     "operatingCost": 200,
//     "agentCapacity": 10
//   }
// }
```

**Location tags determine functionality:**
| Tag | Effect |
|-----|--------|
| `income` | Generates credits each phase |
| `front` | Provides legal cover for org activities |
| `hidden` | Hard to find, good for safehouses |
| `fortified` | Defense bonus, harder to raid |
| `production` | Can manufacture goods |
| `storage` | Can hold inventory |
| `research` | Enables R&D projects |
| `public` | Visible to everyone, can't hide activities |
| `illegal` | Attracts heat if discovered |

### 4. Missions

Tasks created by leaders, executed by agents. Missions use **tags** for classification.

```typescript
interface Mission extends Entity {
  // template: string (inherited) - e.g., "heist", "raid", "negotiation"
  // tags: string[] (inherited) - e.g., ["violent", "high-risk", "stealth"]

  // Origin
  creator: OrgRef;
  createdPhase: number;

  // Visibility (also could be a tag)
  visibility: "public" | "private" | "secret";

  // Requirements (from template, can be overridden)
  requirements: {
    stats: Record<string, number>;  // e.g., { force: 50, mobility: 30 }
    minAgents: number;
    maxAgents: number;
    requiredTags?: string[];        // Agent must have these tags
    equipment?: EquipmentReq[];
  };

  // Target
  target?: {
    entityId: string;
    targetTags?: string[];          // What kind of target
  };

  // Timing
  deadline?: number;
  estimatedDuration: number;

  // Rewards/Penalties (from template)
  rewards: Record<string, number>;
  failurePenalties: Record<string, number>;

  // Execution
  status: string;                   // "available", "in_progress", "completed", etc.
  assignedOrg?: OrgRef;
  assignedAgents: AgentRef[];
  progress: MissionProgress;

  outcome?: MissionOutcome;
}

// NOTE: MissionType is NOT an enum - it's a template string
// Mission templates defined in data/templates/missions/*.json
// Example:
// {
//   "id": "heist",
//   "name": "Heist",
//   "tags": ["theft", "high-risk", "high-reward", "stealth"],
//   "defaults": {
//     "requirements": { "stats": { "mobility": 40, "tech": 30 }, "minAgents": 3 },
//     "estimatedDuration": 4,
//     "rewards": { "credits": 10000 },
//     "failurePenalties": { "heat": 30, "reputation": -10 }
//   }
// }
```

**Mission tags determine behavior:**
| Tag | Effect |
|-----|--------|
| `violent` | Uses Force stat, may cause casualties, generates heat |
| `stealth` | Uses Mobility stat, failure = detection |
| `technical` | Uses Tech stat, requires equipment |
| `social` | Uses Social stat, no direct violence |
| `high-risk` | Greater chance of agent loss, higher rewards |
| `ongoing` | Continuous operation, no fixed end |
| `quick` | Resolves in 1-2 phases |
| `extended` | Takes many phases, more complications |

type MissionStatus =
  | "available"         // Posted, waiting for takers
  | "assigned"          // Org has accepted
  | "in_progress"       // Agents actively working
  | "completed"         // Success
  | "failed"            // Failure
  | "expired"           // Deadline passed
  | "cancelled";        // Creator withdrew

interface MissionProgress {
  phaseStarted?: number;
  phasesElapsed: number;
  forceAccumulated: number;
  stealthAccumulated: number;
  techAccumulated: number;
  socialAccumulated: number;
  complications: Complication[];
  currentPhase: "travel" | "execution" | "extraction";
}
```

### 5. Vehicles

Transportation and mobile assets. Like all entities, vehicles use **tags** instead of hardcoded types.

```typescript
interface Vehicle extends Entity {
  // template: string (inherited) - e.g., "sedan", "helicopter", "armored_vehicle"
  // tags: string[] (inherited) - e.g., ["ground", "fast", "stealthy"]

  owner?: OrgRef;
  operator?: AgentRef;

  stats: {
    speed: number;
    capacity: number;     // Agent slots
    armor: number;
    stealth: number;
    cargo: number;        // Equipment/goods capacity
  };

  condition: number;      // 0-100, degrades with use
  location?: LocationRef;

  maintenanceCost: number; // Per week
}

// NOTE: VehicleType is NOT an enum - it's a template string
// Templates are defined in data/templates/vehicles/*.json
// Example:
// {
//   "id": "armored_vehicle",
//   "name": "Armored Vehicle",
//   "tags": ["ground", "armored", "slow", "high-capacity"],
//   "defaults": {
//     "speed": 40, "capacity": 8, "armor": 80, "stealth": 10, "cargo": 20
//   }
// }
```

---

## Economy System

The economy is the lifeblood of the simulation. Every entity needs money, and money flows through goods, services, and violence.

### Currency & Wealth

```typescript
// Credits are the universal currency
// 1 credit ≈ $100 USD equivalent for mental model

interface Wallet {
  credits: number;           // Liquid cash
  accounts: BankAccount[];   // Can be frozen, traced
  stashes: CashStash[];      // Hidden physical cash (can be found/stolen)
}

// Agents have personal wealth separate from org resources
interface AgentFinances {
  wallet: Wallet;
  salary: number;            // Per WEEK from employer (paid on week rollover)
  missionCuts: number;       // Percentage of mission rewards
  debts: Debt[];             // Money owed to others
  assets: PersonalAsset[];   // Owned property, vehicles, gear
}
```

### Income Sources

#### Agent Income
```typescript
type AgentIncomeSource =
  | "salary"           // Regular pay from employer
  | "mission_cut"      // Percentage of mission rewards (typically 5-20%)
  | "personal_deal"    // Side business, personal contracts
  | "investment"       // Returns from business investments
  | "theft"            // Stolen goods/cash
  | "extortion"        // Protection money, blackmail
  | "inheritance"      // From dead relatives/associates
  | "gambling";        // Wins (and losses)

// Salary ranges by role (per WEEK, paid on week rollover)
const SALARY_RANGES = {
  unskilled: { min: 100, max: 300 },     // Factory workers, basic labor
  skilled: { min: 300, max: 600 },       // Requires some stats (Tech for research, etc.)
  specialist: { min: 600, max: 1500 },   // High-stat operatives
  lieutenant: { min: 1500, max: 4000 },  // Leadership roles
  executive: { min: 4000, max: 10000 },  // Senior management
  leader: { min: 0, max: 0 },            // Leaders take profits, not salary
};
```

#### Organization Income
```typescript
type OrgIncomeSource =
  | "legitimate_business"  // Legal revenue streams
  | "protection_racket"    // Extortion
  | "smuggling"            // Contraband trade
  | "drug_trade"           // Narcotics
  | "gambling_operation"   // Casinos, bookmaking
  | "data_brokerage"       // Selling information
  | "contract_work"        // Mercenary, hacking services
  | "manufacturing"        // Legal or illegal goods
  | "theft_fencing"        // Selling stolen goods
  | "investment_returns";  // Interest, dividends

interface IncomeStream {
  type: OrgIncomeSource;
  location?: LocationRef;   // Where income is generated
  baseAmount: number;       // Credits per timing interval
  timing: IncomeTiming;     // When income is generated
  volatility: number;       // How much it fluctuates (0-1)
  risk: number;             // Chance of attracting heat
  requirements: {
    agents: number;         // Staff needed to operate
    minSkill?: StatRequirement;
  };
}

// Income timing - different operations generate at different intervals
type IncomeTiming =
  | "per_phase"     // High-frequency: vending, retail, continuous services
  | "per_day"       // Daily: restaurants, entertainment venues
  | "per_week"      // Weekly: protection rackets, regular contracts
  | "per_month";    // Monthly: rent, large contracts, investments
```

### Agent Employment & Jobs

Agents work jobs to earn money. Jobs range from unskilled labor to highly specialized roles.

```typescript
interface Job {
  id: string;
  title: string;
  employer: OrgRef;
  location: LocationRef;

  // Requirements
  skillRequirements: {
    stat?: string;          // Which stat is needed (if any)
    minValue?: number;      // Minimum stat value required
  };

  // Compensation
  salaryTier: "unskilled" | "skilled" | "specialist" | "lieutenant" | "executive";

  // What the job produces
  output?: {
    type: "income" | "research" | "production" | "security";
    value: number;          // Contribution per phase
  };
}

// Job tiers and their requirements
const JOB_TIERS = {
  unskilled: {
    // No stat requirements - anyone can do these
    // Factory work, manual labor, basic retail, janitorial
    examples: ["factory_worker", "warehouse_hand", "retail_clerk"],
    requirements: null,
  },

  skilled: {
    // Requires moderate stats - valuable but not rare
    // Technicians, drivers, security guards
    examples: ["technician", "driver", "security_guard", "mechanic"],
    requirements: { minStat: 30 },
  },

  specialist: {
    // Requires high stats - these agents are valuable targets
    // Researchers, hackers, enforcers, negotiators
    examples: ["researcher", "hacker", "enforcer", "negotiator"],
    requirements: { minStat: 50 },
  },

  // Lieutenant and Executive are leadership roles, not typical jobs
};
```

**Why this matters for gameplay:**

1. **Normal Economy**: Most agents work normal jobs. Corps employ researchers, factories employ workers.

2. **Agent Value**: High-stat agents are valuable. A researcher with Tech 70 is worth kidnapping.

3. **Poaching**: Orgs can try to hire away skilled agents from competitors.

4. **Capture**: In hostile missions, capturing a skilled agent can be more valuable than killing them.

5. **Workforce**: Orgs need workers. Losing your factory workers means losing production income.

```typescript
// Example: NeoSynth Corp employs agents
const neoSynthJobs = [
  // Unskilled - anyone can do these
  { title: "Assembly Line Worker", tier: "unskilled", location: factory, output: { type: "production", value: 10 } },
  { title: "Janitor", tier: "unskilled", location: hq, output: null },

  // Skilled - need some stats
  { title: "Security Guard", tier: "skilled", requirements: { stat: "force", minValue: 30 }, location: hq },
  { title: "Lab Technician", tier: "skilled", requirements: { stat: "tech", minValue: 30 }, location: lab },

  // Specialist - high value, worth stealing
  { title: "Senior Researcher", tier: "specialist", requirements: { stat: "engineering", minValue: 60 },
    output: { type: "research", value: 50 } },
  { title: "Netrunner", tier: "specialist", requirements: { stat: "tech", minValue: 60 },
    output: { type: "security", value: 30 } },
];

// A rival corp might target that Senior Researcher...
// Mission: "Extract Dr. Chen from NeoSynth" - kidnap, not kill
// If successful, the researcher now works for you (under duress or willingly)
```

### Goods Categories (Simplified)

The economy uses **16 broad goods categories** - not granular items. This keeps inventory simple while differentiating orgs by what they trade.

```typescript
// ~16 categories, each defined in data/goods/categories.json
// These are the starting categories - can add more via data

// WEAPONS & MILITARY
"small_arms"        // Pistols, SMGs, rifles
"heavy_weapons"     // Machine guns, launchers, military hardware
"explosives"        // Grenades, bombs, demolition charges
"armor"             // Body armor, protective gear

// CONTRABAND
"narcotics"         // Drugs, stims, illegal pharmaceuticals
"contraband"        // Restricted tech, stolen goods, black market items

// VEHICLES & PARTS
"vehicles"          // Cars, bikes, aircraft (whole units)
"vehicle_parts"     // Components, modifications, fuel

// CORPORATE & INDUSTRIAL
"electronics"       // Computers, hacking tools, surveillance
"data_storage"      // Servers, drives, storage media (holds non-tangible data)
"robotics"          // Drones, automated systems, cyberware
"industrial"        // Manufacturing equipment, raw materials
"medical"           // Pharmaceuticals, surgical equipment, biotech

// CONSUMER & LUXURY
"consumer_goods"    // Legal products, retail inventory
"luxury"            // High-value items, art, jewelry (good for fencing)
"provisions"        // Food, supplies, basic necessities
```

### Tangible vs Non-Tangible

**Core rule: Everything exists somewhere physically.**

```typescript
// TANGIBLE: Stored at Locations
interface Inventory {
  location: LocationRef;
  items: InventorySlot[];
}

interface InventorySlot {
  category: string;       // "small_arms", "narcotics", etc.
  quantity: number;       // Units (abstract, not individual items)
  value: number;          // Total credits value
  tags: string[];         // ["stolen", "military-grade", "traceable"]
}

// NON-TANGIBLE: Stored ON tangible data_storage
interface DataStore {
  location: LocationRef;           // Where the physical storage is
  storageCapacity: number;         // How much data can be held
  contents: DataItem[];
}

interface DataItem {
  id: string;
  type: string;           // "intel", "secrets", "blackmail", "research"
  value: number;
  about?: EntityRef;      // Who/what this data concerns
  encrypted: boolean;     // Harder to access if stolen
}

// EXAMPLE:
// NeoSynth Corp has secrets about their AI research
// → Stored as DataItem on their server farm (data_storage at HQ location)
// → Yakuza raids the location, steals the data_storage
// → Now Yakuza has the DataItem (can sell, use for blackmail, etc.)
// → NeoSynth loses access (unless they had backups elsewhere)
```

**This creates gameplay:**
- Want to steal data? Must raid the location with data_storage
- Want to protect secrets? Invest in security at that location
- Data can be copied (if you have access) but originals can be destroyed
- Encrypted data needs tech skill to decrypt

Each goods category has a base price defined in data. Prices fluctuate based on simple supply/demand:

```typescript
interface GoodsCategory {
  id: string;                   // "small_arms", "narcotics", etc.
  name: string;
  basePrice: number;            // Credits per unit
  legality: "legal" | "restricted" | "illegal";
  tags: string[];               // For behavior matching
}

// Market is simple: track supply/demand per category
interface Market {
  prices: Record<string, number>;    // Current price per category
  supply: Record<string, number>;    // Available in the city
  demand: Record<string, number>;    // Wanted by orgs
}

// Price fluctuation: price = basePrice * (demand / supply)
// Capped at 0.5x to 3x base price
```

### Trading

```typescript
// Orgs can buy/sell goods at locations with appropriate tags
// "market" tag = can buy/sell legally
// "black-market" tag = can buy/sell illegal goods (with heat risk)

interface Trade {
  buyer: EntityRef;
  seller: EntityRef;
  location: LocationRef;
  category: string;
  quantity: number;
  pricePerUnit: number;
  tags: string[];               // ["illegal", "traced", etc.]
}

// Stolen goods sell at 30-50% of market value (need a fence)
// Legal goods sell at market price
// Illegal goods have price premium but generate heat if traced
```

### Organization Assets (Simplified)

```typescript
interface OrgAssets {
  wallet: Wallet;                    // Liquid credits

  // Inventory stored across locations
  // Each location has its own inventory
  // Org's total inventory = sum of all location inventories

  // Real estate
  ownedLocations: LocationRef[];

  // Data assets (stored on data_storage at locations)
  // Accessed via location inventory, not stored directly on org
}
```

### Money Flow Summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        MONEY FLOW IN NEOARCOLOGY                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────┐      salaries      ┌─────────────┐                    │
│   │             │ ─────────────────> │             │                    │
│   │    ORGS     │                    │   AGENTS    │                    │
│   │             │ <───────────────── │             │                    │
│   └─────────────┘   mission work     └─────────────┘                    │
│         │                                   │                            │
│         │                                   │                            │
│         ▼                                   ▼                            │
│   ┌─────────────┐                    ┌─────────────┐                    │
│   │  LOCATIONS  │                    │   MARKETS   │                    │
│   │  (income)   │                    │   (goods)   │                    │
│   └─────────────┘                    └─────────────┘                    │
│         │                                   │                            │
│         │                                   │                            │
│         ▼                                   ▼                            │
│   ┌─────────────┐                    ┌─────────────┐                    │
│   │  SECURITY   │ <───────────────── │   HEISTS    │                    │
│   │  (expense)  │     theft target   │   (profit)  │                    │
│   └─────────────┘                    └─────────────┘                    │
│                                                                          │
│   RESEARCH produces: equipment, intel, products → value                  │
│   VIOLENCE costs: weapons, medical, replacements → expense               │
│   BUSINESS produces: legitimate income → steady but low                  │
│   CRIME produces: high income → but heat and risk                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Simulation Logic

### How Leaders Generate Missions (Agent-Driven)

```typescript
function leaderGeneratesMissions(leader: Agent, org: Organization, world: World): Mission[] {
  const missions: Mission[] = [];

  // Leader weighs org goals against personal goals
  const goals = weighGoals(leader, org);

  for (const goal of goals) {
    // Leader's personality affects mission type selection
    const preferredApproach = getLeaderPreference(leader, goal);

    switch (goal.type) {
      case "expand_territory":
        const targets = findExpansionTargets(org, world);
        if (leader.stats.force > leader.stats.social) {
          // Aggressive leader prefers raids
          missions.push(...targets.map(t => createRaidMission(org, t)));
        } else {
          // Diplomatic leader prefers buyouts/negotiation
          missions.push(...targets.map(t => createNegotiateMission(org, t)));
        }
        break;

      case "destroy_enemy":
        const enemy = world.getOrg(goal.target);
        // Check if this is also the leader's personal enemy
        const personalVendetta = leader.relationships.find(
          r => r.targetId === goal.target && r.strength < -50
        );
        if (personalVendetta) {
          // Leader prioritizes this, may over-commit resources
          missions.push(createHitMission(org, enemy.leader, { priority: "critical" }));
        } else {
          missions.push(createSabotageMission(org, enemy.locations[0]));
        }
        break;

      case "increase_wealth":
        // Leader's tags affect target selection
        if (leader.tags.includes("greedy")) {
          // Greedy leader goes for bigger, riskier scores
          missions.push(createHeistMission(org, findWealthyTarget(world)));
        } else {
          // Conservative leader prefers steady income
          missions.push(createRacketMission(org, findVulnerableTarget(world)));
        }
        break;

      // Personal goal handling
      case "personal_revenge":
        // Leader using org resources for personal vendetta
        // This may upset leadership council if discovered
        missions.push(createHitMission(org, goal.target, { hidden: true }));
        break;
    }
  }

  // Consult leadership council based on decision style
  return consultCouncil(leader, org, missions, world);
}

function consultCouncil(
  leader: Agent,
  org: Organization,
  proposedMissions: Mission[],
  world: World
): Mission[] {
  // Decision style is determined by org tags, not a separate field
  if (org.tags.includes("autocratic")) {
    // Leader decides alone
    return proposedMissions;
  }

  if (org.tags.includes("council-led")) {
    // Leadership votes on major missions
    const majorMissions = proposedMissions.filter(m => m.risk > 50);
    for (const mission of majorMissions) {
      const votes = org.leadership.map(lt => {
        const agent = world.getAgent(lt);
        return evaluateMissionAsCouncilMember(agent, mission, leader);
      });
      const approved = votes.filter(v => v.approve).length > votes.length / 2;
      if (!approved) {
        // Remove mission, but track dissent
        proposedMissions.splice(proposedMissions.indexOf(mission), 1);
        recordDissent(org, mission, votes);
      }
    }
    return proposedMissions;
  }

  if (org.tags.includes("consensus-driven")) {
    // All leadership must agree - conservative approach
    return proposedMissions.filter(m =>
      org.leadership.every(lt => {
        const agent = world.getAgent(lt);
        return evaluateMissionAsCouncilMember(agent, m, leader).approve;
      })
    );
  }

  if (org.tags.includes("democratic")) {
    // All members vote (slow, but high buy-in)
    return proposedMissions.filter(m => {
      const approval = org.members.reduce((sum, memberId) => {
        const agent = world.getAgent(memberId);
        return sum + (evaluateMissionAsMember(agent, m) ? 1 : 0);
      }, 0);
      return approval > org.members.length / 2;
    });
  }

  // Default to autocratic if no decision style tag
  return proposedMissions;
}

function evaluateMissionAsCouncilMember(
  agent: Agent,
  mission: Mission,
  leader: Agent
): { approve: boolean; reasoning: string } {
  // Council member's decision based on:
  // 1. Does mission align with their personal goals?
  // 2. Does it put them or their allies at risk?
  // 3. What's their relationship with the leader?
  // 4. Are they scheming for leadership themselves?

  const loyaltyToLeader = agent.relationships.find(r => r.targetId === leader.id)?.strength ?? 0;
  const personalBenefit = calculatePersonalBenefit(agent, mission);
  const riskToSelf = calculateRiskToAgent(agent, mission);

  // Ambitious agents with low loyalty may vote to make leader look bad
  if (agent.tags.includes("ambitious") && loyaltyToLeader < 30) {
    // Approve risky missions hoping they fail
    if (mission.risk > 70) {
      return { approve: true, reasoning: "hoping_leader_fails" };
    }
  }

  // Standard evaluation
  const score = loyaltyToLeader * 0.3 + personalBenefit * 0.4 - riskToSelf * 0.3;
  return {
    approve: score > 0,
    reasoning: score > 0 ? "mission_worthwhile" : "too_risky"
  };
}
```

### How Missions Get Accepted

```typescript
function processMissionMarket(world: World): void {
  const availableMissions = world.missions.filter(m => m.status === "available");

  for (const mission of availableMissions) {
    // Find orgs that could take this mission
    const candidates = findEligibleOrgs(mission, world);

    for (const org of candidates) {
      const shouldAccept = evaluateMission(org, mission);

      if (shouldAccept) {
        assignMission(mission, org);
        break;
      }
    }
  }
}

function evaluateMission(org: Organization, mission: Mission): boolean {
  // Does org have capable agents?
  const canComplete = hasCapableAgents(org, mission.requirements);
  if (!canComplete) return false;

  // Is reward worth the risk?
  const riskRewardRatio = calculateRiskReward(org, mission);
  if (riskRewardRatio < org.ai.riskTolerance) return false;

  // Does it conflict with relationships?
  if (isAllyTarget(org, mission.target)) return false;

  // Does org have bandwidth?
  const availableAgents = org.members.filter(a => a.status === "available");
  if (availableAgents.length < mission.requirements.minAgents) return false;

  return true;
}
```

### Mission Resolution

```typescript
function resolveMissionPhase(mission: Mission, world: World): void {
  const agents = mission.assignedAgents.map(id => world.getAgent(id));
  const equipment = mission.equipment;

  // Calculate contribution this phase
  const baseStats = aggregateAgentStats(agents);
  const equipBonus = aggregateEquipmentBonus(equipment);
  const total = addStats(baseStats, equipBonus);

  // Apply RNG (60% - 140% bell curve)
  const roll = rollBellCurve(0.6, 1.4);
  const contribution = multiplyStats(total, roll);

  // Add to progress
  mission.progress.forceAccumulated += contribution.force;
  mission.progress.stealthAccumulated += contribution.stealth;
  mission.progress.techAccumulated += contribution.tech;
  mission.progress.socialAccumulated += contribution.social;
  mission.progress.phasesElapsed += 1;

  // Log the activity
  world.log({
    phase: world.currentPhase,
    type: "mission_progress",
    mission: mission.id,
    agents: agents.map(a => a.id),
    roll: roll,
    contribution: contribution
  });

  // Check for complications
  if (Math.random() < getComplicationChance(mission)) {
    const complication = generateComplication(mission);
    mission.progress.complications.push(complication);
    world.log({ type: "complication", mission: mission.id, complication });
  }

  // Check for completion
  if (meetsRequirements(mission)) {
    completeMission(mission, world, "success");
  } else if (mission.progress.phasesElapsed > mission.estimatedDuration * 2) {
    completeMission(mission, world, "failed");
  }
}
```

### Power Dynamics

```typescript
function calculatePowerBalance(world: World): void {
  const orgs = world.organizations;

  for (const org of orgs) {
    // Calculate raw power
    const militaryPower = org.members.reduce((sum, a) =>
      sum + world.getAgent(a).stats.force, 0);
    const economicPower = org.resources.credits +
      org.locations.reduce((sum, l) => sum + world.getLocation(l).baseIncome, 0);
    const politicalPower = org.resources.influence;

    // Total power score
    org.powerScore = militaryPower * 0.3 +
                     economicPower * 0.4 +
                     politicalPower * 0.3;
  }

  // Determine who controls each sector
  for (const sector of world.sectors) {
    const orgsInSector = orgs.filter(o => hasPresenceIn(o, sector));
    const dominant = orgsInSector.sort((a, b) => b.powerScore - a.powerScore)[0];
    sector.controlledBy = dominant?.id;
  }

  // Log power shifts
  logPowerChanges(world);
}
```

---

## Activity Log (Emergent Storytelling)

Every significant event is logged for narrative reconstruction:

```typescript
interface ActivityLog {
  entries: LogEntry[];
}

interface LogEntry {
  phase: number;
  timestamp: Date;
  type: LogEventType;
  severity: "minor" | "notable" | "major" | "critical";

  // Participants
  actors: EntityRef[];
  targets: EntityRef[];

  // Details
  data: Record<string, any>;

  // Generated narrative (optional)
  narrative?: string;
}

type LogEventType =
  // Organization events
  | "org_created"
  | "org_destroyed"
  | "org_merged"
  | "org_territory_gained"
  | "org_territory_lost"
  | "org_leader_changed"
  | "org_war_declared"
  | "org_alliance_formed"

  // Agent events
  | "agent_born"
  | "agent_died"
  | "agent_hired"
  | "agent_fired"
  | "agent_promoted"
  | "agent_betrayed"
  | "agent_retired"
  | "agent_captured"
  | "agent_escaped"

  // Mission events
  | "mission_created"
  | "mission_accepted"
  | "mission_progress"
  | "mission_complication"
  | "mission_completed"
  | "mission_failed"

  // World events
  | "power_shift"
  | "economic_crash"
  | "government_crackdown"
  | "gang_war_started"
  | "gang_war_ended"
  | "corporate_scandal";
```

### Narrative Generation

```typescript
function generateNarrative(entry: LogEntry): string {
  switch (entry.type) {
    case "org_destroyed":
      const org = getOrg(entry.targets[0]);
      const killer = getOrg(entry.actors[0]);
      return `${org.name} has been destroyed by ${killer.name} after ` +
             `${entry.data.warDuration} phases of conflict.`;

    case "agent_betrayed":
      const agent = getAgent(entry.actors[0]);
      const oldOrg = getOrg(entry.data.oldEmployer);
      const newOrg = getOrg(entry.data.newEmployer);
      return `${agent.name} betrayed ${oldOrg.name} and defected to ${newOrg.name}, ` +
             `bringing ${entry.data.stolenIntel} intel with them.`;

    case "mission_completed":
      const mission = getMission(entry.targets[0]);
      const executor = getOrg(entry.actors[0]);
      return `${executor.name} successfully completed "${mission.name}": ` +
             `${entry.data.summary}`;

    // ... etc
  }
}
```

### History Browser

The UI can display the log as a timeline:

```
PHASE 487: NeoSynth Corp territory expanded into Sector 7
PHASE 485: Agent "Razor" killed during failed extraction
PHASE 483: Black Dragons declared war on Steel Serpents
PHASE 480: Corrupt official Mayor Chen bribed by Yakuza
PHASE 476: Tech startup "CyberDyne" founded (new corporation)
PHASE 471: Gang war between Black Dragons and Steel Serpents ended
PHASE 465: Steel Serpents lost control of Downtown warehouse
...
```

---

## Procedural Generation

### City Generation

```typescript
interface CityGenConfig {
  // Scale
  sectors: number;                    // 5-12
  locationsPerSector: number;         // 20-100

  // Starting orgs
  corporations: number;               // 2-5
  gangs: number;                      // 3-8
  governmentStrength: "strong" | "weak" | "corrupt";

  // Population
  startingAgents: number;             // 50-200

  // Economic
  totalWealth: number;
  wealthDistribution: "equal" | "concentrated" | "mixed";
}

function generateCity(config: CityGenConfig): World {
  const world = new World();

  // 1. Generate sectors and locations
  for (let i = 0; i < config.sectors; i++) {
    const sector = generateSector(i, config);
    world.sectors.push(sector);
    world.locations.push(...sector.locations);
  }

  // 2. Generate government (always exists)
  const government = generateGovernment(config.governmentStrength);
  world.organizations.push(government);

  // 3. Generate corporations
  for (let i = 0; i < config.corporations; i++) {
    const corp = generateCorporation(world);
    world.organizations.push(corp);
  }

  // 4. Generate gangs
  for (let i = 0; i < config.gangs; i++) {
    const gang = generateGang(world);
    world.organizations.push(gang);
  }

  // 5. Distribute locations to orgs
  distributeLocations(world);

  // 6. Generate agents
  for (let i = 0; i < config.startingAgents; i++) {
    const agent = generateAgent(world);
    world.agents.push(agent);
  }

  // 7. Assign agents to orgs
  assignAgentsToOrgs(world);

  // 8. Generate initial relationships
  generateRelationships(world);

  return world;
}
```

### Agent Generation

```typescript
function generateAgent(world: World): Agent {
  // Random stats with some specialization
  const archetype = pickRandom(["combat", "infiltrator", "hacker", "face", "fixer"]);
  const stats = generateStatsForArchetype(archetype);

  // Random personality via tags (pick 2-4 from weighted pool)
  const personalityTags = pickRandomTags([
    { tag: "aggressive", weight: 0.3 },
    { tag: "cautious", weight: 0.3 },
    { tag: "greedy", weight: 0.4 },
    { tag: "ambitious", weight: 0.4 },
    { tag: "loyal", weight: 0.3 },
    { tag: "reckless", weight: 0.2 },
    { tag: "paranoid", weight: 0.2 },
    { tag: "charismatic", weight: 0.2 },
    { tag: "ruthless", weight: 0.15 },
    { tag: "idealistic", weight: 0.15 },
  ], { min: 2, max: 4 });

  // Generate name
  const name = generateCyberpunkName();

  return {
    id: uuid(),
    name,
    template: archetype,
    created: world.currentPhase,
    tags: [archetype, ...personalityTags],  // Role tag + personality tags
    relationships: [],
    status: "available",
    age: randomRange(20, 50) * PHASES_PER_YEAR,
    stats,
    wallet: { credits: randomRange(100, 1000), accounts: [], stashes: [] },
    morale: 50,
  };
}
```

### Organization Name Generation

```typescript
const CORP_PREFIXES = ["Neo", "Cyber", "Omni", "Syn", "Tech", "Data", "Aero", "Bio"];
const CORP_SUFFIXES = ["Corp", "Systems", "Industries", "Dynamics", "Solutions"];

const GANG_NAMES = [
  "Black Dragons", "Steel Serpents", "Neon Wolves", "Chrome Reapers",
  "Rust Angels", "Binary Saints", "Void Kings", "Ash Collective"
];

const SYNDICATE_NAMES = [
  "The Syndicate", "Red Hand", "Shadow Council", "The Collective",
  "Iron Circle", "Silent Partners"
];
```

---

## Game Modes

### 1. Observer Mode (MVP)

**Purpose**: Watch the city simulation unfold. No control, pure observation.

**Turn-Based**: The simulation does NOT run in real-time. The player controls when ticks happen:
- **Tick 1x**: Advance 1 phase
- **Tick 5x**: Advance 5 phases
- **Tick 10x**: Advance 10 phases
- **Tick 100x**: Advance 100 phases (for burn-in or fast-forward)

This gives the player time to inspect the world state between ticks.

**Features**:
- Browse all entities (Django-admin style lists)
- Activity log updates after each tick batch
- View org power rankings
- See relationships graph
- Player-controlled tick advancement (not real-time)
- Filter log by org/agent/type
- Historical graphs (power over time, wealth, etc.)

**UI Layout**:
```
┌─────────────────────────────────────────────────────────────────┐
│  NEOARCOLOGY OBSERVER │ Phase: 1,247 │ Day 311 │ Year 1        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────────────────────────────────┐│
│  │ ENTITY NAV   │  │                                          ││
│  │              │  │           MAIN VIEW                      ││
│  │ [Orgs]       │  │                                          ││
│  │ [Agents]     │  │  • Entity list / detail                  ││
│  │ [Locations]  │  │  • Power rankings                        ││
│  │ [Missions]   │  │  • Relationship graph                    ││
│  │ [Vehicles]   │  │  • Statistics                            ││
│  │              │  │                                          ││
│  │ [Statistics] │  │                                          ││
│  │ [Timeline]   │  │                                          ││
│  └──────────────┘  └──────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ACTIVITY LOG                                                ││
│  │ [1247] Yakuza completed "Warehouse Raid" - gained Sector 3  ││
│  │ [1246] Agent "Chrome" hired by NeoSynth Corp                ││
│  │ [1245] Black Dragons declared war on Steel Serpents         ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  [Tick 1x]  [Tick 5x]  [Tick 10x]  [Tick 100x]   Phase: 1247   │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Org Mode

**Purpose**: Take control of one organization and see how far you can take it in a living world.

**Turn-Based**: Player takes actions, then clicks **[Next Phase]** to advance time. One phase = one turn.

**Setup**:
1. Generate city
2. Run simulation for N phases (e.g., 500) to create history
3. Present player with org selection screen
4. Player picks an org (any type: corporation, gang, cult, fixer crew, etc.) or creates a new one
5. Player becomes the "leader agent" of that org
6. Player controls that org; AI controls everything else

**Player Controls**:
- Hire/fire agents
- Accept/create missions
- Assign agents to missions
- Purchase equipment, vehicles, locations
- Set org priorities and goals
- Manage relationships (declare war, propose alliance)
- Conduct business deals and research

**No Victory Condition**: This is a sandbox. The player sets their own goals:
- Dominate the city?
- Become the richest org?
- Destroy a specific rival?
- Build a criminal empire from nothing?
- Run a legitimate corporation?
- Lead a fanatical cult?
- Survive as long as possible?

**Game Over** (optional): The game continues even if your org is destroyed:
- **Org Destroyed**: All assets seized, members scattered. Player can:
  - Transition to **Observer Mode** and watch what happens next
  - Start a new org (if any former agents are available to recruit)
  - Quit and restart with a new city
- **Bankrupt**: Can't pay salaries. Agents start leaving. Not game over—just a crisis to manage.
- **Leader Dies**: Leadership challenge triggers. If no suitable successor, org may fragment.

The simulation doesn't care about the player. The world continues regardless.

### 3. Agent Mode (Future)

**Purpose**: Control a single agent navigating the underworld.

**Turn-Based**: Player takes actions, then clicks **[Next Phase]** to advance time. One phase = one turn.

**Gameplay**:
- Start as a free agent
- Accept jobs from various orgs
- Build reputation
- Rise through the ranks of an organization
- Eventually: start your own org of any type (transitions to Org Mode)

---

## Technical Architecture

### State Structure

```typescript
interface WorldState {
  // Time
  currentPhase: number;
  currentDay: number;
  currentYear: number;

  // Entities
  organizations: Record<string, Organization>;
  agents: Record<string, Agent>;
  locations: Record<string, Location>;
  vehicles: Record<string, Vehicle>;
  missions: Record<string, Mission>;

  // Economy
  market: MarketState;
  goods: Record<string, Good>;
  researchProjects: Record<string, ResearchProject>;

  // World structure
  sectors: Sector[];

  // Activity log
  log: LogEntry[];

  // Global stats
  stats: {
    totalWealth: number;
    totalAgents: number;
    activeWars: number;
    governmentPower: number;
    corporatePower: number;
    gangPower: number;
    marketActivity: number;
  };

  // Game mode state
  mode: GameMode;
  playerOrg?: string;        // For Fixer Mode
  playerAgent?: string;      // For Agent Mode
}

type GameMode = "observer" | "fixer" | "agent";

interface MarketState {
  priceModifiers: Record<string, number>;   // category ID → price modifier
  activeEvents: MarketEvent[];
  supplyLevels: Record<string, number>;     // category ID → supply level
  demandLevels: Record<string, number>;     // category ID → demand level
}
```

### Engine Structure

```
src/
├── simulation/
│   ├── World.ts              # World state container
│   ├── TickEngine.ts         # Main simulation loop
│   ├── EntityManager.ts      # CRUD for entities
│   │
│   ├── ai/
│   │   ├── AgentAI.ts        # Agent decision making (primary)
│   │   ├── LeadershipAI.ts   # Org decisions via leader
│   │   └── MissionAI.ts      # Mission generation/evaluation
│   │
│   ├── systems/
│   │   ├── MissionSystem.ts  # Mission lifecycle
│   │   ├── EncounterSystem.ts # Agent-to-agent interactions
│   │   ├── ConfrontationSystem.ts # Combat/social/tech resolution
│   │   ├── EconomySystem.ts  # Money flow, salaries, trades
│   │   ├── MarketSystem.ts   # Supply/demand, price fluctuations
│   │   ├── ResearchSystem.ts # R&D projects and outputs
│   │   ├── PowerSystem.ts    # Influence calculations
│   │   └── EventSystem.ts    # Random events
│   │
│   └── generators/
│       ├── CityGenerator.ts
│       ├── AgentGenerator.ts
│       ├── OrgGenerator.ts
│       ├── MissionGenerator.ts
│       └── GoodsGenerator.ts
│
├── config/
│   ├── ConfigLoader.ts       # Load and merge config files
│   ├── RuntimeConfig.ts      # Runtime overrides
│   └── Validator.ts          # Config schema validation
│
├── modes/
│   ├── ObserverMode.ts       # Observer-specific logic
│   ├── FixerMode.ts          # Fixer-specific logic
│   └── AgentMode.ts          # Agent-specific logic
│
├── renderer/
│   ├── Renderer.ts           # Pixi.js setup
│   ├── panels/               # UI panels
│   └── components/           # Reusable UI
│
├── store/
│   └── worldStore.ts         # Zustand store
│
├── debug/
│   ├── DebugTools.ts         # Inspection and manipulation
│   ├── StatsCollector.ts     # Metrics and histograms
│   └── BalanceLogger.ts      # Track balance changes
│
└── types/
    ├── entities.ts           # Entity interfaces
    ├── economy.ts            # Economic types
    ├── interactions.ts       # Agent interaction types
    └── config.ts             # Config schema types

data/
├── config/
│   ├── simulation.json       # Core simulation parameters
│   ├── economy.json          # Economic balance values
│   ├── combat.json           # Confrontation formulas
│   └── generation.json       # Procedural gen parameters
│
├── templates/
│   ├── orgs/                 # Organization templates
│   ├── agents/               # Agent archetype templates
│   ├── locations/            # Location type templates
│   ├── missions/             # Mission type templates
│   └── goods/                # Goods and equipment data
│
├── names/
│   ├── agents.json           # Name generation pools
│   ├── orgs.json             # Org name components
│   └── locations.json        # Location name patterns
│
└── scenarios/                # Pre-built world setups
    ├── default.json
    ├── gang_war.json
    └── corporate_dystopia.json
```

---

## Implementation Rollout

The game is built in layers, each adding complexity to a working foundation.

### Phase 0: Stack Setup
Set up the development environment and project structure.

**Deliverables:**
- [ ] TypeScript + Pixi.js + Zustand project scaffold
- [ ] Electron shell (or web-only for initial dev)
- [ ] Build system (Vite or similar)
- [ ] Data file loading (JSON templates, configs)
- [ ] Basic type definitions from this design doc
- [ ] Dev tooling (hot reload, debug panel stub)

### Phase 1: Peaceful Economy Simulation (No UI)

Build a "normal" cyberpunk economy with no hostile actions. The world runs, money flows, agents work jobs. **Built bottom-up in three sub-phases:**

#### Phase 1a: Agent Slice of Life

Establish foundational agent behavior before any economy exists.

**Core Systems:**
- [ ] Tick engine with time rollover (phase → day → week)
- [ ] Agent needs: hunger (increases weekly, death at 100)
- [ ] Agent inventory: hold goods personally (provisions)
- [ ] Agent routine: daily cycle (wake → activity → eat → rest)
- [ ] Eating: consume 1 provisions per week, resets hunger
- [ ] Starvation: 4 weeks without food = death
- [ ] Activity logging (consumption, hunger, death)

**What this proves:**
- Agents have survival pressure (must eat or die)
- Time system works (weekly need cycles)
- Foundation for all future agent behavior

**Test scenario:** 10 agents start with 4-8 provisions each. Watch them consume provisions weekly. All eventually starve. Success!

#### Phase 1b: Simple Economy

Agents can buy provisions. Entrepreneurial agents open small businesses.

**Core Systems:**
- [ ] Location system (retail_shop, restaurant)
- [ ] Location inventory (goods for sale)
- [ ] Commerce: agents buy provisions (fixed price: 10 credits)
- [ ] Agent entrepreneurship: open business (costs credits)
- [ ] Basic employment: 1 employee per small location
- [ ] Weekly payroll: owner pays employee
- [ ] Business viability: dissolve if owner bankrupt
- [ ] Agent decisions: buy food, seek work, open business

**Location capacity (employees):**
- retail_shop: 1
- restaurant: 1

**What this proves:**
- Money flows: customer → business → employee
- Businesses can succeed or fail
- Agents survive by earning and spending
- Simple economic equilibrium (or interesting collapse)

**Test scenario:** 20 agents, 2 initial shops. Run 100+ weeks. Observe purchases, employment, new businesses, failures, deaths.

#### Phase 1c: Complex Organizations

Multi-agent organizations with hierarchy and varied job tiers.

**Core Systems:**
- [ ] Organization entity (leader, members, wallet, locations)
- [ ] Org templates: corporation, gang, small_business
- [ ] Multiple location types with varied capacity:
  - retail_shop/restaurant: 1 employee
  - office: 2 employees (skilled jobs)
  - factory: 3-4 employees (mix unskilled/skilled)
  - research_lab: 3-4 employees (specialist jobs)
- [ ] Job tiers: unskilled (100-300/wk), skilled (300-600/wk), specialist (600-1500/wk)
- [ ] Stat requirements for skilled/specialist jobs
- [ ] Leader decisions: hire, expand, contract
- [ ] Org dissolution: 4 weeks negative wallet

**What this proves:**
- Multi-tier economy works
- Skilled agents get better jobs
- Orgs grow and shrink based on performance
- Complex economic dynamics emerge

**No hostile actions yet:** No theft, no combat, no raids. Just a working economy.

### Phase 2: Procedural Generation
Generate interesting starting worlds.

**Deliverables:**
- [ ] City generator (sectors, districts)
- [ ] Location generator (variety of location templates)
- [ ] Organization generator (corps, gangs, gov't with appropriate locations/agents)
- [ ] Agent generator (personality tags, stat distributions, archetypes)
- [ ] Name generators (agents, orgs, locations)
- [ ] "Burn in" capability (run N phases to create history before player enters)
- [ ] Scenario system (pre-configured starting conditions)

### Phase 3: Observer Mode UI
Build the UI to visualize the simulation.

**Deliverables:**
- [ ] Pixi.js renderer setup
- [ ] Main layout (nav, main panel, activity log)
- [ ] Time controls (pause, play, speed: 1x, 10x, 100x)
- [ ] Entity list panels (Django-admin style):
  - [ ] Organizations list + detail view
  - [ ] Agents list + detail view
  - [ ] Locations list + detail view
  - [ ] Missions list + detail view (empty for now)
- [ ] Activity log panel (filterable)
- [ ] Basic statistics/graphs (org wealth over time, agent employment, etc.)
- [ ] Entity relationships view

**What this phase proves:**
- Can observe the peaceful economy running
- Can inspect any entity in detail
- Can see money flowing, agents working
- Can identify issues/imbalances visually

### Phase 4: Hostile Missions & Combat
Add conflict to the simulation.

**Deliverables:**
- [ ] Mission system:
  - [ ] Mission templates (heist, raid, sabotage, extraction, assassination)
  - [ ] Mission creation by leaders
  - [ ] Agent assignment to missions
  - [ ] Mission progress and resolution
- [ ] Confrontation system:
  - [ ] Combat resolution (Force vs Force)
  - [ ] Stealth resolution (Mobility checks)
  - [ ] Tech resolution (hacking, counter-hacking)
- [ ] Encounter system:
  - [ ] Mission collisions (two teams at same location)
  - [ ] Random encounters
- [ ] Consequences:
  - [ ] Agent injury, capture, death
  - [ ] Inventory theft
  - [ ] Location damage/capture
  - [ ] Heat generation
- [ ] Observer Mode updates:
  - [ ] Missions list populated
  - [ ] Combat/mission logs in activity feed

**What this phase proves:**
- Hostile actions work correctly
- Combat resolves based on stats
- Orgs can attack each other for resources
- Agent capture/extraction works (steal the researcher!)
- The simulation handles conflict without breaking the economy

### Phase 5: Org Mode
Player takes control of an organization.

**Deliverables:**
- [ ] Org selection screen (pick existing org of any type, or create new one)
- [ ] Player becomes the "leader agent" of their org
- [ ] Player control override (AI disabled for player org)
- [ ] Org Mode UI:
  - [ ] Management dashboard (your org's status)
  - [ ] Agent roster (hire, fire, assign)
  - [ ] Location management (buy, sell, upgrade)
  - [ ] Mission planning (create missions, assign agents)
  - [ ] Finances panel (income, expenses, projections)
  - [ ] Relationships panel (allies, enemies, deals)
- [ ] Transition to/from Observer Mode (watch vs play)
- [ ] Sandbox gameplay (no victory conditions, player sets goals)

**What this phase proves:**
- Player can meaningfully control an org
- Player decisions affect the simulation
- The world continues around the player
- Observer Mode works as a "step back and watch" option

### Phase 6: Agent Mode
Player controls a single agent.

**Deliverables:**
- [ ] Agent selection/creation
- [ ] Player is one agent in the world
- [ ] Agent Mode UI:
  - [ ] Personal status (stats, wallet, relationships)
  - [ ] Job hunting (view available jobs, apply)
  - [ ] Mission participation (as team member, not leader)
  - [ ] Personal deals and side hustles
  - [ ] Reputation and relationship management
- [ ] Agent-level goals:
  - [ ] Accumulate wealth
  - [ ] Rise through org ranks
  - [ ] Found your own org of any type (transitions to Org Mode)
  - [ ] Retire wealthy
- [ ] Permadeath or agent persistence options

**What this phase proves:**
- Can experience the world from ground level
- Agent-level gameplay is compelling
- Natural progression from Agent → Org Mode works

---

### Implementation Notes

**Build order matters:** Each phase builds on the previous. Don't skip ahead.

**Peaceful first, then hostile:** Getting the economy right without combat simplifies debugging. Combat adds complexity—make sure the foundation is solid.

**UI validates simulation:** Observer Mode isn't just for the player—it's how we verify the simulation works correctly.

**Data-driven from day one:** Use JSON templates even in Phase 1. Don't hardcode entity types.

### Iterative Design

**This design document will evolve.** Each implementation phase will surface new insights:

- **Phase 1 (Economy)**: We'll learn how money should flow, what makes agents feel alive economically. The economy section of this doc will be refined based on what actually works.

- **Phase 2 (Proc Gen)**: We'll discover what makes interesting starting worlds. Generation parameters will be tuned.

- **Phase 3 (Observer UI)**: Seeing the simulation visualized will reveal balance issues and missing features.

- **Phase 4 (Combat/Missions)**: Combat mechanics in this doc are speculative. The actual implementation will be designed when we get there, informed by how the peaceful simulation behaves.

- **Phase 5 (Org Mode)**: Player control requirements will become clear once we can observe the AI orgs.

- **Phase 6 (Agent Mode)**: Agent-level gameplay will be designed based on what makes the simulation interesting.

**Don't over-design future phases.** The sections in this doc for later phases are sketches, not specifications. Detailed design happens when implementation begins.

---

## Data-Driven Design

The simulation must be highly configurable for rapid iteration. Designers should be able to tweak values, generate a new world, and observe the results without code changes.

### Configuration Philosophy

```
CODE defines MECHANICS (how things work)
DATA defines BALANCE (how things feel)
```

### Configuration Files

```
data/
├── config/
│   ├── simulation.json     # Core simulation parameters
│   ├── economy.json        # Economic balance values
│   ├── combat.json         # Confrontation formulas
│   ├── generation.json     # Procedural gen parameters
│   └── difficulty.json     # Presets for different experiences
│
├── templates/
│   ├── orgs/               # Organization templates
│   │   ├── corporation.json
│   │   ├── gang.json
│   │   └── ...
│   ├── agents/             # Agent archetype templates
│   │   ├── combat.json
│   │   ├── tech.json
│   │   └── ...
│   ├── locations/          # Location type templates
│   ├── missions/           # Mission type templates
│   └── goods/              # Goods and equipment data
│
├── names/
│   ├── agents.json         # Name generation pools
│   ├── orgs.json           # Org name components
│   └── locations.json      # Location name patterns
│
└── scenarios/              # Pre-built world setups
    ├── tutorial.json       # Simple starting scenario
    ├── gang_war.json       # High-conflict scenario
    └── corporate_dystopia.json
```

### Simulation Config Example

```json
{
  "simulation": {
    "time": {
      "phasesPerDay": 4,
      "daysPerWeek": 7,
      "weeksPerMonth": 4,
      "monthsPerYear": 12
    },
    "burnIn": {
      "defaultPhases": 500,
      "minPhases": 100,
      "maxPhases": 2000
    }
  },
  "agents": {
    "stats": {
      "min": 1,
      "max": 100,
      "startingTotal": 180,
      "growthPerMission": 0.5
    },
    "personalityTags": {
      "minTags": 2,
      "maxTags": 4,
      "pool": [
        { "tag": "aggressive", "weight": 0.3 },
        { "tag": "cautious", "weight": 0.3 },
        { "tag": "greedy", "weight": 0.4 },
        { "tag": "ambitious", "weight": 0.4 },
        { "tag": "loyal", "weight": 0.3 }
      ]
    },
    "founding": {
      "requiredTags": ["ambitious", "leadership"],
      "minSocial": 40,
      "minCredits": 10000,
      "minContacts": 3
    }
  },
  "organizations": {
    "decisionStyles": {
      "corporation": { "default": "council", "weights": [0.1, 0.6, 0.2, 0.1] },
      "gang": { "default": "autocratic", "weights": [0.7, 0.2, 0.05, 0.05] },
      "cult": { "default": "consensus", "weights": [0.1, 0.2, 0.5, 0.2] }
    }
  },
  "missions": {
    "rng": {
      "minRoll": 0.6,
      "maxRoll": 1.4,
      "distribution": "bell_curve"
    },
    "complications": {
      "baseChance": 0.1,
      "phaseIncrement": 0.02
    },
    "failureThreshold": 2.0
  },
  "economy": {
    "salaryMultipliers": {
      "grunt": 1.0,
      "specialist": 2.5,
      "lieutenant": 6.0,
      "executive": 15.0
    },
    "fenceRates": {
      "cash": 1.0,
      "goods": 0.3,
      "data": 0.5
    }
  }
}
```

### Template Example (Gang)

```json
{
  "id": "gang",
  "name": "Gang",
  "description": "Street-level criminal organization",

  "tags": ["criminal", "violent", "territorial", "street-level", "autocratic"],

  "defaults": {
    "startingCredits": { "min": 5000, "max": 20000 },
    "startingMembers": { "min": 5, "max": 15 },
    "startingLocations": { "min": 1, "max": 3 }
  },

  "leaderRequirements": {
    "preferredStats": ["force", "social"],
    "requiredTags": ["leadership"],
    "preferredTags": ["aggressive", "ambitious"]
  },

  "locationPreferences": {
    "primary": ["street_corner", "safehouse", "nightclub"],
    "secondary": ["warehouse", "chop_shop"],
    "avoids": ["office", "research_lab"]
  },

  "incomeTypes": {
    "preferred": ["protection_racket", "drug_trade", "theft_fencing"],
    "avoided": ["legitimate_business"]
  },

  "missionPreferences": {
    "preferred": ["raid", "extortion", "theft"],
    "avoided": ["negotiate", "research"]
  },

  "nameGeneration": {
    "patterns": [
      "{color} {animals}",
      "{material} {animals}",
      "The {adjective} {noun_plural}"
    ],
    "pools": {
      "color": ["Black", "Red", "White", "Golden", "Silver"],
      "animals": ["Dragons", "Serpents", "Wolves", "Tigers", "Ravens"],
      "material": ["Steel", "Iron", "Chrome", "Neon", "Rust"]
    }
  }
}
```

Note: The "behavior" block is gone - behavior emerges from the org's tags combined with the leader's tags.

### Runtime Configuration Override

```typescript
// Allow runtime tweaks without restart
interface RuntimeConfig {
  // Load from files at startup
  loadFromFiles(): void;

  // Override specific values (for debugging/testing)
  override(path: string, value: any): void;

  // Reset to file values
  reset(): void;

  // Watch files for changes (hot reload in dev)
  watchFiles(): void;

  // Export current config (including overrides)
  export(): ConfigSnapshot;
}

// Usage in simulation
const missionRNG = config.get("simulation.missions.rng.minRoll");
const gangAggression = config.get("templates.orgs.gang.behavior.aggression");
```

### Scenario System

Pre-built scenarios for testing specific situations:

```json
{
  "id": "gang_war",
  "name": "Gang War",
  "description": "Two powerful gangs on the brink of war",

  "overrides": {
    "simulation.burnIn.defaultPhases": 200
  },

  "setup": {
    "organizations": [
      {
        "template": "gang",
        "name": "Black Dragons",
        "power": "high",
        "territory": "sector_1"
      },
      {
        "template": "gang",
        "name": "Steel Serpents",
        "power": "high",
        "territory": "sector_2"
      }
    ],
    "relationships": [
      {
        "org1": "Black Dragons",
        "org2": "Steel Serpents",
        "type": "enemy",
        "strength": -80
      }
    ],
    "events": [
      {
        "phase": 0,
        "type": "org_war_declared",
        "actors": ["Black Dragons"],
        "targets": ["Steel Serpents"]
      }
    ]
  }
}
```

### Designer Workflow

```
1. OBSERVE → Run simulation, watch what happens
2. IDENTIFY → "Gangs are too powerful" or "Agents never betray"
3. TWEAK → Adjust values in config files
4. REGENERATE → Create new world with new parameters
5. VALIDATE → Run simulation again
6. REPEAT → Until balance feels right
```

### Debug Tools

```typescript
interface DebugTools {
  // Simulation controls
  pause(): void;
  step(phases: number): void;
  setSpeed(multiplier: number): void;

  // Inspection
  inspectAgent(id: string): AgentDebugInfo;
  inspectOrg(id: string): OrgDebugInfo;
  inspectRelationships(): RelationshipGraph;

  // Manipulation (for testing)
  giveCredits(entityId: string, amount: number): void;
  forceRelationship(agent1: string, agent2: string, strength: number): void;
  triggerEvent(eventType: string, params: object): void;

  // Logging
  setLogLevel(level: "none" | "errors" | "warnings" | "info" | "debug"): void;
  filterLogs(entityId?: string, eventType?: string): void;

  // Statistics
  getStats(): SimulationStats;
  getHistogram(metric: string, buckets: number): Histogram;
  compareRuns(runIds: string[]): ComparisonReport;
}
```

### Balance Tracking

Keep a changelog of balance adjustments:

```markdown
# BALANCE.md

## 2025-12-24: Initial Values
- Agent founding: minAmbition=70, minCredits=10000
- Fence rates: goods=0.3, data=0.5

## 2025-12-25: Gang Rebalance
- Problem: Gangs dominating too quickly
- Change: Reduced gang aggression 0.9 → 0.7
- Change: Increased gang heat generation 1.0 → 1.5
- Result: Gangs still aggressive but get crushed by government more often

## 2025-12-26: Economy Tweaks
- Problem: Agents never have enough money to found orgs
- Change: Increased mission cuts 5-10% → 10-20%
- Change: Reduced founding minCredits 10000 → 7500
- Result: More agent-founded orgs, more dynamic simulation
```

---

## Living Documentation Strategy

For Claude Code efficiency as the project scales, maintain these documentation files:

### Repository Documentation Structure

```
neoarcology/
├── CLAUDE.md              # Root-level Claude Code instructions
├── docs/
│   ├── GAME-DESIGN.md     # This document (source of truth for mechanics)
│   ├── BALANCE.md         # Tunable parameters, formulas, rationale
│   └── ARCHITECTURE.md    # Technical decisions, patterns used
│
├── src/
│   ├── simulation/
│   │   └── CLAUDE.md      # Simulation engine patterns
│   ├── renderer/
│   │   └── CLAUDE.md      # Renderer-specific patterns
│   └── types/
│       └── CLAUDE.md      # Type definitions and conventions
│
└── roadmap/
    └── plans/             # PLAN-NNN-*.md files for implementation
```

### Root CLAUDE.md Template

```markdown
# NeoArcology - Development Guide

## Quick Reference
- **Stack**: TypeScript, Pixi.js, Zustand, Electron
- **Architecture**: Simulation-first (world runs autonomously)
- **Time Units**: Phase → Day (4) → Week (28) → Month (112) → Year (1344)

## MVP Foundation (4 Pillars)
1. **Tags**: Everything classified by tags, not hardcoded types
2. **Wallets**: Credits flow between entities
3. **Stats + RNG**: 6 agent stats + dice roll = task outcomes
4. **Locations**: Everything physical exists at a location

## Core Concepts
- **Simulation-first**: The world runs without player input
- **Agents drive everything**: Agents are the atomic unit; orgs are emergent structures
- **Game modes are views**: Observer, Fixer, Agent modes view same simulation
- **Tags over types**: Entities use tags (strings), behaviors attach to tags
- **Activity log**: All events logged for emergent narrative

## Agent Stats
- **Operations**: Force, Mobility, Tech (missions, combat)
- **Enterprise**: Social, Business, Engineering (economy, politics)

## Critical Conventions
- **Tags over types**: Entities use tags (strings) not hardcoded type enums
- **Behaviors attach to tags**: Adding a tag gives entity that behavior
- **Templates are data**: "gang", "corporation" defined in JSON, not code
- **~16 goods categories**: Broad categories, not granular items
- **Tangible at locations**: Physical goods at locations, data on data_storage
- Entity IDs are UUIDs
- Every org has exactly ONE leader (leader field) plus leadership array
- All significant events must be logged to ActivityLog
- Never mutate state directly, use store actions

## Key Files
- Simulation loop: `src/simulation/TickEngine.ts`
- World state: `src/simulation/World.ts`
- Leadership AI: `src/simulation/ai/LeadershipAI.ts`
- Agent AI: `src/simulation/ai/AgentAI.ts`
- Activity log: `src/simulation/ActivityLog.ts`
- Types: `src/types/*.ts`
- Balance: `data/config.json`

## Common Pitfalls
- Using hardcoded types instead of tags
- Forgetting that behavior comes from Leader tags + Org tags
- Forgetting to log significant events to ActivityLog
- Not checking org.leader before leadership array operations
- Mutations in tick processing (always return new state)
- [Add as discovered during development]
```

### BALANCE.md Template

```markdown
# NeoArcology - Balance Parameters

## Time
- Phase = basic unit
- Day = 4 phases
- Week = 28 phases
- Agent ages in phases (display as years: phase / 1344)

## Agent Stats
- Range: 1-100 for each stat
- Archetype weights determine starting distributions
- Stats grow slowly with experience (+1 per ~50 phases on mission)

## Organization
- Starting credits by type: Corp (high), Gang (low), Government (very high)
- Power score = military (0.3) + economic (0.4) + political (0.3)
- Heat threshold for raids: 75+

## Missions
- RNG roll: 60%-140% (bell curve via 3-roll average)
- Complication chance: base 10%, +5% per phase
- Failure threshold: 2x estimated duration

## Economy
[Document economic formulas here as implemented]
```

### Documentation Update Protocol

When making significant changes:
1. Update relevant `CLAUDE.md` in affected directory
2. Update `BALANCE.md` if changing numbers/formulas
3. Keep `GAME-DESIGN.md` as source of truth for mechanics
4. Add to Common Pitfalls when discovering gotchas
5. Log architectural decisions in `ARCHITECTURE.md`

### PLAN File Integration

Use the `roadmap/plans/` folder for implementation planning:

```markdown
# PLAN-NNN: [Short Title]

**Status:** planned | in-progress | completed
**Priority:** P0 (critical) | P1 (high) | P2 (medium) | P3 (low)
**Dependencies:** PLAN-XXX (if any)

## Goal
One sentence describing the outcome.

## Objectives
- [ ] Concrete deliverable 1
- [ ] Concrete deliverable 2

## Notes
Context, decisions, or blockers.
```

---

## Open Questions

1. **Scale**: How many organizations/agents can we simulate before performance degrades?

2. **Balance**: How do we prevent one org from dominating too quickly?

3. **Narrative**: How much procedural narrative generation vs. raw logs?

4. **Persistence**: Save/load world state? Export history as text?

5. **Multiplayer**: Multiple players controlling different orgs in same world?

---

## Glossary

### Time
- **Phase**: Basic unit of simulation time
- **Tick**: Processing one phase of simulation
- **Burn-in**: Running simulation without player to generate history

### Entities
- **Agent**: The atomic unit of simulation. Individual with stats, personality, goals, and relationships. Agents drive all behavior.
- **Organization (Org)**: Emergent structure created and run by agents. Provides shared resources and collective identity.
- **Location**: Physical place in the city with type and owner
- **Mission**: Task created by a leader, executed by agents
- **Leader**: The agent who controls an organization's decisions

### Agent Concepts
- **Personal Goal**: Agent's individual objectives, may conflict with org goals
- **Relationship**: Connection between two agents (-100 to +100 strength)
- **Encounter**: When agents interact directly (same location, mission collision, etc.)
- **Confrontation**: Direct opposition between agents (combat, social, or technical)

### Stats
- **Operations Stats**: Force, Mobility, Tech - used for missions, combat
- **Enterprise Stats**: Social, Business, Engineering - used for economy, politics
- **Power Score**: Combined military (0.3) + economic (0.4) + political (0.3) strength

### Organization Concepts
- **Decision Style**: How leadership makes choices (autocratic, council, consensus, democratic)
- **Leadership Council**: Lieutenants who advise (and may challenge) the leader
- **Internal Politics**: Schemes, betrayals, and leadership challenges within an org

### Economy
- **Credits**: Universal currency (1 credit ≈ $100 USD mental model)
- **Wallet**: Agent/org financial state (cash, accounts, stashes)
- **Goods**: Physical items that can be bought, sold, or stolen
- **Fence Rate**: Percentage of value you get when selling stolen goods
- **Market Event**: Temporary condition affecting supply/demand/prices
- **Income Stream**: Recurring source of credits for an org

### Systems
- **Activity Log**: Record of all significant events for emergent narrative
- **Encounter System**: Detects and resolves agent-to-agent interactions
- **Team Dynamics**: How agent relationships affect mission execution
- **Market System**: Supply/demand dynamics affecting prices
- **Research System**: Projects that produce tangible value (upgrades, intel, products)
- **Infrastructure Preferences**: Which location types each org type gravitates toward

### Game Modes
- **Observer Mode**: Player watches simulation without control
- **Org Mode**: Player controls one organization of any type (player is the leader agent)
- **Agent Mode**: Player controls one agent (future)

---

*Document Version: 7.2*
*Created: 2025-12-23*
*Rewritten: 2025-12-24 - Simulation-first architecture*
*Updated: 2025-12-24 - Added enterprise stats, infrastructure preferences, living docs*
*Major Update: 2025-12-24 - Agent-driven architecture (agents as atomic unit, interaction system, personal goals)*
*Major Update: 2025-12-24 - Economy system, sandbox Fixer Mode, data-driven design for rapid iteration*
*Major Update: 2025-12-25 - Tags over types: fully data-driven entity classification and behaviors*
*Simplification: 2025-12-25 - MVP foundation (4 pillars), 16 goods categories, tangible/non-tangible storage*
*Clarification: 2025-12-25 - Leader tags + org tags combine for behavior; agent personality via tags*
*Consistency Pass: 2025-12-25 - Fixed all code examples to use tags consistently; removed old personality/type patterns*
*Major Update: 2025-12-25 - Implementation rollout plan; economy timing (weekly salaries, flexible income); agent jobs system*
*Clarification: 2025-12-25 - Renamed Fixer Mode → Org Mode (control any org type); added iterative design philosophy*
*Clarification: 2025-12-25 - Turn-based not real-time; Observer has Tick buttons, Org/Agent have Next Phase*
