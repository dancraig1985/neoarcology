/**
 * DeliverySystem - Manages delivery requests and logistics operations
 * PLAN-028: Replaces instant goods teleportation with realistic trucking
 */

import type { Order, DeliveryRequest, Agent, Vehicle, Location, Organization } from '../../types';
import type { SimulationContext } from '../../types/SimulationContext';
import { ActivityLog } from '../ActivityLog';

/**
 * Create a new delivery request (logistics order)
 */
export function createDeliveryRequest(
  from: Location,
  to: Location,
  goods: Record<string, number>,
  payment: number,
  urgency: 'low' | 'medium' | 'high',
  phase: number,
  context: SimulationContext
): DeliveryRequest {
  const id = context.idGen.nextDeliveryId();

  ActivityLog.info(
    phase,
    'delivery',
    `created delivery request: ${Object.entries(goods).map(([g, amt]) => `${amt} ${g}`).join(', ')} from ${from.name} to ${to.name} (payment: ${payment} credits)`,
    from.owner ?? 'system',
    from.name
  );

  // Create an Order with orderType='logistics'
  // buyer = requesting org, seller = logistics company (assigned later)
  return {
    id,
    orderType: 'logistics',
    created: phase,
    buyer: from.owner ?? 'system',
    seller: '', // Assigned when logistics company picks up the order
    status: 'pending',
    // Logistics-specific fields
    fromLocation: from.id,
    toLocation: to.id,
    cargo: goods,
    payment,
    urgency,
  };
}

/**
 * Assign a delivery request to a driver and vehicle
 */
export function assignDeliveryToDriver(
  request: DeliveryRequest,
  driver: Agent,
  vehicle: Vehicle,
  phase: number
): DeliveryRequest {
  ActivityLog.info(
    phase,
    'delivery',
    `assigned to ${driver.name} with ${vehicle.name}`,
    driver.id,
    driver.name
  );

  return {
    ...request,
    seller: driver.employer ?? '', // Logistics company fulfilling the order
    status: 'assigned',
    assignedDriver: driver.id,
    assignedVehicle: vehicle.id,
    assignedAt: phase,
  };
}

/**
 * Mark delivery as in transit (driver picked up goods and is traveling)
 */
export function startDelivery(
  request: DeliveryRequest,
  phase: number
): DeliveryRequest {
  return {
    ...request,
    status: 'in_transit',
  };
}

/**
 * Complete a delivery (goods delivered successfully)
 */
export function completeDelivery(
  request: DeliveryRequest,
  logisticsCompany: Organization,
  phase: number
): { request: DeliveryRequest; company: Organization } {
  if (!request.assignedDriver) {
    return { request, company: logisticsCompany };
  }

  ActivityLog.info(
    phase,
    'delivery',
    `completed delivery (earned ${request.payment ?? 0} credits)`,
    request.assignedDriver,
    'Driver'
  );

  // Pay logistics company
  const updatedCompany = {
    ...logisticsCompany,
    wallet: {
      ...logisticsCompany.wallet,
      credits: logisticsCompany.wallet.credits + (request.payment ?? 0),
    },
  };

  return {
    request: {
      ...request,
      status: 'delivered',
      fulfilled: phase,
    },
    company: updatedCompany,
  };
}

/**
 * Mark delivery as failed (driver couldn't complete it)
 * NOTE: This only fails the logistics order. Use failDeliveryWithParent() to also fail the parent goods order.
 */
export function failDelivery(
  request: DeliveryRequest,
  reason: string,
  phase: number
): DeliveryRequest {
  if (request.assignedDriver) {
    ActivityLog.warning(
      phase,
      'delivery',
      `failed: ${reason}`,
      request.assignedDriver,
      'Driver'
    );
  }

  return {
    ...request,
    status: 'failed',
    fulfilled: phase,
  };
}

/**
 * Fail a logistics order AND its parent goods order (if exists)
 * When a logistics delivery fails, the parent goods order should also fail
 * since the buyer paid but goods never arrived.
 */
