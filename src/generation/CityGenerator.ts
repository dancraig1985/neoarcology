/**
 * CityGenerator - Orchestrates procedural city generation
 *
 * Generates:
 * - Zone grid with height map
 * - Initial locations respecting spawn constraints
 * - Initial agents and orgs
 *
 * All generation parameters are read from templates and config files.
 */

import {
  LoadedConfig,
  LocationTemplate,
  AgentTemplate,
  OrgTemplate,
  SpawnConstraints,
  MinMaxRange,
} from '../config/ConfigLoader';
import { Agent, Location, Organization, Wallet } from '../types';
import { CityGrid, GRID_SIZE } from './types';
import { generateZones } from './ZoneGenerator';

const CENTER = GRID_SIZE / 2;

/**
 * Result of city generation
 */
export interface GeneratedCity {
  grid: CityGrid;
  locations: Location[];
  organizations: Organization[];
  agents: Agent[];
}

/**
 * Generation counters for unique IDs
 */
let locationIdCounter = 0;
let orgIdCounter = 0;
let agentIdCounter = 0;

function nextLocationId(): string {
  return `loc_${++locationIdCounter}`;
}

function nextOrgId(): string {
  return `org_${++orgIdCounter}`;
}

function nextAgentId(): string {
  return `agent_${++agentIdCounter}`;
}

/**
 * Reset ID counters (for testing)
 */
export function resetIdCounters(): void {
  locationIdCounter = 0;
  orgIdCounter = 0;
  agentIdCounter = 0;
}

/**
 * Random number generator with optional seed
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

/**
 * Pick a random item from array
 */
function pickRandom<T>(array: T[], rand: () => number): T {
  return array[Math.floor(rand() * array.length)] as T;
}

/**
 * Random integer from MinMaxRange
 */
function randomFromRange(range: MinMaxRange, rand: () => number): number {
  return Math.floor(rand() * (range.max - range.min + 1)) + range.min;
}

/**
 * Random integer in range [min, max]
 */
