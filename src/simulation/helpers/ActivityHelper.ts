/**
 * ActivityHelper - Compute what an agent is currently doing
 * Derives activity from agent state, location context, and recent logs
 */

import type { Agent, Location } from '../../types';
import type { LogEntry } from '../ActivityLog';

/**
 * Activity types that agents can be doing
 */
export type AgentActivity =
  | 'traveling'
  | 'working'
  | 'eating'
  | 'resting'
  | 'shopping'
  | 'drinking'
  | 'idle'
  | 'seeking_job'
  | 'dead';

/**
 * Compute what an agent is currently doing based on their state and recent activity
 */
export function computeAgentActivity(
  agent: Agent,
  locations: Location[],
  recentLogs: LogEntry[]
): { activity: AgentActivity; detail: string } {
  // Dead agents
  if (agent.status === 'dead') {
    return { activity: 'dead', detail: 'Dead' };
  }

  // Traveling agents
  if (agent.travelingTo) {
    const dest = locations.find((l) => l.id === agent.travelingTo);
    const destName = dest?.name ?? 'unknown';
    const phases = agent.travelPhasesRemaining ?? 0;
    return {
      activity: 'traveling',
      detail: `→ ${destName} (${phases}p)`,
    };
  }

  // Check recent logs for current phase activity (most recent first)
  const currentPhaseLog = recentLogs[recentLogs.length - 1];
  if (currentPhaseLog) {
    const msg = currentPhaseLog.message.toLowerCase();
    const cat = currentPhaseLog.category;

    if (cat === 'hunger' && msg.includes('ate')) {
      return { activity: 'eating', detail: 'Eating' };
    }
    if (cat === 'fatigue' && msg.includes('rest')) {
      return { activity: 'resting', detail: 'Resting' };
    }
    if (cat === 'leisure' && msg.includes('drink')) {
      return { activity: 'drinking', detail: 'Having a drink' };
    }
    if (cat === 'commerce' && msg.includes('purchased')) {
      return { activity: 'shopping', detail: 'Shopping' };
    }
  }

  // At current location - determine activity from context
  const currentLoc = locations.find((l) => l.id === agent.currentLocation);

  if (currentLoc) {
    // Working at their workplace
    if (agent.employedAt && agent.currentLocation === agent.employedAt) {
      return { activity: 'working', detail: `Working at ${currentLoc.name}` };
    }

    // At a leisure location (pub)
    if (currentLoc.tags.includes('leisure')) {
      return { activity: 'drinking', detail: `At ${currentLoc.name}` };
    }

    // At a retail shop
    if (currentLoc.tags.includes('retail') && !currentLoc.tags.includes('leisure')) {
      return { activity: 'shopping', detail: `At ${currentLoc.name}` };
    }

    // At home or shelter
    if (currentLoc.tags.includes('residential') || currentLoc.tags.includes('shelter')) {
      return { activity: 'resting', detail: `At ${currentLoc.name}` };
    }

    // At public space
    if (currentLoc.tags.includes('public')) {
      return { activity: 'idle', detail: `At ${currentLoc.name}` };
    }

    // At some other location
    return { activity: 'idle', detail: `At ${currentLoc.name}` };
  }

  // Unemployed and not at any location
  if (agent.status === 'available') {
    return { activity: 'seeking_job', detail: 'Looking for work' };
  }

  // Fallback
  return { activity: 'idle', detail: 'Idle' };
}

/**
 * Get a short activity label for table display
 */
export function getActivityLabel(activity: AgentActivity): string {
  switch (activity) {
    case 'traveling':
      return 'Traveling';
    case 'working':
      return 'Working';
    case 'eating':
      return 'Eating';
    case 'resting':
      return 'Resting';
    case 'shopping':
      return 'Shopping';
    case 'drinking':
      return 'Drinking';
    case 'idle':
      return 'Idle';
    case 'seeking_job':
      return 'Job Seeking';
    case 'dead':
      return 'Dead';
    default:
      return 'Unknown';
  }
}
