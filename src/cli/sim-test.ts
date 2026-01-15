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
 *
 * Metrics are now tracked directly by the simulation systems via the Metrics module.
 * This CLI simply runs the simulation and reports from state.metrics.
 */

import { parseArgs } from 'util';
import { writeFileSync } from 'fs';
import { loadConfigSync } from './ConfigLoaderNode';
import { createSimulationWithCity, tick } from '../simulation/Simulation';
import {
  recordWeeklySnapshot,
  finalizeMetrics,
} from '../simulation/Metrics';
import {
  generateTextReport,
  generateVerboseReport,
  generateJsonReport,
} from './ReportGenerator';

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

  // Metrics are now initialized inside createSimulationWithCity
  // and tracked automatically by instrumented systems
  const metrics = state.metrics;

  log(`Starting simulation: ${state.agents.length} agents, ${state.organizations.length} orgs`);
  log(`Running for ${totalTicks} ticks (${Math.floor(totalTicks / phasesPerWeek)} weeks)...\n`);

  // Run simulation
  for (let t = 1; t <= totalTicks; t++) {
    const prevWeek = state.time.week;
    state = tick(state, config);
    const currentWeek = state.time.week;

    // Week rollover - record snapshot for reports
    if (currentWeek > prevWeek) {
      recordWeeklySnapshot(metrics, state, t);

      // Progress indicator
      if (!values.quiet) {
        originalLog(`  Week ${currentWeek}...`);
      }
    }
  }

  // Restore console
  console.log = originalLog;

  // Finalize metrics with final state
  finalizeMetrics(metrics, state, totalTicks);

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

// Run
main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
