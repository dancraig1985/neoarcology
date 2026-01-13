/**
 * Metrics - Track simulation metrics for analysis
 * Collects population, economy, business, and supply data
 */

import type { SimulationState } from './Simulation';

/**
 * Snapshot of simulation state at a point in time
 */
export interface MetricsSnapshot {
  tick: number;
  week: number;

  // Population
  population: {
    alive: number;
    dead: number;
    employed: number;
    unemployed: number;
    businessOwners: number;
  };

  // Economy
  economy: {
    totalCredits: number;
    agentCredits: number;
    orgCredits: number;
  };

  // Businesses
  businesses: {
    active: number;
    retail: number;
    wholesale: number;
  };

  // Food supply
  supply: {
    factoryInventory: number;
    shopInventory: number;
    agentInventory: number;
    total: number;
  };
}

/**
 * Cumulative transaction counts during simulation run
 */
export interface TransactionCounts {
  retailSales: number;
  wholesaleSales: number;
  wagesPaid: number;
  dividendsPaid: number;
  deaths: number;
  deathsByCause: Record<string, number>;
  businessesOpened: number;
  businessesClosed: number;
  hires: number;
  fires: number;
  immigrants: number;
}

/**
 * Weekly event summary for verbose output
 */
export interface WeeklyEvents {
  week: number;
  deaths: { name: string; cause: string }[];
  businessesOpened: string[];
  businessesClosed: string[];
  hires: number;
  fires: number;
}

/**
 * Complete metrics collection for a simulation run
 */
export interface SimulationMetrics {
  seed: number | undefined;
  startingPopulation: number;
  startingBusinesses: number;

  // Cumulative counts
  transactions: TransactionCounts;

  // Periodic snapshots
  snapshots: MetricsSnapshot[];

  // Weekly event logs (for verbose output)
  weeklyEvents: WeeklyEvents[];

  // Final state
  finalSnapshot: MetricsSnapshot | null;
}

/**
 * Create initial metrics tracker
 */
export function createMetrics(seed?: number): SimulationMetrics {
  return {
    seed,
    startingPopulation: 0,
    startingBusinesses: 0,
    transactions: {
      retailSales: 0,
      wholesaleSales: 0,
      wagesPaid: 0,
      dividendsPaid: 0,
      deaths: 0,
      deathsByCause: {},
      businessesOpened: 0,
      businessesClosed: 0,
      hires: 0,
      fires: 0,
      immigrants: 0,
    },
    snapshots: [],
    weeklyEvents: [],
    finalSnapshot: null,
  };
}

/**
 * Take a snapshot of current simulation state
 */
export function takeSnapshot(state: SimulationState, tick: number): MetricsSnapshot {
  const { agents, organizations, locations, time } = state;

  const alive = agents.filter(a => a.status !== 'dead');
  const dead = agents.filter(a => a.status === 'dead');
  const employed = alive.filter(a => a.status === 'employed');
  const unemployed = alive.filter(a => a.status === 'available');
  const businessOwners = organizations.map(o => o.leader).filter(Boolean);

  const agentCredits = alive.reduce((sum, a) => sum + a.wallet.credits, 0);
  const orgCredits = organizations.reduce((sum, o) => sum + o.wallet.credits, 0);

  const retailLocations = locations.filter(l => l.tags.includes('retail'));
  const wholesaleLocations = locations.filter(l => l.tags.includes('wholesale'));

  const factoryInventory = wholesaleLocations.reduce(
    (sum, l) => sum + (l.inventory['provisions'] ?? 0),
    0
  );
  const shopInventory = retailLocations.reduce(
    (sum, l) => sum + (l.inventory['provisions'] ?? 0),
    0
  );
  const agentInventory = alive.reduce(
    (sum, a) => sum + (a.inventory['provisions'] ?? 0),
    0
  );

  return {
    tick,
    week: time.week,
    population: {
      alive: alive.length,
      dead: dead.length,
      employed: employed.length,
      unemployed: unemployed.length,
      businessOwners: businessOwners.length,
    },
    economy: {
      totalCredits: agentCredits + orgCredits,
      agentCredits,
      orgCredits,
    },
    businesses: {
      active: organizations.length,
      retail: retailLocations.length,
      wholesale: wholesaleLocations.length,
    },
    supply: {
      factoryInventory,
      shopInventory,
      agentInventory,
      total: factoryInventory + shopInventory + agentInventory,
    },
  };
}

