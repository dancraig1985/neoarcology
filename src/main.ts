/**
 * NeoArcology - Entry Point
 * A cyberpunk city simulation that runs autonomously
 */

import { loadConfig } from './config/ConfigLoader';
import { initRenderer } from './renderer/Renderer';
import { createSimulation, tick, shouldStop, getSummary, type SimulationState } from './simulation/Simulation';

// Simulation state
let simulation: SimulationState | null = null;
let simulationInterval: number | null = null;

async function main() {
  console.log('=================================');
  console.log('  NeoArcology v0.1.0');
  console.log('  Cyberpunk City Simulation');
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
    const config = await loadConfig();
    console.log('[Main] Configuration loaded\n');

    // Log balance config
    console.log('=== Balance Config ===');
    console.log(`Hunger per phase: ${config.balance.agent.hungerPerPhase}`);
    console.log(`Hunger threshold: ${config.balance.agent.hungerThreshold}`);
    console.log(`Hunger max (death): ${config.balance.agent.hungerMax}`);
    console.log(`Starting provisions: ${config.balance.agent.startingProvisionsMin}-${config.balance.agent.startingProvisionsMax}`);
    console.log('======================\n');

    // Create simulation with test agents
    console.log('[Main] Creating simulation...');
    simulation = createSimulation(config);

    // Run simulation loop
    const ticksPerSecond = 20; // Speed: 20 phases per second
    const tickInterval = 1000 / ticksPerSecond;

    console.log(`[Main] Starting simulation at ${ticksPerSecond} ticks/second`);
    console.log('[Main] Watch agents eat provisions and eventually starve...\n');

    simulationInterval = window.setInterval(() => {
      if (!simulation) return;

      // Process one tick
      simulation = tick(simulation, config);

      // Check if all agents are dead
      if (shouldStop(simulation)) {
        console.log('\n' + getSummary(simulation));
        console.log('🎮 SIMULATION COMPLETE: All agents have died.');
        console.log('This is the expected outcome for PLAN-001!');

        if (simulationInterval) {
          clearInterval(simulationInterval);
          simulationInterval = null;
        }
      }
    }, tickInterval);

    // Store references for debugging
    (window as unknown as {
      neoArcology: {
        app: typeof app;
        getSimulation: () => SimulationState | null;
        pause: () => void;
        resume: () => void;
      }
    }).neoArcology = {
      app,
      getSimulation: () => simulation,
      pause: () => {
        if (simulationInterval) {
          clearInterval(simulationInterval);
          simulationInterval = null;
          console.log('[Main] Simulation paused');
        }
      },
      resume: () => {
        if (!simulationInterval && simulation) {
          simulationInterval = window.setInterval(() => {
            if (!simulation) return;
            simulation = tick(simulation, config);
            if (shouldStop(simulation)) {
              console.log('\n' + getSummary(simulation));
              if (simulationInterval) {
                clearInterval(simulationInterval);
                simulationInterval = null;
              }
            }
          }, tickInterval);
          console.log('[Main] Simulation resumed');
        }
      },
    };

    console.log('[Main] Debug commands available:');
    console.log('  neoArcology.pause() - Pause simulation');
    console.log('  neoArcology.resume() - Resume simulation');
    console.log('  neoArcology.getSimulation() - Get current state\n');

  } catch (error) {
    console.error('[Main] Failed to initialize:', error);
    throw error;
  }
}

// Start the application
main();
