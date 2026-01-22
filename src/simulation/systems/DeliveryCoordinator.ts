/**
 * DeliveryCoordinator - Centralized state management for delivery system
 *
 * Responsibilities:
 * - Match drivers to orders (considering fatigue, vehicle availability)
 * - Validate state consistency (no orphaned references)
 * - Detect stuck deliveries (timeout after 20 phases of no progress)
 * - Handle cleanup (release vehicles, fail orders)
 *
 * Part of delivery system refactoring to reduce state explosion and failure modes
 */

import type { Agent, Order, Vehicle, Location, Organization } from '../../types';
import { ActivityLog } from '../ActivityLog';
import { failDelivery, failDeliveryWithParent } from './DeliverySystem';

/**
 * Result of attempting to assign a delivery
 */
export interface AssignmentResult {
  success: boolean;
  reason?: string;
  agent?: Agent;
  order?: Order;
  vehicle?: Vehicle;
}

/**
 * Information about a stuck delivery
 */
export interface StuckDelivery {
  orderId: string;
  agentId: string;
  agentName: string;
  reason: string;
  phasesStuck: number;
}

/**
 * Validate that all references in a delivery are still valid
 * Checks: driver exists and alive, vehicle exists, locations exist
 */
export function validateDeliveryState(
  order: Order,
  agents: Agent[],
  vehicles: Vehicle[],
  locations: Location[]
): { valid: boolean; reason?: string } {
  // Must be a logistics order
  if (order.orderType !== 'logistics') {
    return { valid: false, reason: 'not a logistics order' };
  }

  // Must have required fields
  if (!order.fromLocation || !order.toLocation) {
    return { valid: false, reason: 'missing from/to locations' };
  }

  // Check locations exist
  const fromLoc = locations.find((l) => l.id === order.fromLocation);
  const toLoc = locations.find((l) => l.id === order.toLocation);

  if (!fromLoc) {
    return { valid: false, reason: `pickup location ${order.fromLocation} not found` };
  }

  if (!toLoc) {
    return { valid: false, reason: `delivery location ${order.toLocation} not found` };
  }

  // If assigned, check driver and vehicle exist
  if (order.assignedDriver) {
    const driver = agents.find((a) => a.id === order.assignedDriver);
    if (!driver) {
      return { valid: false, reason: `driver ${order.assignedDriver} not found` };
    }
    if (driver.status === 'dead') {
      return { valid: false, reason: `driver ${order.assignedDriver} is dead` };
    }
  }

  if (order.assignedVehicle) {
    const vehicle = vehicles.find((v) => v.id === order.assignedVehicle);
    if (!vehicle) {
      return { valid: false, reason: `vehicle ${order.assignedVehicle} not found` };
    }
  }

  return { valid: true };
}

/**
 * Attempt to assign a delivery to a driver
 * Validates: driver not too fatigued, vehicle available, logistics company owns vehicle
 */
export function assignDeliveryToDriver(
  driver: Agent,
  order: Order,
  vehicle: Vehicle,
  phase: number
): AssignmentResult {
  // Check driver fatigue (prevent mid-delivery interruption by urgent_rest)
  if (driver.needs.fatigue >= 85) {
    return {
      success: false,
      reason: 'driver too fatigued (>= 85)',
    };
  }

  // Check driver is employed at logistics company
  if (!driver.employer) {
    return {
      success: false,
      reason: 'driver not employed',
    };
  }

  // Check vehicle is owned by same company
  if (vehicle.owner !== driver.employer) {
    return {
      success: false,
      reason: `vehicle owner (${vehicle.owner}) doesn't match driver employer (${driver.employer})`,
    };
  }

  // Check vehicle is available
  if (vehicle.operator) {
    return {
      success: false,
      reason: `vehicle already has operator (${vehicle.operator})`,
    };
  }

  // All checks passed - update order
  const updatedOrder: Order = {
    ...order,
    status: 'assigned',
    seller: driver.employer, // Logistics company fulfilling the order
    assignedDriver: driver.id,
    assignedVehicle: vehicle.id,
    assignedAt: phase,
  };

  ActivityLog.info(
    phase,
    'delivery',
    `coordinator assigned delivery ${order.id} to ${driver.name} with vehicle ${vehicle.id}`,
    driver.id,
    driver.name
  );

  return {
    success: true,
    order: updatedOrder,
    agent: driver,
    vehicle,
  };
}

