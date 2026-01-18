/**
 * AgentStateHelpers - Centralized agent state management
 *
 * Provides atomic state transition functions to prevent inconsistent state.
 * All multi-field state changes should go through these helpers.
 */

import type { Agent, Location, Organization, TravelMethod, AgentTask, TaskPriority } from '../../types';

// ============================================
// Employment State Helpers
// ============================================

/**
 * Set agent employment state (atomic update of status, employer, employedAt, salary)
 * Call this when hiring an agent
 */
export function setEmployment(
  agent: Agent,
  locationId: string,
  orgId: string,
  salary: number
): Agent {
  return {
    ...agent,
    status: 'employed',
    employer: orgId,
    employedAt: locationId,
    salary,
  };
}

/**
 * Clear agent employment state (atomic update)
 * Call this when firing, quitting, or org dissolution
 */
export function clearEmployment(agent: Agent): Agent {
  return {
    ...agent,
    status: 'available',
    employer: undefined,
    employedAt: undefined,
    salary: 0,
  };
}

// ============================================
// Travel State Helpers
// ============================================

/**
 * Set agent travel state (atomic update of all 5 travel fields)
 * Call this when starting travel
 */
export function setTravel(
  agent: Agent,
  fromId: string,
  toId: string,
  method: TravelMethod,
  phases: number
): Agent {
  return {
    ...agent,
    currentLocation: undefined, // No longer at origin
    travelingFrom: fromId,
    travelingTo: toId,
    travelMethod: method,
    travelPhasesRemaining: phases,
  };
}

/**
 * Clear all travel state (atomic update)
 * Call this when travel is cancelled or invalidated (not on arrival - use setLocation)
 */
export function clearTravel(agent: Agent): Agent {
  return {
    ...agent,
    travelingFrom: undefined,
    travelingTo: undefined,
    travelMethod: undefined,
    travelPhasesRemaining: undefined,
  };
}

/**
 * Set agent's current location and clear travel state (arrival)
 * Call this when agent arrives at destination
 */
export function setLocation(agent: Agent, locationId: string): Agent {
  return {
    ...agent,
    currentLocation: locationId,
    travelingFrom: undefined,
    travelingTo: undefined,
    travelMethod: undefined,
    travelPhasesRemaining: undefined,
  };
}

/**
 * Clear agent's current location (but keep travel state if any)
 * Rarely needed - usually use setTravel or setLocation instead
 */
export function clearLocation(agent: Agent): Agent {
  return {
    ...agent,
    currentLocation: undefined,
  };
}

/**
 * Clear both location and travel state (agent is nowhere)
 * Use for death or other special cases
 */
export function clearAllLocationState(agent: Agent): Agent {
  return {
    ...agent,
    currentLocation: undefined,
    travelingFrom: undefined,
    travelingTo: undefined,
    travelMethod: undefined,
    travelPhasesRemaining: undefined,
  };
}

// ============================================
// Task State Helpers
// ============================================

/**
 * Set agent's current task
 */
export function setTask(agent: Agent, task: AgentTask): Agent {
  return { ...agent, currentTask: task };
}

/**
 * Clear agent's current task
 */
export function clearTask(agent: Agent): Agent {
  return { ...agent, currentTask: undefined };
}

/**
 * Check if agent has a current task
 */
export function hasTask(agent: Agent): boolean {
  return agent.currentTask !== undefined;
}

/**
 * Check if an incoming priority can interrupt current priority
 */
export function canInterrupt(incomingPriority: TaskPriority, currentPriority: TaskPriority): boolean {
  const priorityOrder: Record<TaskPriority, number> = {
    critical: 4,
    high: 3,
    normal: 2,
    idle: 1,
  };

  return priorityOrder[incomingPriority] > priorityOrder[currentPriority];
}

// ============================================
// Death Handler
// ============================================

/**
 * Handle agent death (clears all state)
 * Call this when agent dies from any cause
 */
export function setDead(agent: Agent, phase: number): Agent {
  return {
    ...agent,
    status: 'dead',
    destroyed: phase,
    // Clear employment
    employer: undefined,
    employedAt: undefined,
    salary: 0,
    // Clear location and travel
    currentLocation: undefined,
    travelingFrom: undefined,
    travelingTo: undefined,
    travelMethod: undefined,
    travelPhasesRemaining: undefined,
    // Clear vehicle occupancy
    inVehicle: undefined,
    // Clear residence
    residence: undefined,
  };
}

