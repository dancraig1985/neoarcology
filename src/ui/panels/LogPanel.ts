/**
 * LogPanel - Activity log display with virtual scrolling
 * Shows simulation events with color-coding and filtering
 * Uses virtual scrolling to handle large numbers of entries efficiently
 */

import { Text, TextStyle, Container, Graphics } from 'pixi.js';
import { Panel } from '../components/Panel';
import { COLORS, SPACING, FONTS, LOG_LEVEL_COLORS, CATEGORY_ICONS } from '../UITheme';
import { ActivityLog, type LogEntry } from '../../simulation/ActivityLog';

// Virtual scrolling: render buffer around visible area
const RENDER_BUFFER = 10; // Extra entries above/below visible area
const LINE_HEIGHT = FONTS.small + 4;
const FILTER_BAR_HEIGHT = 24;

// Available filter categories
const FILTER_CATEGORIES = [
  'all',
  'commerce',
  'production',
  'employment',
  'travel',
  'leisure',
  'hunger',
  'death',
  'spawn',
] as const;

type FilterCategory = (typeof FILTER_CATEGORIES)[number];

export interface LogPanelEvents {
  onEntityClick?: (entityId: string, entityType: 'agents' | 'orgs' | 'locations') => void;
}

export class LogPanel extends Panel {
  private logContainer: Container;
  private scrollOffset = 0;
  private maskGraphics: Graphics;
  private filterButtons: Container;
  private activeFilter: FilterCategory = 'all';
  private entityFilter?: string; // Filter by specific entity ID
  private onEntityClick?: LogPanelEvents['onEntityClick'];

  // Virtual scrolling state
  private allEntries: LogEntry[] = [];
  private renderedRange = { start: 0, end: 0 };

  constructor(width: number, height: number, events?: LogPanelEvents) {
    super(width, height, {
      title: 'ACTIVITY LOG',
      showHeader: true,
      headerHeight: 28,
      backgroundColor: COLORS.panel,
      borderColor: COLORS.border,
      showBorder: true,
      showCornerAccents: true,
      padding: SPACING.sm,
    });

    this.onEntityClick = events?.onEntityClick;

    // Create filter buttons
    this.filterButtons = new Container();
    this.filterButtons.y = 28; // Below header
    this.addChild(this.filterButtons);
    this.createFilterButtons();

    // Create mask for clipping
    this.maskGraphics = new Graphics();
    this.addChild(this.maskGraphics);

    // Create log container
    this.logContainer = new Container();
    this.logContainer.mask = this.maskGraphics;
    this.getContent().addChild(this.logContainer);

    // Set up scroll interaction
    this.eventMode = 'static';
    this.on('wheel', this.onWheel, this);

    this.layout();
  }

  private createFilterButtons(): void {
    const buttonStyle = new TextStyle({
      fontFamily: FONTS.family,
      fontSize: FONTS.small - 1,
      fill: COLORS.textDim,
    });

    const activeStyle = new TextStyle({
      fontFamily: FONTS.family,
      fontSize: FONTS.small - 1,
      fill: COLORS.text,
    });

    let xOffset = SPACING.sm;
    for (const category of FILTER_CATEGORIES) {
      const button = new Container();
      button.x = xOffset;
      button.y = SPACING.xs;

      const label = category === 'all' ? 'ALL' : category.toUpperCase().slice(0, 4);
      const text = new Text({
        text: `[${label}]`,
        style: category === this.activeFilter ? activeStyle : buttonStyle,
      });
      button.addChild(text);

      // Make clickable
      button.eventMode = 'static';
      button.cursor = 'pointer';
      button.on('pointerdown', () => this.setFilter(category));

      this.filterButtons.addChild(button);
      xOffset += text.width + SPACING.sm;
    }
  }

  private updateFilterButtons(): void {
    this.filterButtons.removeChildren();
    this.createFilterButtons();
  }

  /**
   * Set the category filter
   */
  setFilter(category: FilterCategory): void {
    this.activeFilter = category;
    this.entityFilter = undefined; // Clear entity filter
    this.updateFilterButtons();
    this.update();
  }

