/**
 * Simulation - Main simulation controller
 * Ties together tick engine, agents, and systems
 */

import type { Agent, Location, Organization } from '../types';
import type { LoadedConfig } from '../config/ConfigLoader';
import { createTimeState, advancePhase, formatTime, type TimeState } from './TickEngine';
import { ActivityLog } from './ActivityLog';
import { processAgentPhase, createAgent, countLivingAgents, countDeadAgents } from './systems/AgentSystem';
import { processAgentEconomicDecision, processWeeklyEconomy } from './systems/EconomySystem';
import { createOrganization, createFactoryLocation, processFactoryProduction, addLocationToOrg } from './systems/OrgSystem';
import { generateCity } from '../generation/CityGenerator';

// Agent names for test harness (20 names for expanded population)
const TEST_NAMES = [
  'Alex Chen',
  'Jordan Kim',
  'Sam Reyes',
  'Casey Morgan',
  'Riley Park',
  'Quinn Davis',
  'Avery Lee',
  'Drew Santos',
  'Blake Turner',
  'Jamie Cruz',
  'Morgan Swift',
  'Taylor Vega',
  'Phoenix Reed',
  'River Stone',
  'Skylar Frost',
  'Sage Wolfe',
  'Rowan Steele',
  'Finley Drake',
  'Ash Kimura',
  'Eden Blackwood',
];

export interface SimulationState {
  time: TimeState;
  agents: Agent[];
  locations: Location[];
  organizations: Organization[];
  grid: import('../generation/types').CityGrid | null;
  isRunning: boolean;
  ticksPerSecond: number;
}

/**
 * Create initial simulation state with test agents, corporation, and factory
 * PLAN-003: Supply chain test harness
 */
export function createSimulation(config: LoadedConfig): SimulationState {
  const time = createTimeState();
  const agents: Agent[] = [];
  const locations: Location[] = [];
  const organizations: Organization[] = [];

  // Create the corporation leader (normal agent, corp wealth is separate)
  const leader = createAgent(
    'agent-0',
    'Victoria Sterling',
    config.balance,
    time.currentPhase
  );
  leader.status = 'employed'; // Leader is "employed" by their own org
  leader.employer = 'org-1';
  agents.push(leader);

  ActivityLog.info(
    time.currentPhase,
    'spawn',
    `spawned as corporation leader with ${leader.wallet.credits} credits`,
    leader.id,
    leader.name
  );

  // Create the corporation (corp has its own wallet, separate from leader)
  const corp = createOrganization(
    'org-1',
    'Sterling Provisions Inc.',
    leader.id,
    leader.name,
    10000, // Starting credits for the corp
    time.currentPhase
  );

  // Create factory owned by the corporation
  const factoryTemplate = config.locationTemplates['factory'];
  if (!factoryTemplate) {
    throw new Error('Factory template not found');
  }

  const factory = createFactoryLocation(
    'location-factory-1',
    'Sterling Factory',
    factoryTemplate,
    corp.id,
    time.currentPhase
  );
  // Give factory initial inventory so shops can restock immediately
  factory.inventory['provisions'] = 100;

  // Link factory to corp
  const updatedCorp = addLocationToOrg(corp, factory.id);
  organizations.push(updatedCorp);
  locations.push(factory);

  console.log(`[Simulation] Created corporation "${updatedCorp.name}" with factory "${factory.name}"`);

  // Get shop template for initial shops
  const shopTemplate = config.locationTemplates['retail_shop'];
  if (!shopTemplate) {
    throw new Error('Retail shop template not found');
  }

  // Create 2 initial shop owners with micro-orgs to bootstrap the economy
  const initialShopOwners = ['Alex Chen', 'Jordan Kim'];
  const initialShopNames = ['Central Market', 'Corner Store'];
  for (let i = 0; i < 2; i++) {
    const ownerName = initialShopOwners[i] ?? `Shop Owner ${i + 1}`;
    const shopName = initialShopNames[i] ?? `Shop ${i + 1}`;

    // Create the shop owner agent
    const shopOwner = createAgent(
      `agent-${i + 1}`,
      ownerName,
      config.balance,
      time.currentPhase
    );

    // Create a micro-org for this shop
    const shopOrgId = `org-shop-${i + 1}`;
    let shopOrg = createOrganization(
      shopOrgId,
      `${ownerName}'s Shop`,
      shopOwner.id,
      ownerName,
      700, // Starting business capital (enough for ~140 provisions at wholesale)
      time.currentPhase
    );

    // Create the shop owned by the micro-org
    const shop = createInitialShop(
      `location-shop-${i + 1}`,
      shopName,
      shopTemplate,
      shopOrgId, // Owned by org, not agent
      shopOrg.name,
      time.currentPhase
    );

    // Link shop to org
    shopOrg = addLocationToOrg(shopOrg, shop.id);

    // Set up shop owner as employed by their own org
    shopOwner.status = 'employed';
    shopOwner.employer = shopOrgId;

    agents.push(shopOwner);
    locations.push(shop);
    organizations.push(shopOrg);

    ActivityLog.info(
      time.currentPhase,
      'spawn',
      `spawned as owner of "${shopOrg.name}" running "${shop.name}"`,
      shopOwner.id,
      shopOwner.name
    );
  }

  // Create remaining test agents (citizens who will buy provisions)
  for (let i = 2; i < 20; i++) {
    const agent = createAgent(
      `agent-${i + 1}`,
      TEST_NAMES[i] ?? `Agent ${i + 1}`,
      config.balance,
      time.currentPhase
    );
    agents.push(agent);

    ActivityLog.info(
      time.currentPhase,
      'spawn',
      `spawned with ${agent.inventory['provisions']} provisions, ${agent.wallet.credits} credits`,
      agent.id,
      agent.name
    );
  }

  console.log(`\n[Simulation] Created ${organizations.length} corps, ${locations.length} locations (1 factory, 2 shops), ${agents.length} agents`);
  console.log('[Simulation] Supply chain: Factory → Wholesale → Retail → Consumption');
  console.log('[Simulation] Starting simulation...\n');

  return {
    time,
    agents,
    locations,
    organizations,
    grid: null, // Legacy: no grid in test harness mode
    isRunning: false,
    ticksPerSecond: 10,
  };
}

