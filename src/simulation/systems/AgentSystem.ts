/**
 * AgentSystem - Processes agent needs, hunger, eating, travel, and starvation
 */

import type { Agent, Location } from '../../types';
import type { AgentsConfig } from '../../config/ConfigLoader';
import type { SimulationContext } from '../../types/SimulationContext';
import { ActivityLog } from '../ActivityLog';
import { processTravel, isTraveling } from './TravelSystem';
import { setDead } from './AgentStateHelpers';
import { recordDeath } from '../Metrics';

/**
 * Process a single agent for one phase
 * Handles travel, hunger accumulation, eating, and starvation
 */
export function processAgentPhase(
  agent: Agent,
  phase: number,
  agentsConfig: AgentsConfig,
  locations: Location[],
  context: SimulationContext
): Agent {
  // Skip dead agents
  if (agent.status === 'dead') {
    return agent;
  }

  let updatedAgent = agent;

  // Process travel if agent is in transit
  if (isTraveling(updatedAgent)) {
    const wasTraveling = updatedAgent.travelingTo;
    updatedAgent = processTravel(updatedAgent);

    // Check if just arrived
    if (!isTraveling(updatedAgent) && wasTraveling) {
      const destination = locations.find((l) => l.id === updatedAgent.currentLocation);
      ActivityLog.info(
        phase,
        'travel',
        `arrived at ${destination?.name ?? 'destination'}`,
        updatedAgent.id,
        updatedAgent.name
      );
    }
  }

  // Accumulate hunger
  const newHunger = updatedAgent.needs.hunger + agentsConfig.hunger.perPhase;

  // Accumulate fatigue (capped at 100)
  const currentFatigue = updatedAgent.needs.fatigue ?? 0;
  const newFatigue = Math.min(100, currentFatigue + agentsConfig.fatigue.perPhase);

  // Accumulate leisure need (capped at 100)
  // BUT if at a public space (park), leisure slowly decreases instead (free entertainment)
  const currentLeisure = updatedAgent.needs.leisure ?? 0;
  const currentLoc = locations.find((l) => l.id === updatedAgent.currentLocation);
  const isAtPark = currentLoc?.tags.includes('public') && !currentLoc?.tags.includes('shelter');

  let newLeisure: number;
  if (isAtPark) {
    // At park - slowly reduce leisure (free but slow entertainment)
    newLeisure = Math.max(0, currentLeisure - agentsConfig.leisure.parkSatisfactionPerPhase);
  } else {
    // Normal accumulation
    newLeisure = Math.min(
      agentsConfig.leisure.max,
      currentLeisure + agentsConfig.leisure.perPhase
    );
  }

  // Check if agent needs to eat (hunger >= threshold)
  const isHungry = newHunger >= agentsConfig.hunger.threshold;

  updatedAgent = {
    ...updatedAgent,
    needs: {
      ...updatedAgent.needs,
      hunger: newHunger,
      fatigue: newFatigue,
      leisure: newLeisure,
    },
  };

  // If hungry, attempt to eat
  if (isHungry && updatedAgent.status !== 'dead') {
    updatedAgent = attemptToEat(updatedAgent, phase, agentsConfig);
  }

  // Check for starvation
  if (updatedAgent.needs.hunger >= agentsConfig.hunger.max) {
    updatedAgent = handleStarvation(updatedAgent, phase, context);
  } else if (updatedAgent.needs.hunger >= agentsConfig.hunger.max * 0.75) {
    // Starving warning (75%+)
    ActivityLog.warning(
      phase,
      'hunger',
      `is starving! (hunger: ${updatedAgent.needs.hunger.toFixed(1)})`,
      updatedAgent.id,
      updatedAgent.name
    );
  } else if (updatedAgent.needs.hunger >= agentsConfig.hunger.max * 0.5) {
    // Very hungry warning (50%+)
    ActivityLog.warning(
      phase,
      'hunger',
      `is very hungry (hunger: ${updatedAgent.needs.hunger.toFixed(1)})`,
      updatedAgent.id,
      updatedAgent.name
    );
  }

  return updatedAgent;
}

/**
 * Attempt to eat provisions
 */
