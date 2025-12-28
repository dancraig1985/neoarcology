/**
 * Core entity types for NeoArcology
 * Based on GAME-DESIGN.md - Tags over types philosophy
 */

// Economy types imported when needed

// Reference types for entity relationships
export type EntityRef = string; // UUID
export type AgentRef = EntityRef;
export type OrgRef = EntityRef;
export type LocationRef = EntityRef;
export type MissionRef = EntityRef;
export type VehicleRef = EntityRef;

/**
 * Base Entity - all simulation objects inherit from this
 * Uses tags instead of hardcoded types
 */
export interface Entity {
  id: EntityRef;
  name: string;
  template: string; // e.g., "gang", "corporation" - just a string, not an enum
  tags: string[]; // e.g., ["criminal", "violent", "territorial"]
  created: number; // Phase when created
  destroyed?: number; // Phase when destroyed (if applicable)
  relationships: Relationship[];
}

/**
 * Relationship between entities
 * Uses tags for relationship classification
 */
export interface Relationship {
  targetId: EntityRef;
  tags: string[]; // e.g., ["employer", "trusted"] or ["enemy", "blood-feud"]
  strength: number; // -100 to +100
  since: number; // Phase when relationship started
}

/**
 * Agent Stats - 6 numbers that determine task outcomes
 */
export interface AgentStats {
  force: number; // Combat, intimidation, physical power (0-100)
  mobility: number; // Stealth, infiltration, agility, escape (0-100)
  tech: number; // Hacking, electronics, digital systems (0-100)
  social: number; // Negotiation, leadership, manipulation (0-100)
  business: number; // Economics, trade, management, logistics (0-100)
  engineering: number; // Research, manufacturing, repair, construction (0-100)
}

/**
 * Agent Needs - survival requirements
 */
export interface AgentNeeds {
  hunger: number; // 0-100, 100 = death by starvation
  // Future: energy, health, etc.
}

/**
 * Agent Inventory - goods held personally
 */
export interface AgentInventory {
  [goodsCategory: string]: number; // e.g., { provisions: 5 }
}

/**
 * Agent - Individual actors in the simulation
 * Agents are the atomic unit - orgs don't think, their leaders do
 */
export interface Agent extends Entity {
  status: AgentStatus;
  age: number; // In phases

  stats: AgentStats;

  // Survival needs
  needs: AgentNeeds;

  // Personal inventory (goods held)
  inventory: AgentInventory;
  inventoryCapacity: number; // Max goods agent can carry

  // Employment
  employer?: OrgRef;
  employedAt?: LocationRef; // Location where agent works
  salary: number; // Per week

  // Personal finances
  wallet: Wallet;

  // Current activity
  currentAction?: Action;

  // Mood
  morale: number; // -100 to +100

  // Personal goals (may conflict with org goals)
  personalGoals: PersonalGoal[];
}

export type AgentStatus =
  | 'available'
  | 'employed'
  | 'on_mission'
  | 'wounded'
  | 'captured'
  | 'dead'
  | 'retired';

/**
 * Action - what an agent is currently doing
 */
export interface Action {
  type: string;
  startedPhase: number;
  targetId?: EntityRef;
  progress: number;
}

/**
 * Personal Goal - agents have goals independent of their org
 */
export interface PersonalGoal {
  type: PersonalGoalType;
  priority: number; // 1-100
  target?: EntityRef;
  progress: number;
}

export type PersonalGoalType =
  | 'wealth_accumulation'
  | 'revenge'
  | 'protection'
  | 'advancement'
  | 'independence'
  | 'found_org'
  | 'retire'
  | 'mastery'
  | 'reputation'
  | 'romance'
  | 'family'
  | 'ideology';

/**
 * Organization - emergent structures created and run by agents
 * Behavior emerges from Leader Agent Tags + Org Tags
 * MINIMAL for PLAN-003: Just enough for supply chain
 */
export interface Organization extends Entity {
  // Leadership - single leader who makes decisions for the org
  leader: AgentRef;

  // Finances - org has its own wallet separate from leader
  wallet: Wallet;