// ============================================
// Entity Deletion Handlers
// ============================================

/**
 * Handle location deletion - clears all agent references to that location
 * Call this when a location is about to be deleted
 */
export function onLocationDeleted(locationId: string, agents: Agent[]): Agent[] {
  return agents.map((agent) => {
    if (agent.status === 'dead') return agent;

    let updated = agent;
    let needsUpdate = false;

    // Clear currentLocation if at deleted location
    if (agent.currentLocation === locationId) {
      updated = clearLocation(updated);
      needsUpdate = true;
    }

    // Clear travel state if traveling to/from deleted location
    if (agent.travelingTo === locationId || agent.travelingFrom === locationId) {
      updated = clearTravel(updated);
      needsUpdate = true;
    }

    // Clear employment if employed at deleted location
    if (agent.employedAt === locationId) {
      updated = clearEmployment(updated);
      needsUpdate = true;
    }

    return needsUpdate ? updated : agent;
  });
}

/**
 * Handle organization dissolution - clears all agent references to that org
 * Call this when an org is about to be dissolved
 */
export function onOrgDissolved(orgId: string, agents: Agent[]): Agent[] {
  return agents.map((agent) => {
    if (agent.status === 'dead') return agent;

    // Clear employment if employed by dissolved org
    if (agent.employer === orgId) {
      return clearEmployment(agent);
    }

    return agent;
  });
}

/**
 * Combined handler for org dissolution that also handles location deletion
 * Call this when dissolving an org - handles both org and location cleanup
 */
export function onOrgDissolvedWithLocations(
  orgId: string,
  locationIds: string[],
  agents: Agent[]
): Agent[] {
  return agents.map((agent) => {
    if (agent.status === 'dead') return agent;

    let updated = agent;

    // Check if affected by any deleted location
    const atDeletedLocation = locationIds.includes(agent.currentLocation ?? '');
    const travelingToDeleted = locationIds.includes(agent.travelingTo ?? '');
    const travelingFromDeleted = locationIds.includes(agent.travelingFrom ?? '');
    const employedAtDeleted = locationIds.includes(agent.employedAt ?? '');
    const employedByOrg = agent.employer === orgId;
    const residenceDeleted = locationIds.includes(agent.residence ?? '');

    // Clear location if at deleted location
    if (atDeletedLocation) {
      updated = { ...updated, currentLocation: undefined };
    }

    // Clear travel if traveling to/from deleted location
    if (travelingToDeleted || travelingFromDeleted) {
      updated = clearTravel(updated);
    }

    // Clear employment if employed at deleted location OR by dissolved org
    if (employedAtDeleted || employedByOrg) {
      updated = clearEmployment(updated);
    }

    // Clear residence if lived at deleted location
    if (residenceDeleted) {
      updated = { ...updated, residence: undefined };
    }

    return updated;
  });
}

/**
 * Handle org dissolution by orphaning locations instead of deleting them
 * - Locations become ownerless and available for purchase
 * - Employees lose their jobs
 * - Residents stay (but stop paying rent since no owner)
 * Returns updated agents and locations
 */
export function onOrgDissolvedOrphanLocations(
  orgId: string,
  locations: Location[],
  agents: Agent[],
  phase: number
): { agents: Agent[]; locations: Location[] } {
  // Find all locations owned by this org
  const orgLocationIds = locations
    .filter((loc) => loc.owner === orgId)
    .map((loc) => loc.id);

  // Orphan the locations (set owner to undefined, mark for sale)
  const updatedLocations = locations.map((loc) => {
    if (loc.owner !== orgId) return loc;

    // Record previous ownership
    const previousOwners = [...(loc.previousOwners ?? [])];
    previousOwners.push({
      ownerId: orgId,
      from: loc.created,
      to: phase,
    });

    return {
      ...loc,
      owner: undefined,
      ownerType: 'none' as const,
      previousOwners,
      forSale: true,
      // Clear employees array since they no longer work here
      employees: [],
    };
  });

  // Update agents: clear employment but keep residents
  const updatedAgents = agents.map((agent) => {
    if (agent.status === 'dead') return agent;

    let updated = agent;

    // Clear employment if employed by dissolved org
    const employedByOrg = agent.employer === orgId;
    const employedAtOrgLocation = orgLocationIds.includes(agent.employedAt ?? '');

    if (employedByOrg || employedAtOrgLocation) {
      updated = clearEmployment(updated);
    }

    // NOTE: We intentionally do NOT clear residence
    // Tenants stay in orphaned apartments (they just stop paying rent)

    return updated;
  });

  return { agents: updatedAgents, locations: updatedLocations };
}