function attemptToEat(agent: Agent, phase: number, agentsConfig: AgentsConfig): Agent {
  const provisions = agent.inventory['provisions'] ?? 0;

  if (provisions >= agentsConfig.hunger.provisionsPerMeal) {
    // Eat successfully
    const oldHunger = agent.needs.hunger;
    const newProvisions = provisions - agentsConfig.hunger.provisionsPerMeal;

    ActivityLog.info(
      phase,
      'eating',
      `ate provisions (hunger: ${oldHunger.toFixed(1)} → 0, provisions: ${provisions} → ${newProvisions})`,
      agent.id,
      agent.name
    );

    return {
      ...agent,
      needs: {
        ...agent.needs,
        hunger: 0,
      },
      inventory: {
        ...agent.inventory,
        provisions: newProvisions,
      },
    };
  } else {
    // No food available
    ActivityLog.warning(
      phase,
      'hunger',
      `is hungry but has no provisions! (hunger: ${agent.needs.hunger.toFixed(1)})`,
      agent.id,
      agent.name
    );
    return agent;
  }
}

/**
 * Handle agent starvation (death)
 * Uses centralized setDead helper to clear all state atomically
 */
function handleStarvation(agent: Agent, phase: number, context: SimulationContext): Agent {
  // Log if they were employed when they died
  if (agent.employer) {
    console.log(`[DEATH] ${agent.name} died while employed by ${agent.employer}`);
  }

  ActivityLog.critical(
    phase,
    'death',
    `died of starvation`,
    agent.id,
    agent.name
  );

  // Record death in metrics
  recordDeath(context.metrics, agent.name, 'starvation');

  return setDead(agent, phase);
}

/**
 * Get count of living agents
 */
export function countLivingAgents(agents: Agent[]): number {
  return agents.filter((a) => a.status !== 'dead').length;
}

/**
 * Get count of dead agents
 */
export function countDeadAgents(agents: Agent[]): number {
  return agents.filter((a) => a.status === 'dead').length;
}

/**
 * Determine the type of rest based on agent's location
 * Returns: 'home' | 'shelter' | 'forced'
 */
export function getRestType(agent: Agent, location: Location | undefined): 'home' | 'shelter' | 'forced' {
  // No location = forced rest
  if (!location) {
    return 'forced';
  }

  // Resting at home (own residence)
  if (agent.residence === location.id) {
    return 'home';
  }

  // Resting at shelter (public + residential tags)
  const isPublic = location.tags.includes('public');
  const isResidential = location.tags.includes('residential');
  if (isPublic && isResidential) {
    return 'shelter';
  }

  // Anywhere else = forced rest
  return 'forced';
}

/**
 * Process rest for an agent
 * Resets fatigue based on location type:
 * - Home (own residence): 0%
 * - Shelter (public + residential): 30%
 * - Forced (anywhere else): 60%
 */
export function processRest(
  agent: Agent,
  location: Location | undefined,
  phase: number,
  agentsConfig: AgentsConfig
): Agent {
  // Skip dead agents
  if (agent.status === 'dead') {
    return agent;
  }

  const restType = getRestType(agent, location);
  let newFatigue: number;
  let logMessage: string;

  switch (restType) {
    case 'home':
      newFatigue = agentsConfig.fatigue.homeRestReset;
      logMessage = `rested at home (fatigue: ${agent.needs.fatigue.toFixed(1)}% → ${newFatigue}%)`;
      break;
    case 'shelter':
      newFatigue = agentsConfig.fatigue.shelterRestReset;
      logMessage = `rested at shelter (fatigue: ${agent.needs.fatigue.toFixed(1)}% → ${newFatigue}%)`;
      break;
    case 'forced':
      newFatigue = agentsConfig.fatigue.forcedRestReset;
      logMessage = `forced to rest in public (fatigue: ${agent.needs.fatigue.toFixed(1)}% → ${newFatigue}%)`;
      break;
  }

  ActivityLog.info(phase, 'rest', logMessage, agent.id, agent.name);

  return {
    ...agent,
    needs: {
      ...agent.needs,
      fatigue: newFatigue,
    },
    // Preserve employment status - only set 'available' if not employed
    status: agent.status === 'employed' ? 'employed' : 'available',
  };
}

/**
 * Check if agent needs rest based on fatigue thresholds
 */
export function needsRest(agent: Agent, agentsConfig: AgentsConfig): 'none' | 'seeking' | 'urgent' | 'forced' {
  const fatigue = agent.needs.fatigue ?? 0;

  if (fatigue >= agentsConfig.fatigue.forceRestThreshold) {
    return 'forced';
  }
  if (fatigue >= agentsConfig.fatigue.urgentRestThreshold) {
    return 'urgent';
  }
  if (fatigue >= agentsConfig.fatigue.seekRestThreshold) {
    return 'seeking';
  }
  return 'none';
}
