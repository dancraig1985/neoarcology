# NeoArcology - Game Design Document

**Core Concept**: A cyberpunk city simulation that runs autonomously. Game modes are different views/control schemes into the same living world.

**Inspirations**: Dwarf Fortress (simulation depth), Django Admin (interface), Syndicate, Shadowrun
**Stack**: TypeScript, Pixi.js, Electron (same as Chrome Fixer)

---

## Design Philosophy

### Simulation First

The city simulation is the **primary artifact**. It runs whether a player is watching or not. Every entity has autonomous behavior driven by goals, resources, and relationships.

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
│     │  OBSERVER   │  │   FIXER     │  │   AGENT     │           │
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

When a player enters "Fixer Mode":
- They take control of ONE organization
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

Each phase tick processes in this order:

```
1. AGENT TICK
   └─> Each agent processes their current action
   └─> Agents on missions contribute progress
   └─> Agents heal, age, gain experience
   └─> Unemployed agents seek work

2. ORGANIZATION TICK
   └─> Each org processes income/expenses
   └─> Orgs generate new missions based on goals
   └─> Orgs recruit agents if needed
   └─> Orgs evaluate mission results
   └─> Power/influence calculations

3. MISSION TICK
   └─> Active missions progress
   └─> Missions resolve (success/failure)
   └─> Rewards/penalties distributed

4. LOCATION TICK
   └─> Location ownership changes
   └─> Location income generated
   └─> Location security updates

5. WORLD TICK
   └─> Random events
   └─> Day/Week/Month/Year rollovers
   └─> Global stat updates
   └─> Activity log finalization
```

---

## Entity System

All simulation entities share a common base:

```typescript
interface Entity {
  id: string;
  name: string;
  created: number;        // Phase when created
  destroyed?: number;     // Phase when destroyed (if applicable)
  tags: string[];
  relationships: Relationship[];
}

interface Relationship {
  targetId: string;
  type: RelationType;     // "employer", "enemy", "ally", "owns", etc.
  strength: number;       // -100 (hatred) to +100 (loyalty)
  since: number;          // Phase when established
}
```

---

## Core Entities

### 1. Organizations

The **most important entity**. Organizations drive the simulation.

```typescript
interface Organization extends Entity {
  type: OrgType;

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

  // Behavior
  goals: OrgGoal[];       // What the org is trying to achieve
  enemies: OrgRef[];
  allies: OrgRef[];

  // Economics
  income: IncomeSource[];
  expenses: Expense[];

  // AI (replaced by player in control modes)
  ai: OrgAI;
}

type OrgType =
  | "corporation"      // Legal business, high resources, low heat tolerance
  | "gang"             // Street-level, violent, territorial
  | "government"       // Law enforcement, regulation, legitimate force
  | "syndicate"        // Organized crime, balanced
  | "fixer_crew"       // Mission runners, player-style orgs
  | "cult"             // Ideology-driven, fanatical members
  | "mercenary"        // For-hire, neutral
  | "media"            // Information brokers, low violence
  | "underground";     // Hidden, hackers, info traders

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

### Organization Behavior (AI)

Each org type has default behavioral weights:

| Org Type | Aggression | Risk Tolerance | Expansion | Loyalty Focus |
|----------|------------|----------------|-----------|---------------|
| Corporation | Low | Low | High | Medium |
| Gang | High | High | Medium | Low |
| Government | Medium | Low | Low | High |
| Syndicate | Medium | Medium | High | Medium |
| Fixer Crew | Low | High | Low | High |
| Cult | High | Very High | Medium | Very High |
| Mercenary | Medium | High | Low | Low |

### Organization Infrastructure Preferences

Each org type gravitates toward specific location types based on their operations:

| Org Type | Primary Locations | Secondary Locations | Avoids |
|----------|-------------------|---------------------|--------|
| **Corporation** | Office, Research Lab, Factory | Warehouse, Server Farm | Street Corner, Safehouse |
| **Gang** | Street Corner, Safehouse, Nightclub | Warehouse, Chop Shop | Office, Research Lab |
| **Government** | Government Building, Office | Precinct, Courthouse | Safehouse, Brothel |
| **Syndicate** | Nightclub, Casino, Office | Warehouse, Safehouse, Docks | Government Building |
| **Fixer Crew** | Safehouse, Garage, Bar | Warehouse, Apartment | Office, Factory |
| **Cult** | Temple, Compound, Safehouse | Residence, Warehouse | Government, Corporate |
| **Mercenary** | Armory, Barracks, Garage | Safehouse, Warehouse | Retail, Office |
| **Media** | Office, Server Farm, Studio | Safehouse, Apartment | Factory, Warehouse |
| **Underground** | Server Farm, Safehouse, Bunker | Warehouse, Apartment | Street Corner, Office |

### Location Types by Category

**Legitimate Front**:
- Office, Retail, Restaurant, Nightclub, Casino, Factory

**Criminal Operations**:
- Safehouse, Warehouse, Chop Shop, Brothel, Drug Lab, Smuggling Dock

**Technical Infrastructure**:
- Server Farm, Research Lab, Workshop, Armory

**Residential/Social**:
- Apartment, Compound, Temple, Barracks

**Government/Civic**:
- Government Building, Precinct, Courthouse, Hospital

**Organization Decision Loop** (each tick):
```
1. Evaluate current goals
2. Check resource levels
3. Generate missions to achieve goals
4. Assign agents to missions
5. Process completed missions
6. Update relationships based on events
7. Recruit if understaffed
8. Adjust goals based on situation
```

### 2. Agents

Individual actors in the simulation.

```typescript
interface Agent extends Entity {
  // Status
  status: AgentStatus;
  age: number;            // In phases (or years for display)

