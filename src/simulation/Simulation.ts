/**
 * Simulation - Main simulation controller
 * Ties together tick engine, agents, and systems
 */

import type { Agent, Location, Organization, Building, Vehicle, Order, DeliveryRequest } from '../types';
import type { LoadedConfig } from '../config/ConfigLoader';
import type { SeededRNG, SimulationContext } from '../types/SimulationContext';
import type { IdState } from './IdGenerator';
import type { TransactionHistory } from '../types/Transaction';
import { IdGenerator, createInitialIdState } from './IdGenerator';
import { createTransactionHistory } from '../types/Transaction';
import { createTimeState, advancePhase, formatTime, type TimeState } from './TickEngine';
import { ActivityLog } from './ActivityLog';
import { createSeededRNG } from './SeededRandom';
import { processAgentPhase, countLivingAgents, countDeadAgents } from './systems/AgentSystem';
import { fixHomelessAgents } from './systems/AgentEconomicSystem';
import { tryRestockFromWholesale, tryPlaceGoodsOrder, processGoodsOrders } from './systems/SupplyChainSystem';
import { processWeeklyEconomy } from './systems/PayrollSystem';
import { processAgentBehavior } from './behaviors/BehaviorProcessor';
import { processFactoryProduction } from './systems/OrgSystem';
import { processOrgBehaviors } from './systems/OrgBehaviorSystem';
import { cleanupDeadEmployees, cleanupDeadResidents } from './systems/LocationSystem';
import { checkImmigration } from './systems/ImmigrationSystem';
import { processVehicleTravel, cleanupAllVehicles } from './systems/VehicleSystem';
import { cleanupOldDeliveries } from './systems/DeliverySystem';
import { generateCity } from '../generation/CityGenerator';
import { createMetrics, takeSnapshot, startNewWeek, type SimulationMetrics, type MetricsSnapshot } from './Metrics';
import { InvariantChecker } from './validation/InvariantChecker';

export interface SimulationState {
  time: TimeState;
  agents: Agent[];
  buildings: Building[];
  locations: Location[];
  organizations: Organization[];
  vehicles: Vehicle[];
  deliveryRequests: DeliveryRequest[]; // All orders (goods and logistics) - DeliveryRequest is type alias for Order
  grid: import('../generation/types').CityGrid | null;
  isRunning: boolean;
  ticksPerSecond: number;
  // Metrics for Reports panel
  metrics: SimulationMetrics;
  currentSnapshot: MetricsSnapshot | null;
  // Seeded random number generator for reproducible simulations
  rng: SeededRNG;
  // ID generation state for reproducible simulations
  idState: IdState;
  // Transaction history for event-sourced metrics (PLAN-035)
  transactionHistory: TransactionHistory;
}

/**
 * Create simulation with procedurally generated city
 * Uses CityGenerator for proper zone-based layout
 */
export function createSimulationWithCity(config: LoadedConfig, seed?: number): SimulationState {
  const time = createTimeState();

  // Create seeded RNG for reproducible simulation (uses same seed as city generation)
  const actualSeed = seed ?? Date.now();
  const rng = createSeededRNG(actualSeed);

  // Create ID generation state BEFORE city generation
  // City generator will use these counters, then simulation continues from where it left off
  const idState = createInitialIdState();
  const idGen = new IdGenerator(idState);

  // Generate the city with zones, locations, agents, and orgs
  // City generation uses idGen, so idState will be updated with the next available IDs
  const city = generateCity(config, idGen, actualSeed);

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

  console.log(`\n[Simulation] Generated city with ${city.buildings.length} buildings, ${city.organizations.length} orgs, ${city.locations.length} locations, ${city.agents.length} agents`);
  console.log('[Simulation] Supply chain: Factory → Wholesale → Retail → Consumption');
  console.log('[Simulation] Starting simulation...\n');

  // Initialize metrics tracking
  const metrics = createMetrics(seed);
  metrics.startingPopulation = city.agents.length;
  metrics.startingBusinesses = city.organizations.length;
  startNewWeek(metrics, 1);

  const initialState: SimulationState = {
    time,
    agents: city.agents,
    buildings: city.buildings,
    locations: city.locations,
    organizations: city.organizations,
    vehicles: city.vehicles, // Use vehicles from city generation
    deliveryRequests: [], // Populated as factories/warehouses create delivery requests
    grid: city.grid,
    isRunning: false,
    ticksPerSecond: 10,
    metrics,
    currentSnapshot: null,
    rng, // Seeded RNG for reproducible simulation runs
    idState, // ID generation state (already used by city generator, continues from there)
    transactionHistory: createTransactionHistory(56), // Track last week of transactions (PLAN-035)
  };

  // Take initial snapshot
  initialState.currentSnapshot = takeSnapshot(initialState, 0);

  return initialState;
}

