/**
 * TickEngine - Processes simulation phases
 * Handles time progression and phase-based updates
 */

import type { SimulationConfig } from '../config/ConfigLoader';

export type PhaseOfDay = 'dawn' | 'morning' | 'midday' | 'afternoon' | 'dusk' | 'evening' | 'night' | 'midnight';

export interface TimeState {
  currentPhase: number; // Total phases elapsed
  phaseOfDay: PhaseOfDay; // dawn, morning, midday, afternoon, dusk, evening, night, midnight
  day: number; // Current day (1-based)
  week: number; // Current week (1-based)
}

const PHASE_NAMES: PhaseOfDay[] = ['dawn', 'morning', 'midday', 'afternoon', 'dusk', 'evening', 'night', 'midnight'];

/**
 * Create initial time state
 */
export function createTimeState(): TimeState {
  return {
    currentPhase: 0,
    phaseOfDay: 'dawn',
    day: 1,
    week: 1,
  };
}

/**
 * Advance time by one phase
 * Returns the new time state and whether day/week rolled over
 */
export function advancePhase(
  time: TimeState,
  simulation: SimulationConfig
): {
  time: TimeState;
  dayRollover: boolean;
  weekRollover: boolean;
} {
  const newPhase = time.currentPhase + 1;
  const phaseInDay = newPhase % simulation.time.phasesPerDay;
  const phaseInWeek = newPhase % simulation.time.phasesPerWeek;

  const dayRollover = phaseInDay === 0;
  const weekRollover = phaseInWeek === 0;

  const newDay = dayRollover ? time.day + 1 : time.day;
  const newWeek = weekRollover ? time.week + 1 : time.week;

  return {
    time: {
      currentPhase: newPhase,
      phaseOfDay: PHASE_NAMES[phaseInDay] ?? 'dawn',
      day: newDay,
      week: newWeek,
    },
    dayRollover,
    weekRollover,
  };
}

/**
 * Format time for display
 */
export function formatTime(time: TimeState): string {
  return `Week ${time.week}, Day ${((time.day - 1) % 7) + 1}, ${time.phaseOfDay} (phase ${time.currentPhase})`;
}
