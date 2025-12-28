/**
 * ConfigLoader - Load JSON configuration and template files
 * Reads from the data/ folder at runtime
 */

/**
 * Simulation configuration from data/config/simulation.json
 * Core simulation parameters (time only)
 */
export interface SimulationConfig {
  time: {
    phasesPerDay: number;
    phasesPerWeek: number;
    phasesPerMonth: number;
    phasesPerYear: number;
  };
}

/**
 * Goods category configuration (size, prices, etc.)
 */
export interface GoodsConfig {
  size: number;           // How much inventory space 1 unit occupies
  retailPrice: number;    // Price when sold to consumers
  wholesalePrice: number; // Price for B2B transactions
}

/**
 * Economy configuration from data/config/economy.json
 * All economic parameters: pricing, salaries, goods
 */
export interface EconomyConfig {
  goods: Record<string, GoodsConfig>;
  defaultGoodsSize: number;
  salary: {
    unskilled: { min: number; max: number };
  };
  entrepreneurThreshold: number;
}

/**
 * Agent behavior configuration from data/config/agents.json
 * Runtime agent behavior (not generation defaults - those are in templates)
 */
export interface AgentsConfig {
  hunger: {
    perPhase: number;
    threshold: number;
    max: number;
    provisionsPerMeal: number;
  };
  inventoryCapacity: number;
}

/**
 * Zone configuration
 * Defines city zone types and their procedural generation parameters
 */
export interface ZoneConfig {
  name: string;
  color: string;           // Hex color for map visualization
  heightRange: [number, number]; // [min, max] floors for buildings
  sizeRange: [number, number];   // [min, max] target cells for this zone
  spawnWeight: number;     // Base probability for zone assignment
  centerBias: number;      // 0-1, how much this zone prefers city center
  edgeBias: number;        // 0-1, how much this zone prefers city edges
  avoidZones: string[];    // Zone IDs this zone shouldn't be adjacent to
  description: string;
}

/**
 * City configuration from data/config/city.json
 * Zone definitions and city generation parameters
 */
export interface CityConfig {
  zones: Record<string, ZoneConfig>;
  generation: {
    initialWorkers: { min: number; max: number };
  };
}

/**
 * Distance threshold for transport mode
 */
export interface DistanceThreshold {
  maxDistance: number;
  phases: number;
}

/**
 * Transport mode configuration
 */
export interface TransportModeConfig {
  name: string;
  description: string;
  available: boolean;
  requiresOwnership?: boolean;
  distanceThresholds: DistanceThreshold[];
}

/**
 * Transport configuration file structure
 */
export interface TransportConfig {
  transportModes: Record<string, TransportModeConfig>;
  defaultMode: string;
}

/**
 * Spawn constraints for location templates
 * Determines where locations can be placed in the city
 */
export interface SpawnConstraints {
  allowedZones: string[];       // Zone IDs where this location can spawn
  floorRange: [number, number]; // [min, max] floor for placement
  preferGroundFloor?: boolean;  // Higher chance to spawn on floor 0
  preferHighFloor?: boolean;    // Higher chance to spawn on upper floors
  minDistanceFromCenter?: number; // Minimum grid distance from city center
  maxPerCity?: number;          // Maximum instances in the entire city
}

/**
 * Range with min/max values for generation
 */
export interface MinMaxRange {
  min: number;
  max: number;
}

/**
 * Generation hints for templates
 */
export interface GenerationHints {
  count?: MinMaxRange;      // How many to spawn at city generation
  spawnAtStart?: boolean;   // Should this spawn during initial generation
  ownerOrgTemplate?: string; // Org template ID for auto-created owner (e.g., 'small_business')
  ownerCredits?: MinMaxRange; // Starting credits for owner org (overrides org template default)
  ownsLocations?: string[];  // Location types this org spawns with
  leaderBecomesEmployed?: boolean; // Does the leader become employed by this org
}

/**
 * Entity template loaded from data/templates/
 * Only includes fields actually used by the code
 */
export interface EntityTemplate {
  id: string;
  name: string;
  description?: string;
  tags: string[] | null;
  generation?: GenerationHints;
}

/**
 * Agent template with defaults for stat generation
 */
export interface AgentTemplate extends EntityTemplate {
  defaults?: {
    stats?: {
      force?: MinMaxRange;
      mobility?: MinMaxRange;
      tech?: MinMaxRange;
      social?: MinMaxRange;
      business?: MinMaxRange;
      engineering?: MinMaxRange;
    };
    credits?: MinMaxRange;
    provisions?: MinMaxRange;
    hunger?: MinMaxRange;
    morale?: MinMaxRange;
    inventoryCapacity?: number;
  };
}

/**
 * Organization template with defaults
 */
export interface OrgTemplate extends EntityTemplate {
  defaults?: {
    credits?: MinMaxRange;
  };
}

/**
 * Production configuration for a single good type
 * Factories can produce multiple goods at different rates
 */
export interface ProductionConfig {
  good: string;              // e.g., "provisions", "small_arms", "heavy_weapons"
  amountPerEmployee: number; // How much each worker produces per cycle
  phasesPerCycle: number;    // Production interval: 1 = every phase, 4 = daily, 28 = weekly
}