  /**
   * Filter to show only entries for a specific entity
   */
  setEntityFilter(entityId: string): void {
    this.entityFilter = entityId;
    this.activeFilter = 'all';
    this.updateFilterButtons();
    this.update();
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this.activeFilter = 'all';
    this.entityFilter = undefined;
    this.updateFilterButtons();
    this.update();
  }

  /**
   * Update log display with latest entries
   */
  update(): void {
    let entries = ActivityLog.getEntries();

    // Apply entity filter
    if (this.entityFilter) {
      entries = entries.filter((e) => e.entityId === this.entityFilter);
    }

    // Apply category filter
    if (this.activeFilter !== 'all') {
      entries = entries.filter((e) => this.matchesCategory(e.category));
    }

    // Store all entries for virtual scrolling
    this.allEntries = entries;

    // Auto-scroll to bottom (most recent)
    this.scrollToBottom();

    // Render visible entries
    this.renderVisibleEntries();
  }

  /**
   * Check if a category matches the active filter
   */
  private matchesCategory(category: string): boolean {
    switch (this.activeFilter) {
      case 'commerce':
        return ['commerce', 'purchase', 'sale', 'transaction', 'wholesale', 'restock'].includes(
          category
        );
      case 'production':
        return ['production', 'procurement', 'expansion'].includes(category);
      case 'employment':
        return ['employment', 'hire', 'fire', 'salary', 'payroll', 'business', 'dividend'].includes(
          category
        );
      case 'travel':
        return ['travel'].includes(category);
      case 'leisure':
        return ['leisure'].includes(category);
      case 'hunger':
        return ['hunger'].includes(category);
      case 'death':
        return ['death', 'dissolution'].includes(category);
      case 'spawn':
        return ['spawn'].includes(category);
      default:
        return true;
    }
  }

  /**
   * Calculate which entries are visible and render only those
   */
  private renderVisibleEntries(): void {
    const viewHeight = this.getContentHeight() - FILTER_BAR_HEIGHT;
    const totalEntries = this.allEntries.length;

    // Calculate visible range based on scroll offset
    const firstVisible = Math.floor(this.scrollOffset / LINE_HEIGHT);
    const visibleCount = Math.ceil(viewHeight / LINE_HEIGHT);

    // Add buffer for smoother scrolling
    const start = Math.max(0, firstVisible - RENDER_BUFFER);
    const end = Math.min(totalEntries, firstVisible + visibleCount + RENDER_BUFFER);

    // Check if we need to re-render (range changed significantly)
    if (start === this.renderedRange.start && end === this.renderedRange.end) {
      // Just update position
      this.logContainer.y = FILTER_BAR_HEIGHT - this.scrollOffset + (start * LINE_HEIGHT);
      return;
    }

    // Re-render the visible range
    this.logContainer.removeChildren();
    this.renderedRange = { start, end };

    let yOffset = 0;
    for (let i = start; i < end; i++) {
      const entry = this.allEntries[i];
      if (!entry) continue;

      const rowContainer = this.createEntryRow(entry);
      rowContainer.y = yOffset;
      this.logContainer.addChild(rowContainer);
      yOffset += LINE_HEIGHT;
    }

    // Position container to account for virtual scrolling offset
    this.logContainer.y = FILTER_BAR_HEIGHT - this.scrollOffset + (start * LINE_HEIGHT);
  }

