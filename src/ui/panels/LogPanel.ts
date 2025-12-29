/**
 * LogPanel - Activity log display
 * Shows recent simulation events with color-coding and filtering
 */

import { Text, TextStyle, Container, Graphics } from 'pixi.js';
import { Panel } from '../components/Panel';
import { COLORS, SPACING, FONTS, LOG_LEVEL_COLORS, CATEGORY_ICONS } from '../UITheme';
import { ActivityLog, type LogEntry } from '../../simulation/ActivityLog';

const MAX_VISIBLE_ENTRIES = 50;

// Available filter categories
const FILTER_CATEGORIES = [
  'all',
  'commerce',
  'production',
  'employment',
  'travel',
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
  private logEntries: Container[] = [];
  private scrollOffset = 0;
  private maskGraphics: Graphics;
  private filterButtons: Container;
  private activeFilter: FilterCategory = 'all';
  private entityFilter?: string; // Filter by specific entity ID
  private onEntityClick?: LogPanelEvents['onEntityClick'];

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

    // Take last N entries
    entries = entries.slice(-MAX_VISIBLE_ENTRIES);
    this.renderEntries(entries);
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
        return ['production'].includes(category);
      case 'employment':
        return ['employment', 'hire', 'fire', 'salary', 'payroll', 'business', 'dividend'].includes(
          category
        );
      case 'travel':
        return ['travel'].includes(category);
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

  private renderEntries(entries: LogEntry[]): void {
    // Clear existing entries
    this.logContainer.removeChildren();
    this.logEntries = [];

    let yOffset = 0;
    const lineHeight = FONTS.small + 4;
    const filterBarHeight = 24; // Height of filter bar

    for (const entry of entries) {
      const color = LOG_LEVEL_COLORS[entry.level] ?? COLORS.textSecondary;
      const icon = CATEGORY_ICONS[entry.category] ?? '>';

      const rowContainer = new Container();
      rowContainer.y = yOffset;

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
      this.logContainer.addChild(rowContainer);
      this.logEntries.push(rowContainer);

      yOffset += lineHeight;
    }

    // Offset content below filter bar
    this.logContainer.y = filterBarHeight;

    // Auto-scroll to bottom
    this.scrollToBottom();
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
    if (['dissolution', 'dividend', 'payroll'].includes(entry.category)) {
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
    const filterBarHeight = 24;
    const contentHeight = this.logEntries.length * (FONTS.small + 4);
    const viewHeight = this.getContentHeight() - filterBarHeight;

    if (contentHeight > viewHeight) {
      this.scrollOffset = contentHeight - viewHeight;
      this.logContainer.y = filterBarHeight - this.scrollOffset;
    } else {
      this.scrollOffset = 0;
      this.logContainer.y = filterBarHeight;
    }
  }

  private onWheel(event: WheelEvent): void {
    const filterBarHeight = 24;
    const contentHeight = this.logEntries.length * (FONTS.small + 4);
    const viewHeight = this.getContentHeight() - filterBarHeight;
    const maxScroll = Math.max(0, contentHeight - viewHeight);

    this.scrollOffset += event.deltaY * 0.5;
    this.scrollOffset = Math.max(0, Math.min(maxScroll, this.scrollOffset));
    this.logContainer.y = filterBarHeight - this.scrollOffset;
  }

  protected layout(): void {
    super.layout();

    // Update mask (guard against being called before init)
    if (!this.maskGraphics) return;
    const headerHeight = 28;
    const filterBarHeight = 24;
    this.maskGraphics.clear();
    this.maskGraphics.rect(
      SPACING.sm,
      headerHeight + filterBarHeight + SPACING.sm,
      this.getContentWidth(),
      this.getContentHeight() - filterBarHeight
    );
    this.maskGraphics.fill({ color: 0xffffff });
  }
}
