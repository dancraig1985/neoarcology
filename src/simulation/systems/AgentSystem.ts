/**
 * AgentSystem - Processes agent needs, hunger, eating, travel, and starvation
 */

import type { Agent, Location } from '../../types';
import type { AgentsConfig } from '../../config/ConfigLoader';
import { ActivityLog } from '../ActivityLog';
import { processTravel, isTraveling } from './TravelSystem';
import { setDead } from './AgentStateHelpers';

/**
 * Process a single agent for one phase
 * Handles travel, hunger accumulation, eating, and starvation
 */
export function processAgentPhase(
  agent: Agent,
  phase: number,
  agentsConfig: AgentsConfig,
  locations: Location[]
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

  // Check if agent needs to eat (hunger >= threshold)
  const isHungry = newHunger >= agentsConfig.hunger.threshold;

  updatedAgent = {
    ...updatedAgent,
    needs: {
      ...updatedAgent.needs,
      hunger: newHunger,
    },
  };

  // If hungry, attempt to eat
  if (isHungry && updatedAgent.status !== 'dead') {
    updatedAgent = attemptToEat(updatedAgent, phase, agentsConfig);
  }

  // Check for starvation
  if (updatedAgent.needs.hunger >= agentsConfig.hunger.max) {
    updatedAgent = handleStarvation(updatedAgent, phase);
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
function handleStarvation(agent: Agent, phase: number): Agent {
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
