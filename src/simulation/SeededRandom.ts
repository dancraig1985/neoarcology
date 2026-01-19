/**
 * SeededRandom - Deterministic random number generation
 *
 * Uses Linear Congruential Generator (LCG) algorithm for reproducible randomness.
 * Same algorithm used in city generation (src/generation/noise.ts).
 *
 * This enables:
 * - Reproducible simulation runs with same seed
 * - Unit testing with deterministic random values
 * - Concurrent simulations without RNG interference
 */

import type { SeededRNG } from '../types/SimulationContext';

/**
 * Create a seeded random number generator
 *
 * Uses LCG algorithm with parameters from glibc:
 * - Multiplier: 1103515245
 * - Increment: 12345
 * - Modulus: 2^31 - 1
 *
 * @param seed - Initial seed value (use Date.now() for non-reproducible runs)
 * @returns Function that generates random numbers in [0, 1) range
 *
 * @example
 * const rng = createSeededRNG(42);
 * console.log(rng()); // 0.00002770498395...
 * console.log(rng()); // 0.96429824829...
 */
export function createSeededRNG(seed: number): SeededRNG {
  let state = seed;

  return (): number => {
    // LCG algorithm: state = (a * state + c) mod m
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

/**
 * Choose a random element from an array using provided RNG
 *
 * @param arr - Array to choose from
 * @param rng - Random number generator function
 * @returns Random element, or undefined if array is empty
 *
 * @example
 * const rng = createSeededRNG(42);
 * const colors = ['red', 'green', 'blue'];
 * const color = randomChoice(colors, rng);
 */
export function randomChoice<T>(arr: readonly T[], rng: SeededRNG): T | undefined {
  if (arr.length === 0) return undefined;
  const index = Math.floor(rng() * arr.length);
  return arr[index];
}

/**
 * Shuffle an array in-place using provided RNG (Fisher-Yates algorithm)
 *
 * @param arr - Array to shuffle
 * @param rng - Random number generator function
 * @returns The same array (mutated)
 *
 * @example
 * const rng = createSeededRNG(42);
 * const deck = [1, 2, 3, 4, 5];
 * shuffleArray(deck, rng);
 */
export function shuffleArray<T>(arr: T[], rng: SeededRNG): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/**
 * Generate a random integer in [min, max] range (inclusive)
 *
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @param rng - Random number generator function
 * @returns Random integer
 *
 * @example
 * const rng = createSeededRNG(42);
 * const dice = randomInt(1, 6, rng);
 */
export function randomInt(min: number, max: number, rng: SeededRNG): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}