/**
 * Create simulation with procedurally generated city
 * Uses CityGenerator for proper zone-based layout
 */
export function createSimulationWithCity(config: LoadedConfig, seed?: number): SimulationState {
  const time = createTimeState();

  // Generate the city with zones, locations, agents, and orgs
  const city = generateCity(config, seed);

  // Log spawns for all agents
  for (const agent of city.agents) {
    ActivityLog.info(
      time.currentPhase,
      'spawn',
      `spawned with ${agent.inventory['provisions'] ?? 0} provisions, ${agent.wallet.credits} credits`,
      agent.id,
      agent.name
    );
  }

  // Log business openings
  for (const loc of city.locations) {
    const org = city.organizations.find((o) => o.id === loc.owner);
    if (org) {
      ActivityLog.info(
        time.currentPhase,
        'business',
        `${org.name} opened "${loc.name}" at (${loc.x}, ${loc.y})`,
        org.id,
        org.name
      );
    }
  }

  console.log(`\n[Simulation] Generated city with ${city.organizations.length} orgs, ${city.locations.length} locations, ${city.agents.length} agents`);
  console.log('[Simulation] Supply chain: Factory → Wholesale → Retail → Consumption');
  console.log('[Simulation] Starting simulation...\n');

  return {
    time,
    agents: city.agents,
    locations: city.locations,
    organizations: city.organizations,
    grid: city.grid,
    isRunning: false,
    ticksPerSecond: 10,
  };
}

/**
 * Create an initial shop for bootstrapping the economy
 */
function createInitialShop(
  id: string,
  name: string,
  template: LoadedConfig['locationTemplates'][string],
  orgId: string,
  orgName: string,
  phase: number
): Location {
  const locationConfig = template.balance;

  ActivityLog.info(
    phase,
    'business',
    `${orgName} opened shop "${name}"`,
    orgId,
    orgName
  );

  return {
    id,
    name,
    template: template.id,
    tags: template.tags ?? [],
    created: phase,
    relationships: [],
    x: 16, // Placeholder: center of grid (will be placed by CityGenerator)
    y: 16,
    floor: 0,
    size: 1,
    security: 10,
    owner: orgId,
    ownerType: 'org', // Owned by org, not agent directly
    previousOwners: [],
    employees: [],
    employeeSlots: locationConfig.employeeSlots ?? 0,
    baseIncome: 0,
    operatingCost: locationConfig.operatingCost ?? 0,
    weeklyRevenue: 0,
    weeklyCosts: 0,
    agentCapacity: 10,
    vehicleCapacity: 0,
    occupants: [],
    vehicles: [],
    inventory: {
      provisions: 20, // Start with some inventory
    },
    inventoryCapacity: locationConfig.inventoryCapacity ?? 0,
  };
}

// Note: createSystemLocation removed - supply chain uses real org-owned factories

/**
 * Process one simulation tick (one phase)
 */
