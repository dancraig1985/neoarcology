/**
 * NeoArcology - Entry Point
 * A cyberpunk city simulation that runs autonomously
 */

import { loadConfig, type LoadedConfig } from './config/ConfigLoader';
import { initRenderer } from './renderer/Renderer';
import { createSimulation, tick, getSummary, type SimulationState } from './simulation/Simulation';
import { UIController } from './ui/UIController';

// Simulation state
let simulation: SimulationState | null = null;
let config: LoadedConfig | null = null;
let ui: UIController | null = null;

/**
 * Advance the simulation by N phases
 */
function advanceSimulation(phases: number): void {
  if (!simulation || !config) return;

  for (let i = 0; i < phases; i++) {
    simulation = tick(simulation, config);
  }

  // Update UI after all ticks
  if (ui) {
    ui.update(simulation);
  }

  // Log summary periodically for debugging
  if (phases >= 28) {
    console.log(getSummary(simulation));
  }
}

async function main() {
  console.log('=================================');
  console.log('  NeoArcology v0.1.0');
  console.log('  Cyberpunk City Simulation');
  console.log('  OBSERVER MODE');
  console.log('=================================\n');

  try {
    // Get the app container
    const container = document.getElementById('app');
    if (!container) {
      throw new Error('Could not find #app container');
    }

    // Initialize Pixi.js renderer
    console.log('[Main] Initializing renderer...');
    const app = await initRenderer(container);
    console.log('[Main] Renderer ready\n');

    // Load configuration
    console.log('[Main] Loading configuration...');
    config = await loadConfig();
    console.log('[Main] Configuration loaded\n');

    // Create simulation with test agents
    console.log('[Main] Creating simulation...');
    simulation = createSimulation(config);
    console.log('[Main] Simulation created\n');

    // Create UI controller
    console.log('[Main] Initializing UI...');
    ui = new UIController(app, {
      onTick: (phases) => advanceSimulation(phases),
    });

    // Initial UI update
    ui.update(simulation);
    console.log('[Main] UI ready\n');

    console.log('[Main] Observer Mode active');
    console.log('[Main] Use the buttons at the bottom to advance time:');
    console.log('  - End Turn: +1 phase');
    console.log('  - +Day: +4 phases');
    console.log('  - +Week: +28 phases');
    console.log('  - +Month: +112 phases');
    console.log('  - +Year: +1344 phases\n');

    // Store references for debugging
    (window as unknown as {
      neoArcology: {
        app: typeof app;
        getSimulation: () => SimulationState | null;
        tick: (n?: number) => void;
      }
    }).neoArcology = {
      app,
      getSimulation: () => simulation,
      tick: (n = 1) => advanceSimulation(n),
    };

    console.log('[Main] Debug commands available:');
    console.log('  neoArcology.getSimulation() - Get current state');
    console.log('  neoArcology.tick(n) - Advance n phases\n');

  } catch (error) {
    console.error('[Main] Failed to initialize:', error);
    throw error;
  }
}

// Start the application
main();