  // Stats - two categories
  stats: {
    // Operations stats (missions, combat, infiltration)
    force: number;        // Combat, intimidation, physical power
    mobility: number;     // Stealth, infiltration, agility, escape
    tech: number;         // Hacking, electronics, digital systems

    // Enterprise stats (business, politics, development)
    social: number;       // Negotiation, leadership, manipulation
    business: number;     // Economics, trade, management, logistics
    engineering: number;  // Research, manufacturing, repair, construction
  };

  // Employment
  employer?: OrgRef;
  role?: string;          // "soldier", "hacker", "lieutenant", "accountant", etc.
  salary: number;

  // Current activity
  currentAction?: Action;
  actionQueue: Action[];

  // History
  history: HistoryEntry[];

  // AI
  ai: AgentAI;
}
```

**Agent Stat Categories**:

| Category | Stats | Used For |
|----------|-------|----------|
| **Operations** | Force, Mobility, Tech | Heists, hits, infiltration, sabotage, extraction |
| **Enterprise** | Social, Business, Engineering | Negotiation, trade, manufacturing, research, politics |

**Stat Details**:
- **Force**: Combat, intimidation, physical confrontation, security
- **Mobility**: Stealth, infiltration, escape, surveillance, agility
- **Tech**: Hacking, electronics, digital systems, cyberware
- **Social**: Negotiation, leadership, manipulation, diplomacy, recruitment
- **Business**: Economics, trade, logistics, management, accounting
- **Engineering**: R&D, manufacturing, repair, construction, vehicle/gear maintenance

type AgentStatus =
  | "available"    // Free agent, seeking work
  | "employed"     // Working for an org
  | "on_mission"   // Currently on a mission
  | "wounded"      // Recovering
  | "captured"     // Held by another org
  | "dead"         // Deceased
  | "retired";     // Left the life

interface AgentAI {
  // Personality drives decisions
  personality: {
    greed: number;        // Money motivation
    ambition: number;     // Power motivation
    violence: number;     // Willingness to use force
    loyalty: number;      // Stick with employer
    survival: number;     // Self-preservation
  };

  // Current mood/state
  morale: number;
  fear: number;
  satisfaction: number;
}
```