/**
 * Release all resources associated with a delivery
 * Clears: driver task, vehicle operator, vehicle cargo
 */
export function releaseDeliveryResources(
  agent: Agent,
  order: Order,
  vehicle: Vehicle | undefined,
  phase: number
): {
  agent: Agent;
  vehicle: Vehicle | undefined;
} {
  // Clear agent's active delivery state (if using new system)
  const updatedAgent: Agent = agent.deliveryShiftState?.activeDelivery
    ? {
        ...agent,
        deliveryShiftState: {
          ...agent.deliveryShiftState,
          activeDelivery: undefined,
        },
      }
    : agent;

  // Clear vehicle operator and cargo
  const updatedVehicle: Vehicle | undefined = vehicle
    ? {
        ...vehicle,
        operator: undefined,
        cargo: {},
      }
    : undefined;

  ActivityLog.info(
    phase,
    'delivery',
    `coordinator released resources for delivery ${order.id}`,
    agent.id,
    agent.name
  );

  return {
    agent: updatedAgent,
    vehicle: updatedVehicle,
  };
}

/**
 * Detect deliveries that are stuck (no progress in too many phases)
 * Returns list of stuck deliveries with details
 */
export function detectStuckDeliveries(
  agents: Agent[],
  orders: Order[],
  currentPhase: number,
  maxPhasesStuck: number = 20
): StuckDelivery[] {
  const stuck: StuckDelivery[] = [];

  // Check all active logistics orders
  const activeOrders = orders.filter(
    (o) =>
      o.orderType === 'logistics' &&
      (o.status === 'assigned' || o.status === 'in_transit')
  );

  for (const order of activeOrders) {
    if (!order.assignedDriver) continue;

    const driver = agents.find((a) => a.id === order.assignedDriver);
    if (!driver) continue;

    // Check if using new system (activeDelivery)
    if (driver.deliveryShiftState?.activeDelivery) {
      const activeDelivery = driver.deliveryShiftState.activeDelivery;

      // Check if orderId matches
      if (activeDelivery.orderId !== order.id) {
        stuck.push({
          orderId: order.id,
          agentId: driver.id,
          agentName: driver.name,
          reason: `driver working on different order (${activeDelivery.orderId})`,
          phasesStuck: currentPhase - (order.assignedAt ?? order.created),
        });
        continue;
      }

      // Check if action has exceeded expected duration
      const actionDuration = currentPhase - activeDelivery.actionStartPhase;
      const timeout = activeDelivery.expectedDuration + 10; // 10 phase grace period

      if (actionDuration > timeout) {
        stuck.push({
          orderId: order.id,
          agentId: driver.id,
          agentName: driver.name,
          reason: `action '${activeDelivery.action}' timeout (${actionDuration} > ${timeout} phases)`,
          phasesStuck: actionDuration,
        });
      }
    } else {
      // Using old system (task.params) - check overall timeout
      const assignedPhase = order.assignedAt ?? order.created;
      const phasesInProgress = currentPhase - assignedPhase;

      if (phasesInProgress > maxPhasesStuck) {
        stuck.push({
          orderId: order.id,
          agentId: driver.id,
          agentName: driver.name,
          reason: `timeout in status '${order.status}' (${phasesInProgress} > ${maxPhasesStuck} phases)`,
          phasesStuck: phasesInProgress,
        });
      }
    }
  }

  return stuck;
}

/**
 * Main cleanup function - run periodically (every 10 ticks)
 * Detects stuck deliveries, validates state, and fails orders that can't proceed
 */
