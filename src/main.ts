/**
 * NeoArcology - Entry Point
 * A cyberpunk city simulation that runs autonomously
 */

import { loadConfig } from './config/ConfigLoader';
import { initRenderer } from './renderer/Renderer';
import { worldStore } from './store/worldStore';

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

    // Initialize world store
    console.log('[Main] Initializing world store...');
    worldStore.getState().initialize(config);
    console.log('[Main] World store initialized\n');

    // Log loaded data summary
    console.log('=== Configuration Summary ===');
    console.log(`Time: ${config.simulation.time.phasesPerDay} phases/day`);
    console.log(`Initial agents: ${config.simulation.generation.initialAgents}`);
    console.log(`Initial orgs: ${config.simulation.generation.initialOrgs}`);
    console.log(`Org templates: ${config.templates.orgs.map((t) => t.id).join(', ')}`);
    console.log(`Agent templates: ${config.templates.agents.map((t) => t.id).join(', ')}`);
    console.log(`Location templates: ${config.templates.locations.map((t) => t.id).join(', ')}`);
    console.log('=============================\n');

    console.log('[Main] NeoArcology ready!');
    console.log('[Main] Phase 0 complete - stack setup verified.');

    // Store app reference for later use (Phase 3)
    (window as unknown as { neoArcology: { app: typeof app; store: typeof worldStore } }).neoArcology =
      {
        app,
        store: worldStore,
      };
  } catch (error) {
    console.error('[Main] Failed to initialize:', error);
    throw error;
  }
}

// Start the application
main();
