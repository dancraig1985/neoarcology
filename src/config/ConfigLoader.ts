/**
 * ConfigLoader - Load JSON configuration and template files
 * Reads from the data/ folder at runtime
 */

/**
 * Population/immigration configuration
 */
export interface PopulationConfig {
  target: number;              // Desired population
  minimum: number;             // Emergency spawning threshold
  spawnCheckInterval: number;  // Phases between checks (28 = weekly)
  spawnRate: number;           // Max new agents per check
  immigrantCredits: { min: number; max: number };
  immigrantProvisions: { min: number; max: number };
}

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
  population?: PopulationConfig;
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
  fatigue: {
    perPhase: number;
    seekRestThreshold: number;
    urgentRestThreshold: number;
    forceRestThreshold: number;
    homeRestReset: number;
    shelterRestReset: number;
    forcedRestReset: number;
  };
  leisure: {
    perPhase: number;
    threshold: number;
    max: number;
    pubSatisfaction: number;
    parkSatisfactionPerPhase: number;
  };
  housing: {
    bufferWeeks: number;
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
  buildingTemplates: string[];  // Which building template IDs can spawn here
  buildingsPerBlock: MinMaxRange; // How many buildings per grid cell
}

/**
 * Building template from data/templates/buildings/
 */
export interface BuildingTemplate extends EntityTemplate {
  floors: MinMaxRange;           // Min/max floors for this building type
  unitsPerFloor: MinMaxRange;    // Min/max location units per floor
  allowedLocationTags: string[]; // Which location tags can be placed here
}

/**
 * City configuration from data/config/city.json
 * Zone definitions for procedural city generation
 */
export interface CityConfig {
  zones: Record<string, ZoneConfig>;
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
  count?: MinMaxRange;      // How many to spawn at city generation (total)
  countPerZone?: MinMaxRange; // How many to spawn per zone type
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
    inventoryGood?: string;     // What good to stock (default: 'provisions')
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
    buildings: BuildingTemplate[];
  };
  /** Convenience lookup: locationTemplates['retail_shop'] */
  locationTemplates: Record<string, LocationTemplate>;
  /** Convenience lookup: agentTemplates['civilian'] */
  agentTemplates: Record<string, AgentTemplate>;
  /** Convenience lookup: orgTemplates['corporation'] */
  orgTemplates: Record<string, OrgTemplate>;
  /** Convenience lookup: buildingTemplates['office_tower'] */
  buildingTemplates: Record<string, BuildingTemplate>;
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
  const buildingTemplates = (await loadTemplates(
    '/data/templates/buildings'
  )) as BuildingTemplate[];

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

  const buildingTemplateMap: Record<string, BuildingTemplate> = {};
  for (const template of buildingTemplates) {
    buildingTemplateMap[template.id] = template;
  }

  console.log(
    `[ConfigLoader] Loaded templates: ${orgTemplates.length} orgs, ${agentTemplates.length} agents, ${locationTemplates.length} locations, ${buildingTemplates.length} buildings`
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
      buildings: buildingTemplates,
    },
    locationTemplates: locationTemplateMap,
    agentTemplates: agentTemplateMap,
    orgTemplates: orgTemplateMap,
    buildingTemplates: buildingTemplateMap,
  };
}

/**
 * Manifest structure generated by scripts/generate-manifest.ts
 */
interface TemplateManifest {
  generated: string;
  templates: {
    orgs: string[];
    agents: string[];
    locations: string[];
    buildings: string[];
  };
}

// Cached manifest (loaded once)
let cachedManifest: TemplateManifest | null = null;

/**
 * Load the template manifest
 * Run `npm run generate:manifest` after adding new template files
 */
async function loadManifest(): Promise<TemplateManifest> {
  if (cachedManifest) return cachedManifest;

  const response = await fetch('/data/manifest.json');
  if (!response.ok) {
    throw new Error('Failed to load manifest.json - run `npm run generate:manifest`');
  }
  cachedManifest = (await response.json()) as TemplateManifest;
  return cachedManifest;
}

/**
 * Load templates from a directory using the manifest
 * The manifest is generated at build time by scripts/generate-manifest.ts
 */
async function loadTemplates(basePath: string): Promise<EntityTemplate[]> {
  const manifest = await loadManifest();
  const templates: EntityTemplate[] = [];

  // Map path to manifest key
  const pathToKey: Record<string, keyof TemplateManifest['templates']> = {
    '/data/templates/orgs': 'orgs',
    '/data/templates/agents': 'agents',
    '/data/templates/locations': 'locations',
    '/data/templates/buildings': 'buildings',
  };

  const key = pathToKey[basePath];
  const files = key ? manifest.templates[key] : [];

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
