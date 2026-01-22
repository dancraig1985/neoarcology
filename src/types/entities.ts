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
export type BuildingRef = EntityRef;
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
  fatigue: number; // 0-100, forces rest at 100 (not fatal)
  leisure: number; // 0-100, high = wants entertainment (not fatal)
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

  // Work shift state (only present when employed)
  shiftState?: {
    phasesWorked: number; // Phases worked in current shift
    lastShiftEndPhase: number; // When last shift ended (for cooldown)
    shiftStartPhase: number; // When current shift started
  };

  // Delivery shift state (only present when employed at depot)
  deliveryShiftState?: {
    phasesDelivered: number; // Phases worked on deliveries in current shift
    lastShiftEndPhase: number; // When last shift ended (for cooldown)
    shiftStartPhase: number; // When current shift started

    // Active delivery tracking (NEW - replaces task.params for delivery state)
    activeDelivery?: {
      orderId: string; // Which order being delivered
      vehicleId: string; // Which vehicle being used
      action: 'traveling_to_pickup' | 'loading_and_traveling' | 'unloading'; // Current action
      actionStartPhase: number; // When this action started
      expectedDuration: number; // How long action should take
    };
  };

  // Corpse collection shift state (PLAN-039, only present when employed at clinic)
  corpseShiftState?: {
    phasesWorked: number; // Phases worked in current corpse shift
    lastShiftEndPhase: number; // When last shift ended (for cooldown)
    shiftStartPhase: number; // When current shift started
    currentPhase: 'scanning' | 'traveling_to_corpse' | 'loading' | 'returning'; // Current collection phase
    targetLocationId?: string; // Location with corpse being collected
    vehicleId?: string; // Ambulance being used
  };

  // Pub visit state (only present when visiting pub)
  pubVisitState?: {
    phasesAtPub: number; // Phases spent at pub in current visit
    pubId: LocationRef; // Which pub being visited
  };

  // Personal finances
  wallet: Wallet;

  // Physical location - agent is either at a location OR in transit OR in a vehicle
  currentLocation?: LocationRef; // Where agent IS (undefined = in transit or in vehicle)

  // Vehicle state (when riding as driver or passenger)
  inVehicle?: VehicleRef; // Set when agent is inside a vehicle
  // When inVehicle is set:
  // - Agent's location = vehicle's location (single source of truth)
  // - Agent doesn't travel independently
  // - Vehicle handles movement

  // Travel state (only set while traveling on foot/transit, NOT when in vehicle)
  travelingFrom?: LocationRef; // Origin of current travel
  travelingTo?: LocationRef; // Destination
  travelMethod?: TravelMethod; // How they're traveling
  travelPhasesRemaining?: number; // Phases until arrival

  // Housing
  residence?: LocationRef; // Where agent lives (apartment they rent)

  // Current task (behavior system)
  currentTask?: AgentTask;

  // Mood
  morale: number; // -100 to +100

  // Personal goals (may conflict with org goals)
  personalGoals: PersonalGoal[];
}

export type TravelMethod = 'walk' | 'transit' | 'truck';

/**
 * Agent Status
 */
export type AgentStatus =
  | 'available'   // Not employed, can seek work or start business
  | 'employed'    // Working at a location for an org
  | 'dead';       // Deceased, no longer active

/**
 * Task Priority - determines interrupt behavior
 * - critical: Always interrupts (emergency hunger, forced rest)
 * - high: Interrupts normal tasks (urgent rest)
 * - normal: Completes before re-evaluation (commuting, buying food)
 * - idle: Runs when no other task (wandering)
 */
export type TaskPriority = 'critical' | 'high' | 'normal' | 'idle';

/**
 * AgentTask - what an agent is currently doing
 * Type is a string (behavior ID from config), not an enum
 */
export interface AgentTask {
  type: string;              // Behavior ID from behaviors.json
  priority: TaskPriority;
  startedPhase: number;
  targetId?: string;         // Target location/entity
  targetName?: string;       // For logging/display
  params?: Record<string, unknown>;  // Task-specific parameters
}

/**
 * @deprecated Use AgentTask instead
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

  // Weekly cycle offset (0-55) - staggers payroll/rent across week
  // Org processes weekly operations when (phase % 56) === weeklyPhaseOffset
  weeklyPhaseOffset: number;
}

/**
 * Building - physical structures that contain locations
 * A city block (grid cell) can have multiple buildings
 * Buildings are infrastructure containers, not actors
 */
export interface Building extends Entity {
  // Grid position (which city block this building is in)
  x: number;        // Grid x coordinate (city block)
  y: number;        // Grid y coordinate (city block)