export function failDeliveryWithParent(
  logisticsOrder: Order,
  allOrders: Order[],
  reason: string,
  phase: number
): Order[] {
  // Fail the logistics order
  const failedLogistics = failDelivery(logisticsOrder, reason, phase);

  // Update orders array with failed logistics order
  let updatedOrders = allOrders.map(o => o.id === logisticsOrder.id ? failedLogistics : o);

  // If this logistics order has a parent goods order, fail that too
  if (logisticsOrder.parentOrderId) {
    const parentOrder = updatedOrders.find(o => o.id === logisticsOrder.parentOrderId);
    if (parentOrder && parentOrder.orderType === 'goods' && parentOrder.status === 'ready') {
      ActivityLog.warning(
        phase,
        'order',
        `failing parent goods order ${parentOrder.id} due to logistics failure: ${reason}`,
        parentOrder.buyer,
        'SupplyChain'
      );

      updatedOrders = updatedOrders.map(o =>
        o.id === parentOrder.id
          ? { ...o, status: 'failed' as const, fulfilled: phase }
          : o
      );
    }
  }

  return updatedOrders;
}

/**
 * Find available logistics companies (have drivers and vehicles)
 */
export function getAvailableLogisticsCompanies(
  orgs: Organization[],
  agents: Agent[],
  vehicles: Vehicle[]
): Organization[] {
  return orgs.filter((org) => {
    // Must be a logistics company
    if (!org.tags.includes('logistics')) return false;

    // Must have at least one available driver
    const drivers = agents.filter(
      (a) => a.employer === org.id && a.status === 'employed' && !a.currentTask
    );
    if (drivers.length === 0) return false;

    // Must have at least one available vehicle
    const availableVehicles = vehicles.filter(
      (v) => v.owner === org.id && !v.operator
    );
    if (availableVehicles.length === 0) return false;

    return true;
  });
}

/**
 * Find an available driver from a logistics company
 */
export function findAvailableDriver(
  company: Organization,
  agents: Agent[]
): Agent | null {
  const drivers = agents.filter(
    (a) =>
      a.employer === company.id &&
      a.status === 'employed' &&
      !a.currentTask // Not currently doing anything
  );

  return drivers.length > 0 ? drivers[0]! : null;
}

/**
 * Find an available vehicle from a logistics company
 */
export function findAvailableVehicle(
  company: Organization,
  vehicles: Vehicle[]
): Vehicle | null {
  const availableVehicles = vehicles.filter(
    (v) => v.owner === company.id && !v.operator && v.currentBuilding // Must be parked at a building
  );

  return availableVehicles.length > 0 ? availableVehicles[0]! : null;
}

/**
 * Calculate delivery payment based on distance and goods quantity
 */
export function calculateDeliveryPayment(
  goods: Record<string, number>,
  distance: number
): number {
  const totalGoods = Object.values(goods).reduce((sum, amt) => sum + amt, 0);
  // Base rate: 1 credit per good + 0.5 credits per distance unit
  const payment = totalGoods * 1 + distance * 0.5;
  return Math.max(10, Math.floor(payment)); // Minimum 10 credits
}

/**
 * Remove old failed/cancelled orders, but keep successful deliveries for history
 */
export function cleanupOldDeliveries(
  requests: DeliveryRequest[],
  currentPhase: number,
  maxAge: number = 560 // Keep failed orders for ~10 weeks at 8 phases/day
): DeliveryRequest[] {
  return requests.filter((req) => {
    // Keep all active orders (including 'ready' for goods awaiting delivery)
    if (req.status === 'pending' || req.status === 'ready' || req.status === 'assigned' || req.status === 'in_transit') {
      return true;
    }

    // Keep all successful deliveries (for browsing history)
    if (req.status === 'delivered') {
      return true;
    }

    // Remove old failed/cancelled orders after maxAge
    if (req.status === 'failed' || req.status === 'cancelled') {
      const age = currentPhase - (req.fulfilled ?? req.created);
      return age < maxAge;
    }

    // Default: keep
    return true;
  });
}