  // Owned locations (factories, warehouses, etc.)
  locations: LocationRef[];
}

/**
 * Location - physical places in the city
 * Tags determine functionality (income, storage, fortified, etc.)
 */
export interface Location extends Entity {
  // Position on city grid
  x: number;        // Grid x coordinate (0-31)
  y: number;        // Grid y coordinate (0-31)
  floor: number;    // Building floor (0 = ground, up to cell maxHeight)

  // Properties
  size: number; // 1-5 scale
  security: number; // 0-100

  // Ownership - can be Agent (small business) or Org (corporation)
  owner?: AgentRef | OrgRef;
  ownerType: 'agent' | 'org' | 'none';
  previousOwners: { ownerId: EntityRef; from: number; to: number }[];

  // Employment
  employees: AgentRef[];
  employeeSlots: number;

  // Economics
  baseIncome: number;
  operatingCost: number;
  weeklyRevenue: number; // Tracks sales this week
  weeklyCosts: number; // Tracks costs this week

  // Capacity
  agentCapacity: number;
  vehicleCapacity: number;

  // Current state
  occupants: AgentRef[];
  vehicles: VehicleRef[];

  // Inventory
  inventory: Inventory;
  inventoryCapacity: number; // Max goods location can store
}

/**
 * Inventory - goods stored at a location
 * ~16 broad categories, not 1000 items
 */
export interface Inventory {
  [category: string]: number; // e.g., { small_arms: 50, narcotics: 100 }
}

/**
 * Mission - tasks created by leaders, executed by agents
 */
export interface Mission extends Entity {
  // Origin
  creator: OrgRef;
  createdPhase: number;

  // Visibility
  visibility: 'public' | 'private' | 'secret';

  // Requirements
  requirements: MissionRequirements;

  // Target
  target?: {
    entityId: EntityRef;
    targetTags?: string[];
  };

  // Timing
  deadline?: number;
  estimatedDuration: number;

  // Rewards/Penalties
  rewards: Record<string, number>;
  failurePenalties: Record<string, number>;

  // Execution
  status: MissionStatus;
  assignedOrg?: OrgRef;
  assignedAgents: AgentRef[];
  progress: MissionProgress;

  outcome?: MissionOutcome;
}

export interface MissionRequirements {
  stats: Partial<AgentStats>;
  minAgents: number;
  maxAgents: number;
  requiredTags?: string[];
  equipment?: EquipmentRequirement[];
}

export interface EquipmentRequirement {
  category: string;
  quantity: number;
}

export type MissionStatus =
  | 'available'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'expired'
  | 'cancelled';

export interface MissionProgress {
  phaseStarted?: number;
  phasesElapsed: number;
  forceAccumulated: number;
  stealthAccumulated: number;
  techAccumulated: number;
  socialAccumulated: number;
  complications: Complication[];
  currentPhase: 'travel' | 'execution' | 'extraction';
}

export interface Complication {
  type: string;
  severity: number;
  resolved: boolean;
}

export interface MissionOutcome {
  success: boolean;
  actualRewards: Record<string, number>;
  actualPenalties: Record<string, number>;
  agentResults: { agentId: AgentRef; status: AgentStatus }[];
}

/**
 * Vehicle - transportation and mobile assets
 */
export interface Vehicle extends Entity {
  owner?: OrgRef;
  operator?: AgentRef;

  stats: VehicleStats;
  condition: number; // 0-100
  location?: LocationRef;
  maintenanceCost: number; // Per week
}

export interface VehicleStats {
  speed: number;
  capacity: number; // Agent slots
  armor: number;
  stealth: number;
  cargo: number; // Equipment/goods capacity
}

/**
 * Wallet - for tracking credits
 * Both agents and orgs have wallets
 */
export interface Wallet {
  credits: number;
  accounts: BankAccount[];
  stashes: CashStash[];
}

export interface BankAccount {
  id: string;
  balance: number;
  frozen: boolean;
}

export interface CashStash {
  id: string;
  amount: number;
  locationId: LocationRef;
  hidden: boolean;
}
