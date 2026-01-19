/**
 * ImmigrationSystem - Handles population spawning/immigration
 * Spawns new agents when population drops below target
 */

import type { Agent, Location } from '../../types';
import type { PopulationConfig, AgentTemplate } from '../../config/ConfigLoader';
import type { SimulationContext } from '../../types/SimulationContext';
import { ActivityLog } from '../ActivityLog';
import { recordImmigrant } from '../Metrics';

// Name pools for immigrants
const FIRST_NAMES = [
  'Alex', 'Blake', 'Casey', 'Dana', 'Ellis',
  'Finn', 'Grey', 'Harper', 'Indigo', 'Jordan',
  'Kai', 'Lennox', 'Morgan', 'Nova', 'Onyx',
  'Phoenix', 'Quinn', 'Riley', 'Sage', 'Vesper', 'Winter',
];

const LAST_NAMES = [
  'Andersen', 'Chen', 'Dubois', 'Hassan', 'Johansson',
  'Kim', 'Nakamura', 'Okafor', 'Okonkwo', 'Petrov',
  'Rivera', 'Singh', 'Sterling', 'Vasquez', 'Yamamoto',
];

/**
 * Generate a random name for an immigrant
 */
function generateImmigrantName(context: SimulationContext): string {
  const first = FIRST_NAMES[Math.floor(context.rng() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(context.rng() * LAST_NAMES.length)];
  return `${first} ${last}`;
}

/**
 * Create a single immigrant agent
 */
function createImmigrant(
  config: PopulationConfig,
  agentTemplate: AgentTemplate | undefined,
  spawnLocation: string | undefined,
  phase: number,
  context: SimulationContext
): Agent {
  const defaults = agentTemplate?.defaults ?? {};
  const stats = defaults.stats ?? {};

  const randomStat = (range?: { min: number; max: number }) => {
    if (range) {
      return Math.floor(context.rng() * (range.max - range.min + 1)) + range.min;
    }
    return Math.floor(context.rng() * 41) + 20; // 20-60 default
  };

  // Use population config for starting resources (immigrants arrive with less)
  const credits = Math.floor(
    context.rng() * (config.immigrantCredits.max - config.immigrantCredits.min + 1) +
    config.immigrantCredits.min
  );
  const provisions = Math.floor(
    context.rng() * (config.immigrantProvisions.max - config.immigrantProvisions.min + 1) +
    config.immigrantProvisions.min
  );

  return {
    id: context.idGen.nextAgentId(),
    name: generateImmigrantName(context),
    template: 'civilian',
    tags: ['civilian', 'immigrant'],
    created: phase,
    relationships: [],
    status: 'available',
    age: 0,
    stats: {
      force: randomStat(stats.force),
      mobility: randomStat(stats.mobility),
      tech: randomStat(stats.tech),
      social: randomStat(stats.social),
      business: randomStat(stats.business),
      engineering: randomStat(stats.engineering),
    },
    needs: {
      hunger: Math.floor(context.rng() * 21), // 0-20 (arrive hungry but not starving)
      fatigue: Math.floor(context.rng() * 31) + 20, // 20-50 (arrive somewhat tired from journey)
      leisure: Math.floor(context.rng() * 31), // 0-30 (arrive wanting some fun)
    },
    inventory: {
      provisions,
    },
    inventoryCapacity: defaults.inventoryCapacity ?? 20,
    salary: 0,
    wallet: { credits, accounts: [], stashes: [] },
    currentLocation: spawnLocation,
    morale: Math.floor(context.rng() * 41) + 30, // 30-70 (cautiously optimistic)
    personalGoals: [],
  };
}

/**
 * Check if immigration should occur and spawn new agents if needed
 * Returns the new agents to add to the simulation
 */
export function checkImmigration(
  agents: Agent[],
  locations: Location[],
  config: PopulationConfig | undefined,
  agentTemplate: AgentTemplate | undefined,
  phase: number,
  context: SimulationContext
): Agent[] {
  // Skip if no population config
  if (!config) {
    return [];
  }

  // Count living agents
  const living = agents.filter(a => a.status !== 'dead').length;

  // No immigration needed if at or above target
  if (living >= config.target) {
    return [];
  }

  // Calculate how many immigrants to spawn
  const deficit = config.target - living;
  const isEmergency = living < config.minimum;

  // Spawn more aggressively in emergency, but not all at once
  const maxSpawn = isEmergency ? config.spawnRate * 2 : config.spawnRate;
  const toSpawn = Math.min(deficit, maxSpawn);

  if (toSpawn <= 0) {
    return [];
  }

  // Find a public location for immigrants to arrive at
  const publicLocations = locations.filter(loc => loc.tags.includes('public'));
  const spawnLocation = publicLocations.length > 0
    ? publicLocations[Math.floor(context.rng() * publicLocations.length)]?.id
    : undefined;

  // Spawn immigrants
  const newAgents: Agent[] = [];
  for (let i = 0; i < toSpawn; i++) {
    const immigrant = createImmigrant(config, agentTemplate, spawnLocation, phase, context);
    newAgents.push(immigrant);

    ActivityLog.info(
      phase,
      'immigration',
      `arrived in the city seeking opportunity (credits: ${immigrant.wallet.credits}, provisions: ${immigrant.inventory['provisions'] ?? 0})`,
      immigrant.id,
      immigrant.name
    );

    // Record immigrant in metrics
    recordImmigrant(context.metrics);
  }

  if (isEmergency) {
    console.log(`[Immigration] EMERGENCY: ${toSpawn} immigrants arrived (pop was ${living}, min is ${config.minimum})`);
  } else {
    console.log(`[Immigration] ${toSpawn} immigrants arrived (pop was ${living}, target is ${config.target})`);
  }

  return newAgents;
}