/**
 * Fail logistics orders that have been stuck in_transit or assigned for too long
 * OR where the assigned driver/vehicle no longer exists
 */
export function cleanupOrphanedDeliveries(
  requests: Order[],
  agents: Agent[],
  vehicles: Vehicle[],
  currentPhase: number,
  maxPhasesInTransit: number = 560 // 10 weeks - way too long for any delivery
): Order[] {
  return requests.map((req) => {
    // Only check logistics orders that are in progress
    if (req.orderType !== 'logistics') {
      return req;
    }

    if (req.status !== 'in_transit' && req.status !== 'assigned') {
      return req;
    }

    // Check if driver still exists and is alive
    if (req.assignedDriver) {
      const driver = agents.find((a) => a.id === req.assignedDriver);
      if (!driver || driver.status === 'dead') {
        ActivityLog.warning(
          currentPhase,
          'delivery',
          `failing ${req.id} - assigned driver ${req.assignedDriver} no longer exists`,
          'system',
          'DeliveryCleanup'
        );
        return failDelivery(req, 'driver no longer exists', currentPhase);
      }
    }

    // Check if vehicle still exists
    if (req.assignedVehicle) {
      const vehicle = vehicles.find((v) => v.id === req.assignedVehicle);
      if (!vehicle) {
        ActivityLog.warning(
          currentPhase,
          'delivery',
          `failing ${req.id} - assigned vehicle ${req.assignedVehicle} no longer exists`,
          'system',
          'DeliveryCleanup'
        );
        return failDelivery(req, 'vehicle no longer exists', currentPhase);
      }
    }

    // Check if delivery has been in progress for too long
    const assignedPhase = req.assignedAt ?? req.created;
    const phasesInProgress = currentPhase - assignedPhase;

    if (phasesInProgress > maxPhasesInTransit) {
      ActivityLog.warning(
        currentPhase,
        'delivery',
        `failing ${req.id} - stuck in ${req.status} for ${phasesInProgress} phases`,
        req.assignedDriver ?? 'system',
        'DeliveryCleanup'
      );
      return failDelivery(req, `timeout after ${phasesInProgress} phases`, currentPhase);
    }

    return req;
  });
}

/**
 * Cancel goods orders that have been pending for too long
 * Seller likely can't fulfill (out of business, no production, etc.)
 */
export function cancelStaleGoodsOrders(
  orders: Order[],
  currentPhase: number,
  maxPendingPhases: number = 560, // 10 weeks for pending orders
  maxReadyPhases: number = 200 // ~3.5 weeks for ready orders (stuck in logistics)
): Order[] {
  return orders.map((order) => {
    // Only check goods orders
    if (order.orderType !== 'goods') {
      return order;
    }

    // Cancel pending orders stuck for too long (seller can't fulfill)
    if (order.status === 'pending') {
      const pendingDuration = currentPhase - order.created;

      if (pendingDuration > maxPendingPhases) {
        ActivityLog.warning(
          currentPhase,
          'order',
          `cancelling ${order.id} - pending for ${pendingDuration} phases (seller unable to fulfill)`,
          order.buyer,
          'OrderCleanup'
        );

        return {
          ...order,
          status: 'cancelled' as const,
          fulfilled: currentPhase,
        };
      }
    }

    // Fail ready orders stuck for too long (logistics failure)
    // Note: Buyer already paid, but goods never arrived
    if (order.status === 'ready') {
      const readyDuration = currentPhase - order.created;

      if (readyDuration > maxReadyPhases) {
        ActivityLog.warning(
          currentPhase,
          'order',
          `failing ${order.id} - ready for ${readyDuration} phases (logistics failure, goods paid but not delivered)`,
          order.buyer,
          'OrderCleanup'
        );

        return {
          ...order,
          status: 'failed' as const,
          fulfilled: currentPhase,
        };
      }
    }

    return order;
  });
}