**Agent Decision Loop** (when unemployed):
```
1. Evaluate offers from organizations
2. Consider org reputation, pay, risk
3. Accept best offer matching personality
4. OR become freelance (take odd jobs)
5. OR retire if old/wealthy enough
6. OR turn to crime if desperate
```

### 3. Locations

Physical places in the city.

```typescript
interface Location extends Entity {
  // Position (no visual map, but logical positioning)
  sector: string;
  district: string;
  coordinates: {
    distance: number;     // From city center
    vertical: number;     // Building floor (0 = ground)
  };

  // Properties
  type: LocationType;
  size: "tiny" | "small" | "medium" | "large" | "massive";
  security: number;       // 0-100

  // Ownership
  owner?: OrgRef;
  previousOwners: { org: OrgRef; from: number; to: number }[];

  // Economics
  baseIncome: number;
  operatingCost: number;

  // Capacity
  agentCapacity: number;  // How many agents can work here
  vehicleCapacity: number;

  // Current state
  occupants: AgentRef[];
  vehicles: VehicleRef[];
}

type LocationType =
  // Legitimate fronts
  | "office"          // Corporate, business operations
  | "retail"          // Shop front, public-facing
  | "restaurant"      // Food service, meetings
  | "nightclub"       // Entertainment, intel gathering
  | "casino"          // Gambling, money laundering
  | "factory"         // Manufacturing, production

  // Criminal operations
  | "safehouse"       // Hidden location, planning
  | "warehouse"       // Storage, smuggling staging
  | "chop_shop"       // Vehicle theft/modification
  | "brothel"         // Vice operations
  | "drug_lab"        // Narcotics production
  | "smuggling_dock"  // Import/export contraband

  // Technical infrastructure
  | "server_farm"     // Data, hacking operations
  | "research_lab"    // R&D, prototyping
  | "workshop"        // Equipment, vehicle repair
  | "armory"          // Weapons storage, training

  // Residential/social
  | "apartment"       // Housing, low-key meetings
  | "compound"        // Fortified residence
  | "temple"          // Cult/religious operations
  | "barracks"        // Military-style housing

  // Government/civic
  | "government_bldg" // Official buildings
  | "precinct"        // Law enforcement
  | "courthouse"      // Legal system
  | "hospital"        // Medical facilities

  // Territorial
  | "street_corner"   // Gang territory marker
  | "garage"          // Vehicle storage
  | "bar"             // Low-key meeting spot
  | "studio";         // Media production
```

### 4. Missions

Tasks created by organizations, executed by agents.

```typescript
interface Mission extends Entity {
  // Origin
  creator: OrgRef;
  createdPhase: number;

  // Classification
  type: MissionType;
  visibility: "public" | "private" | "secret";

  // Requirements
  requirements: {
    force: number;
    stealth: number;
    tech: number;
    social: number;
    minAgents: number;
    maxAgents: number;
    equipment?: EquipmentReq[];
  };

  // Target
  target?: {
    type: "agent" | "organization" | "location" | "object";
    id: string;
  };

  // Timing
  deadline?: number;      // Phase when mission expires
  estimatedDuration: number; // Phases to complete

  // Rewards
  rewards: {
    credits: number;
    reputation: number;
    influence: number;
    special?: any;
  };

  // Penalties
  failurePenalties: {
    credits: number;
    reputation: number;
    heat: number;
  };

  // Execution
  status: MissionStatus;
  assignedOrg?: OrgRef;
  assignedAgents: AgentRef[];
  progress: MissionProgress;

  // Outcome
  outcome?: MissionOutcome;
}

type MissionType =
  // Combat
  | "hit"               // Kill target
  | "raid"              // Attack location
  | "defense"           // Protect location
  | "extraction"        // Rescue/kidnap person

  // Stealth
  | "theft"             // Steal object
  | "infiltration"      // Plant agent/device
  | "sabotage"          // Damage without trace

  // Tech
  | "hack"              // Digital intrusion
  | "surveillance"      // Gather intel
  | "data_theft"        // Steal information

  // Social
  | "negotiate"         // Broker deal
  | "bribe"             // Corrupt official
  | "recruit"           // Turn enemy agent
  | "propaganda"        // Shift public opinion

  // Economic
  | "smuggle"           // Move contraband
  | "extortion"         // Demand payment
  | "heist"             // Major theft

  // Continuous (operations)
  | "patrol"            // Ongoing security
  | "investigation"     // Ongoing intel
  | "racket"            // Ongoing income
  | "training";         // Improve agent stats

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

Transportation and mobile assets.

```typescript
interface Vehicle extends Entity {
  type: VehicleType;

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

type VehicleType =
  // Ground
  | "motorcycle"
  | "sedan"
  | "sports_car"
  | "suv"
  | "van"
  | "truck"
  | "armored_vehicle"

