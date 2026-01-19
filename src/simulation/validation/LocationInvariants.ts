/**
 * Location invariant checks
 * Validates location state consistency and business rules
 */

import type { SimulationState } from '../Simulation';
import type { InvariantViolation } from '../../types/InvariantViolation';

export function checkLocationInvariants(state: SimulationState): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const currentPhase = state.time.currentPhase;

  for (const location of state.locations) {
    // Inventory can't exceed capacity
    const totalGoods = Object.values(location.inventory).reduce((sum, qty) => sum + qty, 0);
    if (totalGoods > location.inventoryCapacity) {
      violations.push({
        severity: 'warning',
        category: 'inventory',
        message: `Location ${location.name} exceeds capacity: ${totalGoods}/${location.inventoryCapacity}`,
        entityId: location.id,
        phase: currentPhase,
      });
    }

    // Inventory can't be negative
    for (const [good, qty] of Object.entries(location.inventory)) {
      if (qty < 0) {
        violations.push({
          severity: 'error',
          category: 'inventory',
          message: `Location ${location.name} has negative ${good}: ${qty}`,
          entityId: location.id,
          phase: currentPhase,
        });
      }
    }

    // If owner is set, must be valid entity
    if (location.owner && location.ownerType !== 'none') {
      if (location.ownerType === 'org') {
        const org = state.organizations.find((o) => o.id === location.owner);
        if (!org) {
          violations.push({
            severity: 'error',
            category: 'location',
            message: `Location ${location.name} owned by non-existent org ${location.owner}`,
            entityId: location.id,
            phase: currentPhase,
          });
        }
      } else if (location.ownerType === 'agent') {
        const agent = state.agents.find((a) => a.id === location.owner);
        if (!agent) {
          violations.push({
            severity: 'error',
            category: 'location',
            message: `Location ${location.name} owned by non-existent agent ${location.owner}`,
            entityId: location.id,
            phase: currentPhase,
          });
        }
      }
    }

    // Employees must exist
    for (const employeeId of location.employees) {
      const employee = state.agents.find((a) => a.id === employeeId);
      if (!employee) {
        violations.push({
          severity: 'error',
          category: 'employment',
          message: `Location ${location.name} has non-existent employee ${employeeId}`,
          entityId: location.id,
          phase: currentPhase,
        });
      } else {
        // Employee's employedAt should match this location
        if (employee.employedAt !== location.id) {
          violations.push({
            severity: 'warning',
            category: 'employment',
            message: `Location ${location.name} lists ${employee.name} as employee but agent's employedAt is ${employee.employedAt}`,
            entityId: location.id,
            phase: currentPhase,
          });
        }
      }
    }

    // Can't have more employees than slots
    if (location.employees.length > location.employeeSlots) {
      violations.push({
        severity: 'error',
        category: 'employment',
        message: `Location ${location.name} has ${location.employees.length} employees but only ${location.employeeSlots} slots`,
        entityId: location.id,
        phase: currentPhase,
      });
    }

    // Residents must exist (for residential locations)
    if (location.residents) {
      for (const residentId of location.residents) {
        const resident = state.agents.find((a) => a.id === residentId);
        if (!resident) {
          violations.push({
            severity: 'error',
            category: 'housing',
            message: `Location ${location.name} has non-existent resident ${residentId}`,
            entityId: location.id,
            phase: currentPhase,
          });
        } else {
          // Resident's residence should match this location
          if (resident.residence !== location.id) {
            violations.push({
              severity: 'warning',
              category: 'housing',
              message: `Location ${location.name} lists ${resident.name} as resident but agent's residence is ${resident.residence}`,
              entityId: location.id,
              phase: currentPhase,
            });
          }
        }
      }

      // Can't have more residents than max
      if (location.maxResidents && location.residents.length > location.maxResidents) {
        violations.push({
          severity: 'error',
          category: 'housing',
          message: `Location ${location.name} has ${location.residents.length} residents but only ${location.maxResidents} capacity`,
          entityId: location.id,
          phase: currentPhase,
        });
      }
    }

    // Vehicles must exist
    for (const vehicleId of location.vehicles) {
      const vehicle = state.vehicles.find((v) => v.id === vehicleId);
      if (!vehicle) {
        violations.push({
          severity: 'error',
          category: 'location',
          message: `Location ${location.name} has non-existent vehicle ${vehicleId}`,
          entityId: location.id,
          phase: currentPhase,
        });
      }
    }

    // Can't exceed vehicle capacity
    if (location.vehicles.length > location.vehicleCapacity) {
      violations.push({
        severity: 'warning',
        category: 'location',
        message: `Location ${location.name} has ${location.vehicles.length} vehicles but only ${location.vehicleCapacity} capacity`,
        entityId: location.id,
        phase: currentPhase,
      });
    }

    // Operating cost can't be negative
    if (location.operatingCost < 0) {
      violations.push({
        severity: 'error',
        category: 'economy',
        message: `Location ${location.name} has negative operating cost: ${location.operatingCost}`,
        entityId: location.id,
        phase: currentPhase,
      });
    }
  }

  return violations;
}
