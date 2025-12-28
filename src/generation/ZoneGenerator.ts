/**
 * ZoneGenerator - Organic zone generation using growth algorithm
 *
 * Creates natural-looking city layouts by:
 * 1. Seeding downtown near (but not exactly at) center
 * 2. Growing zones outward like organic blobs
 * 3. Each zone type spreads from its seeds based on rules
 */

import { ZoneConfig } from '../config/ConfigLoader';
import { CityCell, CityGrid, GRID_SIZE } from './types';
import { createNoise2D, fbm } from './noise';

const CENTER = GRID_SIZE / 2; // 16

/**
 * Simple seeded random number generator
 */
function createRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

/**
 * Shuffle array in place using Fisher-Yates
 */
function shuffle<T>(arr: T[], random: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/**
 * Get orthogonal neighbors of a cell
 */
function getNeighborCoords(x: number, y: number): Array<{ x: number; y: number }> {
  const neighbors: Array<{ x: number; y: number }> = [];
  if (x > 0) neighbors.push({ x: x - 1, y });
  if (x < GRID_SIZE - 1) neighbors.push({ x: x + 1, y });
  if (y > 0) neighbors.push({ x, y: y - 1 });
  if (y < GRID_SIZE - 1) neighbors.push({ x, y: y + 1 });
  return neighbors;
}

/**
 * Calculate distance from city center
 */
function distanceFromCenter(x: number, y: number): number {
  const dx = x - CENTER;
  const dy = y - CENTER;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Grow a zone from seed cells using flood-fill with noise
 */
function growZone(
  cells: string[][],
  zoneId: string,
  seeds: Array<{ x: number; y: number }>,
  targetSize: number,
  noise: (x: number, y: number) => number,
  random: () => number,
  canGrowInto: (x: number, y: number) => boolean
): void {
  const frontier: Array<{ x: number; y: number }> = [...seeds];
  let grown = 0;

  // Mark seeds
  for (const seed of seeds) {
    if (cells[seed.x]?.[seed.y] === '') {
      cells[seed.x]![seed.y] = zoneId;
      grown++;
    }
  }

  while (frontier.length > 0 && grown < targetSize) {
    // Pick a random frontier cell (weighted by noise for organic shapes)
    shuffle(frontier, random);

    const current = frontier.shift()!;
    const neighbors = getNeighborCoords(current.x, current.y);
    shuffle(neighbors, random);

    for (const neighbor of neighbors) {
      if (grown >= targetSize) break;

      const col = cells[neighbor.x];
      if (!col || col[neighbor.y] !== '') continue;
      if (!canGrowInto(neighbor.x, neighbor.y)) continue;

      // Use noise to create irregular edges (probability of growing)
      const noiseVal = noise(neighbor.x * 0.3, neighbor.y * 0.3);
      if (random() > 0.3 + noiseVal * 0.4) continue;

      col[neighbor.y] = zoneId;
      grown++;
      frontier.push(neighbor);
    }
  }
}

/**
 * Get cells adjacent to a zone
 */
function getZoneEdge(
  cells: string[][],
  zoneId: string
): Array<{ x: number; y: number }> {
  const edge: Array<{ x: number; y: number }> = [];

  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      if (cells[x]?.[y] !== '') continue;

      // Check if adjacent to the zone
      const neighbors = getNeighborCoords(x, y);
      const adjacentToZone = neighbors.some(
        (n) => cells[n.x]?.[n.y] === zoneId
      );
      if (adjacentToZone) {
        edge.push({ x, y });
      }
    }
  }

  return edge;
}

/**
 * Generate the city grid with organic zone growth
 */