  // Aerial
  | "drone"
  | "helicopter"
  | "vtol";
```

---

## Simulation Logic

### How Organizations Generate Missions

```typescript
function generateOrgMissions(org: Organization, world: World): Mission[] {
  const missions: Mission[] = [];

  for (const goal of org.goals) {
    switch (goal.type) {
      case "expand_territory":
        // Find nearby uncontrolled or weakly-held locations
        // Generate raid/takeover missions
        const targets = findExpansionTargets(org, world);
        missions.push(...targets.map(t => createRaidMission(org, t)));
        break;

      case "destroy_enemy":
        // Generate missions against enemy org
        const enemy = world.getOrg(goal.target);
        missions.push(createHitMission(org, enemy.leadership[0]));
        missions.push(createSabotageMission(org, enemy.locations[0]));
        break;

      case "increase_wealth":
        // Generate income-producing missions
        missions.push(createHeistMission(org, findWealthyTarget(world)));
        missions.push(createExtortionMission(org, findVulnerableTarget(world)));
        break;

      case "reduce_heat":
        // Generate missions to reduce law enforcement attention
        missions.push(createBribeMission(org, findCorruptOfficial(world)));
        break;

      // ... etc
    }
  }

  return prioritizeAndFilter(missions, org.resources);
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
  const archetype = pickRandom(["combat", "stealth", "tech", "social", "balanced"]);
  const stats = generateStatsForArchetype(archetype);

  // Random personality
  const personality = {
    greed: randomRange(20, 80),
    ambition: randomRange(20, 80),
    violence: randomRange(10, 90),
    loyalty: randomRange(30, 90),
    survival: randomRange(40, 90),
  };

  // Generate name
  const name = generateCyberpunkName();

  return {
    id: uuid(),
    name,
    created: world.currentPhase,
    tags: [archetype],
    relationships: [],
    status: "available",
    age: randomRange(20, 50) * PHASES_PER_YEAR,
    stats,
    ai: { personality, morale: 50, fear: 0, satisfaction: 50 },
    history: [],
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

**Features**:
- Browse all entities (Django-admin style lists)
- Watch real-time activity log
- View org power rankings
- See relationships graph
- Fast-forward time (1x, 10x, 100x speed)
- Pause and inspect
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
│  [PAUSE]  [1x]  [10x]  [100x]  ████████████░░░░ Phase 1247     │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Fixer Mode

**Purpose**: Take control of one organization and try to complete a mission chain.

**Setup**:
1. Generate city
2. Run simulation for N phases (e.g., 500) to create history
3. Present player with org selection screen
4. Player picks an org (or creates a new fixer crew)
5. Game reveals mission chain (win condition)
6. Player controls that org; AI controls everything else

**Player Controls**:
- Hire/fire agents
- Accept/create missions
- Assign agents to missions
- Purchase equipment, vehicles, locations
- Set org priorities
- Manage relationships (declare war, propose alliance)

**Victory**: Complete the procedurally generated mission chain
**Defeat**: Org destroyed, bankrupt, or player gives up

### 3. Agent Mode (Future)

**Purpose**: Control a single agent navigating the underworld.

**Gameplay**:
- Start as a free agent
- Accept jobs from various orgs
- Build reputation
- Eventually: start own fixer crew (transitions to Fixer Mode)

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
  };

  // Game mode state
  mode: GameMode;
  playerOrg?: string;        // For Fixer Mode
  playerAgent?: string;      // For Agent Mode
  missionChain?: MissionChain; // Win condition
}

type GameMode = "observer" | "fixer" | "agent";
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
│   │   ├── OrgAI.ts          # Organization decision making
│   │   ├── AgentAI.ts        # Agent decision making
│   │   └── MissionAI.ts      # Mission generation/evaluation
│   │
│   ├── systems/
│   │   ├── MissionSystem.ts  # Mission lifecycle
│   │   ├── CombatSystem.ts   # Conflict resolution
│   │   ├── EconomySystem.ts  # Money flow
│   │   ├── PowerSystem.ts    # Influence calculations
│   │   └── EventSystem.ts    # Random events
│   │
│   └── generators/
│       ├── CityGenerator.ts
│       ├── AgentGenerator.ts
│       ├── OrgGenerator.ts
│       └── MissionGenerator.ts
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
└── data/
    ├── names.json            # Name generation data
    ├── config.json           # Balance parameters
    └── templates/            # Entity templates
```

---

## MVP Implementation Plan

### Phase 1: Core Simulation (No UI)
1. Entity types and interfaces
2. World state management
3. Basic tick engine
4. Organization AI (simple)
5. Agent AI (simple)
6. Mission creation and resolution
7. Activity logging

### Phase 2: Observer Mode UI
1. Pixi.js renderer setup
2. Entity list panels (Django-admin style)
3. Activity log panel
4. Time controls (pause, speed)
5. Basic entity detail views

### Phase 3: Procedural Generation
1. City generator
2. Organization generator
3. Agent generator
4. Initial world setup
5. "Burn in" simulation (run N phases to create history)

### Phase 4: Fixer Mode
1. Org selection screen
2. Player control override
3. Mission chain generation
4. Win/lose conditions
5. Player-specific UI enhancements

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

## Core Concepts
- **Simulation-first**: The world runs without player input
- **Game modes are views**: Observer, Fixer, Agent modes view same simulation
- **Organizations drive the sim**: Orgs generate missions, agents execute them
- **Activity log**: All events logged for emergent narrative

## Agent Stats
- **Operations**: Force, Mobility, Tech (missions, combat)
- **Enterprise**: Social, Business, Engineering (economy, politics)

## Critical Conventions
- Entity IDs are UUIDs
- Every org has exactly ONE leader (leader field) plus leadership array
- Locations have org-specific preferences (gangs → safehouses, corps → offices)
- All significant events must be logged to ActivityLog
- Never mutate state directly, use store actions

## Key Files
- Simulation loop: `src/simulation/TickEngine.ts`
- World state: `src/simulation/World.ts`
- Organization AI: `src/simulation/ai/OrgAI.ts`
- Agent AI: `src/simulation/ai/AgentAI.ts`
- Activity log: `src/simulation/ActivityLog.ts`
- Types: `src/types/*.ts`
- Balance: `data/config.json`

## Common Pitfalls
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
- **Organization (Org)**: Group entity (corp, gang, government, etc.)
- **Agent**: Individual operative with stats and personality
- **Location**: Physical place in the city with type and owner
- **Mission**: Task created by one org, potentially executed by another
- **Leader**: Single agent who runs an organization

### Stats
- **Operations Stats**: Force, Mobility, Tech - used for missions, combat
- **Enterprise Stats**: Social, Business, Engineering - used for economy, politics
- **Power Score**: Combined military (0.3) + economic (0.4) + political (0.3) strength

### Systems
- **Activity Log**: Record of all significant events for emergent narrative
- **Infrastructure Preferences**: Which location types each org type gravitates toward

### Game Modes
- **Observer Mode**: Player watches simulation without control
- **Fixer Mode**: Player controls one organization
- **Agent Mode**: Player controls one agent (future)

---

*Document Version: 2.1*
*Created: 2025-12-23*
*Rewritten: 2025-12-24 - Simulation-first architecture*
*Updated: 2025-12-24 - Added enterprise stats, infrastructure preferences, living docs*
