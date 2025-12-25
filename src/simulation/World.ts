/**
 * World - Empty world container stub
 * Will contain the simulation state and tick processing in Phase 1
 */

import type { Agent, Location, Mission, Organization, Vehicle } from '../types';

/**
 * World state container
 * The simulation operates on this state each tick
 */
export interface WorldState {
  // Current simulation time
  currentPhase: number;

  // Entity collections
  agents: Map<string, Agent>;
  organizations: Map<string, Organization>;
  locations: Map<string, Location>;
  missions: Map<string, Mission>;
  vehicles: Map<string, Vehicle>;

  // Statistics
  stats: WorldStats;
}

export interface WorldStats {
  totalAgents: number;
  totalOrgs: number;
  totalLocations: number;
  activeMissions: number;
  totalCreditsInCirculation: number;
}

/**
 * Create an empty world state
 */
export function createEmptyWorld(): WorldState {
  return {
    currentPhase: 0,
    agents: new Map(),
    organizations: new Map(),
    locations: new Map(),
    missions: new Map(),
    vehicles: new Map(),
    stats: {
      totalAgents: 0,
      totalOrgs: 0,
      totalLocations: 0,
      activeMissions: 0,
      totalCreditsInCirculation: 0,
    },
  };
}
