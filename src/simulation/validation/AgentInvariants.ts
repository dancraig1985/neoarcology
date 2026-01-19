/**
 * Agent invariant checks
 * Validates agent state consistency and business rules
 */

import type { SimulationState } from '../Simulation';
import type { InvariantViolation } from '../../types/InvariantViolation';

export function checkAgentInvariants(state: SimulationState): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const currentPhase = state.time.currentPhase;

  for (const agent of state.agents) {
    // Employed agents must have valid employer
    if (agent.status === 'employed' && agent.employer) {
      const org = state.organizations.find((o) => o.id === agent.employer);
      if (!org) {
        violations.push({
          severity: 'error',
          category: 'employment',
          message: `Agent ${agent.name} employed by non-existent org ${agent.employer}`,
          entityId: agent.id,
          phase: currentPhase,
        });
      }
    }

    // Agents can't have negative needs
    if (agent.needs.hunger < 0 || agent.needs.fatigue < 0 || agent.needs.leisure < 0) {
      violations.push({
        severity: 'error',
        category: 'agent_state',
        message: `Agent ${agent.name} has negative need (hunger:${agent.needs.hunger}, fatigue:${agent.needs.fatigue}, leisure:${agent.needs.leisure})`,
        entityId: agent.id,
        phase: currentPhase,
      });
    }

    // Needs can't exceed 100
    if (agent.needs.hunger > 100 || agent.needs.fatigue > 100 || agent.needs.leisure > 100) {
      violations.push({
        severity: 'warning',
        category: 'agent_state',
        message: `Agent ${agent.name} has need > 100 (hunger:${agent.needs.hunger}, fatigue:${agent.needs.fatigue}, leisure:${agent.needs.leisure})`,
        entityId: agent.id,
        phase: currentPhase,
      });
    }

    // Living agents must be somewhere (either at location or in transit or in vehicle)
    if (agent.status !== 'dead') {
      const hasLocation = agent.currentLocation || agent.travelingTo || agent.inVehicle;
      if (!hasLocation) {
        violations.push({
          severity: 'error',
          category: 'location',
          message: `Living agent ${agent.name} has no location (not at location, not traveling, not in vehicle)`,
          entityId: agent.id,
          phase: currentPhase,
        });
      }
    }

    // Wallet can't be negative
    if (agent.wallet.credits < 0) {
      violations.push({
        severity: 'warning',
        category: 'economy',
        message: `Agent ${agent.name} has negative credits: ${agent.wallet.credits}`,
        entityId: agent.id,
        phase: currentPhase,
      });
    }

    // Employed agents should have employedAt location
    if (agent.status === 'employed' && !agent.employedAt) {
      violations.push({
        severity: 'warning',
        category: 'employment',
        message: `Agent ${agent.name} is employed but has no employedAt location`,
        entityId: agent.id,
        phase: currentPhase,
      });
    }

    // employedAt must be a valid location
    if (agent.employedAt) {
      const workplace = state.locations.find((l) => l.id === agent.employedAt);
      if (!workplace) {
        violations.push({
          severity: 'error',
          category: 'employment',
          message: `Agent ${agent.name} employedAt non-existent location ${agent.employedAt}`,
          entityId: agent.id,
          phase: currentPhase,
        });
      }
    }

    // Residence must be valid location if set
    if (agent.residence) {
      const home = state.locations.find((l) => l.id === agent.residence);
      if (!home) {
        violations.push({
          severity: 'error',
          category: 'housing',
          message: `Agent ${agent.name} residence is non-existent location ${agent.residence}`,
          entityId: agent.id,
          phase: currentPhase,
        });
      }
    }

    // Travel state consistency
    if (agent.travelingTo) {
      // Must have travelingFrom
      if (!agent.travelingFrom) {
        violations.push({
          severity: 'warning',
          category: 'travel',
          message: `Agent ${agent.name} travelingTo ${agent.travelingTo} but no travelingFrom`,
          entityId: agent.id,
          phase: currentPhase,
        });
      }

      // Must have travel method
      if (!agent.travelMethod) {
        violations.push({
          severity: 'warning',
          category: 'travel',
          message: `Agent ${agent.name} traveling but no travelMethod`,
          entityId: agent.id,
          phase: currentPhase,
        });
      }

      // Must have phases remaining
      if (agent.travelPhasesRemaining === undefined || agent.travelPhasesRemaining < 0) {
        violations.push({
          severity: 'error',
          category: 'travel',
          message: `Agent ${agent.name} traveling but invalid travelPhasesRemaining: ${agent.travelPhasesRemaining}`,
          entityId: agent.id,
          phase: currentPhase,
        });
      }
    }

    // Inventory capacity check
    const totalInventory = Object.values(agent.inventory).reduce((sum, qty) => sum + qty, 0);
    if (totalInventory > agent.inventoryCapacity) {
      violations.push({
        severity: 'warning',
        category: 'inventory',
        message: `Agent ${agent.name} exceeds inventory capacity: ${totalInventory}/${agent.inventoryCapacity}`,
        entityId: agent.id,
        phase: currentPhase,
      });
    }

    // Negative inventory check
    for (const [good, qty] of Object.entries(agent.inventory)) {
      if (qty < 0) {
        violations.push({
          severity: 'error',
          category: 'inventory',
          message: `Agent ${agent.name} has negative ${good}: ${qty}`,
          entityId: agent.id,
          phase: currentPhase,
        });
      }
    }
  }

  return violations;
}
