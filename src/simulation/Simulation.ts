/**
 * Simulation - Main simulation controller
 * Ties together tick engine, agents, and systems
 */

import type { Agent, Location } from '../types';
import type { LoadedConfig } from '../config/ConfigLoader';
import { createTimeState, advancePhase, formatTime, type TimeState } from './TickEngine';
import { ActivityLog } from './ActivityLog';
import { processAgentPhase, createAgent, countLivingAgents, countDeadAgents } from './systems/AgentSystem';
import { processAgentEconomicDecision, processWeeklyEconomy } from './systems/EconomySystem';

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
  isRunning: boolean;
  ticksPerSecond: number;
}

/**
 * Create initial simulation state with test agents and locations
 */
export function createSimulation(config: LoadedConfig): SimulationState {
  const time = createTimeState();
  const agents: Agent[] = [];
  const locations: Location[] = [];

  // Create 2 initial retail shops (system-owned - no owner)
  const shopNames = ['Central Market', 'Corner Store'];
  for (let i = 0; i < 2; i++) {
    const location = createSystemLocation(
      `location-sys-${i + 1}`,
      shopNames[i] ?? `Shop ${i + 1}`,
      'retail_shop',
      config,
      time.currentPhase
    );
    locations.push(location);

    ActivityLog.info(
      time.currentPhase,
      'business',
      `system shop opened with ${location.inventory['provisions']} provisions`,
      location.id,
      location.name
    );
  }

  // Create 20 test agents
  for (let i = 0; i < 20; i++) {
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
      `spawned with ${agent.inventory['provisions']} provisions, ${agent.wallet.credits} credits, hunger: ${agent.needs.hunger.toFixed(1)}`,
      agent.id,
      agent.name
    );
  }

  console.log(`\n[Simulation] Created ${locations.length} locations and ${agents.length} test agents`);
  console.log('[Simulation] Starting simulation...\n');

  return {
    time,
    agents,
    locations,
    isRunning: false,
    ticksPerSecond: 10,
  };
}

/**
 * Create a system-owned location (no owner, infinite restocking)
 */
function createSystemLocation(
  id: string,
  name: string,
  templateId: string,
  config: LoadedConfig,
  phase: number
): Location {
  const template = config.locationTemplates[templateId];
  if (!template) {
    throw new Error(`Unknown location template: ${templateId}`);
  }

  const locationConfig = template.balance;
  const defaults = template.defaults as {
    size?: number;
    security?: number;
    agentCapacity?: number;
  };

  return {
    id,
    name,
    template: templateId,
    tags: [...template.tags, 'system'],
    created: phase,
    relationships: [],
    sector: 'downtown',
    district: 'market',
    coordinates: { distance: Math.random() * 50, vertical: 0 },
    size: defaults.size ?? 2,
    security: defaults.security ?? 20,
    owner: undefined,
    ownerType: 'none',
    previousOwners: [],
    employees: [],
    employeeSlots: 0, // System shops don't hire - they're just supply sources
    baseIncome: 0,
    operatingCost: 0, // System shops have no operating cost
    weeklyRevenue: 0,
    weeklyCosts: 0,
    agentCapacity: defaults.agentCapacity ?? 20,
    vehicleCapacity: 0,
    occupants: [],
    vehicles: [],
    inventory: {
      provisions: locationConfig.startingInventory * 5, // System shops have more stock
    },
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
    const shops = state.locations.filter((l) => l.ownerType === 'agent').length;
    console.log(
      `\n--- ${formatTime(newTime)} --- (${living} alive, ${dead} dead, ${employed} employed, ${shops} agent shops)`
    );
  }

  let updatedAgents = [...state.agents];
  let updatedLocations = [...state.locations];

  // 1. Process biological needs (hunger, eating from inventory)
  updatedAgents = updatedAgents.map((agent) =>
    processAgentPhase(agent, newTime.currentPhase, config.balance)
  );

  // 2. Process economic decisions for each agent (buy food, seek job, open business)
  for (let i = 0; i < updatedAgents.length; i++) {
    const agent = updatedAgents[i];
    if (!agent || agent.status === 'dead') continue;

    const result = processAgentEconomicDecision(
      agent,
      updatedLocations,
      updatedAgents,
      config.balance,
      config.locationTemplates,
      newTime.currentPhase
    );

    updatedAgents[i] = result.agent;
    updatedLocations = result.locations;

    // Add new location if agent opened a business
    if (result.newLocation) {
      updatedLocations.push(result.newLocation);
    }
  }

  // 3. Restock system-owned shops (infinite supply)
  updatedLocations = restockSystemShops(updatedLocations, config.locationTemplates);

  // 4. Process weekly economy on week rollover (payroll, operating costs)
  if (weekRollover) {
    console.log(`\n=== WEEK ${newTime.week} ROLLOVER ===`);
    const weeklyResult = processWeeklyEconomy(
      updatedAgents,
      updatedLocations,
      config.balance,
      newTime.currentPhase
    );
    updatedAgents = weeklyResult.agents;
    updatedLocations = weeklyResult.locations;
  }

  return {
    ...state,
    time: newTime,
    agents: updatedAgents,
    locations: updatedLocations,
  };
}

/**
 * Restock system-owned shops to maintain supply
 */
function restockSystemShops(
  locations: Location[],
  locationTemplates: Record<string, LoadedConfig['locationTemplates'][string]>
): Location[] {
  return locations.map((loc) => {
    if (loc.ownerType !== 'none') return loc;

    const template = locationTemplates[loc.template];
    const targetStock = (template?.balance.startingInventory ?? 20) * 5;
    const currentStock = loc.inventory['provisions'] ?? 0;

    if (currentStock < targetStock / 2) {
      return {
        ...loc,
        inventory: {
          ...loc.inventory,
          provisions: targetStock,
        },
      };
    }
    return loc;
  });
}

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

  const systemShops = state.locations.filter((l) => l.ownerType === 'none').length;
  const agentShops = state.locations.filter((l) => l.ownerType === 'agent').length;
  const locationProvisions = state.locations.reduce(
    (sum, l) => sum + (l.inventory['provisions'] ?? 0),
    0
  );

  return `
=== Simulation Summary ===
Time: ${formatTime(state.time)}
Agents: ${living} alive, ${dead} dead, ${employed} employed
Agent Provisions: ${agentProvisions}
Agent Credits: ${agentCredits}
Locations: ${systemShops} system shops, ${agentShops} agent shops
Shop Inventory: ${locationProvisions} provisions
==========================
`;
}
