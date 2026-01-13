#!/usr/bin/env node
/**
 * sim-test - Headless simulation testing CLI
 * Run the simulation without UI and output metrics
 *
 * Usage:
 *   npm run sim:test                           # Run with defaults
 *   npm run sim:test -- --ticks 1000           # Run for 1000 ticks
 *   npm run sim:test -- --seed 12345           # Use specific seed
 *   npm run sim:test -- --verbose              # Show weekly events
 *   npm run sim:test -- --json                 # Output JSON format
 *   npm run sim:test -- --quiet                # Suppress simulation logs
 */

import { parseArgs } from 'util';
import { writeFileSync } from 'fs';
import { loadConfigSync } from './ConfigLoaderNode';
import { createSimulationWithCity, tick, type SimulationState } from '../simulation/Simulation';
import {
  createMetrics,
  recordInitialState,
  recordWeeklySnapshot,
  finalizeMetrics,
  startNewWeek,
  recordDeath,
  recordBusinessOpened,
  recordBusinessClosed,
  recordRetailSale,
  recordWholesaleSale,
  recordWagePayment,
  recordDividendPayment,
  recordHire,
  recordFire,
  recordImmigrant,
  type SimulationMetrics,
} from '../simulation/Metrics';
import {
  generateTextReport,
  generateVerboseReport,
  generateJsonReport,
} from './ReportGenerator';
import { ActivityLog } from '../simulation/ActivityLog';