export function generateZones(
  zones: Record<string, ZoneConfig>,
  seed: number = Date.now()
): CityGrid {
  const noise2D = createNoise2D(seed);
  const noise = (x: number, y: number) => fbm(noise2D, x, y, 2);
  const random = createRandom(seed);

  // Initialize empty zone map
  const zoneMap: string[][] = [];
  for (let x = 0; x < GRID_SIZE; x++) {
    zoneMap.push(Array(GRID_SIZE).fill(''));
  }

  // Helper to check if cell is empty
  const isEmpty = (x: number, y: number) => zoneMap[x]?.[y] === '';

  // Helper to get zone size from config
  const getZoneSize = (zoneId: string): number => {
    const zone = zones[zoneId];
    if (!zone?.sizeRange) return 50; // Default fallback
    const [min, max] = zone.sizeRange;
    return min + Math.floor(random() * (max - min + 1));
  };

  // ===================
  // PHASE 1: DOWNTOWN
  // ===================
  // Place downtown seed near center, offset by noise for variety
  const downtownOffsetX = Math.floor((noise(0, 0) - 0.5) * 6); // -3 to +3
  const downtownOffsetY = Math.floor((noise(1, 1) - 0.5) * 6);
  const downtownCenterX = CENTER + downtownOffsetX;
  const downtownCenterY = CENTER + downtownOffsetY;

  // Seed downtown with a small cluster
  const downtownSeeds: Array<{ x: number; y: number }> = [
    { x: downtownCenterX, y: downtownCenterY },
    { x: downtownCenterX + 1, y: downtownCenterY },
    { x: downtownCenterX, y: downtownCenterY + 1 },
    { x: downtownCenterX - 1, y: downtownCenterY },
    { x: downtownCenterX, y: downtownCenterY - 1 },
  ].filter((p) => p.x >= 0 && p.x < GRID_SIZE && p.y >= 0 && p.y < GRID_SIZE);

  // Grow downtown (size from config)
  growZone(zoneMap, 'downtown', downtownSeeds, getZoneSize('downtown'), noise, random, () => true);

  // ===================
  // PHASE 2: GOVERNMENT
  // ===================
  // Pick cells adjacent to downtown (size from config)
  const govEdge = getZoneEdge(zoneMap, 'downtown');
  shuffle(govEdge, random);
  const govSeeds = govEdge.slice(0, Math.min(3, govEdge.length));

  growZone(zoneMap, 'government', govSeeds, getZoneSize('government'), noise, random, isEmpty);

  // ===================
  // PHASE 3: COMMERCIAL
  // ===================
  // Grows from downtown and government edges (size from config)
  const commercialEdge = [
    ...getZoneEdge(zoneMap, 'downtown'),
    ...getZoneEdge(zoneMap, 'government'),
  ];
  shuffle(commercialEdge, random);
  const commercialSeeds = commercialEdge.slice(0, Math.min(8, commercialEdge.length));

  growZone(zoneMap, 'commercial', commercialSeeds, getZoneSize('commercial'), noise, random, isEmpty);

  // ===================
  // PHASE 4: INDUSTRIAL
  // ===================
  // Seed in a random corner/edge, grow inward
  const corners = [
    { x: 2, y: 2 },                           // top-left
    { x: GRID_SIZE - 3, y: 2 },               // top-right
    { x: 2, y: GRID_SIZE - 3 },               // bottom-left
    { x: GRID_SIZE - 3, y: GRID_SIZE - 3 },   // bottom-right
  ];
  shuffle(corners, random);

  // Pick 1-2 corners for industrial
  const industrialCorners = corners.slice(0, 1 + Math.floor(random() * 2));
  const industrialSeeds: Array<{ x: number; y: number }> = [];
  for (const corner of industrialCorners) {
    // Spread seeds around the corner
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const x = corner.x + dx;
        const y = corner.y + dy;
        if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE && isEmpty(x, y)) {
          industrialSeeds.push({ x, y });
        }
      }
    }
  }
  shuffle(industrialSeeds, random);

  growZone(
    zoneMap,
    'industrial',
    industrialSeeds.slice(0, 10),
    getZoneSize('industrial'),
    noise,
    random,
    (x, y) => isEmpty(x, y) && distanceFromCenter(x, y) > 8 // Stay away from center
  );

  // ===================
  // PHASE 5: SLUMS
  // ===================
  // Seed on edges far from industrial, grow inward
  const slumsSeeds: Array<{ x: number; y: number }> = [];

  // Find edge cells not near industrial
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      if (!isEmpty(x, y)) continue;

      const isEdge = x < 3 || x >= GRID_SIZE - 3 || y < 3 || y >= GRID_SIZE - 3;
      if (!isEdge) continue;

      // Check if not adjacent to industrial
      const neighbors = getNeighborCoords(x, y);
      const nearIndustrial = neighbors.some((n) => zoneMap[n.x]?.[n.y] === 'industrial');
      if (!nearIndustrial) {
        slumsSeeds.push({ x, y });
      }
    }
  }
  shuffle(slumsSeeds, random);

  growZone(
    zoneMap,
    'slums',
    slumsSeeds.slice(0, 15),
    getZoneSize('slums'),
    noise,
    random,
    (x, y) => {
      if (!isEmpty(x, y)) return false;
      // Slums avoid downtown and government
      const neighbors = getNeighborCoords(x, y);
      return !neighbors.some((n) => {
        const zone = zoneMap[n.x]?.[n.y];
        return zone === 'downtown' || zone === 'government';
      });
    }
  );

  // ===================
  // PHASE 6: RESIDENTIAL
  // ===================
  // Residential grows ONLY from commercial edges (natural urban transition)
  // It does NOT fill remaining space - slums do that
  const residentialEdge = getZoneEdge(zoneMap, 'commercial');
  shuffle(residentialEdge, random);

  // Only seed from commercial edges - keeps residential clustered near commercial
  const residentialSeeds = residentialEdge.slice(0, Math.min(10, residentialEdge.length));

  growZone(
    zoneMap,
    'residential',
    residentialSeeds,
    getZoneSize('residential'), // Size from config
    noise,
    random,
    (x, y) => {
      if (!isEmpty(x, y)) return false;
      // Residential avoids being directly adjacent to industrial
      const neighbors = getNeighborCoords(x, y);
      return !neighbors.some((n) => zoneMap[n.x]?.[n.y] === 'industrial');
    }
  );

  // ===================
  // PHASE 7: FILL GAPS
  // ===================
  // Any remaining empty cells become slums (buffer zones)
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      if (zoneMap[x]?.[y] === '') {
        zoneMap[x]![y] = 'slums';
      }
    }
  }

  // ===================
  // BUILD FINAL GRID
  // ===================
  const cells: CityCell[][] = [];
  for (let x = 0; x < GRID_SIZE; x++) {
    const col: CityCell[] = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      const zoneId = zoneMap[x]?.[y] ?? 'residential';
      const zone = zones[zoneId];
      const [minHeight, maxHeight] = zone?.heightRange ?? [10, 40];

      // Use noise to vary heights within the zone's range
      const heightNoise = fbm(noise2D, x * 2, y * 2, 2);
      let height = Math.round(minHeight + (maxHeight - minHeight) * heightNoise);

      // Downtown gets extra height near its center
      if (zoneId === 'downtown') {
        const distFromDowntownCenter = Math.sqrt(
          (x - downtownCenterX) ** 2 + (y - downtownCenterY) ** 2
        );
        const centerBoost = Math.max(0, 1 - distFromDowntownCenter / 8);
        height = Math.min(maxHeight, height + Math.round(centerBoost * 30));
      }

      col.push({
        x,
        y,
        zone: zoneId,
        maxHeight: height,
      });
    }
    cells.push(col);
  }

  return {
    width: GRID_SIZE,
    height: GRID_SIZE,
    cells,
  };
}
