/**
 * BehaviorRegistry - Registry pattern for behavior executors
 * Maps executor names to executor functions
 */

import type { Agent, Location, Organization, Building, AgentTask, Vehicle, DeliveryRequest } from '../../types/entities';
import type {
  BehaviorDefinition,
  EconomyConfig,
  AgentsConfig,
  TransportConfig,
  LocationTemplate,
} from '../../config/ConfigLoader';

/**
 * Context passed to behavior executors
 */
export interface BehaviorContext {
  agents: Agent[];
  locations: Location[];
  orgs: Organization[];
  buildings: Building[];
  vehicles?: Vehicle[];
  deliveryRequests?: DeliveryRequest[];
  economyConfig: EconomyConfig;
  agentsConfig: AgentsConfig;
  transportConfig: TransportConfig;
  locationTemplates: Record<string, LocationTemplate>;
  phase: number;
}

/**
 * Result returned from behavior executors
 */
export interface TaskResult {
  agent: Agent;
  locations: Location[];
  orgs: Organization[];
  complete: boolean;
  newLocation?: Location;
  newOrg?: Organization;
  vehicles?: Vehicle[];
  deliveryRequests?: DeliveryRequest[];
}

/**
 * Executor function signature
 * Takes an agent, their current task, and context
 * Returns updated state and whether task is complete
 */
export type ExecutorFn = (
  agent: Agent,
  task: AgentTask,
  ctx: BehaviorContext
) => TaskResult;

// Registry of executor functions
const executorRegistry = new Map<string, ExecutorFn>();

/**
 * Register an executor function
 */
export function registerExecutor(name: string, executor: ExecutorFn): void {
  executorRegistry.set(name, executor);
}

/**
 * Get an executor by name
 */
export function getExecutor(name: string): ExecutorFn | undefined {
  return executorRegistry.get(name);
}

/**
 * Check if an executor is registered
 */
export function hasExecutor(name: string): boolean {
  return executorRegistry.has(name);
}

/**
 * Execute a behavior for an agent
 * Creates/continues task and runs the appropriate executor
 */
export function executeBehavior(
  agent: Agent,
  behavior: BehaviorDefinition,
  ctx: BehaviorContext
): TaskResult {
  const executor = executorRegistry.get(behavior.executor);

  if (!executor) {
    console.warn(`[BehaviorRegistry] No executor found for: ${behavior.executor}`);
    return {
      agent,
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true, // Mark complete so we don't get stuck
    };
  }

  // Create task from behavior if agent doesn't have one
  const task: AgentTask = agent.currentTask ?? {
    type: behavior.id,
    priority: behavior.priority,
    startedPhase: ctx.phase,
    params: behavior.params,
  };

  return executor(agent, task, ctx);
}

/**
 * Execute an agent's current task
 */
export function executeCurrentTask(
  agent: Agent,
  ctx: BehaviorContext,
  behaviorsById: Record<string, BehaviorDefinition>
): TaskResult {
  if (!agent.currentTask) {
    return {
      agent,
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true,
    };
  }

  const behavior = behaviorsById[agent.currentTask.type];
  if (!behavior) {
    console.warn(`[BehaviorRegistry] Unknown behavior: ${agent.currentTask.type}`);
    // Clear invalid task
    return {
      agent: { ...agent, currentTask: undefined },
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true,
    };
  }

  const executor = executorRegistry.get(behavior.executor);
  if (!executor) {
    console.warn(`[BehaviorRegistry] No executor for: ${behavior.executor}`);
    return {
      agent: { ...agent, currentTask: undefined },
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true,
    };
  }

  return executor(agent, agent.currentTask, ctx);
}

/**
 * Get list of registered executors (for debugging)
 */
export function getRegisteredExecutors(): string[] {
  return Array.from(executorRegistry.keys());
}
