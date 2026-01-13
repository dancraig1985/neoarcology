/**
 * Simulation - Main simulation controller
 * Ties together tick engine, agents, and systems
 */

import type { Agent, Location, Organization, Building } from '../types';
import type { LoadedConfig } from '../config/ConfigLoader';
import { createTimeState, advancePhase, formatTime, type TimeState } from './TickEngine';
import { ActivityLog } from './ActivityLog';
import { processAgentPhase, countLivingAgents, countDeadAgents } from './systems/AgentSystem';
import { processAgentEconomicDecision, processWeeklyEconomy, fixHomelessAgents } from './systems/EconomySystem';
import { processFactoryProduction } from './systems/OrgSystem';
import { cleanupDeadEmployees } from './systems/LocationSystem';
import { checkImmigration } from './systems/ImmigrationSystem';
import { generateCity } from '../generation/CityGenerator';

export interface SimulationState {
  time: TimeState;
  agents: Agent[];
  buildings: Building[];
  locations: Location[];
  organizations: Organization[];
  grid: import('../generation/types').CityGrid | null;
  isRunning: boolean;
  ticksPerSecond: number;
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

  console.log(`\n[Simulation] Generated city with ${city.buildings.length} buildings, ${city.organizations.length} orgs, ${city.locations.length} locations, ${city.agents.length} agents`);
  console.log('[Simulation] Supply chain: Factory → Wholesale → Retail → Consumption');
  console.log('[Simulation] Starting simulation...\n');

  return {
    time,
    agents: city.agents,
    buildings: city.buildings,
    locations: city.locations,
    organizations: city.organizations,
    grid: city.grid,
    isRunning: false,
    ticksPerSecond: 10,
  };
}

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
  // Only employees physically present at the location contribute to production
  const goodsSizes = { goods: config.economy.goods, defaultGoodsSize: config.economy.defaultGoodsSize };
  updatedLocations = updatedLocations.map((loc) => {
    const template = config.locationTemplates[loc.template];
    return processFactoryProduction(loc, template?.balance.production, newTime.currentPhase, goodsSizes, updatedAgents);
  });

  // 2. Process biological needs (hunger, eating, travel)
  updatedAgents = updatedAgents.map((agent) =>
    processAgentPhase(agent, newTime.currentPhase, config.agents, updatedLocations)
  );

  // 2b. Clean up dead employees from location employee lists
  updatedLocations = cleanupDeadEmployees(updatedLocations, updatedAgents, newTime.currentPhase);

  // 3. Process economic decisions for each agent (buy food, restock shop, seek job, open business)
  for (let i = 0; i < updatedAgents.length; i++) {
    const agent = updatedAgents[i];
    if (!agent || agent.status === 'dead') continue;

    const result = processAgentEconomicDecision(
      agent,
      updatedLocations,
      updatedOrgs,
      state.buildings,
      config.economy,
      config.agents,
      config.locationTemplates,
      config.transport,
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
      newTime.currentPhase
    );
    updatedAgents = weeklyResult.agents;
    updatedLocations = weeklyResult.locations;
    updatedOrgs = weeklyResult.orgs;

    // 4b. Fix any homeless agents created by org dissolution
    // (e.g., employees at deleted locations)
    updatedAgents = fixHomelessAgents(updatedAgents, updatedLocations, newTime.currentPhase);

    // 4c. Check for immigration (spawn new agents if population is low)
    const immigrants = checkImmigration(
      updatedAgents,
      updatedLocations,
      config.simulation.population,
      config.agentTemplates['civilian'],
      newTime.currentPhase
    );
    if (immigrants.length > 0) {
      updatedAgents = [...updatedAgents, ...immigrants];
    }
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
