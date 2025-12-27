/**
 * UIController - Main controller that bridges simulation to UI
 * Manages all panels and handles layout
 */

import { Application, Container } from 'pixi.js';
import type { SimulationState } from '../simulation/Simulation';
import { SPACING } from './UITheme';
import { HeaderPanel } from './panels/HeaderPanel';
import { ControlsPanel } from './panels/ControlsPanel';
import { NavPanel, type EntityType } from './panels/NavPanel';
import { MainPanel } from './panels/MainPanel';
import { LogPanel } from './panels/LogPanel';

export interface UIControllerCallbacks {
  onTick: (phases: number) => void;
}

export class UIController {
  private app: Application;
  private root: Container;
  private callbacks: UIControllerCallbacks;

  // Panels
  private headerPanel: HeaderPanel;
  private controlsPanel: ControlsPanel;
  private navPanel: NavPanel;
  private mainPanel: MainPanel;
  private logPanel: LogPanel;

  // State
  private _currentEntityType: EntityType = 'agents';

  /**
   * Get the currently selected entity type
   */
  get currentEntityType(): EntityType {
    return this._currentEntityType;
  }

  constructor(app: Application, callbacks: UIControllerCallbacks) {
    this.app = app;
    this.callbacks = callbacks;

    // Clear stage and create root container
    app.stage.removeChildren();
    this.root = new Container();
    app.stage.addChild(this.root);

    // Get initial dimensions
    const width = app.screen.width;
    const height = app.screen.height;

    console.log(`[UIController] Initial size: ${width}x${height}`);

    // Header
    this.headerPanel = new HeaderPanel(width);
    this.root.addChild(this.headerPanel);

    // Controls (bottom)
    this.controlsPanel = new ControlsPanel(width, {
      onEndTurn: () => this.callbacks.onTick(1),
      onAdvanceDay: () => this.callbacks.onTick(4),
      onAdvanceWeek: () => this.callbacks.onTick(28),
      onAdvanceMonth: () => this.callbacks.onTick(112),
      onAdvanceYear: () => this.callbacks.onTick(1344),
    });
    this.root.addChild(this.controlsPanel);

    // Nav (left sidebar)
    const middleHeight = height - SPACING.headerHeight - SPACING.logHeight - SPACING.controlsHeight;
    this.navPanel = new NavPanel(SPACING.navWidth, middleHeight, {
      onSelect: (type) => this.onEntityTypeSelect(type),
    });
    this.root.addChild(this.navPanel);

    // Main panel (center)
    const mainWidth = width - SPACING.navWidth;
    this.mainPanel = new MainPanel(mainWidth, middleHeight);
    this.root.addChild(this.mainPanel);

    // Log panel (above controls)
    this.logPanel = new LogPanel(width, SPACING.logHeight, {
      onEntityClick: (entityId, entityType) => this.navigateToEntity(entityId, entityType),
    });
    this.root.addChild(this.logPanel);

    // Initial layout
    this.layout();

    // Handle resize - use Pixi's resize event
    app.renderer.on('resize', () => this.onResize());

    // Keyboard shortcuts
    this.setupKeyboardShortcuts();
  }

  private setupKeyboardShortcuts(): void {
    window.addEventListener('keydown', (event) => {
      // Ignore if user is typing in an input field
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (event.code) {
        case 'Space':
          event.preventDefault();
          this.callbacks.onTick(1); // End Turn
          break;
        case 'KeyD':
          event.preventDefault();
          this.callbacks.onTick(4); // +Day
          break;
        case 'KeyW':
          event.preventDefault();
          this.callbacks.onTick(28); // +Week
          break;
        case 'KeyM':
          event.preventDefault();
          this.callbacks.onTick(112); // +Month
          break;
        case 'KeyY':
          event.preventDefault();
          this.callbacks.onTick(1344); // +Year
          break;
      }
    });
  }

  /**
   * Update UI with current simulation state
   */
  update(state: SimulationState): void {
    this.headerPanel.updateTime(state.time);
    this.controlsPanel.updatePhase(state.time);
    this.mainPanel.update(state);
    this.logPanel.update();
  }

  private onEntityTypeSelect(type: EntityType): void {
    this._currentEntityType = type;
    this.mainPanel.setEntityType(type);
  }

  /**
   * Navigate to an entity from the log
   */
  private navigateToEntity(entityId: string, entityType: EntityType): void {
    // Switch to the entity type if needed
    if (this._currentEntityType !== entityType) {
      this._currentEntityType = entityType;
      this.navPanel.setSelected(entityType);
      this.mainPanel.setEntityType(entityType);
    }

    // Select the entity in the main panel
    this.mainPanel.selectEntity(entityId);
  }

  private onResize(): void {
    this.layout();
  }

  private layout(): void {
    const width = this.app.screen.width;
    const height = this.app.screen.height;

    // Header at top
    this.headerPanel.resize(width, SPACING.headerHeight);
    this.headerPanel.x = 0;
    this.headerPanel.y = 0;

    // Controls at bottom
    this.controlsPanel.resize(width, SPACING.controlsHeight);
    this.controlsPanel.x = 0;
    this.controlsPanel.y = height - SPACING.controlsHeight;

    // Log above controls
    this.logPanel.resize(width, SPACING.logHeight);
    this.logPanel.x = 0;
    this.logPanel.y = height - SPACING.controlsHeight - SPACING.logHeight;

    // Middle section height
    const middleHeight = height - SPACING.headerHeight - SPACING.logHeight - SPACING.controlsHeight;
    const middleTop = SPACING.headerHeight;

    // Nav on left
    this.navPanel.resize(SPACING.navWidth, middleHeight);
    this.navPanel.x = 0;
    this.navPanel.y = middleTop;

    // Main panel fills remaining space
    const mainWidth = width - SPACING.navWidth;
    this.mainPanel.resize(mainWidth, middleHeight);
    this.mainPanel.x = SPACING.navWidth;
    this.mainPanel.y = middleTop;
  }
}
