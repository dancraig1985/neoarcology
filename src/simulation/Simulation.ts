/**
 * Simulation - Main simulation controller
 * Ties together tick engine, agents, and systems
 */

import type { Agent } from '../types';
import type { LoadedConfig } from '../config/ConfigLoader';
import { createTimeState, advancePhase, formatTime, type TimeState } from './TickEngine';
import { ActivityLog } from './ActivityLog';
import { processAgentPhase, createAgent, countLivingAgents, countDeadAgents } from './systems/AgentSystem';

// Agent names for test harness
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
];

export interface SimulationState {
  time: TimeState;
  agents: Agent[];
  isRunning: boolean;
  ticksPerSecond: number;
}

/**
 * Create initial simulation state with test agents
 */
export function createSimulation(config: LoadedConfig): SimulationState {
  const time = createTimeState();
  const agents: Agent[] = [];

  // Create 10 test agents
  for (let i = 0; i < 10; i++) {
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

  console.log(`\n[Simulation] Created ${agents.length} test agents`);
  console.log('[Simulation] Starting simulation...\n');

  return {
    time,
    agents,
    isRunning: false,
    ticksPerSecond: 10,
  };
}

/**
 * Process one simulation tick (one phase)
 */
export function tick(state: SimulationState, config: LoadedConfig): SimulationState {
  // Advance time (uses simulation config for time structure)
  const { time: newTime, dayRollover } = advancePhase(state.time, config.simulation);

  // Log time progression on day rollover
  if (dayRollover) {
    const living = countLivingAgents(state.agents);
    const dead = countDeadAgents(state.agents);
    console.log(`\n--- ${formatTime(newTime)} --- (${living} alive, ${dead} dead)`);
  }

  // Process all agents (uses balance config for gameplay tuning)
  const newAgents = state.agents.map((agent) =>
    processAgentPhase(agent, newTime.currentPhase, config.balance)
  );

  return {
    ...state,
    time: newTime,
    agents: newAgents,
  };
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
  const totalProvisions = state.agents.reduce(
    (sum, a) => sum + (a.inventory['provisions'] ?? 0),
    0
  );
  const totalCredits = state.agents.reduce((sum, a) => sum + a.wallet.credits, 0);

  return `
=== Simulation Summary ===
Time: ${formatTime(state.time)}
Agents: ${living} alive, ${dead} dead
Total Provisions: ${totalProvisions}
Total Credits: ${totalCredits}
==========================
`;
}