/**
 * Process one simulation tick (one phase)
 */
export function tick(state: SimulationState, config: LoadedConfig): SimulationState {
  // Advance time (uses simulation config for time structure)
  const { time: newTime, dayRollover, weekRollover } = advancePhase(state.time, config.simulation);

  // Create simulation context for this tick (dependency injection container)
  const idGen = new IdGenerator(state.idState);
  const context: SimulationContext = {
    metrics: state.metrics,
    rng: state.rng,
    config,
    phase: newTime.currentPhase,
    idGen,
    transactionHistory: state.transactionHistory,
  };

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
  // Only employees physically present at the location contribute to production
  const goodsSizes = { goods: config.economy.goods, defaultGoodsSize: config.economy.defaultGoodsSize };
  updatedLocations = updatedLocations.map((loc) => {
    const template = config.locationTemplates[loc.template];
    return processFactoryProduction(loc, template?.balance.production, newTime.currentPhase, goodsSizes, updatedAgents);
  });

  // 1b. Automatic restocking: All retail shops restock from wholesale
  // This is an org-level process, not an agent behavior - runs every phase
  for (const org of updatedOrgs) {
    const orgRetailLocations = updatedLocations.filter(
      (loc) => org.locations.includes(loc.id) && loc.tags.includes('retail')
    );
    for (const retailLoc of orgRetailLocations) {
      const result = tryRestockFromWholesale(org, retailLoc, updatedLocations, updatedOrgs, config.economy, config.thresholds, newTime.currentPhase, context);
      updatedLocations = result.locations;
      updatedOrgs = result.orgs;
    }
  }

  // 1c. Goods Order Placement: Retail shops place orders for restocking (parallel system)
  // Creates Order entities with orderType='goods' for B2B commerce
  let newGoodsOrders: Order[] = [];
  for (const org of updatedOrgs) {
    const orgRetailLocations = updatedLocations.filter(
      (loc) => org.locations.includes(loc.id) && loc.tags.includes('retail')
    );
    for (const retailLoc of orgRetailLocations) {
      const order = tryPlaceGoodsOrder(
        org,
        retailLoc,
        updatedLocations,
        updatedOrgs,
        state.deliveryRequests, // Check existing orders to avoid duplicates
        config.economy,
        config.thresholds,
        newTime.currentPhase,
        context
      );
      if (order) {
        newGoodsOrders.push(order);
      }
    }
  }

  // 2. Process biological needs (hunger, eating, travel)
  updatedAgents = updatedAgents.map((agent) =>
    processAgentPhase(agent, newTime.currentPhase, config.agents, updatedLocations, context)
  );

  // 2b. Clean up dead employees from location employee lists
  updatedLocations = cleanupDeadEmployees(updatedLocations, updatedAgents, newTime.currentPhase);

  // 2c. Clean up dead residents from apartment resident lists (frees apartments for rent)
  updatedLocations = cleanupDeadResidents(updatedLocations, updatedAgents, newTime.currentPhase);

  // 2d. Clean up dead agents from vehicles (operators and passengers)
  let updatedVehicles = cleanupAllVehicles(state.vehicles, updatedAgents, newTime.currentPhase);

  // 2e. Clean up old completed/failed delivery requests (keep for ~10 weeks)
  let updatedDeliveryRequests = cleanupOldDeliveries(state.deliveryRequests, newTime.currentPhase);

  // 3. Process behavior-based decisions for each agent

  for (let i = 0; i < updatedAgents.length; i++) {
    const agent = updatedAgents[i];
    if (!agent || agent.status === 'dead') continue;

    const result = processAgentBehavior(
      agent,
      updatedAgents,
      updatedLocations,
      updatedOrgs,
      state.buildings,
      updatedVehicles,
      updatedDeliveryRequests,
      config,
      newTime.currentPhase,
      context
    );

    updatedAgents[i] = result.agent;
    updatedLocations = result.locations;
    updatedOrgs = result.orgs;
    updatedVehicles = result.vehicles;
    updatedDeliveryRequests = result.deliveryRequests;

    // Add new location and org if agent opened a business
    if (result.newLocation) {
      updatedLocations.push(result.newLocation);
    }
    if (result.newOrg) {
      updatedOrgs.push(result.newOrg);
    }
  }

  // 3b. Process vehicle travel (all vehicles in transit)
  updatedVehicles = updatedVehicles.map(vehicle =>
    processVehicleTravel(vehicle, newTime.currentPhase)
  );

  // 3c. Process org-level behaviors (procurement, expansion)
  const orgBehaviorResult = processOrgBehaviors(
    updatedOrgs,
    updatedLocations,
    state.buildings,
    config.locationTemplates,
    config.economy,
    config.thresholds,
    config.business,
    config.logistics,
    newTime.currentPhase,
    context
  );
  updatedOrgs = orgBehaviorResult.orgs;
  updatedLocations = orgBehaviorResult.locations;

  // Collect new delivery requests from org behaviors (warehouse transfers)
  updatedDeliveryRequests = [...updatedDeliveryRequests, ...orgBehaviorResult.deliveryRequests];

  // Add new goods orders (B2B commerce orders from retail shops)
  updatedDeliveryRequests = [...updatedDeliveryRequests, ...newGoodsOrders];

  // Process goods orders: check if ready and create logistics orders for delivery
  const goodsOrderResult = processGoodsOrders(
    updatedDeliveryRequests,
    updatedLocations,
    updatedOrgs,
    config.economy,
    config.logistics,
    newTime.currentPhase
  );
  updatedDeliveryRequests = goodsOrderResult.orders;
  // Add new logistics orders created from ready goods orders
  updatedDeliveryRequests = [...updatedDeliveryRequests, ...goodsOrderResult.newLogisticsOrders];

  // 4. Process weekly economy (payroll, operating costs) - STAGGERED across week
  // Each org processes on their weeklyPhaseOffset (spread across 56 phases)
  // Also cleans up vehicles and orders from dissolved orgs
  const weeklyResult = processWeeklyEconomy(
    updatedAgents,
    updatedLocations,
    updatedOrgs,
    updatedVehicles,
    updatedDeliveryRequests,
    config.business,
    newTime.currentPhase,
    context
  );
  updatedAgents = weeklyResult.agents;
  updatedLocations = weeklyResult.locations;
  updatedOrgs = weeklyResult.orgs;
  updatedVehicles = weeklyResult.vehicles;
  updatedDeliveryRequests = weeklyResult.deliveryRequests;

  // 4b. Fix any homeless agents created by org dissolution
  // (e.g., employees at deleted locations)
  updatedAgents = fixHomelessAgents(updatedAgents, updatedLocations, newTime.currentPhase);

  // 4c. Check for immigration on week rollover only
  if (weekRollover) {
    console.log(`\n=== WEEK ${newTime.week} ROLLOVER ===`);

    const immigrants = checkImmigration(
      updatedAgents,
      updatedLocations,
      config.simulation.population,
      config.agentTemplates['civilian'],
      newTime.currentPhase,
      context
    );
    if (immigrants.length > 0) {
      updatedAgents = [...updatedAgents, ...immigrants];
    }

    // Start new week for metrics tracking
    startNewWeek(state.metrics, newTime.week);
  }

  // Build updated state
  const updatedState: SimulationState = {
    ...state,
    time: newTime,
    agents: updatedAgents,
    locations: updatedLocations,
    organizations: updatedOrgs,
    vehicles: updatedVehicles, // Updated by deliver_goods behavior
    deliveryRequests: updatedDeliveryRequests, // Includes new requests from warehouse transfers and updated by deliveries
  };

  // Update current snapshot for Reports panel
  updatedState.currentSnapshot = takeSnapshot(updatedState, newTime.currentPhase);

  // Run invariant checks if enabled (PLAN-036)
  if (config.simulation.invariantChecking) {
    const checker = new InvariantChecker(config.simulation.invariantChecking, config.economy);
    const shouldFail = checker.checkAndLog(updatedState);

    if (shouldFail) {
      throw new Error(`Invariant violations detected at phase ${newTime.currentPhase}`);
    }
  }

  return updatedState;
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
