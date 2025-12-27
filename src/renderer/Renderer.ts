/**
 * Renderer - Pixi.js setup
 * Creates the Pixi application for UI rendering
 */

import { Application } from 'pixi.js';

/**
 * Initialize the Pixi.js renderer
 * Returns the app instance for UI to use
 */
export async function initRenderer(container: HTMLElement): Promise<Application> {
  console.log('[Renderer] Initializing Pixi.js...');

  // Create the Pixi application
  const app = new Application();

  await app.init({
    background: 0x0a0a12, // Deep dark background
    resizeTo: container,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  });

  // Add canvas to container
  container.appendChild(app.canvas);

  console.log('[Renderer] Pixi.js initialized successfully');
  console.log(`[Renderer] Canvas size: ${app.screen.width}x${app.screen.height}`);

  return app;
}
