/**
 * World Store - Zustand store for world state
 * Main state management for the simulation
 * Uses vanilla Zustand (no React dependency)
 */

import { createStore } from 'zustand/vanilla';
import type { WorldState } from '../simulation/World';
import { createEmptyWorld } from '../simulation/World';
import type { LoadedConfig } from '../config/ConfigLoader';

/**
 * World store state and actions
 */
export interface WorldStore {
  // State
  world: WorldState;
  config: LoadedConfig | null;
  isInitialized: boolean;
  isPaused: boolean;

  // Actions
  initialize: (config: LoadedConfig) => void;
  tick: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
}

/**
 * Create the world store (vanilla Zustand - no React)
 */
export const worldStore = createStore<WorldStore>((set, get) => ({
  // Initial state
  world: createEmptyWorld(),
  config: null,
  isInitialized: false,
  isPaused: true,

  // Initialize with loaded config
  initialize: (config: LoadedConfig) => {
    console.log('[WorldStore] Initializing with config...');
    set({
      config,
      isInitialized: true,
      world: createEmptyWorld(),
    });
  },

  // Process one simulation tick
  tick: () => {
    const { isInitialized, isPaused, world } = get();

    if (!isInitialized || isPaused) {
      return;
    }

    // Increment phase (actual tick logic will be in Phase 1)
    set({
      world: {
        ...world,
        currentPhase: world.currentPhase + 1,
      },
    });
  },

  // Pause simulation
  pause: () => set({ isPaused: true }),

  // Resume simulation
  resume: () => set({ isPaused: false }),

  // Reset to empty world
  reset: () =>
    set({
      world: createEmptyWorld(),
      isInitialized: false,
      isPaused: true,
    }),
}));
