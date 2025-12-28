/**
 * Simple 2D noise implementation for zone generation
 * Based on value noise with smooth interpolation
 */

/**
 * Simple seedable random number generator
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

/**
 * Smooth interpolation (smoothstep)
 */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Linear interpolation
 */
function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

/**
 * Create a 2D noise function
 * Returns values between 0 and 1
 */
export function createNoise2D(seed: number = 12345): (x: number, y: number) => number {
  const random = seededRandom(seed);

  // Generate a grid of random values
  const gridSizeNoise = 64;
  const grid: number[][] = [];
  for (let i = 0; i < gridSizeNoise; i++) {
    const row: number[] = [];
    for (let j = 0; j < gridSizeNoise; j++) {
      row.push(random());
    }
    grid.push(row);
  }

  return (x: number, y: number): number => {
    // Scale coordinates
    const sx = x * 0.1;
    const sy = y * 0.1;

    // Get grid cell coordinates
    const x0 = Math.floor(sx) & (gridSizeNoise - 1);
    const y0 = Math.floor(sy) & (gridSizeNoise - 1);
    const x1 = (x0 + 1) & (gridSizeNoise - 1);
    const y1 = (y0 + 1) & (gridSizeNoise - 1);

    // Get fractional part
    const fx = sx - Math.floor(sx);
    const fy = sy - Math.floor(sy);

    // Apply smoothstep
    const u = smoothstep(fx);
    const v = smoothstep(fy);

    // Get corner values (safe access with fallback)
    const row0 = grid[x0] ?? [];
    const row1 = grid[x1] ?? [];
    const n00 = row0[y0] ?? 0;
    const n10 = row1[y0] ?? 0;
    const n01 = row0[y1] ?? 0;
    const n11 = row1[y1] ?? 0;

    // Bilinear interpolation
    const nx0 = lerp(n00, n10, u);
    const nx1 = lerp(n01, n11, u);

    return lerp(nx0, nx1, v);
  };
}

/**
 * Multi-octave noise (fractal brownian motion)
 * Combines multiple noise frequencies for more natural results
 */
export function fbm(
  noise: (x: number, y: number) => number,
  x: number,
  y: number,
  octaves: number = 4,
  persistence: number = 0.5
): number {
  let total = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    total += noise(x * frequency, y * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }

  return total / maxValue;
}
