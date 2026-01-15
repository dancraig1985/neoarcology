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
  BuildingTemplate,
} from '../config/ConfigLoader';
import { Agent, Location, Organization, Wallet, Building } from '../types';
import { CityGrid, GRID_SIZE } from './types';
import { generateZones } from './ZoneGenerator';

const CENTER = GRID_SIZE / 2;

/**
 * Result of city generation
 */
export interface GeneratedCity {
  grid: CityGrid;
  buildings: Building[];
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
let buildingIdCounter = 0;

function nextLocationId(): string {
  return `loc_${++locationIdCounter}`;
}

function nextOrgId(): string {
  return `org_${++orgIdCounter}`;
}

function nextAgentId(): string {
  return `agent_${++agentIdCounter}`;
}

function nextBuildingId(): string {
  return `bld_${++buildingIdCounter}`;
}

/**
 * Reset ID counters (for testing)
 */
export function resetIdCounters(): void {
  locationIdCounter = 0;
  orgIdCounter = 0;
  agentIdCounter = 0;
  buildingIdCounter = 0;
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
 * Find a valid placement within a specific zone
 */
function findValidPlacementInZone(
  grid: CityGrid,
  zoneId: string,
  constraints: SpawnConstraints | undefined,
  rand: () => number,
  attempts: number = 100
): { x: number; y: number; floor: number } | null {
  for (let i = 0; i < attempts; i++) {
    const x = randomInt(0, GRID_SIZE - 1, rand);
    const y = randomInt(0, GRID_SIZE - 1, rand);

    const col = grid.cells[x];
    if (!col) continue;
    const cell = col[y];
    if (!cell) continue;

    // Must be in the specific zone
    if (cell.zone !== zoneId) continue;

    if (constraints?.minDistanceFromCenter) {
      if (distanceFromCenter(x, y) < constraints.minDistanceFromCenter) continue;
    }

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
 * Track which units in each building are occupied
 * Key: building ID, Value: Set of "floor:unit" strings
 */
type BuildingOccupancy = Map<string, Set<string>>;

/**
 * Check if a location's tags match a building's allowed tags
 */
function locationMatchesBuilding(locationTags: string[], building: Building): boolean {
  // Location needs at least one tag that matches building's allowed tags
  return locationTags.some((tag) => building.allowedLocationTags.includes(tag));
}

/**
 * Find a building that can accommodate a location with given tags
 * Returns the building and an available unit, or null if none found
 */
function findBuildingForLocation(
  buildings: Building[],
  locationTags: string[],
  occupancy: BuildingOccupancy,
  zoneFilter?: string,
  grid?: CityGrid,
  rand?: () => number
): { building: Building; floor: number; unit: number } | null {
  // Filter buildings that match the location tags
  let candidates = buildings.filter((b) => locationMatchesBuilding(locationTags, b));

  // If zone filter specified, only consider buildings in that zone
  if (zoneFilter && grid) {
    candidates = candidates.filter((b) => {
      const col = grid.cells[b.x];
      if (!col) return false;
      const cell = col[b.y];
      return cell?.zone === zoneFilter;
    });
  }

  // Shuffle candidates if rand provided
  if (rand) {
    candidates = [...candidates].sort(() => rand() - 0.5);
  }

  // Find a building with available space
  for (const building of candidates) {
    const occupied = occupancy.get(building.id) ?? new Set();
    const totalUnits = building.floors * building.unitsPerFloor;

    if (occupied.size >= totalUnits) continue; // Building is full

    // Find an available unit
    for (let floor = 0; floor < building.floors; floor++) {
      for (let unit = 0; unit < building.unitsPerFloor; unit++) {
        const key = `${floor}:${unit}`;
        if (!occupied.has(key)) {
          // Mark as occupied
          if (!occupancy.has(building.id)) {
            occupancy.set(building.id, new Set());
          }
          occupancy.get(building.id)!.add(key);
          return { building, floor, unit };
        }
      }
    }
  }

  return null;
}

/**
 * Create a building from template
 */
function createBuildingFromTemplate(
  template: BuildingTemplate,
  x: number,
  y: number,
  phase: number,
  rand: () => number
): Building {
  const floors = randomFromRange(template.floors, rand);
  const unitsPerFloor = randomFromRange(template.unitsPerFloor, rand);

  return {
    id: nextBuildingId(),
    name: `${template.name} ${buildingIdCounter}`,
    template: template.id,
    tags: template.tags ?? [],
    created: phase,
    relationships: [],
    x,
    y,
    floors,
    unitsPerFloor,
    allowedLocationTags: template.allowedLocationTags,
  };
}

/**
 * Generate buildings for all grid cells based on zone configuration
 * Each zone specifies which building templates can spawn and how many per block
 */
function generateBuildings(
  grid: CityGrid,
  config: LoadedConfig,
  rand: () => number
): Building[] {
  const buildings: Building[] = [];

  // Iterate over each cell in the grid
  for (let x = 0; x < GRID_SIZE; x++) {
    const col = grid.cells[x];
    if (!col) continue;

    for (let y = 0; y < GRID_SIZE; y++) {
      const cell = col[y];
      if (!cell) continue;

      // Get zone config for this cell
      const zoneConfig = config.city.zones[cell.zone];
      if (!zoneConfig) continue;

      // Skip if no building templates defined
      if (!zoneConfig.buildingTemplates || zoneConfig.buildingTemplates.length === 0) continue;

      // Determine how many buildings for this block
      const numBuildings = zoneConfig.buildingsPerBlock
        ? randomFromRange(zoneConfig.buildingsPerBlock, rand)
        : 1;

      // Create buildings
      for (let i = 0; i < numBuildings; i++) {
        // Pick a random building template from allowed list
        const templateId = pickRandom(zoneConfig.buildingTemplates, rand);
        const template = config.buildingTemplates[templateId];

        if (!template) {
          console.warn(`[CityGenerator] Unknown building template: ${templateId}`);
          continue;
        }

        const building = createBuildingFromTemplate(template, x, y, 0, rand);
        buildings.push(building);
      }
    }
  }

  return buildings;
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
      fatigue: 0, // Agents start fully rested
      leisure: randomInt(0, 20, rand), // Start with low leisure need
    },
    inventory: {
      provisions: defaults.provisions ? randomFromRange(defaults.provisions, rand) : randomInt(2, 8, rand),
    },
    inventoryCapacity: defaults.inventoryCapacity ?? 20,
    salary: 0,
    wallet: createWallet(defaults.credits ? randomFromRange(defaults.credits, rand) : randomInt(50, 200, rand)),
    currentLocation: undefined, // Will be assigned after locations are generated
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
 * Building placement info for location creation
 */
interface BuildingPlacement {
  building: Building;
  floor: number;
  unit: number;
}

/**
 * Create a location from template (owned by an org)
 * If buildingPlacement is provided, location is placed in that building
 * Otherwise, falls back to legacy x,y,floor coords
 */
function createLocationFromTemplate(
  name: string,
  template: LocationTemplate,
  x: number,
  y: number,
  floor: number,
  ownerId: string,
  phase: number,
  buildingPlacement?: BuildingPlacement
): Location {
  const balance = template.balance;

  // Use building coords if placed in a building
  const finalX = buildingPlacement?.building.x ?? x;
  const finalY = buildingPlacement?.building.y ?? y;
  const finalFloor = buildingPlacement?.floor ?? floor;

  return {
    id: nextLocationId(),
    name,
    template: template.id,
    tags: template.tags ?? [],
    created: phase,
    relationships: [],
    building: buildingPlacement?.building.id,
    floor: finalFloor,
    unit: buildingPlacement?.unit,
    x: finalX,
    y: finalY,
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
    vehicles: [],
    inventory: {
      [balance.inventoryGood ?? 'provisions']: balance.startingInventory ?? 0,
    },
    inventoryCapacity: balance.inventoryCapacity ?? 0,
  };
}

/**
 * Create a public location (no owner)
 * If buildingPlacement is provided, location is placed in that building
 * Otherwise, falls back to legacy x,y,floor coords (outdoor locations)
 */
function createPublicLocation(
  name: string,
  template: LocationTemplate,
  x: number,
  y: number,
  floor: number,
  phase: number,
  buildingPlacement?: BuildingPlacement
): Location {
  // Use building coords if placed in a building
  const finalX = buildingPlacement?.building.x ?? x;
  const finalY = buildingPlacement?.building.y ?? y;
  const finalFloor = buildingPlacement?.floor ?? floor;

  return {
    id: nextLocationId(),
    name,
    template: template.id,
    tags: template.tags ?? [],
    created: phase,
    relationships: [],
    building: buildingPlacement?.building.id,
    floor: finalFloor,
    unit: buildingPlacement?.unit,
    x: finalX,
    y: finalY,
    size: 1,
    security: 5,
    owner: '',
    ownerType: 'none',
    previousOwners: [],
    employees: [],
    employeeSlots: 0,
    baseIncome: 0,
    operatingCost: 0,
    weeklyRevenue: 0,
    weeklyCosts: 0,
    agentCapacity: 50, // Public spaces can hold many people
    vehicleCapacity: 0,
    vehicles: [],
    inventory: {},
    inventoryCapacity: 0,
  };
}

/**
 * Generate a complete city using templates from config
 */
export function generateCity(config: LoadedConfig, seed: number = Date.now()): GeneratedCity {
  const rand = seededRandom(seed);

  // Generate zone grid
  const grid = generateZones(config.city.zones, seed);

  // Generate buildings for each grid cell
  const buildings = generateBuildings(grid, config, rand);
  console.log(`[CityGenerator] Generated ${buildings.length} buildings`);

  // Track which building units are occupied
  const buildingOccupancy: BuildingOccupancy = new Map();

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
  const pubNames = ['The Rusty Circuit', 'Neon Tap', 'Binary Bar', 'Voltage Lounge', 'The Grid', 'Chrome & Hops', 'Synth Spirits', 'The Dive'];
  const boutiqueNames = ['Luxe & Chrome', 'Elite Goods', 'Prestige Shop', 'The Gilded Shelf', 'Opulent', 'Prime Selection', 'Neon Luxe', 'Zenith Style'];
  const publicSpaceNames: Record<string, string[]> = {
    downtown: ['Central Plaza', 'Metro Hub', 'Tower Square', 'Skyline Park'],
    commercial: ['Market Square', 'Commerce Court', 'Trade Plaza', 'Shopping Promenade'],
    residential: ['Community Park', 'Neighborhood Green', 'Local Square', 'Block Garden'],
    slums: ['Street Corner', 'Informal Market', 'The Lot', 'Underpass'],
    government: ['Civic Plaza', 'Transit Center', 'City Steps', 'Admin Square'],
  };

  let shopIndex = 0;
  let factoryIndex = 0;
  let restaurantIndex = 0;
  let pubIndex = 0;
  let boutiqueIndex = 0;
  const publicSpaceIndex: Record<string, number> = {};

  function nextShopName(): string {
    return shopNames[shopIndex++ % shopNames.length] ?? 'Shop';
  }
  function nextFactoryName(): string {
    return factoryNames[factoryIndex++ % factoryNames.length] ?? 'Factory';
  }
  function nextRestaurantName(): string {
    return restaurantNames[restaurantIndex++ % restaurantNames.length] ?? 'Restaurant';
  }
  function nextPubName(): string {
    return pubNames[pubIndex++ % pubNames.length] ?? 'Pub';
  }
  function nextBoutiqueName(): string {
    return boutiqueNames[boutiqueIndex++ % boutiqueNames.length] ?? 'Boutique';
  }
  function nextPublicSpaceName(zone: string): string {
    const names = publicSpaceNames[zone] ?? ['Public Space'];
    const idx = publicSpaceIndex[zone] ?? 0;
    publicSpaceIndex[zone] = idx + 1;
    return names[idx % names.length] ?? 'Public Space';
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
  // 2. CREATE CORPORATIONS WITH PRODUCTION FACILITIES
  // ==================
  const corpTemplate = config.orgTemplates['corporation'];

  // Get all production facility templates that corporations own
  const productionTemplates = Object.values(config.locationTemplates).filter(
    (template) => template.generation?.ownerOrgTemplate === 'corporation' && template.generation?.spawnAtStart
  );

  // Track spawned corporations so we can assign facilities to them
  const spawnedCorps: Organization[] = [];

  if (corpTemplate?.generation?.spawnAtStart) {
    // Create corporations based on how many production facilities we need
    // Each facility needs an owner corporation
    let totalFacilities = 0;
    for (const template of productionTemplates) {
      if (template.generation?.count) {
        totalFacilities += randomFromRange(template.generation.count, rand);
      }
    }

    // Create one corporation per facility (or use corp template count if specified)
    const numCorps = corpTemplate.generation.count
      ? Math.min(randomFromRange(corpTemplate.generation.count, rand), totalFacilities)
      : totalFacilities;

    for (let i = 0; i < numCorps; i++) {
      const leader = agents[i];
      if (!leader) continue;

      const credits = corpTemplate.defaults?.credits
        ? randomFromRange(corpTemplate.defaults.credits, rand)
        : randomInt(2000, 5000, rand);

      const corpName = `${pickRandom(lastNames, rand)} Industries`;
      const corp = createOrgFromTemplate(corpName, corpTemplate, leader.id, credits, 0);

      if (corpTemplate.generation.leaderBecomesEmployed) {
        leader.status = 'employed';
        leader.employer = corp.id;
      }

      spawnedCorps.push(corp);
      organizations.push(corp);
    }
  }

  // Now spawn each type of production facility and assign to corporations
  let corpIndex = 0;
  for (const facilityTemplate of productionTemplates) {
    if (!facilityTemplate.generation?.count) continue;

    const numFacilities = randomFromRange(facilityTemplate.generation.count, rand);
    const facilityType = facilityTemplate.id;

    for (let i = 0; i < numFacilities; i++) {
      // Pick a corporation to own this facility (round-robin)
      const corp = spawnedCorps[corpIndex % spawnedCorps.length];
      if (!corp) break;
      corpIndex++;

      // Try to find a building placement
      const buildingPlacement = findBuildingForLocation(
        buildings,
        facilityTemplate.tags ?? [],
        buildingOccupancy,
        undefined,
        grid,
        rand
      );

      let facility: Location | null = null;

      if (buildingPlacement) {
        facility = createLocationFromTemplate(
          nextFactoryName(),
          facilityTemplate,
          0,
          0,
          0,
          corp.id,
          0,
          buildingPlacement
        );
      } else {
        // Fallback to legacy placement
        const placement = findValidPlacement(grid, facilityTemplate.spawnConstraints, rand);
        if (placement) {
          facility = createLocationFromTemplate(
            nextFactoryName(),
            facilityTemplate,
            placement.x,
            placement.y,
            placement.floor,
            corp.id,
            0
          );
        }
      }

      if (facility) {
        locations.push(facility);
        corp.locations.push(facility.id);
      }
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

      // Create the shop - try building placement first
      const buildingPlacement = findBuildingForLocation(
        buildings,
        shopTemplate.tags ?? [],
        buildingOccupancy,
        undefined,
        grid,
        rand
      );

      if (buildingPlacement) {
        let shop = createLocationFromTemplate(
          nextShopName(),
          shopTemplate,
          0, 0, 0,
          shopOrg.id,
          0,
          buildingPlacement
        );
        // Add owner as employee if template specifies (for workforce tracking, not salary)
        if (shopOrgTemplate.generation?.leaderBecomesEmployed && owner) {
          shop = { ...shop, employees: [owner.id] };
          owner.employedAt = shop.id;
          owner.employer = shopOrg.id;
          owner.status = 'employed';
          // Note: owner.salary stays 0 - owners live off dividends, not payroll
        }
        locations.push(shop);
        shopOrg.locations.push(shop.id);
      } else {
        // Fallback to legacy placement
        const placement = findValidPlacement(grid, shopTemplate.spawnConstraints, rand);
        if (placement) {
          let shop = createLocationFromTemplate(
            nextShopName(),
            shopTemplate,
            placement.x,
            placement.y,
            placement.floor,
            shopOrg.id,
            0
          );
          // Add owner as employee if template specifies (for workforce tracking, not salary)
          if (shopOrgTemplate.generation?.leaderBecomesEmployed && owner) {
            shop = { ...shop, employees: [owner.id] };
            owner.employedAt = shop.id;
            owner.employer = shopOrg.id;
            owner.status = 'employed';
            // Note: owner.salary stays 0 - owners live off dividends, not payroll
          }
          locations.push(shop);
          shopOrg.locations.push(shop.id);
        }
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

      // Create the restaurant - try building placement first
      const buildingPlacement = findBuildingForLocation(
        buildings,
        restaurantTemplate.tags ?? [],
        buildingOccupancy,
        undefined,
        grid,
        rand
      );

      if (buildingPlacement) {
        let restaurant = createLocationFromTemplate(
          nextRestaurantName(),
          restaurantTemplate,
          0, 0, 0,
          restaurantOrg.id,
          0,
          buildingPlacement
        );
        // Add owner as employee if template specifies (for workforce tracking, not salary)
        if (restaurantOrgTemplate.generation?.leaderBecomesEmployed && owner) {
          restaurant = { ...restaurant, employees: [owner.id] };
          owner.employedAt = restaurant.id;
          owner.employer = restaurantOrg.id;
          owner.status = 'employed';
          // Note: owner.salary stays 0 - owners live off dividends, not payroll
        }
        locations.push(restaurant);
        restaurantOrg.locations.push(restaurant.id);
      } else {
        // Fallback to legacy placement
        const placement = findValidPlacement(grid, restaurantTemplate.spawnConstraints, rand);
        if (placement) {
          let restaurant = createLocationFromTemplate(
            nextRestaurantName(),
            restaurantTemplate,
            placement.x,
            placement.y,
            placement.floor,
            restaurantOrg.id,
            0
          );
          // Add owner as employee if template specifies (for workforce tracking, not salary)
          if (restaurantOrgTemplate.generation?.leaderBecomesEmployed && owner) {
            restaurant = { ...restaurant, employees: [owner.id] };
            owner.employedAt = restaurant.id;
            owner.employer = restaurantOrg.id;
            owner.status = 'employed';
            // Note: owner.salary stays 0 - owners live off dividends, not payroll
          }
          locations.push(restaurant);
          restaurantOrg.locations.push(restaurant.id);
        }
      }

      organizations.push(restaurantOrg);
    }
  }

  // ==================
  // 5. CREATE PUBS (with small business orgs)
  // ==================
  const pubTemplate = config.locationTemplates['pub'];
  const pubOrgTemplateId = pubTemplate?.generation?.ownerOrgTemplate ?? 'small_business';
  const pubOrgTemplate = config.orgTemplates[pubOrgTemplateId];

  if (pubTemplate?.generation?.spawnAtStart && pubTemplate.generation.count && pubOrgTemplate) {
    const numPubs = randomFromRange(pubTemplate.generation.count, rand);

    for (let i = 0; i < numPubs; i++) {
      const ownerIdx = agents.findIndex((a) => a.status === 'available');
      if (ownerIdx === -1) break;

      const owner = agents[ownerIdx];
      if (!owner) continue;

      // Credits: location template override > org template default > fallback
      const orgCredits = pubTemplate.generation.ownerCredits
        ? randomFromRange(pubTemplate.generation.ownerCredits, rand)
        : pubOrgTemplate.defaults?.credits
          ? randomFromRange(pubOrgTemplate.defaults.credits, rand)
          : randomInt(350, 600, rand);

      const pubOrg = createOrgFromTemplate(
        `${owner.name}'s Pub`,
        pubOrgTemplate,
        owner.id,
        orgCredits,
        0
      );

      // Set owner as employed if template specifies
      if (pubOrgTemplate.generation?.leaderBecomesEmployed) {
        owner.status = 'employed';
        owner.employer = pubOrg.id;
      }

      // Create the pub - try building placement first
      const buildingPlacement = findBuildingForLocation(
        buildings,
        pubTemplate.tags ?? [],
        buildingOccupancy,
        undefined,
        grid,
        rand
      );

      if (buildingPlacement) {
        let pub = createLocationFromTemplate(
          nextPubName(),
          pubTemplate,
          0, 0, 0,
          pubOrg.id,
          0,
          buildingPlacement
        );
        // Add owner as employee if template specifies (for workforce tracking, not salary)
        if (pubOrgTemplate.generation?.leaderBecomesEmployed && owner) {
          pub = { ...pub, employees: [owner.id] };
          owner.employedAt = pub.id;
          owner.employer = pubOrg.id;
          owner.status = 'employed';
          // Note: owner.salary stays 0 - owners live off dividends, not payroll
        }
        locations.push(pub);
        pubOrg.locations.push(pub.id);
      } else {
        // Fallback to legacy placement
        const placement = findValidPlacement(grid, pubTemplate.spawnConstraints, rand);
        if (placement) {
          let pub = createLocationFromTemplate(
            nextPubName(),
            pubTemplate,
            placement.x,
            placement.y,
            placement.floor,
            pubOrg.id,
            0
          );
          // Add owner as employee if template specifies (for workforce tracking, not salary)
          if (pubOrgTemplate.generation?.leaderBecomesEmployed && owner) {
            pub = { ...pub, employees: [owner.id] };
            owner.employedAt = pub.id;
            owner.employer = pubOrg.id;
            owner.status = 'employed';
            // Note: owner.salary stays 0 - owners live off dividends, not payroll
          }
          locations.push(pub);
          pubOrg.locations.push(pub.id);
        }
      }

      organizations.push(pubOrg);
    }
  }

  // ==================
  // 5b. CREATE LUXURY BOUTIQUES (with small business orgs)
  // ==================
  const boutiqueTemplate = config.locationTemplates['luxury_boutique'];
  const boutiqueOrgTemplateId = boutiqueTemplate?.generation?.ownerOrgTemplate ?? 'small_business';
  const boutiqueOrgTemplate = config.orgTemplates[boutiqueOrgTemplateId];

  if (boutiqueTemplate?.generation?.spawnAtStart && boutiqueTemplate.generation.count && boutiqueOrgTemplate) {
    const numBoutiques = randomFromRange(boutiqueTemplate.generation.count, rand);

    for (let i = 0; i < numBoutiques; i++) {
      const ownerIdx = agents.findIndex((a) => a.status === 'available');
      if (ownerIdx === -1) break;

      const owner = agents[ownerIdx];
      if (!owner) continue;

      // Credits: location template override > org template default > fallback
      const orgCredits = boutiqueTemplate.generation.ownerCredits
        ? randomFromRange(boutiqueTemplate.generation.ownerCredits, rand)
        : boutiqueOrgTemplate.defaults?.credits
          ? randomFromRange(boutiqueOrgTemplate.defaults.credits, rand)
          : randomInt(400, 700, rand);

      const boutiqueOrg = createOrgFromTemplate(
        `${owner.name}'s Boutique`,
        boutiqueOrgTemplate,
        owner.id,
        orgCredits,
        0
      );

      // Set owner as employed if template specifies
      if (boutiqueOrgTemplate.generation?.leaderBecomesEmployed) {
        owner.status = 'employed';
        owner.employer = boutiqueOrg.id;
      }

      // Create the boutique - try building placement first
      const buildingPlacement = findBuildingForLocation(
        buildings,
        boutiqueTemplate.tags ?? [],
        buildingOccupancy,
        undefined,
        grid,
        rand
      );

      if (buildingPlacement) {
        let boutique = createLocationFromTemplate(
          nextBoutiqueName(),
          boutiqueTemplate,
          0, 0, 0,
          boutiqueOrg.id,
          0,
          buildingPlacement
        );
        // Add owner as employee if template specifies (for workforce tracking, not salary)
        if (boutiqueOrgTemplate.generation?.leaderBecomesEmployed && owner) {
          boutique = { ...boutique, employees: [owner.id] };
          owner.employedAt = boutique.id;
          owner.employer = boutiqueOrg.id;
          owner.status = 'employed';
        }
        locations.push(boutique);
        boutiqueOrg.locations.push(boutique.id);
      } else {
        // Fallback to legacy placement
        const placement = findValidPlacement(grid, boutiqueTemplate.spawnConstraints, rand);
        if (placement) {
          let boutique = createLocationFromTemplate(
            nextBoutiqueName(),
            boutiqueTemplate,
            placement.x,
            placement.y,
            placement.floor,
            boutiqueOrg.id,
            0
          );
          // Add owner as employee if template specifies (for workforce tracking, not salary)
          if (boutiqueOrgTemplate.generation?.leaderBecomesEmployed && owner) {
            boutique = { ...boutique, employees: [owner.id] };
            owner.employedAt = boutique.id;
            owner.employer = boutiqueOrg.id;
            owner.status = 'employed';
          }
          locations.push(boutique);
          boutiqueOrg.locations.push(boutique.id);
        }
      }

      organizations.push(boutiqueOrg);
    }
  }

  // ==================
  // 6. CREATE PUBLIC SPACES (per zone)
  // ==================
  const publicSpaceTemplate = config.locationTemplates['public_space'];

  if (publicSpaceTemplate?.generation?.spawnAtStart && publicSpaceTemplate.generation.countPerZone) {
    const allowedZones = publicSpaceTemplate.spawnConstraints?.allowedZones ?? [];

    for (const zoneId of allowedZones) {
      const numSpaces = randomFromRange(publicSpaceTemplate.generation.countPerZone, rand);

      for (let i = 0; i < numSpaces; i++) {
        // Find a cell in this specific zone
        const placement = findValidPlacementInZone(grid, zoneId, publicSpaceTemplate.spawnConstraints, rand);
        if (placement) {
          const publicSpace = createPublicLocation(
            nextPublicSpaceName(zoneId),
            publicSpaceTemplate,
            placement.x,
            placement.y,
            placement.floor,
            0
          );
          locations.push(publicSpace);
        }
      }
    }
  }

  // Note: Locations start with empty employee slots.
  // The simulation's hiring process will fill them as agents seek jobs.

  // ==================
  // 6. CREATE APARTMENTS (with small business orgs)
  // ==================
  const apartmentTemplate = config.locationTemplates['apartment'];
  const apartmentOrgTemplateId = apartmentTemplate?.generation?.ownerOrgTemplate ?? 'small_business';
  const apartmentOrgTemplate = config.orgTemplates[apartmentOrgTemplateId];
  const apartmentNames = [
    'Sky View', 'Urban Nest', 'Metro Living', 'City Heights', 'Neon Suite',
    'Cyber Loft', 'Downtown Studio', 'Steel Tower Unit', 'Night City Flat', 'Grid Apartments',
  ];
  let apartmentIndex = 0;
  function nextApartmentName(): string {
    return apartmentNames[apartmentIndex++ % apartmentNames.length] ?? 'Apartment';
  }

  if (apartmentTemplate?.generation?.spawnAtStart && apartmentTemplate.generation.count && apartmentOrgTemplate) {
    const numApartments = randomFromRange(apartmentTemplate.generation.count, rand);

    // Create landlords who each own multiple apartments (10-15 per landlord)
    const apartmentsPerLandlord = 12;
    const numLandlords = Math.ceil(numApartments / apartmentsPerLandlord);
    const landlordOrgs: Organization[] = [];

    // First, create all landlord orgs
    for (let i = 0; i < numLandlords; i++) {
      const ownerIdx = agents.findIndex((a) => a.status === 'available');
      if (ownerIdx === -1) break;

      const owner = agents[ownerIdx];
      if (!owner) continue;

      const orgCredits = apartmentTemplate.generation.ownerCredits
        ? randomFromRange(apartmentTemplate.generation.ownerCredits, rand)
        : apartmentOrgTemplate.defaults?.credits
          ? randomFromRange(apartmentOrgTemplate.defaults.credits, rand)
          : randomInt(100, 200, rand);

      const apartmentOrg = createOrgFromTemplate(
        `${owner.name}'s Properties`,
        apartmentOrgTemplate,
        owner.id,
        orgCredits,
        0
      );

      if (apartmentOrgTemplate.generation?.leaderBecomesEmployed) {
        owner.status = 'employed';
        owner.employer = apartmentOrg.id;
      }

      landlordOrgs.push(apartmentOrg);
      organizations.push(apartmentOrg);
    }

    // Now distribute apartments among landlords
    for (let i = 0; i < numApartments; i++) {
      const landlordOrg = landlordOrgs[i % landlordOrgs.length];
      if (!landlordOrg) continue;

      // Create the apartment - try building placement first
      const buildingPlacement = findBuildingForLocation(
        buildings,
        apartmentTemplate.tags ?? [],
        buildingOccupancy,
        undefined,
        grid,
        rand
      );

      if (buildingPlacement) {
        const apartment = createLocationFromTemplate(
          nextApartmentName(),
          apartmentTemplate,
          0, 0, 0,
          landlordOrg.id,
          0,
          buildingPlacement
        );
        apartment.maxResidents = apartmentTemplate.balance.maxResidents ?? 1;
        apartment.rentCost = apartmentTemplate.balance.rentCost ?? 20;
        apartment.residents = [];
        locations.push(apartment);
        landlordOrg.locations.push(apartment.id);
      } else {
        const placement = findValidPlacement(grid, apartmentTemplate.spawnConstraints, rand);
        if (placement) {
          const apartment = createLocationFromTemplate(
            nextApartmentName(),
            apartmentTemplate,
            placement.x,
            placement.y,
            placement.floor,
            landlordOrg.id,
            0
          );
          apartment.maxResidents = apartmentTemplate.balance.maxResidents ?? 1;
          apartment.rentCost = apartmentTemplate.balance.rentCost ?? 20;
          apartment.residents = [];
          locations.push(apartment);
          landlordOrg.locations.push(apartment.id);
        }
      }
    }
  }

  // ==================
  // 7. CREATE SHELTERS (public, no org)
  // ==================
  const shelterTemplate = config.locationTemplates['shelter'];
  const shelterNames = ['Downtown Shelter', 'Community Refuge', 'Emergency Housing', 'City Shelter', 'Hope Center'];
  let shelterIndex = 0;
  function nextShelterName(): string {
    return shelterNames[shelterIndex++ % shelterNames.length] ?? 'Shelter';
  }

  if (shelterTemplate?.generation?.spawnAtStart && shelterTemplate.generation.count) {
    const numShelters = randomFromRange(shelterTemplate.generation.count, rand);

    for (let i = 0; i < numShelters; i++) {
      // Shelters are public - try building placement first
      const buildingPlacement = findBuildingForLocation(
        buildings,
        shelterTemplate.tags ?? [],
        buildingOccupancy,
        undefined,
        grid,
        rand
      );

      if (buildingPlacement) {
        const shelter = createPublicLocation(
          nextShelterName(),
          shelterTemplate,
          buildingPlacement.building.x,
          buildingPlacement.building.y,
          buildingPlacement.floor,
          0,
          buildingPlacement
        );
        shelter.maxResidents = shelterTemplate.balance.maxResidents ?? 20;
        shelter.rentCost = 0;
        shelter.residents = [];
        locations.push(shelter);
      } else {
        // Fallback to legacy placement
        const placement = findValidPlacement(grid, shelterTemplate.spawnConstraints, rand);
        if (placement) {
          const shelter = createPublicLocation(
            nextShelterName(),
            shelterTemplate,
            placement.x,
            placement.y,
            placement.floor,
            0
          );
          shelter.maxResidents = shelterTemplate.balance.maxResidents ?? 20;
          shelter.rentCost = 0;
          shelter.residents = [];
          locations.push(shelter);
        }
      }
    }
  }

  // ==================
  // 8. ASSIGN INITIAL AGENT LOCATIONS AND HOUSING
  // ==================
  // Business owners → their business location
  // Other agents → a random public space
  // Some agents get assigned to apartments as residents

  const publicSpaces = locations.filter((l) => l.tags.includes('public'));
  const apartments = locations.filter((l) =>
    l.tags.includes('residential') &&
    !l.tags.includes('public') &&
    l.maxResidents !== undefined
  );

  // First pass: assign locations to agents
  for (const agent of agents) {
    if (agent.employer) {
      // Agent is employed (owner) - find the org's first location
      const org = organizations.find((o) => o.id === agent.employer);
      if (org && org.locations.length > 0) {
        const firstLocationId = org.locations[0];
        agent.currentLocation = firstLocationId;
        agent.employedAt = firstLocationId;
      } else if (publicSpaces.length > 0) {
        // Fallback to a public space
        agent.currentLocation = pickRandom(publicSpaces, rand).id;
      }
    } else {
      // Unemployed agent - place at a random public space
      if (publicSpaces.length > 0) {
        agent.currentLocation = pickRandom(publicSpaces, rand).id;
      }
    }
  }

  // Second pass: assign housing to some agents (not landlords)
  // Shuffle available apartments for random distribution
  const availableApartments = apartments.filter((apt) => {
    // Don't assign landlords to their own apartments
    const ownerOrg = organizations.find((o) => o.locations.includes(apt.id));
    return ownerOrg !== undefined;
  });

  for (const agent of agents) {
    // Skip if agent already has residence or is a landlord
    if (agent.residence) continue;

    // Check if agent is a landlord (owns apartments)
    const ledOrg = organizations.find((o) => o.leader === agent.id);
    const ownsApartment = ledOrg && ledOrg.locations.some((locId) => {
      const loc = locations.find((l) => l.id === locId);
      return loc?.tags.includes('residential') && !loc?.tags.includes('public');
    });
    if (ownsApartment) continue;

    // Find an available apartment
    const apt = availableApartments.find((a) => {
      const residents = a.residents ?? [];
      const maxResidents = a.maxResidents ?? 1;
      return residents.length < maxResidents;
    });

    if (apt) {
      // Move in
      agent.residence = apt.id;
      apt.residents = apt.residents ?? [];
      apt.residents.push(agent.id);
    }
    // Agents without apartments start homeless (will seek housing in simulation)
  }

  // Log housing stats
  const housedAgents = agents.filter((a) => a.residence).length;
  const totalAgents = agents.length;
  console.log(`[CityGenerator] Housing: ${housedAgents}/${totalAgents} agents housed (${Math.round(housedAgents/totalAgents*100)}%)`);
  console.log(`[CityGenerator] Generated ${apartments.length} apartments, ${locations.filter(l => l.template === 'shelter').length} shelters`);

  console.log(
    `[CityGenerator] Generated city with ${buildings.length} buildings, ${locations.length} locations, ` +
    `${organizations.length} orgs, ${agents.length} agents`
  );

  return { grid, buildings, locations, organizations, agents };
}
