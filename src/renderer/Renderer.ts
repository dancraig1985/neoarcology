/**
 * Renderer - Pixi.js setup stub
 * Will handle rendering in Phase 3
 */

import { Application, Graphics } from 'pixi.js';

/**
 * Initialize the Pixi.js renderer
 * Returns the app instance for later use
 */
export async function initRenderer(container: HTMLElement): Promise<Application> {
  console.log('[Renderer] Initializing Pixi.js...');

  // Create the Pixi application
  const app = new Application();

  await app.init({
    background: '#1a1a2e', // Dark cyberpunk blue
    resizeTo: container,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
  });

  // Add canvas to container
  container.appendChild(app.canvas);

  // Create a simple visual to confirm rendering works
  const graphics = new Graphics();

  // Draw a cyberpunk-style grid pattern
  graphics.rect(0, 0, app.screen.width, app.screen.height);
  graphics.fill({ color: 0x1a1a2e });

  // Draw some accent lines
  graphics.moveTo(0, app.screen.height / 2);
  graphics.lineTo(app.screen.width, app.screen.height / 2);
  graphics.stroke({ width: 2, color: 0x00ff88, alpha: 0.3 });

  graphics.moveTo(app.screen.width / 2, 0);
  graphics.lineTo(app.screen.width / 2, app.screen.height);
  graphics.stroke({ width: 2, color: 0x00ff88, alpha: 0.3 });

  // Draw corner markers
  const cornerSize = 50;
  const corners = [
    { x: 20, y: 20 },
    { x: app.screen.width - 20 - cornerSize, y: 20 },
    { x: 20, y: app.screen.height - 20 - cornerSize },
    { x: app.screen.width - 20 - cornerSize, y: app.screen.height - 20 - cornerSize },
  ];

  for (const corner of corners) {
    graphics.moveTo(corner.x, corner.y);
    graphics.lineTo(corner.x + cornerSize, corner.y);
    graphics.stroke({ width: 2, color: 0xff0066 });

    graphics.moveTo(corner.x, corner.y);
    graphics.lineTo(corner.x, corner.y + cornerSize);
    graphics.stroke({ width: 2, color: 0xff0066 });
  }

  app.stage.addChild(graphics);

  console.log('[Renderer] Pixi.js initialized successfully');
  console.log(`[Renderer] Canvas size: ${app.screen.width}x${app.screen.height}`);

  return app;
}
