/**
 * Types for city generation
 */

/**
 * A single cell in the city grid (city block)
 * Can contain multiple locations at various floors
 */
export interface CityCell {
  x: number;        // 0-31
  y: number;        // 0-31
  zone: string;     // Zone ID from config (e.g., "downtown", "residential")
  maxHeight: number; // Maximum floors buildings can have (1-120)
}

/**
 * The full city grid
 */
export interface CityGrid {
  width: number;    // Grid width (32)
  height: number;   // Grid height (32)
  cells: CityCell[][]; // 2D array [x][y]
}

/**
 * Grid size constant
 */
export const GRID_SIZE = 32;