/**
 * Location template with balance section and spawn constraints
 */
export interface LocationTemplate extends EntityTemplate {
  spawnConstraints?: SpawnConstraints;
  balance: {
    openingCost?: number;
    operatingCost?: number;
    employeeSlots?: number;
    startingInventory?: number;
    inventoryCapacity?: number;
    rentCost?: number;          // For residential locations
    maxResidents?: number;      // For residential locations
    production?: ProductionConfig[]; // Optional: what goods this location produces
  };
}

/**
 * All loaded configuration
 */
export interface LoadedConfig {
  simulation: SimulationConfig;
  economy: EconomyConfig;
  agents: AgentsConfig;
  city: CityConfig;
  transport: TransportConfig;
  templates: {
    orgs: OrgTemplate[];
    agents: AgentTemplate[];
    locations: LocationTemplate[];
  };
  /** Convenience lookup: locationTemplates['retail_shop'] */
  locationTemplates: Record<string, LocationTemplate>;
  /** Convenience lookup: agentTemplates['civilian'] */
  agentTemplates: Record<string, AgentTemplate>;
  /** Convenience lookup: orgTemplates['corporation'] */
  orgTemplates: Record<string, OrgTemplate>;
}

/**
 * Load all configuration from the data/ folder
 */
export async function loadConfig(): Promise<LoadedConfig> {
  console.log('[ConfigLoader] Loading configuration...');

  // Load simulation config (time only)
  const simulationResponse = await fetch('/data/config/simulation.json');
  const simulation = (await simulationResponse.json()) as SimulationConfig;
  console.log('[ConfigLoader] Loaded simulation config');

  // Load economy config (goods, salaries, pricing)
  const economyResponse = await fetch('/data/config/economy.json');
  const economy = (await economyResponse.json()) as EconomyConfig;
  console.log(`[ConfigLoader] Loaded economy config (${Object.keys(economy.goods).length} goods)`);

  // Load agents config (behavior parameters)
  const agentsResponse = await fetch('/data/config/agents.json');
  const agents = (await agentsResponse.json()) as AgentsConfig;
  console.log('[ConfigLoader] Loaded agents config');

  // Load city config (zones + generation)
  const cityResponse = await fetch('/data/config/city.json');
  const city = (await cityResponse.json()) as CityConfig;
  console.log(`[ConfigLoader] Loaded city config (${Object.keys(city.zones).length} zones)`);

  // Load transport config
  const transportResponse = await fetch('/data/config/transport.json');
  const transport = (await transportResponse.json()) as TransportConfig;
  console.log(`[ConfigLoader] Loaded transport config (${Object.keys(transport.transportModes).length} modes)`);

  // Load templates
  const orgTemplates = (await loadTemplates('/data/templates/orgs')) as OrgTemplate[];
  const agentTemplates = (await loadTemplates('/data/templates/agents')) as AgentTemplate[];
  const locationTemplates = (await loadTemplates(
    '/data/templates/locations'
  )) as LocationTemplate[];

  // Build lookup maps
  const locationTemplateMap: Record<string, LocationTemplate> = {};
  for (const template of locationTemplates) {
    locationTemplateMap[template.id] = template;
  }

  const agentTemplateMap: Record<string, AgentTemplate> = {};
  for (const template of agentTemplates) {
    agentTemplateMap[template.id] = template;
  }

  const orgTemplateMap: Record<string, OrgTemplate> = {};
  for (const template of orgTemplates) {
    orgTemplateMap[template.id] = template;
  }

  console.log(
    `[ConfigLoader] Loaded templates: ${orgTemplates.length} orgs, ${agentTemplates.length} agents, ${locationTemplates.length} locations`
  );

  return {
    simulation,
    economy,
    agents,
    city,
    transport,
    templates: {
      orgs: orgTemplates,
      agents: agentTemplates,
      locations: locationTemplates,
    },
    locationTemplates: locationTemplateMap,
    agentTemplates: agentTemplateMap,
    orgTemplates: orgTemplateMap,
  };
}

/**
 * Load all template files from a directory
 * Note: In a real implementation, we'd need a manifest or server-side listing
 * For now, we use known template files
 */
async function loadTemplates(basePath: string): Promise<EntityTemplate[]> {
  const templates: EntityTemplate[] = [];

  // Known template files (in production, this could be a manifest)
  const knownTemplates: Record<string, string[]> = {
    '/data/templates/orgs': ['corporation.json', 'small_business.json'],
    '/data/templates/agents': ['civilian.json'],
    '/data/templates/locations': [
      'factory.json',
      'retail_shop.json',
      'restaurant.json',
    ],
  };

  const files = knownTemplates[basePath] ?? [];

  for (const file of files) {
    try {
      const response = await fetch(`${basePath}/${file}`);
      if (response.ok) {
        const template = (await response.json()) as EntityTemplate;
        templates.push(template);
      }
    } catch (error) {
      console.warn(`[ConfigLoader] Failed to load template: ${basePath}/${file}`, error);
    }
  }

  return templates;
}
