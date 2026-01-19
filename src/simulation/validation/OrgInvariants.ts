/**
 * Organization invariant checks
 * Validates org state consistency and business rules
 */

import type { SimulationState } from '../Simulation';
import type { InvariantViolation } from '../../types/InvariantViolation';

export function checkOrgInvariants(state: SimulationState): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const currentPhase = state.time.currentPhase;

  for (const org of state.organizations) {
    // Org must have valid leader
    const leader = state.agents.find((a) => a.id === org.leader);
    if (!leader) {
      violations.push({
        severity: 'error',
        category: 'org',
        message: `Org ${org.name} has non-existent leader ${org.leader}`,
        entityId: org.id,
        phase: currentPhase,
      });
    } else {
      // Leader should be employed by this org
      if (leader.employer !== org.id) {
        violations.push({
          severity: 'warning',
          category: 'org',
          message: `Org ${org.name} leader ${leader.name} is not employed by this org (employed by: ${leader.employer})`,
          entityId: org.id,
          phase: currentPhase,
        });
      }
    }

    // Org must have at least one location
    if (org.locations.length === 0) {
      violations.push({
        severity: 'warning',
        category: 'org',
        message: `Org ${org.name} has no locations (should dissolve?)`,
        entityId: org.id,
        phase: currentPhase,
      });
    }

    // All org locations must exist
    for (const locId of org.locations) {
      const location = state.locations.find((l) => l.id === locId);
      if (!location) {
        violations.push({
          severity: 'error',
          category: 'org',
          message: `Org ${org.name} references non-existent location ${locId}`,
          entityId: org.id,
          phase: currentPhase,
        });
      } else {
        // Location should be owned by this org
        if (location.owner !== org.id) {
          violations.push({
            severity: 'warning',
            category: 'org',
            message: `Org ${org.name} lists location ${location.name} but location owner is ${location.owner}`,
            entityId: org.id,
            phase: currentPhase,
          });
        }
      }
    }

    // Negative wallet check (info level - orgs can have debt)
    if (org.wallet.credits < 0) {
      violations.push({
        severity: 'info',
        category: 'economy',
        message: `Org ${org.name} has negative credits: ${org.wallet.credits} (grace period?)`,
        entityId: org.id,
        phase: currentPhase,
      });
    }

    // Weekly phase offset must be valid (0-55)
    if (org.weeklyPhaseOffset < 0 || org.weeklyPhaseOffset > 55) {
      violations.push({
        severity: 'error',
        category: 'org',
        message: `Org ${org.name} has invalid weeklyPhaseOffset: ${org.weeklyPhaseOffset} (must be 0-55)`,
        entityId: org.id,
        phase: currentPhase,
      });
    }
  }

  return violations;
}

export function checkEmploymentInvariants(state: SimulationState): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const currentPhase = state.time.currentPhase;

  // Build employment index from agents
  const employmentByOrg = new Map<string, string[]>();
  for (const agent of state.agents) {
    if (agent.status === 'employed' && agent.employer) {
      const employees = employmentByOrg.get(agent.employer) || [];
      employees.push(agent.id);
      employmentByOrg.set(agent.employer, employees);
    }
  }

  // Build employment index from locations
  const employmentByLocation = new Map<string, string[]>();
  for (const location of state.locations) {
    if (location.employees.length > 0) {
      employmentByLocation.set(location.id, location.employees);
    }
  }

  // Check each org's employee count
  for (const org of state.organizations) {
    const actualEmployees = employmentByOrg.get(org.id) || [];

    // Count total employees across all org locations
    let locationEmployees = 0;
    for (const locId of org.locations) {
      const locEmps = employmentByLocation.get(locId) || [];
      locationEmployees += locEmps.length;
    }

    // Agents claiming to work for this org should match location employee lists
    // EXCEPTION: Org leaders (business owners, property managers) may be employed
    // but not in any location's employees array if all locations have 0 employee slots
    const mismatch = actualEmployees.length !== locationEmployees;
    if (mismatch) {
      // Check if this is the leader-only exception
      const isLeaderOnlyException =
        actualEmployees.length === 1 &&
        locationEmployees === 0 &&
        actualEmployees[0] === org.leader;

      if (!isLeaderOnlyException) {
        violations.push({
          severity: 'warning',
          category: 'employment',
          message: `Org ${org.name} employment mismatch: ${actualEmployees.length} agents claim employment but locations list ${locationEmployees} employees`,
          entityId: org.id,
          phase: currentPhase,
        });
      }
    }
  }

  return violations;
}
