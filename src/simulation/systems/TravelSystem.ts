/**
 * TravelSystem - Distance and travel time calculations
 *
 * Travel is mostly free (0 phases) for short trips.
 * Maximum 2 phases to cross the entire city.
 *
 * Transport modes are data-driven via data/config/transport.json
 */

import { Location } from '../../types';
import { TransportConfig, TransportModeConfig } from '../../config/ConfigLoader';

/**
 * Calculate Euclidean distance between two locations on the grid
 * Includes minor penalty for floor differences
 */
export function getDistance(from: Location, to: Location): number {
  const dx = from.x - to.x;
  const dy = from.y - to.y;
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