// ============================================
// State Validation (Debug Mode)
// ============================================

/**
 * Validate agent state invariants
 * Returns array of issues (empty = valid)
 */
export function validateAgentState(
  agent: Agent,
  locations: Location[],
  orgs: Organization[]
): string[] {
  const issues: string[] = [];

  // Skip validation for dead agents (they can have stale references)
  if (agent.status === 'dead') {
    return issues;
  }

  // Employment invariants
  if (agent.status === 'employed') {
    if (!agent.employer) {
      issues.push(`Agent ${agent.name} is employed but has no employer`);
    }
    if (!agent.employedAt) {
      issues.push(`Agent ${agent.name} is employed but has no employedAt`);
    }
  } else {
    if (agent.employer) {
      issues.push(`Agent ${agent.name} is not employed but has employer set`);
    }
    if (agent.employedAt) {
      issues.push(`Agent ${agent.name} is not employed but has employedAt set`);
    }
    if (agent.salary !== 0) {
      issues.push(`Agent ${agent.name} is not employed but has non-zero salary`);
    }
  }

  // Travel invariants
  const hasLocation = agent.currentLocation !== undefined;
  const isTraveling = agent.travelingTo !== undefined;

  if (hasLocation && isTraveling) {
    issues.push(`Agent ${agent.name} has both currentLocation and travelingTo set`);
  }

  if (isTraveling) {
    if (!agent.travelingFrom) {
      issues.push(`Agent ${agent.name} is traveling but has no travelingFrom`);
    }
    if (agent.travelPhasesRemaining === undefined) {
      issues.push(`Agent ${agent.name} is traveling but has no travelPhasesRemaining`);
    }
  }

  // Reference validity
  if (agent.currentLocation && !locations.find((l) => l.id === agent.currentLocation)) {
    issues.push(`Agent ${agent.name} at non-existent location ${agent.currentLocation}`);
  }

  if (agent.travelingTo && !locations.find((l) => l.id === agent.travelingTo)) {
    issues.push(`Agent ${agent.name} traveling to non-existent location ${agent.travelingTo}`);
  }

  if (agent.employedAt && !locations.find((l) => l.id === agent.employedAt)) {
    issues.push(`Agent ${agent.name} employed at non-existent location ${agent.employedAt}`);
  }

  if (agent.employer && !orgs.find((o) => o.id === agent.employer)) {
    issues.push(`Agent ${agent.name} employed by non-existent org ${agent.employer}`);
  }

  if (agent.residence && !locations.find((l) => l.id === agent.residence)) {
    issues.push(`Agent ${agent.name} has residence at non-existent location ${agent.residence}`);
  }

  return issues;
}

/**
 * Validate all agents and return combined issues
 */
export function validateAllAgents(
  agents: Agent[],
  locations: Location[],
  orgs: Organization[]
): string[] {
  return agents.flatMap((agent) => validateAgentState(agent, locations, orgs));
}

// ============================================
// Utility Predicates
// ============================================

/**
 * Check if agent is currently traveling
 */
export function isAgentTraveling(agent: Agent): boolean {
  return agent.travelingTo !== undefined;
}

/**
 * Check if agent is at a specific location
 */
export function isAgentAtLocation(agent: Agent, locationId: string): boolean {
  return agent.currentLocation === locationId;
}

/**
 * Check if agent is employed
 */
export function isAgentEmployed(agent: Agent): boolean {
  return agent.status === 'employed' && agent.employer !== undefined && agent.employedAt !== undefined;
}

/**
 * Check if agent is alive
 */
export function isAgentAlive(agent: Agent): boolean {
  return agent.status !== 'dead';
}
