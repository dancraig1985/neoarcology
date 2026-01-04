/**
 * TravelSystem - Distance and travel time calculations
 *
 * Travel is mostly free (0 phases) for short trips.
 * Maximum 2 phases to cross the entire city.
 *
 * Transport modes are data-driven via data/config/transport.json
 */

import { Agent, Location, TravelMethod } from '../../types';
import { TransportConfig, TransportModeConfig } from '../../config/ConfigLoader';
import { setTravel, setLocation } from './AgentStateHelpers';

/**
 * Calculate effective distance between two locations
 * Takes building relationships into account:
 * - Same building: very fast (floor difference only, scaled small)
 * - Same grid cell (different buildings): minimal horizontal distance
 * - Different grid cells: full Euclidean distance
 */
export function getDistance(from: Location, to: Location): number {
  // Same building = very fast travel (elevator/stairs only)
  if (from.building && to.building && from.building === to.building) {
    // Only floor difference matters, scaled to be very small
    const floorDiff = Math.abs(from.floor - to.floor);
    return floorDiff * 0.1; // Max ~10 floors = 1.0 "distance"
  }

  // Different buildings but same grid cell = minimal horizontal distance
  const dx = from.x - to.x;
  const dy = from.y - to.y;

  // Same grid cell (adjacent buildings)
  if (dx === 0 && dy === 0) {
    // Small fixed distance for moving between buildings on same block
    const floorDiff = Math.abs(from.floor - to.floor);
    return 0.5 + floorDiff * 0.1;
  }

  // Different grid cells = full distance
  const horizontal = Math.sqrt(dx * dx + dy * dy);

  // Floor differences add minor travel time (elevators, stairs)
  const floorDiff = Math.abs(from.floor - to.floor);
  const vertical = floorDiff * 0.1;

  return horizontal + vertical;
}

/**
 * Calculate distance between two grid coordinates
 */
export function getGridDistance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate how many phases a trip takes using config-driven transport mode
 *
 * @param distance - The distance to travel
 * @param config - Transport configuration
 * @param modeId - Transport mode ID (defaults to config.defaultMode)
 */
export function getTravelPhases(
  distance: number,
  config: TransportConfig,
  modeId?: string
): number {
  const mode = config.transportModes[modeId ?? config.defaultMode];
  if (!mode) {
    // Fallback: worst case (walking)
    const walk = config.transportModes['walk'];
    if (walk) {
      return getTravelPhasesForMode(distance, walk);
    }
    // Absolute fallback
    return Math.ceil(distance / 10);
  }

  return getTravelPhasesForMode(distance, mode);
}

/**
 * Get travel phases for a specific transport mode config
 */
function getTravelPhasesForMode(distance: number, mode: TransportModeConfig): number {
  // Find the first threshold that covers this distance
  for (const threshold of mode.distanceThresholds) {
    if (distance <= threshold.maxDistance) {
      return threshold.phases;
    }
  }

  // If no threshold matches, use the last threshold's phases
  const lastThreshold = mode.distanceThresholds[mode.distanceThresholds.length - 1];
  return lastThreshold?.phases ?? 3;
}

/**
 * Calculate travel time between two locations
 */
export function getTravelTime(
  from: Location,
  to: Location,
  config: TransportConfig,
  modeId?: string
): number {
  const distance = getDistance(from, to);
  return getTravelPhases(distance, config, modeId);
}

/**
 * Get available transport modes for an agent
 * (For now, only 'walk' and 'transit' are available)
 */
export function getAvailableModes(config: TransportConfig): string[] {
  return Object.entries(config.transportModes)
    .filter(([, mode]) => mode.available)
    .map(([id]) => id);
}

/**
 * Check if two locations are adjacent (within 1 grid cell)
 */
export function isAdjacent(a: Location, b: Location): boolean {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return dx <= 1 && dy <= 1;
}

/**
 * Check if a location is within range of another
 */
export function isWithinRange(from: Location, to: Location, maxDistance: number): boolean {
  return getDistance(from, to) <= maxDistance;
}

/**
 * Start travel to a destination.
 * If travel would take 0 phases, agent arrives instantly.
 * Uses centralized helpers for atomic state updates.
 */
export function startTravel(
  agent: Agent,
  destination: Location,
  locations: Location[],
  config: TransportConfig,
  method: TravelMethod = 'walk'
): Agent {
  const from = locations.find((l) => l.id === agent.currentLocation);

  if (!from) {
    // Agent has no current location - can't travel (maybe already in transit?)
    return agent;
  }

  // Already at destination
  if (from.id === destination.id) {
    return agent;
  }

  const distance = getDistance(from, destination);
  const phases = getTravelPhases(distance, config, method);

  if (phases === 0) {
    // Instant travel - use setLocation for atomic update
    return setLocation(agent, destination.id);
  }

  // Start travel - use setTravel for atomic update
  return setTravel(agent, from.id, destination.id, method, phases);
}

/**
 * Redirect an agent to a new destination while traveling.
 * Travel time is recalculated from the original departure point.
 */
export function redirectTravel(
  agent: Agent,
  newDestination: Location,
  locations: Location[],
  config: TransportConfig
): Agent {
  if (!agent.travelingTo) return agent; // Not traveling

  // Already going there
  if (agent.travelingTo === newDestination.id) return agent;

  // Calculate from origin location (simplification - in reality would be current position)
  const fromLoc = locations.find((l) => l.id === agent.travelingFrom);
  if (!fromLoc) return agent;

  const distance = getDistance(fromLoc, newDestination);
  const phases = getTravelPhases(distance, config, agent.travelMethod ?? 'walk');

  return {
    ...agent,
    travelingTo: newDestination.id,
    travelPhasesRemaining: phases, // Reset travel time to new destination
  };
}

/**
 * Process one phase of travel for an agent.
 * Returns the agent with decremented phases, or arrived at destination.
 * Uses centralized setLocation helper for atomic arrival state.
 */
export function processTravel(agent: Agent): Agent {
  if (!agent.travelingTo || agent.travelPhasesRemaining === undefined) {
    return agent; // Not traveling
  }

  const remaining = agent.travelPhasesRemaining - 1;

  if (remaining <= 0) {
    // Arrived at destination - use setLocation for atomic update
    return setLocation(agent, agent.travelingTo);
  }

  // Still traveling
  return {
    ...agent,
    travelPhasesRemaining: remaining,
  };
}

/**
 * Check if an agent is currently traveling
 */
export function isTraveling(agent: Agent): boolean {
  return agent.travelingTo !== undefined;
}

/**
 * Check if an agent is at a specific location
 */
export function isAtLocation(agent: Agent, locationId: string): boolean {
  return agent.currentLocation === locationId;
}

/**
 * Find the nearest location matching a predicate
 */
export function findNearestLocation(
  agent: Agent,
  locations: Location[],
  predicate: (loc: Location) => boolean
): Location | null {
  const agentLoc = locations.find((l) => l.id === agent.currentLocation);

  // Filter matching locations
  const matching = locations.filter(predicate);
  if (matching.length === 0) return null;

  // If agent has no current location (in transit), just return first match
  if (!agentLoc) return matching[0] ?? null;

  // Sort by distance and return closest
  return (
    matching.sort((a, b) => getDistance(agentLoc, a) - getDistance(agentLoc, b))[0] ?? null
  );
}
