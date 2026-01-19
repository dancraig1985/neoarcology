/**
 * Metrics - Track simulation metrics for analysis
 * Collects population, economy, business, and supply data
 *
 * Uses instance-based pattern with explicit metrics parameter.
 * Systems receive metrics through SimulationContext.
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

  // Supply chain inventory (all goods)
  supply: {
    // Legacy fields for backward compatibility (provisions only)
    factoryInventory: number;
    shopInventory: number;
    agentInventory: number;
    total: number;
    // New: inventory by good type
    byGood: {
      factory: Record<string, number>;
      retail: Record<string, number>;
      agent: Record<string, number>;
      office: Record<string, number>;  // Office/lab inventory (valuable_data, data_storage)
    };
  };
}

/**
 * Cumulative transaction counts during simulation run
 */
export interface TransactionCounts {
  // Legacy totals (for backward compatibility)
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
  // New: sales broken down by good
  retailSalesByGood: Record<string, number>;
  wholesaleSalesByGood: Record<string, number>;
  b2bSales: number;  // Business-to-business (e.g., data_storage)
  b2bSalesByGood: Record<string, number>;
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
      retailSalesByGood: {},
      wholesaleSalesByGood: {},
      b2bSales: 0,
      b2bSalesByGood: {},
    },
    snapshots: [],
    weeklyEvents: [],
    finalSnapshot: null,
  };
}

/**
 * Aggregate inventory across entities by good type
 */
function aggregateInventory(inventories: Record<string, number>[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const inv of inventories) {
    for (const [good, count] of Object.entries(inv)) {
      result[good] = (result[good] ?? 0) + count;
    }
  }
  return result;
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
  const wholesaleLocations = locations.filter(l => l.tags.includes('wholesale') || l.tags.includes('production'));
  // Office/lab locations that produce valuable_data (not wholesale or retail)
  const officeLocations = locations.filter(l =>
    (l.tags.includes('office') || l.tags.includes('laboratory')) &&
    !l.tags.includes('wholesale') && !l.tags.includes('retail')
  );

  // Aggregate inventory by good type for each category
  const factoryByGood = aggregateInventory(wholesaleLocations.map(l => l.inventory));
  const retailByGood = aggregateInventory(retailLocations.map(l => l.inventory));
  const agentByGood = aggregateInventory(alive.map(a => a.inventory));
  // Office/lab inventory (valuable_data, data_storage)
  const officeByGood = aggregateInventory(officeLocations.map(l => l.inventory));

  // Legacy: provisions-only counts for backward compatibility
  const factoryInventory = factoryByGood['provisions'] ?? 0;
  const shopInventory = retailByGood['provisions'] ?? 0;
  const agentInventory = agentByGood['provisions'] ?? 0;

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
      // Legacy fields (provisions only)
      factoryInventory,
      shopInventory,
      agentInventory,
      total: factoryInventory + shopInventory + agentInventory,
      // New: all goods by category
      byGood: {
        factory: factoryByGood,
        retail: retailByGood,
        agent: agentByGood,
        office: officeByGood,
      },
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
export function recordRetailSale(metrics: SimulationMetrics, good?: string): void {
  metrics.transactions.retailSales++;
  if (good) {
    metrics.transactions.retailSalesByGood[good] =
      (metrics.transactions.retailSalesByGood[good] ?? 0) + 1;
  }
}

export function recordWholesaleSale(metrics: SimulationMetrics, good?: string): void {
  metrics.transactions.wholesaleSales++;
  if (good) {
    metrics.transactions.wholesaleSalesByGood[good] =
      (metrics.transactions.wholesaleSalesByGood[good] ?? 0) + 1;
  }
}

export function recordB2BSale(metrics: SimulationMetrics, good: string): void {
  metrics.transactions.b2bSales++;
  metrics.transactions.b2bSalesByGood[good] =
    (metrics.transactions.b2bSalesByGood[good] ?? 0) + 1;
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

