/**
 * SimulationContext - Dependency injection container
 *
 * Replaces global singletons with explicit context object passed through systems.
 * Enables unit testing, concurrent simulations, and reproducible runs.
 */

import type { SimulationMetrics } from '../simulation/Metrics';
import type { LoadedConfig } from '../config/ConfigLoader';
import type { IdGenerator } from '../simulation/IdGenerator';
import type { TransactionHistory } from './Transaction';

/**
 * Seeded random number generator function
 * Returns values in [0, 1) range, just like Math.random()
 */
export type SeededRNG = () => number;

/**
 * Context object passed to all simulation systems
 * Contains dependencies that were previously global singletons
 */
export interface SimulationContext {
  /** Metrics instance for tracking simulation events */
  metrics: SimulationMetrics;

  /** Seeded random number generator for reproducible simulations */
  rng: SeededRNG;

  /** Loaded configuration (simulation, economy, templates, etc.) */
  config: LoadedConfig;

  /** Current simulation phase (for convenience, also available in TimeState) */
  phase: number;

  /** ID generator for deterministic ID creation */
  idGen: IdGenerator;

  /** Transaction history for event-sourced metrics (PLAN-035) */
  transactionHistory: TransactionHistory;
}