  /**
   * Create a single log entry row
   */
  private createEntryRow(entry: LogEntry): Container {
    const color = LOG_LEVEL_COLORS[entry.level] ?? COLORS.textSecondary;
    const icon = CATEGORY_ICONS[entry.category] ?? '>';

    const rowContainer = new Container();

    const textStyle = new TextStyle({
      fontFamily: FONTS.family,
      fontSize: FONTS.small,
      fill: color,
    });

    // Phase and icon prefix
    const prefix = new Text({
      text: `[${entry.phase}] ${icon} `,
      style: textStyle,
    });
    rowContainer.addChild(prefix);

    let xOffset = prefix.width;

    // Clickable entity name (if present)
    if (entry.entityName && entry.entityId) {
      const entityStyle = new TextStyle({
        fontFamily: FONTS.family,
        fontSize: FONTS.small,
        fill: COLORS.accentAlt, // Cyan for clickable
      });

      const entityText = new Text({
        text: `[${entry.entityName}]`,
        style: entityStyle,
      });
      entityText.x = xOffset;
      entityText.eventMode = 'static';
      entityText.cursor = 'pointer';

      // Click to filter or navigate
      const entityId = entry.entityId;
      entityText.on('pointerdown', () => {
        if (this.onEntityClick) {
          // Determine entity type from ID prefix or category
          const entityType = this.guessEntityType(entry);
          this.onEntityClick(entityId, entityType);
        } else {
          // Default: filter log to this entity
          this.setEntityFilter(entityId);
        }
      });

      // Hover effect
      entityText.on('pointerover', () => {
        entityText.style.fill = COLORS.text;
      });
      entityText.on('pointerout', () => {
        entityText.style.fill = COLORS.accentAlt;
      });

      rowContainer.addChild(entityText);
      xOffset += entityText.width + 4;
    }

    // Message text
    const messageText = new Text({
      text: entry.message,
      style: textStyle,
    });
    messageText.x = xOffset;

    // Truncate if too wide
    const maxWidth = this.getContentWidth() - xOffset - SPACING.md;
    if (messageText.width > maxWidth) {
      while (messageText.width > maxWidth && messageText.text.length > 3) {
        messageText.text = messageText.text.slice(0, -4) + '...';
      }
    }

    rowContainer.addChild(messageText);
    return rowContainer;
  }

  /**
   * Guess entity type based on log entry context
   */
  private guessEntityType(
    entry: LogEntry
  ): 'agents' | 'orgs' | 'locations' {
    // Categories that typically involve agents
    if (['hunger', 'death', 'purchase', 'spawn', 'travel'].includes(entry.category)) {
      return 'agents';
    }
    // Categories that typically involve orgs
    if (['dissolution', 'dividend', 'payroll', 'procurement', 'expansion'].includes(entry.category)) {
      return 'orgs';
    }
    // Categories that typically involve locations
    if (['production', 'restock', 'hire', 'fire'].includes(entry.category)) {
      return 'locations';
    }
    // Default to agents
    return 'agents';
  }

  private scrollToBottom(): void {
    const viewHeight = this.getContentHeight() - FILTER_BAR_HEIGHT;
    const totalHeight = this.allEntries.length * LINE_HEIGHT;

    if (totalHeight > viewHeight) {
      this.scrollOffset = totalHeight - viewHeight;
    } else {
      this.scrollOffset = 0;
    }
  }

  private onWheel(event: WheelEvent): void {
    const viewHeight = this.getContentHeight() - FILTER_BAR_HEIGHT;
    const totalHeight = this.allEntries.length * LINE_HEIGHT;
    const maxScroll = Math.max(0, totalHeight - viewHeight);

    const oldOffset = this.scrollOffset;
    this.scrollOffset += event.deltaY * 0.5;
    this.scrollOffset = Math.max(0, Math.min(maxScroll, this.scrollOffset));

    // Only re-render if scroll changed
    if (this.scrollOffset !== oldOffset) {
      this.renderVisibleEntries();
    }
  }

  protected layout(): void {
    super.layout();

    // Update mask (guard against being called before init)
    if (!this.maskGraphics) return;
    const headerHeight = 28;
    this.maskGraphics.clear();
    this.maskGraphics.rect(
      SPACING.sm,
      headerHeight + FILTER_BAR_HEIGHT + SPACING.sm,
      this.getContentWidth(),
      this.getContentHeight() - FILTER_BAR_HEIGHT
    );
    this.maskGraphics.fill({ color: 0xffffff });
  }
}