export function tick(state: SimulationState, config: LoadedConfig): SimulationState {
  // Advance time (uses simulation config for time structure)
  const { time: newTime, dayRollover, weekRollover } = advancePhase(state.time, config.simulation);

  // Log time progression on day rollover
  if (dayRollover) {
    const living = countLivingAgents(state.agents);
    const dead = countDeadAgents(state.agents);
    const employed = state.agents.filter((a) => a.status === 'employed').length;
    const shops = state.locations.filter((l) => l.tags.includes('retail')).length;
    const factories = state.locations.filter((l) => l.tags.includes('wholesale')).length;
    console.log(
      `\n--- ${formatTime(newTime)} --- (${living} alive, ${dead} dead, ${employed} employed, ${shops} shops, ${factories} factories)`
    );
  }

  let updatedAgents = [...state.agents];
  let updatedLocations = [...state.locations];
  let updatedOrgs = [...state.organizations];

  // 1. Process production for all locations with production config
  const goodsSizes = { goods: config.balance.goods, defaultGoodsSize: config.balance.defaultGoodsSize };
  updatedLocations = updatedLocations.map((loc) => {
    const template = config.locationTemplates[loc.template];
    return processFactoryProduction(loc, template?.balance.production, newTime.currentPhase, goodsSizes);
  });

  // 2. Process biological needs (hunger, eating from inventory)
  updatedAgents = updatedAgents.map((agent) =>
    processAgentPhase(agent, newTime.currentPhase, config.balance)
  );

  // 3. Process economic decisions for each agent (buy food, restock shop, seek job, open business)
  for (let i = 0; i < updatedAgents.length; i++) {
    const agent = updatedAgents[i];
    if (!agent || agent.status === 'dead') continue;

    const result = processAgentEconomicDecision(
      agent,
      updatedLocations,
      updatedOrgs,
      config.balance,
      config.locationTemplates,
      newTime.currentPhase
    );

    updatedAgents[i] = result.agent;
    updatedLocations = result.locations;
    updatedOrgs = result.orgs;

    // Add new location and org if agent opened a business
    if (result.newLocation) {
      updatedLocations.push(result.newLocation);
    }
    if (result.newOrg) {
      updatedOrgs.push(result.newOrg);
    }
  }

  // 4. Process weekly economy on week rollover (payroll, operating costs for all orgs)
  if (weekRollover) {
    console.log(`\n=== WEEK ${newTime.week} ROLLOVER ===`);

    const weeklyResult = processWeeklyEconomy(
      updatedAgents,
      updatedLocations,
      updatedOrgs,
      config.balance,
      newTime.currentPhase
    );
    updatedAgents = weeklyResult.agents;
    updatedLocations = weeklyResult.locations;
    updatedOrgs = weeklyResult.orgs;
  }

  return {
    ...state,
    time: newTime,
    agents: updatedAgents,
    locations: updatedLocations,
    organizations: updatedOrgs,
  };
}

// Note: restockSystemShops removed - supply chain now uses real factories

/**
 * Check if simulation should stop (all agents dead)
 */
export function shouldStop(state: SimulationState): boolean {
  return countLivingAgents(state.agents) === 0;
}

/**
 * Get simulation summary
 */
export function getSummary(state: SimulationState): string {
  const living = countLivingAgents(state.agents);
  const dead = countDeadAgents(state.agents);
  const employed = state.agents.filter((a) => a.status === 'employed').length;
  const agentProvisions = state.agents.reduce(
    (sum, a) => sum + (a.inventory['provisions'] ?? 0),
    0
  );
  const agentCredits = state.agents.reduce((sum, a) => sum + a.wallet.credits, 0);

  const factories = state.locations.filter((l) => l.tags.includes('wholesale')).length;
  const shops = state.locations.filter((l) => l.tags.includes('retail')).length;
  const factoryProvisions = state.locations
    .filter((l) => l.tags.includes('wholesale'))
    .reduce((sum, l) => sum + (l.inventory['provisions'] ?? 0), 0);
  const shopProvisions = state.locations
    .filter((l) => l.tags.includes('retail'))
    .reduce((sum, l) => sum + (l.inventory['provisions'] ?? 0), 0);
  const orgCredits = state.organizations.reduce((sum, o) => sum + o.wallet.credits, 0);

  return `
=== Simulation Summary ===
Time: ${formatTime(state.time)}
Agents: ${living} alive, ${dead} dead, ${employed} employed
Agent Provisions: ${agentProvisions}
Agent Credits: ${agentCredits}
Organizations: ${state.organizations.length} corps, ${orgCredits} credits
Factories: ${factories} with ${factoryProvisions} provisions
Shops: ${shops} with ${shopProvisions} provisions
==========================
`;
}