  // Vertical extent
  floors: number;   // Total floors (0 to floors-1)

  // Capacity per floor (how many location units can fit)
  unitsPerFloor: number;

  // Which location tags this building allows
  allowedLocationTags: string[];
}

/**
 * Location - physical places in the city
 * Tags determine functionality (income, storage, fortified, etc.)
 * Locations exist inside buildings (or outdoors with direct coords)
 */
export interface Location extends Entity {
  // Building reference (for indoor locations)
  building?: BuildingRef;  // Parent building (undefined = outdoor location)
  floor: number;           // Floor within building (0 for outdoor/ground)
  unit?: number;           // Unit on floor (0 to unitsPerFloor-1)

  // Grid coordinates - always set
  // For indoor locations: copied from building.x, building.y at creation
  // For outdoor locations: set directly
  x: number;        // Grid x coordinate
  y: number;        // Grid y coordinate

  // Properties
  size: number; // 1-5 scale
  security: number; // 0-100

  // Ownership - can be Agent (small business) or Org (corporation)
  owner?: AgentRef | OrgRef;
  ownerType: 'agent' | 'org' | 'none';
  previousOwners: { ownerId: EntityRef; from: number; to: number }[];
  forSale?: boolean; // True when location is orphaned and available for purchase

  // Employment
  employees: AgentRef[];
  employeeSlots: number;

  // Housing (for residential locations)
  residents?: AgentRef[]; // Who lives here
  maxResidents?: number; // Capacity (1 for apartment, more for shelter)
  rentCost?: number; // Weekly rent (0 for shelters)

  // Economics
  baseIncome: number;
  operatingCost: number;

  // Capacity
  agentCapacity: number;
  vehicleCapacity: number;

  // Current state
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
 * Vehicle - Robust system for logistics and personal transport
 * Vehicles travel between buildings (not locations)
 * Agents board vehicles and travel with them
 */
export interface Vehicle {
  id: string;
  name: string;
  template: string;  // 'cargo_truck', 'motorcycle', 'sedan', 'aerial', etc.
  created: number;   // Phase when spawned
  owner: OrgRef | AgentRef;  // Org (fleet) or agent (personal vehicle)

  // Occupancy - who's inside the vehicle
  operator?: AgentRef;  // Driver (undefined = parked/autonomous)
  passengers: AgentRef[];  // Riders, guards, passengers

  // Building-level location (vehicles operate at building level, not location level)
  currentBuilding?: BuildingRef;  // Where parked (undefined = in transit between buildings)

  // Travel state - vehicles travel like agents
  travelingFromBuilding?: BuildingRef;
  travelingToBuilding?: BuildingRef;
  travelMethod?: string;  // Transport mode (truck, aerial, etc.)
  travelPhasesRemaining?: number;  // Phases until arrival

  // Cargo (for trucks/transport vehicles)
  cargo: Inventory;  // Goods being transported
  cargoCapacity: number;  // Max cargo space (in size units, not item count)
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

/**
 * Order - Universal business transaction
 * Replaces DeliveryRequest with a unified model for all commerce
 *
 * Order Types:
 * - 'logistics': Delivery service (formerly DeliveryRequest)
 * - 'goods': B2B wholesale order (retail → wholesale)
 */
export interface Order {
  id: string;
  orderType: 'logistics' | 'goods';
  created: number; // Phase when order was placed
  buyer: EntityRef; // Org placing/requesting the order
  seller: EntityRef; // Org fulfilling the order
  status: 'pending' | 'assigned' | 'in_production' | 'ready' | 'in_transit' | 'delivered' | 'cancelled' | 'failed';
  fulfilled?: number; // Phase when completed/delivered
  parentOrderId?: string; // For logistics orders created from goods orders

  // For goods orders (B2B wholesale)
  good?: string; // 'provisions', 'alcohol', etc.
  quantity?: number;
  totalPrice?: number;
  pickupLocation?: LocationRef; // Where seller will have goods ready (assigned during fulfillment)
  deliveryLocation?: LocationRef; // Where buyer wants delivery

  // For logistics orders (delivery service)
  fromLocation?: LocationRef; // Pickup location
  toLocation?: LocationRef; // Delivery destination
  cargo?: Record<string, number>; // Goods being transported
  payment?: number; // Delivery fee paid to logistics company
  urgency?: 'low' | 'medium' | 'high';
  assignedDriver?: AgentRef; // Which trucker is handling this
  assignedVehicle?: VehicleRef; // Which truck is being used
  assignedAt?: number; // When driver assigned
}

/**
 * @deprecated Use Order with orderType='logistics' instead
 * Kept temporarily for backward compatibility during migration
 */
export type DeliveryRequest = Order;