function randomInt(min: number, max: number, rand: () => number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

/**
 * Calculate grid distance from center
 */
function distanceFromCenter(x: number, y: number): number {
  const dx = x - CENTER;
  const dy = y - CENTER;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if a cell's zone is valid for given spawn constraints
 */
function isValidZone(
  grid: CityGrid,
  x: number,
  y: number,
  constraints: SpawnConstraints | undefined
): boolean {
  if (!constraints || constraints.allowedZones.length === 0) {
    return true;
  }

  const col = grid.cells[x];
  if (!col) return false;
  const cell = col[y];
  if (!cell) return false;

  return constraints.allowedZones.includes(cell.zone);
}

/**
 * Check if a floor is valid for given spawn constraints
 */
function isValidFloor(
  grid: CityGrid,
  x: number,
  y: number,
  floor: number,
  constraints: SpawnConstraints | undefined
): boolean {
  const col = grid.cells[x];
  if (!col) return false;
  const cell = col[y];
  if (!cell) return false;

  if (floor > cell.maxHeight) return false;
  if (!constraints) return true;

  const [minFloor, maxFloor] = constraints.floorRange;
  return floor >= minFloor && floor <= maxFloor;
}

/**
 * Find a valid placement for a location
 */
function findValidPlacement(
  grid: CityGrid,
  constraints: SpawnConstraints | undefined,
  rand: () => number,
  attempts: number = 100
): { x: number; y: number; floor: number } | null {
  for (let i = 0; i < attempts; i++) {
    const x = randomInt(0, GRID_SIZE - 1, rand);
    const y = randomInt(0, GRID_SIZE - 1, rand);

    if (!isValidZone(grid, x, y, constraints)) continue;

    if (constraints?.minDistanceFromCenter) {
      if (distanceFromCenter(x, y) < constraints.minDistanceFromCenter) continue;
    }

    const col = grid.cells[x];
    if (!col) continue;
    const cell = col[y];
    if (!cell) continue;

    let floor = 0;
    if (constraints) {
      const [minFloor, maxFloor] = constraints.floorRange;
      const effectiveMax = Math.min(maxFloor, cell.maxHeight);

      if (constraints.preferGroundFloor) {
        floor = minFloor;
      } else if (constraints.preferHighFloor) {
        floor = effectiveMax;
      } else {
        floor = randomInt(minFloor, effectiveMax, rand);
      }
    }

    if (isValidFloor(grid, x, y, floor, constraints)) {
      return { x, y, floor };
    }
  }

  return null;
}

/**
 * Create initial wallet with specified credits
 */
function createWallet(credits: number): Wallet {
  return {
    credits,
    accounts: [],
    stashes: [],
  };
}

/**
 * Create a new agent from template
 */
function createAgentFromTemplate(
  name: string,
  template: AgentTemplate,
  phase: number,
  rand: () => number
): Agent {
  const defaults = template.defaults ?? {};
  const stats = defaults.stats ?? {};

  return {
    id: nextAgentId(),
    name,
    template: template.id,
    tags: template.tags ?? ['civilian'],
    created: phase,
    relationships: [],
    status: 'available',
    age: 0,
    stats: {
      force: stats.force ? randomFromRange(stats.force, rand) : randomInt(20, 60, rand),
      mobility: stats.mobility ? randomFromRange(stats.mobility, rand) : randomInt(20, 60, rand),
      tech: stats.tech ? randomFromRange(stats.tech, rand) : randomInt(20, 60, rand),
      social: stats.social ? randomFromRange(stats.social, rand) : randomInt(20, 60, rand),
      business: stats.business ? randomFromRange(stats.business, rand) : randomInt(20, 60, rand),
      engineering: stats.engineering ? randomFromRange(stats.engineering, rand) : randomInt(20, 60, rand),
    },
    needs: {
      hunger: defaults.hunger ? randomFromRange(defaults.hunger, rand) : randomInt(10, 30, rand),
    },
    inventory: {
      provisions: defaults.provisions ? randomFromRange(defaults.provisions, rand) : randomInt(2, 8, rand),
    },
    inventoryCapacity: defaults.inventoryCapacity ?? 20,
    salary: 0,
    wallet: createWallet(defaults.credits ? randomFromRange(defaults.credits, rand) : randomInt(50, 200, rand)),
    morale: defaults.morale ? randomFromRange(defaults.morale, rand) : randomInt(20, 80, rand),
    personalGoals: [],
  };
}

/**
 * Create a new organization from template
 */
function createOrgFromTemplate(
  name: string,
  template: OrgTemplate,
  leaderId: string,
  credits: number,
  phase: number
): Organization {
  return {
    id: nextOrgId(),
    name,
    template: template.id,
    tags: template.tags ?? ['corporation'],
    created: phase,
    relationships: [],
    leader: leaderId,
    wallet: createWallet(credits),
    locations: [],
  };
}

/**
 * Create a location from template
 */
function createLocationFromTemplate(
  name: string,
  template: LocationTemplate,
  x: number,
  y: number,
  floor: number,
  ownerId: string,
  phase: number
): Location {
  const balance = template.balance;
  return {
    id: nextLocationId(),
    name,
    template: template.id,
    tags: template.tags ?? [],
    created: phase,
    relationships: [],
    x,
    y,
    floor,
    size: 1,
    security: 10,
    owner: ownerId,
    ownerType: 'org',
    previousOwners: [],
    employees: [],
    employeeSlots: balance.employeeSlots ?? 0,
    baseIncome: 0,
    operatingCost: balance.operatingCost ?? 0,
    weeklyRevenue: 0,
    weeklyCosts: 0,
    agentCapacity: 10,
    vehicleCapacity: 0,
    occupants: [],
    vehicles: [],
    inventory: {
      provisions: balance.startingInventory ?? 0,
    },
    inventoryCapacity: balance.inventoryCapacity ?? 0,
  };
}

/**
 * Generate a complete city using templates from config
 */
export function generateCity(config: LoadedConfig, seed: number = Date.now()): GeneratedCity {
  const rand = seededRandom(seed);

  // Generate zone grid
  const grid = generateZones(config.zones, seed);

  const locations: Location[] = [];
  const organizations: Organization[] = [];
  const agents: Agent[] = [];

  // Names for generation
  const firstNames = [
    'Alex', 'Blake', 'Casey', 'Dana', 'Ellis', 'Finn', 'Grey', 'Harper',
    'Indigo', 'Jordan', 'Kai', 'Lennox', 'Morgan', 'Nova', 'Quinn', 'Riley',
    'Sage', 'Taylor', 'Vesper', 'Winter',
  ];
  const lastNames = [
    'Sterling', 'Chen', 'Vasquez', 'Okonkwo', 'Kim', 'Nakamura', 'Petrov',
    'Singh', 'Andersen', 'Okafor', 'Hassan', 'Rivera', 'Yamamoto', 'Johansson', 'Dubois',
  ];

  const shopNames = [
    'Neon Goods', 'Synth Supply', 'Grid Mart', 'Sector Seven', 'Pulse Market',
    'Vertex Shop', 'Arc Provisions', 'Helix Retail', 'Cipher Store', 'Nova Goods',
  ];
  const factoryNames = ['Apex Manufacturing', 'Grid Works', 'Synth Industries', 'Vertex Production', 'Helix Factory'];
  const restaurantNames = ['Neon Bites', 'Synth Eats', 'Grid Kitchen', 'Pulse Diner', 'Arc Cafe'];

  let shopIndex = 0;
  let factoryIndex = 0;
  let restaurantIndex = 0;

  function nextShopName(): string {
    return shopNames[shopIndex++ % shopNames.length] ?? 'Shop';
  }
  function nextFactoryName(): string {
    return factoryNames[factoryIndex++ % factoryNames.length] ?? 'Factory';
  }
  function nextRestaurantName(): string {
    return restaurantNames[restaurantIndex++ % restaurantNames.length] ?? 'Restaurant';
  }
  function nextAgentName(): string {
    return `${pickRandom(firstNames, rand)} ${pickRandom(lastNames, rand)}`;
  }

  // ==================
  // 1. CREATE AGENTS
  // ==================
  const civilianTemplate = config.agentTemplates['civilian'];
  if (civilianTemplate?.generation?.spawnAtStart && civilianTemplate.generation.count) {
    const numAgents = randomFromRange(civilianTemplate.generation.count, rand);
    for (let i = 0; i < numAgents; i++) {
      agents.push(createAgentFromTemplate(nextAgentName(), civilianTemplate, 0, rand));
    }
  }

  // ==================
  // 2. CREATE CORPORATIONS WITH FACTORIES
  // ==================
  const corpTemplate = config.orgTemplates['corporation'];
  const factoryTemplate = config.locationTemplates['factory'];

  if (corpTemplate?.generation?.spawnAtStart && corpTemplate.generation.count) {
    const numCorps = randomFromRange(corpTemplate.generation.count, rand);

    for (let i = 0; i < numCorps; i++) {
      const leader = agents[i];
      if (!leader) continue;

      // Get credits from template
      const credits = corpTemplate.defaults?.credits
        ? randomFromRange(corpTemplate.defaults.credits, rand)
        : randomInt(2000, 5000, rand);

      const corpName = `${pickRandom(lastNames, rand)} Industries`;
      const corp = createOrgFromTemplate(corpName, corpTemplate, leader.id, credits, 0);

      // Set leader as employed
      if (corpTemplate.generation.leaderBecomesEmployed) {
        leader.status = 'employed';
        leader.employer = corp.id;
      }

      // Create factory for corporation (from ownsLocations)
      if (corpTemplate.generation.ownsLocations?.includes('factory') && factoryTemplate) {
        const placement = findValidPlacement(grid, factoryTemplate.spawnConstraints, rand);
        if (placement) {
          const factory = createLocationFromTemplate(
            nextFactoryName(),
            factoryTemplate,
            placement.x,
            placement.y,
            placement.floor,
            corp.id,
            0
          );
          locations.push(factory);
          corp.locations.push(factory.id);
        }
      }

      organizations.push(corp);
    }
  }

  // ==================
  // 3. CREATE RETAIL SHOPS (with small business orgs)
  // ==================
  const shopTemplate = config.locationTemplates['retail_shop'];
  const shopOrgTemplateId = shopTemplate?.generation?.ownerOrgTemplate ?? 'small_business';
  const shopOrgTemplate = config.orgTemplates[shopOrgTemplateId];

  if (shopTemplate?.generation?.spawnAtStart && shopTemplate.generation.count && shopOrgTemplate) {
    const numShops = randomFromRange(shopTemplate.generation.count, rand);

    for (let i = 0; i < numShops; i++) {
      const ownerIdx = agents.findIndex((a) => a.status === 'available');
      if (ownerIdx === -1) break;

      const owner = agents[ownerIdx];
      if (!owner) continue;

      // Credits: location template override > org template default > fallback
      const orgCredits = shopTemplate.generation.ownerCredits
        ? randomFromRange(shopTemplate.generation.ownerCredits, rand)
        : shopOrgTemplate.defaults?.credits
          ? randomFromRange(shopOrgTemplate.defaults.credits, rand)
          : randomInt(300, 600, rand);

      const shopOrg = createOrgFromTemplate(
        `${owner.name}'s Shop`,
        shopOrgTemplate,
        owner.id,
        orgCredits,
        0
      );

      // Set owner as employed if template specifies
      if (shopOrgTemplate.generation?.leaderBecomesEmployed) {
        owner.status = 'employed';
        owner.employer = shopOrg.id;
      }

      // Create the shop
      const placement = findValidPlacement(grid, shopTemplate.spawnConstraints, rand);
      if (placement) {
        const shop = createLocationFromTemplate(
          nextShopName(),
          shopTemplate,
          placement.x,
          placement.y,
          placement.floor,
          shopOrg.id,
          0
        );
        locations.push(shop);
        shopOrg.locations.push(shop.id);
      }

      organizations.push(shopOrg);
    }
  }

  // ==================
  // 4. CREATE RESTAURANTS (with small business orgs)
  // ==================
  const restaurantTemplate = config.locationTemplates['restaurant'];
  const restaurantOrgTemplateId = restaurantTemplate?.generation?.ownerOrgTemplate ?? 'small_business';
  const restaurantOrgTemplate = config.orgTemplates[restaurantOrgTemplateId];

  if (restaurantTemplate?.generation?.spawnAtStart && restaurantTemplate.generation.count && restaurantOrgTemplate) {
    const numRestaurants = randomFromRange(restaurantTemplate.generation.count, rand);

    for (let i = 0; i < numRestaurants; i++) {
      const ownerIdx = agents.findIndex((a) => a.status === 'available');
      if (ownerIdx === -1) break;

      const owner = agents[ownerIdx];
      if (!owner) continue;

      // Credits: location template override > org template default > fallback
      const orgCredits = restaurantTemplate.generation.ownerCredits
        ? randomFromRange(restaurantTemplate.generation.ownerCredits, rand)
        : restaurantOrgTemplate.defaults?.credits
          ? randomFromRange(restaurantOrgTemplate.defaults.credits, rand)
          : randomInt(200, 400, rand);

      const restaurantOrg = createOrgFromTemplate(
        `${owner.name}'s Restaurant`,
        restaurantOrgTemplate,
        owner.id,
        orgCredits,
        0
      );

      // Set owner as employed if template specifies
      if (restaurantOrgTemplate.generation?.leaderBecomesEmployed) {
        owner.status = 'employed';
        owner.employer = restaurantOrg.id;
      }

      const placement = findValidPlacement(grid, restaurantTemplate.spawnConstraints, rand);
      if (placement) {
        const restaurant = createLocationFromTemplate(
          nextRestaurantName(),
          restaurantTemplate,
          placement.x,
          placement.y,
          placement.floor,
          restaurantOrg.id,
          0
        );
        locations.push(restaurant);
        restaurantOrg.locations.push(restaurant.id);
      }

      organizations.push(restaurantOrg);
    }
  }

  // ==================
  // 5. HIRE INITIAL WORKERS
  // ==================
  const workerConfig = config.balance.generation?.initialWorkers;
  const salaryConfig = config.balance.economy.salary.unskilled;

  if (workerConfig) {
    const numWorkers = randomFromRange(workerConfig, rand);
    const workers = agents.filter((a) => a.status === 'available');

    for (const worker of workers.slice(0, Math.min(numWorkers, workers.length))) {
      const needsWorkers = locations.find((l) => l.employees.length < l.employeeSlots);
      if (!needsWorkers) break;

      worker.status = 'employed';
      worker.employer = needsWorkers.owner;
      worker.employedAt = needsWorkers.id;
      worker.salary = randomFromRange(salaryConfig, rand);
      needsWorkers.employees.push(worker.id);
    }
  }

  console.log(
    `[CityGenerator] Generated city with ${locations.length} locations, ` +
    `${organizations.length} orgs, ${agents.length} agents`
  );

  return { grid, locations, organizations, agents };
}