// Parse command line arguments
const { values } = parseArgs({
  options: {
    ticks: { type: 'string', short: 't', default: '1000' },
    seed: { type: 'string', short: 's' },
    verbose: { type: 'boolean', short: 'v', default: false },
    json: { type: 'boolean', short: 'j', default: false },
    output: { type: 'string', short: 'o' },
    quiet: { type: 'boolean', short: 'q', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

// Show help
if (values.help) {
  console.log(`
sim-test - Headless simulation testing CLI

Usage:
  npm run sim:test [options]

Options:
  -t, --ticks <n>    Number of ticks to run (default: 1000)
  -s, --seed <n>     Random seed for reproducible runs
  -v, --verbose      Show weekly event details
  -j, --json         Output in JSON format
  -o, --output <f>   Write report to file
  -q, --quiet        Suppress simulation logs
  -h, --help         Show this help

Examples:
  npm run sim:test -- --ticks 2000 --seed 42
  npm run sim:test -- --verbose --output report.txt
  npm run sim:test -- --json > results.json
`);
  process.exit(0);
}

// Suppress console.log if quiet mode
const originalLog = console.log;
if (values.quiet) {
  console.log = () => {};
}

// Configuration
const totalTicks = parseInt(values.ticks ?? '1000', 10);
const seed = values.seed ? parseInt(values.seed, 10) : undefined;
const phasesPerWeek = 28;

// Track previous state for detecting changes
let prevAgentCount = 0;
let prevOrgCount = 0;
let prevDeadAgents = new Set<string>();
let prevOrgIds = new Set<string>();

/**
 * Main simulation runner
 */
async function main() {
  // Restore console for our output
  const log = originalLog;

  log('Loading configuration...');
  const config = loadConfigSync();

  log(`Creating simulation${seed !== undefined ? ` with seed ${seed}` : ''}...`);
  let state = createSimulationWithCity(config, seed);

  // Initialize metrics
  const metrics = createMetrics(seed);
  recordInitialState(metrics, state);
  startNewWeek(metrics, 1);

  // Track initial state
  prevAgentCount = state.agents.length;
  prevOrgCount = state.organizations.length;
  prevDeadAgents = new Set(state.agents.filter(a => a.status === 'dead').map(a => a.id));
  prevOrgIds = new Set(state.organizations.map(o => o.id));

  log(`Starting simulation: ${state.agents.length} agents, ${state.organizations.length} orgs`);
  log(`Running for ${totalTicks} ticks (${Math.floor(totalTicks / phasesPerWeek)} weeks)...\n`);

  // Run simulation
  for (let t = 1; t <= totalTicks; t++) {
    const prevWeek = state.time.week;
    state = tick(state, config);
    const currentWeek = state.time.week;

    // Detect events by comparing state
    detectEvents(state, metrics);

    // Week rollover
    if (currentWeek > prevWeek) {
      recordWeeklySnapshot(metrics, state, t);
      startNewWeek(metrics, currentWeek);

      // Progress indicator
      if (!values.quiet) {
        originalLog(`  Week ${currentWeek}...`);
      }
    }
  }

  // Restore console
  console.log = originalLog;

  // Finalize metrics
  finalizeMetrics(metrics, state, totalTicks);

  // Count transactions from activity log
  countTransactionsFromLog(metrics);

  // Generate report
  let report: string;
  if (values.json) {
    report = generateJsonReport(metrics, totalTicks);
  } else if (values.verbose) {
    report = generateVerboseReport(metrics, totalTicks);
  } else {
    report = generateTextReport(metrics, totalTicks);
  }

  // Output
  log('');
  if (values.output) {
    writeFileSync(values.output, report);
    log(`Report written to: ${values.output}`);
  } else {
    log(report);
  }
}

/**
 * Detect events by comparing current state to previous state
 */
function detectEvents(state: SimulationState, metrics: SimulationMetrics) {
  // Detect deaths
  const currentDeadAgents = new Set(state.agents.filter(a => a.status === 'dead').map(a => a.id));
  for (const agentId of currentDeadAgents) {
    if (!prevDeadAgents.has(agentId)) {
      const agent = state.agents.find(a => a.id === agentId);
      if (agent) {
        // Determine cause (currently only starvation)
        recordDeath(metrics, agent.name, 'starvation');
      }
    }
  }
  prevDeadAgents = currentDeadAgents;

  // Detect new businesses
  const currentOrgIds = new Set(state.organizations.map(o => o.id));
  for (const orgId of currentOrgIds) {
    if (!prevOrgIds.has(orgId)) {
      const org = state.organizations.find(o => o.id === orgId);
      if (org) {
        recordBusinessOpened(metrics, org.name);
      }
    }
  }

  // Detect closed businesses
  for (const orgId of prevOrgIds) {
    if (!currentOrgIds.has(orgId)) {
      recordBusinessClosed(metrics, orgId); // We don't have the name anymore
    }
  }
  prevOrgIds = currentOrgIds;
}

/**
 * Count transactions from activity log
 * This is a workaround since we're not instrumenting the simulation code directly
 */
function countTransactionsFromLog(metrics: SimulationMetrics) {
  const entries = ActivityLog.getEntries();

  for (const entry of entries) {
    // Detect retail sales (category: commerce, message: purchased X provisions from Y)
    if (entry.category === 'commerce' && entry.message.includes('purchased')) {
      recordRetailSale(metrics);
    }
    // Detect wholesale sales (category: wholesale, message: bought X provisions)
    if (entry.category === 'wholesale' && entry.message.includes('bought')) {
      recordWholesaleSale(metrics);
    }
    // Detect wage payments (category: payroll, message: paid X credits by)
    if (entry.category === 'payroll' && entry.message.includes('paid') && entry.message.includes('credits by')) {
      const match = entry.message.match(/(\d+) credits/);
      if (match) {
        recordWagePayment(metrics, parseInt(match[1], 10));
      }
    }
    // Detect dividend payments (category: dividend, message: received X credits from)
    if (entry.category === 'dividend' && entry.message.includes('received')) {
      const match = entry.message.match(/(\d+) credits/);
      if (match) {
        recordDividendPayment(metrics, parseInt(match[1], 10));
      }
    }
    // Detect hires (category: employment, message: hired at)
    if (entry.category === 'employment' && entry.message.includes('hired at')) {
      recordHire(metrics);
    }
    // Detect fires/quits (category: employment, message: left job at)
    if (entry.category === 'employment' && entry.message.includes('left job')) {
      recordFire(metrics);
    }
    // Detect immigration (category: immigration, message: arrived in the city)
    if (entry.category === 'immigration' && entry.message.includes('arrived')) {
      recordImmigrant(metrics);
    }
  }
}

// Run
main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