/**
 * Record initial state
 */
export function recordInitialState(
  metrics: SimulationMetrics,
  state: SimulationState
): void {
  metrics.startingPopulation = state.agents.length;
  metrics.startingBusinesses = state.organizations.length;

  // Take initial snapshot
  const snapshot = takeSnapshot(state, 0);
  metrics.snapshots.push(snapshot);
}

/**
 * Record a death event
 */
export function recordDeath(
  metrics: SimulationMetrics,
  agentName: string,
  cause: string
): void {
  metrics.transactions.deaths++;
  metrics.transactions.deathsByCause[cause] =
    (metrics.transactions.deathsByCause[cause] ?? 0) + 1;

  // Add to current week's events
  const currentWeek = metrics.weeklyEvents[metrics.weeklyEvents.length - 1];
  if (currentWeek) {
    currentWeek.deaths.push({ name: agentName, cause });
  }
}

/**
 * Record a business opening
 */
export function recordBusinessOpened(
  metrics: SimulationMetrics,
  businessName: string
): void {
  metrics.transactions.businessesOpened++;

  const currentWeek = metrics.weeklyEvents[metrics.weeklyEvents.length - 1];
  if (currentWeek) {
    currentWeek.businessesOpened.push(businessName);
  }
}

/**
 * Record a business closing
 */
export function recordBusinessClosed(
  metrics: SimulationMetrics,
  businessName: string
): void {
  metrics.transactions.businessesClosed++;

  const currentWeek = metrics.weeklyEvents[metrics.weeklyEvents.length - 1];
  if (currentWeek) {
    currentWeek.businessesClosed.push(businessName);
  }
}

/**
 * Record hire/fire events
 */
export function recordHire(metrics: SimulationMetrics): void {
  metrics.transactions.hires++;
  const currentWeek = metrics.weeklyEvents[metrics.weeklyEvents.length - 1];
  if (currentWeek) currentWeek.hires++;
}

export function recordFire(metrics: SimulationMetrics): void {
  metrics.transactions.fires++;
  const currentWeek = metrics.weeklyEvents[metrics.weeklyEvents.length - 1];
  if (currentWeek) currentWeek.fires++;
}

/**
 * Record transaction counts
 */
export function recordRetailSale(metrics: SimulationMetrics): void {
  metrics.transactions.retailSales++;
}

export function recordWholesaleSale(metrics: SimulationMetrics): void {
  metrics.transactions.wholesaleSales++;
}

export function recordWagePayment(metrics: SimulationMetrics, amount: number): void {
  metrics.transactions.wagesPaid += amount;
}

export function recordDividendPayment(metrics: SimulationMetrics, amount: number): void {
  metrics.transactions.dividendsPaid += amount;
}

export function recordImmigrant(metrics: SimulationMetrics): void {
  metrics.transactions.immigrants++;
}

/**
 * Start a new week for event tracking
 */
export function startNewWeek(metrics: SimulationMetrics, week: number): void {
  metrics.weeklyEvents.push({
    week,
    deaths: [],
    businessesOpened: [],
    businessesClosed: [],
    hires: 0,
    fires: 0,
  });
}

/**
 * Take weekly snapshot
 */
export function recordWeeklySnapshot(
  metrics: SimulationMetrics,
  state: SimulationState,
  tick: number
): void {
  const snapshot = takeSnapshot(state, tick);
  metrics.snapshots.push(snapshot);
}

/**
 * Finalize metrics at end of simulation
 */
export function finalizeMetrics(
  metrics: SimulationMetrics,
  state: SimulationState,
  tick: number
): void {
  metrics.finalSnapshot = takeSnapshot(state, tick);
}
