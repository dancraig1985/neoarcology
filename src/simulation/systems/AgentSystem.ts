/**
 * AgentSystem - Processes agent needs, hunger, eating, and starvation
 */

import type { Agent } from '../../types';
import type { BalanceConfig } from '../../config/ConfigLoader';
import { ActivityLog } from '../ActivityLog';

/**
 * Process a single agent for one phase
 * Handles hunger accumulation, eating, and starvation
 */
export function processAgentPhase(
  agent: Agent,
  phase: number,
  balance: BalanceConfig
): Agent {
  // Skip dead agents
  if (agent.status === 'dead') {
    return agent;
  }

  // Accumulate hunger
  const newHunger = agent.needs.hunger + balance.agent.hungerPerPhase;

  // Check if agent needs to eat (hunger >= threshold)
  const isHungry = newHunger >= balance.agent.hungerThreshold;

  let updatedAgent: Agent = {
    ...agent,
    needs: {
      ...agent.needs,
      hunger: newHunger,
    },
  };

  // If hungry, attempt to eat
  if (isHungry && updatedAgent.status !== 'dead') {
    updatedAgent = attemptToEat(updatedAgent, phase, balance);
  }

  // Check for starvation
  if (updatedAgent.needs.hunger >= balance.agent.hungerMax) {
    updatedAgent = handleStarvation(updatedAgent, phase);
  } else if (updatedAgent.needs.hunger >= balance.agent.hungerMax * 0.75) {
    // Starving warning (75%+)
    ActivityLog.warning(
      phase,
      'hunger',
      `is starving! (hunger: ${updatedAgent.needs.hunger.toFixed(1)})`,
      updatedAgent.id,
      updatedAgent.name
    );
  } else if (updatedAgent.needs.hunger >= balance.agent.hungerMax * 0.5) {
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
function attemptToEat(agent: Agent, phase: number, balance: BalanceConfig): Agent {
  const provisions = agent.inventory['provisions'] ?? 0;

  if (provisions >= balance.agent.provisionsPerMeal) {
    // Eat successfully
    const oldHunger = agent.needs.hunger;
    const newProvisions = provisions - balance.agent.provisionsPerMeal;

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
 */
function handleStarvation(agent: Agent, phase: number): Agent {
  console.log(`[DEBUG DEATH] ${agent.name} died! Credits: ${agent.wallet.credits}, Provisions: ${agent.inventory['provisions'] ?? 0}, Status: ${agent.status}, EmployedAt: ${agent.employedAt ?? 'none'}`);

  ActivityLog.critical(
    phase,
    'death',
    `died of starvation`,
    agent.id,
    agent.name
  );

  return {
    ...agent,
    status: 'dead',
    destroyed: phase,
  };
}

/**
 * Create a new agent with randomized starting values
 */
export function createAgent(
  id: string,
  name: string,
  balance: BalanceConfig,
  phase: number
): Agent {
  const startingHunger =
    Math.random() * (balance.agent.startingHungerMax - balance.agent.startingHungerMin) +
    balance.agent.startingHungerMin;

  const startingCredits =
    Math.random() * (balance.agent.startingCreditsMax - balance.agent.startingCreditsMin) +
    balance.agent.startingCreditsMin;

  const startingProvisions =
    Math.floor(
      Math.random() * (balance.agent.startingProvisionsMax - balance.agent.startingProvisionsMin + 1)
    ) + balance.agent.startingProvisionsMin;

  return {
    id,
    name,
    template: 'citizen',
    tags: ['citizen'],
    created: phase,
    relationships: [],
    status: 'available',
    age: 0,
    stats: {
      force: 20 + Math.floor(Math.random() * 30),
      mobility: 20 + Math.floor(Math.random() * 30),
      tech: 20 + Math.floor(Math.random() * 30),
      social: 20 + Math.floor(Math.random() * 30),
      business: 20 + Math.floor(Math.random() * 30),
      engineering: 20 + Math.floor(Math.random() * 30),
    },
    needs: {
      hunger: startingHunger,
    },
    inventory: {
      provisions: startingProvisions,
    },
    inventoryCapacity: balance.agent.inventoryCapacity,
    salary: 0,
    wallet: {
      credits: Math.floor(startingCredits),
      accounts: [],
      stashes: [],
    },
    morale: 50,
    personalGoals: [],
  };
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