export function tickCleanup(
  agents: Agent[],
  orders: Order[],
  vehicles: Vehicle[],
  locations: Location[],
  currentPhase: number,
  maxPhasesStuck: number = 20
): {
  orders: Order[];
  vehicles: Vehicle[];
  agents: Agent[];
} {
  let updatedOrders = [...orders];
  let updatedVehicles = [...vehicles];
  let updatedAgents = [...agents];

  // 1. Detect stuck deliveries
  const stuckDeliveries = detectStuckDeliveries(agents, orders, currentPhase, maxPhasesStuck);

  for (const stuck of stuckDeliveries) {
    ActivityLog.warning(
      currentPhase,
      'delivery',
      `coordinator detected stuck delivery: ${stuck.reason}`,
      stuck.agentId,
      stuck.agentName
    );

    // Fail the order (and parent goods order if exists)
    const order = updatedOrders.find((o) => o.id === stuck.orderId);
    if (order) {
      updatedOrders = failDeliveryWithParent(order, updatedOrders, stuck.reason, currentPhase);

      // Release resources
      const agent = updatedAgents.find((a) => a.id === stuck.agentId);
      const vehicle = updatedVehicles.find((v) => v.id === order.assignedVehicle);

      if (agent && vehicle) {
        const released = releaseDeliveryResources(agent, order, vehicle, currentPhase);

        // Update agent
        const agentIndex = updatedAgents.findIndex((a) => a.id === agent.id);
        if (agentIndex >= 0) {
          updatedAgents[agentIndex] = released.agent;
        }

        // Update vehicle
        if (released.vehicle) {
          const vehicleIndex = updatedVehicles.findIndex((v) => v.id === vehicle.id);
          if (vehicleIndex >= 0) {
            updatedVehicles[vehicleIndex] = released.vehicle;
          }
        }
      }
    }
  }

  // 2. Validate all active deliveries
  const activeOrders = updatedOrders.filter(
    (o) =>
      o.orderType === 'logistics' &&
      (o.status === 'assigned' || o.status === 'in_transit')
  );

  for (const order of activeOrders) {
    const validation = validateDeliveryState(order, updatedAgents, updatedVehicles, locations);

    if (!validation.valid) {
      ActivityLog.warning(
        currentPhase,
        'delivery',
        `coordinator validation failed: ${validation.reason}`,
        order.assignedDriver ?? 'system',
        'DeliveryCoordinator'
      );

      // Fail the order (and parent goods order if exists)
      updatedOrders = failDeliveryWithParent(
        order,
        updatedOrders,
        `validation failed: ${validation.reason}`,
        currentPhase
      );

      // Release resources if possible
      if (order.assignedDriver && order.assignedVehicle) {
        const agent = updatedAgents.find((a) => a.id === order.assignedDriver);
        const vehicle = updatedVehicles.find((v) => v.id === order.assignedVehicle);

        if (agent && vehicle) {
          const released = releaseDeliveryResources(agent, order, vehicle, currentPhase);

          const agentIndex = updatedAgents.findIndex((a) => a.id === agent.id);
          if (agentIndex >= 0) {
            updatedAgents[agentIndex] = released.agent;
          }

          if (released.vehicle) {
            const vehicleIndex = updatedVehicles.findIndex((v) => v.id === vehicle.id);
            if (vehicleIndex >= 0) {
              updatedVehicles[vehicleIndex] = released.vehicle;
            }
          }
        }
      }
    }
  }

  // 3. Release orphaned vehicles (operator dead or missing)
  for (const vehicle of updatedVehicles) {
    if (!vehicle.operator) continue;

    const operator = updatedAgents.find((a) => a.id === vehicle.operator);

    if (!operator || operator.status === 'dead') {
      ActivityLog.warning(
        currentPhase,
        'vehicle',
        `coordinator releasing orphaned vehicle ${vehicle.id} (operator ${vehicle.operator} ${!operator ? 'missing' : 'dead'})`,
        vehicle.operator,
        'DeliveryCoordinator'
      );

      const vehicleIndex = updatedVehicles.findIndex((v) => v.id === vehicle.id);
      if (vehicleIndex >= 0) {
        updatedVehicles[vehicleIndex] = {
          ...vehicle,
          operator: undefined,
          cargo: {},
        };
      }
    }
  }

  return {
    orders: updatedOrders,
    vehicles: updatedVehicles,
    agents: updatedAgents,
  };
}
