/**
 * ConfigLoader - Load JSON configuration and template files
 * Reads from the data/ folder at runtime
 */

/**
 * Simulation configuration from data/config/simulation.json
 */
export interface SimulationConfig {
  time: {
    phasesPerDay: number;
    phasesPerWeek: number;
    phasesPerMonth: number;
    phasesPerYear: number;
  };
  economy: {
    startingCredits: {
      agent: { min: number; max: number };
      org: { min: number; max: number };
    };
    salaryMultiplier: number;
  };
  generation: {
    initialAgents: number;
    initialOrgs: number;
    initialLocations: number;
  };
}

/**
 * Goods category configuration (size, prices, etc.)
 * All data for a goods type is grouped together
 */
export interface GoodsConfig {
  size: number;           // How much inventory space 1 unit occupies
  retailPrice: number;    // Price when sold to consumers
  wholesalePrice: number; // Price for B2B transactions
}

/**
 * Balance configuration from data/config/balance.json
 * Designer-tunable parameters for game mechanics
 */
export interface BalanceConfig {
  agent: {
    hungerPerPhase: number;
    hungerThreshold: number;
    hungerMax: number;
    provisionsPerMeal: number;
    startingHungerMin: number;
    startingHungerMax: number;
    startingCreditsMin: number;
    startingCreditsMax: number;
    startingProvisionsMin: number;
    startingProvisionsMax: number;
    entrepreneurThreshold: number;
    inventoryCapacity: number;
  };
  economy: {
    salary: {
      unskilled: { min: number; max: number };
    };
  };
  goods: Record<string, GoodsConfig>;
  defaultGoodsSize: number;
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
 * Location template with balance section
 */
export interface LocationTemplate extends EntityTemplate {
  balance: {
    openingCost: number;
    operatingCost: number;
    employeeSlots: number;
    startingInventory: number;
    inventoryCapacity: number;
    production?: ProductionConfig[]; // Optional: what goods this location produces
  };
}

/**
 * All loaded configuration
 */
export interface LoadedConfig {
  simulation: SimulationConfig;
  balance: BalanceConfig;
  templates: {
    orgs: EntityTemplate[];
    agents: EntityTemplate[];
    locations: LocationTemplate[];
  };
  /** Convenience lookup: locationTemplates['retail_shop'] */
  locationTemplates: Record<string, LocationTemplate>;
}

/**
 * Load all configuration from the data/ folder
 */
export async function loadConfig(): Promise<LoadedConfig> {
  console.log('[ConfigLoader] Loading configuration...');

  // Load simulation config
  const simulationResponse = await fetch('/data/config/simulation.json');
  const simulation = (await simulationResponse.json()) as SimulationConfig;
  console.log('[ConfigLoader] Loaded simulation config');

  // Load balance config
  const balanceResponse = await fetch('/data/config/balance.json');
  const balance = (await balanceResponse.json()) as BalanceConfig;
  console.log('[ConfigLoader] Loaded balance config');

  // Load templates
  const orgTemplates = await loadTemplates('/data/templates/orgs');
  const agentTemplates = await loadTemplates('/data/templates/agents');
  const locationTemplates = (await loadTemplates(
    '/data/templates/locations'
  )) as LocationTemplate[];

  // Build location template lookup map
  const locationTemplateMap: Record<string, LocationTemplate> = {};
  for (const template of locationTemplates) {
    locationTemplateMap[template.id] = template;
  }

  console.log(
    `[ConfigLoader] Loaded templates: ${orgTemplates.length} orgs, ${agentTemplates.length} agents, ${locationTemplates.length} locations`
  );

  return {
    simulation,
    balance,
    templates: {
      orgs: orgTemplates,
      agents: agentTemplates,
      locations: locationTemplates,
    },
    locationTemplates: locationTemplateMap,
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
    '/data/templates/orgs': ['corporation.json', 'gang.json'],
    '/data/templates/agents': ['combat.json'],
    '/data/templates/locations': ['factory.json', 'retail_shop.json', 'restaurant.json'],
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
