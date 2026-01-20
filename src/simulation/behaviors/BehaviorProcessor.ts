/**
 * BehaviorProcessor - Main entry point for behavior-based agent processing
 *
 * This replaces the cascading if/else chain in EconomySystem with a
 * data-driven behavior system.
 */

import type { Agent, Location, Organization, Building, TaskPriority, Vehicle, DeliveryRequest } from '../../types/entities';
import type { LoadedConfig } from '../../config/ConfigLoader';
import type { SimulationContext } from '../../types/SimulationContext';
import { processTravel, isTraveling } from '../systems/TravelSystem';
import { evaluateConditions, isTaskComplete, type EvaluationContext } from './ConditionEvaluator';
import { executeBehavior, executeCurrentTask, type BehaviorContext } from './BehaviorRegistry';

// Import executors to register them
import './executors';

/**
 * Result from processing an agent's behavior
 */
export interface BehaviorProcessResult {
  agent: Agent;
  locations: Location[];
  orgs: Organization[];
  vehicles: Vehicle[];
  deliveryRequests: DeliveryRequest[];
  newLocation?: Location;
  newOrg?: Organization;
}

/**
 * Check if a priority level can interrupt another
 */
function canInterrupt(incomingPriority: TaskPriority, currentPriority: TaskPriority): boolean {
  const priorityOrder: Record<TaskPriority, number> = {
    critical: 4,
    high: 3,
    normal: 2,
    idle: 1,
  };

  return priorityOrder[incomingPriority] > priorityOrder[currentPriority];
}

/**
 * Clear the current task
 */
function clearTask(agent: Agent): Agent {
  return { ...agent, currentTask: undefined };
}

/**
 * Process an agent's behavior for one phase
 *
 * Flow:
 * 1. Process travel tick (if traveling)
 * 2. Check CRITICAL interrupts (always interrupt)
 * 3. If has task:
 *    - Check HIGH interrupts (can preempt NORMAL tasks)
 *    - Check if task is complete
 *    - If not complete: execute task step
 * 4. If no task: find highest priority applicable behavior
 */
