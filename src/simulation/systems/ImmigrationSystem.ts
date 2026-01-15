/**
 * ImmigrationSystem - Handles population spawning/immigration
 * Spawns new agents when population drops below target
 */

import type { Agent, Location } from '../../types';
import type { PopulationConfig, AgentTemplate } from '../../config/ConfigLoader';
import { ActivityLog } from '../ActivityLog';
import { trackImmigrant } from '../Metrics';

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

// Counter for unique immigrant IDs (starts high to avoid collision with initial agents)
let immigrantIdCounter = 10000;

/**
 * Generate a random name for an immigrant
 */
function generateImmigrantName(): string {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${first} ${last}`;
}

/**
 * Generate a unique ID for an immigrant
 */
function nextImmigrantId(): string {
  return `agent_imm_${++immigrantIdCounter}`;
}

/**
 * Create a single immigrant agent
 */
function createImmigrant(
  config: PopulationConfig,
  agentTemplate: AgentTemplate | undefined,
  spawnLocation: string | undefined,
  phase: number
): Agent {
  const defaults = agentTemplate?.defaults ?? {};
  const stats = defaults.stats ?? {};

  const randomStat = (range?: { min: number; max: number }) => {
    if (range) {
      return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
    }
    return Math.floor(Math.random() * 41) + 20; // 20-60 default
  };

  // Use population config for starting resources (immigrants arrive with less)
  const credits = Math.floor(
    Math.random() * (config.immigrantCredits.max - config.immigrantCredits.min + 1) +
    config.immigrantCredits.min
  );
  const provisions = Math.floor(
    Math.random() * (config.immigrantProvisions.max - config.immigrantProvisions.min + 1) +
    config.immigrantProvisions.min
  );

  return {
    id: nextImmigrantId(),
    name: generateImmigrantName(),
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
      hunger: Math.floor(Math.random() * 21), // 0-20 (arrive hungry but not starving)
      fatigue: Math.floor(Math.random() * 31) + 20, // 20-50 (arrive somewhat tired from journey)
      leisure: Math.floor(Math.random() * 31), // 0-30 (arrive wanting some fun)
    },
    inventory: {
      provisions,
    },
    inventoryCapacity: defaults.inventoryCapacity ?? 20,
    salary: 0,
    wallet: { credits, accounts: [], stashes: [] },
    currentLocation: spawnLocation,
    morale: Math.floor(Math.random() * 41) + 30, // 30-70 (cautiously optimistic)
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
  phase: number
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
    ? publicLocations[Math.floor(Math.random() * publicLocations.length)]?.id
    : undefined;

  // Spawn immigrants
  const newAgents: Agent[] = [];
  for (let i = 0; i < toSpawn; i++) {
    const immigrant = createImmigrant(config, agentTemplate, spawnLocation, phase);
    newAgents.push(immigrant);

    ActivityLog.info(
      phase,
      'immigration',
      `arrived in the city seeking opportunity (credits: ${immigrant.wallet.credits}, provisions: ${immigrant.inventory['provisions'] ?? 0})`,
      immigrant.id,
      immigrant.name
    );

    // Track immigrant in metrics
    trackImmigrant();
  }

  if (isEmergency) {
    console.log(`[Immigration] EMERGENCY: ${toSpawn} immigrants arrived (pop was ${living}, min is ${config.minimum})`);
  } else {
    console.log(`[Immigration] ${toSpawn} immigrants arrived (pop was ${living}, target is ${config.target})`);
  }

  return newAgents;
}

/**
 * Reset the immigrant ID counter (for testing)
 */
export function resetImmigrantCounter(): void {
  immigrantIdCounter = 10000;
}
