/**
 * Order invariant checks
 * Validates order state consistency and business rules
 */

import type { SimulationState } from '../Simulation';
import type { InvariantViolation } from '../../types/InvariantViolation';

export function checkOrderInvariants(state: SimulationState): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const currentPhase = state.time.currentPhase;

  for (const order of state.deliveryRequests) {
    // Buyer must exist
    const buyer = state.organizations.find((o) => o.id === order.buyer);
    if (!buyer) {
      violations.push({
        severity: 'error',
        category: 'orders',
        message: `Order ${order.id} references non-existent buyer org ${order.buyer}`,
        phase: currentPhase,
      });
    }

    // Seller must exist (if set)
    if (order.seller) {
      const seller = state.organizations.find((o) => o.id === order.seller);
      if (!seller) {
        violations.push({
          severity: 'error',
          category: 'orders',
          message: `Order ${order.id} references non-existent seller org ${order.seller}`,
          phase: currentPhase,
        });
      }
    }

    // Goods orders checks
    if (order.orderType === 'goods') {
      // Must have good and quantity
      if (!order.good || !order.quantity) {
        violations.push({
          severity: 'error',
          category: 'orders',
          message: `Goods order ${order.id} missing good or quantity`,
          phase: currentPhase,
        });
      }

      // Pickup location must exist if set
      if (order.pickupLocation) {
        const pickup = state.locations.find((l) => l.id === order.pickupLocation);
        if (!pickup) {
          violations.push({
            severity: 'error',
            category: 'orders',
            message: `Goods order ${order.id} has non-existent pickupLocation ${order.pickupLocation}`,
            phase: currentPhase,
          });
        }
      }

      // Delivery location must exist
      if (order.deliveryLocation) {
        const delivery = state.locations.find((l) => l.id === order.deliveryLocation);
        if (!delivery) {
          violations.push({
            severity: 'error',
            category: 'orders',
            message: `Goods order ${order.id} has non-existent deliveryLocation ${order.deliveryLocation}`,
            phase: currentPhase,
          });
        }
      }

      // In transit orders must have pickup location
      if (order.status === 'in_transit' && !order.pickupLocation) {
        violations.push({
          severity: 'error',
          category: 'orders',
          message: `Goods order ${order.id} in transit but no pickupLocation`,
          phase: currentPhase,
        });
      }
    }

    // Logistics orders checks
    if (order.orderType === 'logistics') {
      // Must have from/to locations
      if (!order.fromLocation || !order.toLocation) {
        violations.push({
          severity: 'error',
          category: 'orders',
          message: `Logistics order ${order.id} missing fromLocation or toLocation`,
          phase: currentPhase,
        });
      }

      // Locations must exist
      if (order.fromLocation) {
        const from = state.locations.find((l) => l.id === order.fromLocation);
        if (!from) {
          violations.push({
            severity: 'error',
            category: 'orders',
            message: `Logistics order ${order.id} has non-existent fromLocation ${order.fromLocation}`,
            phase: currentPhase,
          });
        }
      }

      if (order.toLocation) {
        const to = state.locations.find((l) => l.id === order.toLocation);
        if (!to) {
          violations.push({
            severity: 'error',
            category: 'orders',
            message: `Logistics order ${order.id} has non-existent toLocation ${order.toLocation}`,
            phase: currentPhase,
          });
        }
      }

      // Must have cargo
      if (!order.cargo || Object.keys(order.cargo).length === 0) {
        violations.push({
          severity: 'warning',
          category: 'orders',
          message: `Logistics order ${order.id} has no cargo`,
          phase: currentPhase,
        });
      }

      // Assigned driver must exist
      if (order.assignedDriver) {
        const driver = state.agents.find((a) => a.id === order.assignedDriver);
        if (!driver) {
          violations.push({
            severity: 'error',
            category: 'orders',
            message: `Logistics order ${order.id} has non-existent assignedDriver ${order.assignedDriver}`,
            phase: currentPhase,
          });
        }
      }

      // Assigned vehicle must exist
      if (order.assignedVehicle) {
        const vehicle = state.vehicles.find((v) => v.id === order.assignedVehicle);
        if (!vehicle) {
          violations.push({
            severity: 'error',
            category: 'orders',
            message: `Logistics order ${order.id} has non-existent assignedVehicle ${order.assignedVehicle}`,
            phase: currentPhase,
          });
        }
      }

      // If in_transit, must have assigned driver and vehicle
      if (order.status === 'in_transit') {
        if (!order.assignedDriver) {
          violations.push({
            severity: 'error',
            category: 'orders',
            message: `Logistics order ${order.id} in transit but has no assignedDriver`,
            phase: currentPhase,
          });
        }

        if (!order.assignedVehicle) {
          violations.push({
            severity: 'error',
            category: 'orders',
            message: `Logistics order ${order.id} in transit but has no assignedVehicle`,
            phase: currentPhase,
          });
        }
      }
    }

    // Delivered orders must have fulfilled timestamp
    if (order.status === 'delivered' && !order.fulfilled) {
      violations.push({
        severity: 'warning',
        category: 'orders',
        message: `Order ${order.id} marked delivered but no fulfilled timestamp`,
        phase: currentPhase,
      });
    }

    // Negative price/payment checks
    if (order.totalPrice !== undefined && order.totalPrice < 0) {
      violations.push({
        severity: 'error',
        category: 'economy',
        message: `Order ${order.id} has negative totalPrice: ${order.totalPrice}`,
        phase: currentPhase,
      });
    }

    if (order.payment !== undefined && order.payment < 0) {
      violations.push({
        severity: 'error',
        category: 'economy',
        message: `Order ${order.id} has negative payment: ${order.payment}`,
        phase: currentPhase,
      });
    }
  }

  return violations;
}