export function processAgentBehavior(
  agent: Agent,
  allAgents: Agent[],
  locations: Location[],
  orgs: Organization[],
  buildings: Building[],
  vehicles: Vehicle[],
  deliveryRequests: DeliveryRequest[],
  config: LoadedConfig,
  phase: number,
  context: SimulationContext
): BehaviorProcessResult {
  // Skip dead agents
  if (agent.status === 'dead') {
    return { agent, locations, orgs, vehicles, deliveryRequests };
  }

  let currentAgent = agent;
  let currentLocations = locations;
  let currentOrgs = orgs;
  let currentVehicles = vehicles;
  let currentDeliveryRequests = deliveryRequests;

  // Build contexts (needed for critical behavior checks even while traveling)
  const evalCtx: EvaluationContext = {
    locations: currentLocations,
    orgs: currentOrgs,
    currentPhase: phase,
  };

  const getBehaviorCtx = (): BehaviorContext => ({
    agents: allAgents,
    locations: currentLocations,
    orgs: currentOrgs,
    buildings,
    vehicles: currentVehicles,
    deliveryRequests: currentDeliveryRequests,
    economyConfig: config.economy,
    agentsConfig: config.agents,
    thresholdsConfig: config.thresholds,
    businessConfig: config.business,
    logisticsConfig: config.logistics,
    transportConfig: config.transport,
    locationTemplates: config.locationTemplates,
    phase,
    context,
  });

  // 1. Process travel tick (if traveling)
  if (isTraveling(currentAgent)) {
    // CRITICAL: Check critical behaviors even while traveling (starvation can't wait!)
    const criticalBehaviors = config.behaviorsByPriority['critical'] ?? [];
    for (const behavior of criticalBehaviors) {
      if (evaluateConditions(currentAgent, behavior.conditions, evalCtx)) {
        // Clear any existing task and execute critical behavior
        // This may redirect travel or handle emergency while in-transit
        currentAgent = clearTask(currentAgent);
        const result = executeBehavior(currentAgent, behavior, getBehaviorCtx());
        currentVehicles = result.vehicles ?? currentVehicles;
        currentDeliveryRequests = result.deliveryRequests ?? currentDeliveryRequests;
        return {
          agent: result.agent,
          locations: result.locations,
          orgs: result.orgs,
          vehicles: currentVehicles,
          deliveryRequests: currentDeliveryRequests,
          newLocation: result.newLocation,
          newOrg: result.newOrg,
        };
      }
    }

    // Check if higher priority behaviors can interrupt/redirect travel
    const currentTask = currentAgent.currentTask;
    if (currentTask) {
      const highBehaviors = config.behaviorsByPriority['high'] ?? [];
      for (const behavior of highBehaviors) {
        if (
          canInterrupt(behavior.priority, currentTask.priority) &&
          evaluateConditions(currentAgent, behavior.conditions, evalCtx)
        ) {
          // Interrupt and execute (may redirect travel)
          currentAgent = clearTask(currentAgent);
          const result = executeBehavior(currentAgent, behavior, getBehaviorCtx());
          currentVehicles = result.vehicles ?? currentVehicles;
          currentDeliveryRequests = result.deliveryRequests ?? currentDeliveryRequests;
          return {
            agent: result.agent,
            locations: result.locations,
            orgs: result.orgs,
            vehicles: currentVehicles,
            deliveryRequests: currentDeliveryRequests,
            newLocation: result.newLocation,
            newOrg: result.newOrg,
          };
        }
      }

      // Check normal priority behaviors (for redirect scenarios like commuting)
      const normalBehaviors = config.behaviorsByPriority['normal'] ?? [];
      for (const behavior of normalBehaviors) {
        if (
          canInterrupt(behavior.priority, currentTask.priority) &&
          evaluateConditions(currentAgent, behavior.conditions, evalCtx)
        ) {
          // Interrupt and execute (may redirect travel)
          currentAgent = clearTask(currentAgent);
          const result = executeBehavior(currentAgent, behavior, getBehaviorCtx());
          currentVehicles = result.vehicles ?? currentVehicles;
          currentDeliveryRequests = result.deliveryRequests ?? currentDeliveryRequests;
          return {
            agent: result.agent,
            locations: result.locations,
            orgs: result.orgs,
            vehicles: currentVehicles,
            deliveryRequests: currentDeliveryRequests,
            newLocation: result.newLocation,
            newOrg: result.newOrg,
          };
        }
      }
    }

    // No interrupt - process normal travel
    currentAgent = processTravel(currentAgent);

    // If still traveling after tick, we're done for this phase
    if (isTraveling(currentAgent)) {
      return { agent: currentAgent, locations: currentLocations, orgs: currentOrgs, vehicles: currentVehicles, deliveryRequests: currentDeliveryRequests };
    }
  }

  // 2. Check CRITICAL behaviors (always interrupt) - recheck after travel completion
  const criticalBehaviors = config.behaviorsByPriority['critical'] ?? [];
  for (const behavior of criticalBehaviors) {
    if (evaluateConditions(currentAgent, behavior.conditions, evalCtx)) {
      // Clear any existing task and execute critical behavior
      currentAgent = clearTask(currentAgent);
      const result = executeBehavior(currentAgent, behavior, getBehaviorCtx());
      currentVehicles = result.vehicles ?? currentVehicles;
      currentDeliveryRequests = result.deliveryRequests ?? currentDeliveryRequests;
      return {
        agent: result.agent,
        locations: result.locations,
        orgs: result.orgs,
        vehicles: currentVehicles,
        deliveryRequests: currentDeliveryRequests,
        newLocation: result.newLocation,
        newOrg: result.newOrg,
      };
    }
  }

  // 3. If has task, check if it should continue
  if (currentAgent.currentTask) {
    const currentTask = currentAgent.currentTask;
    const currentBehavior = config.behaviorsById[currentTask.type];

    // Check HIGH priority interrupts (can preempt NORMAL/IDLE tasks)
    if (currentTask.priority !== 'critical') {
      const highBehaviors = config.behaviorsByPriority['high'] ?? [];
      for (const behavior of highBehaviors) {
        if (
          canInterrupt(behavior.priority, currentTask.priority) &&
          evaluateConditions(currentAgent, behavior.conditions, evalCtx)
        ) {
          // Interrupt current task
          currentAgent = clearTask(currentAgent);
          const result = executeBehavior(currentAgent, behavior, getBehaviorCtx());
          currentVehicles = result.vehicles ?? currentVehicles;
          currentDeliveryRequests = result.deliveryRequests ?? currentDeliveryRequests;
          return {
            agent: result.agent,
            locations: result.locations,
            orgs: result.orgs,
            vehicles: currentVehicles,
            deliveryRequests: currentDeliveryRequests,
            newLocation: result.newLocation,
            newOrg: result.newOrg,
          };
        }
      }
    }

    // Check if current task is complete
    if (currentBehavior && isTaskComplete(currentAgent, currentBehavior.completionConditions, evalCtx)) {
      currentAgent = clearTask(currentAgent);
      // Fall through to find new task
    } else if (currentBehavior) {
      // Continue executing current task
      const result = executeCurrentTask(currentAgent, getBehaviorCtx(), config.behaviorsById);
      currentVehicles = result.vehicles ?? currentVehicles;
      currentDeliveryRequests = result.deliveryRequests ?? currentDeliveryRequests;
      return {
        agent: result.agent,
        locations: result.locations,
        orgs: result.orgs,
        vehicles: currentVehicles,
        deliveryRequests: currentDeliveryRequests,
        newLocation: result.newLocation,
        newOrg: result.newOrg,
      };
    } else {
      // Unknown behavior - clear task
      currentAgent = clearTask(currentAgent);
    }
  }

  // 4. No task (or task just completed) - find highest priority applicable behavior
  // Check in priority order: critical (already checked), high, normal, idle
  const priorityOrder: TaskPriority[] = ['high', 'normal', 'idle'];

  for (const priority of priorityOrder) {
    const behaviors = config.behaviorsByPriority[priority] ?? [];
    for (const behavior of behaviors) {
      if (evaluateConditions(currentAgent, behavior.conditions, evalCtx)) {
        // Start this behavior
        const result = executeBehavior(currentAgent, behavior, getBehaviorCtx());
        currentVehicles = result.vehicles ?? currentVehicles;
        currentDeliveryRequests = result.deliveryRequests ?? currentDeliveryRequests;
        return {
          agent: result.agent,
          locations: result.locations,
          orgs: result.orgs,
          vehicles: currentVehicles,
          deliveryRequests: currentDeliveryRequests,
          newLocation: result.newLocation,
          newOrg: result.newOrg,
        };
      }
    }
  }

  // No behavior applies - agent is idle
  return { agent: currentAgent, locations: currentLocations, orgs: currentOrgs, vehicles: currentVehicles, deliveryRequests: currentDeliveryRequests };
}
