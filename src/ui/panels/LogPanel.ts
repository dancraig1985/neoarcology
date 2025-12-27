/**
 * LogPanel - Activity log display
 * Shows recent simulation events with color-coding
 */

import { Text, TextStyle, Container, Graphics } from 'pixi.js';
import { Panel } from '../components/Panel';
import { COLORS, SPACING, FONTS, LOG_LEVEL_COLORS, CATEGORY_ICONS } from '../UITheme';
import { ActivityLog, type LogEntry } from '../../simulation/ActivityLog';

const MAX_VISIBLE_ENTRIES = 50;

export class LogPanel extends Panel {
  private logContainer: Container;
  private logEntries: Text[] = [];
  private scrollOffset = 0;
  private maskGraphics: Graphics;

  constructor(width: number, height: number) {
    super(width, height, {
      title: 'ACTIVITY LOG',
      showHeader: true,
      headerHeight: 28,
      backgroundColor: COLORS.panel,
      borderColor: COLORS.border,
      showBorder: true,
      padding: SPACING.sm,
    });

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

  /**
   * Update log display with latest entries
   */
  update(): void {
    const entries = ActivityLog.getEntries().slice(-MAX_VISIBLE_ENTRIES);
    this.renderEntries(entries);
  }

  private renderEntries(entries: LogEntry[]): void {
    // Clear existing entries
    this.logContainer.removeChildren();
    this.logEntries = [];

    let yOffset = 0;
    const lineHeight = FONTS.small + 4;

    for (const entry of entries) {
      const color = LOG_LEVEL_COLORS[entry.level] ?? COLORS.textSecondary;
      const icon = CATEGORY_ICONS[entry.category] ?? '>';

      const textStyle = new TextStyle({
        fontFamily: FONTS.family,
        fontSize: FONTS.small,
        fill: color,
        wordWrap: true,
        wordWrapWidth: this.getContentWidth() - SPACING.sm,
      });

      // Format: [phase] icon [EntityName] message
      const entityPrefix = entry.entityName ? `[${entry.entityName}] ` : '';
      const text = new Text({
        text: `[${entry.phase}] ${icon} ${entityPrefix}${entry.message}`,
        style: textStyle,
      });
      text.y = yOffset;
      this.logContainer.addChild(text);
      this.logEntries.push(text);

      yOffset += lineHeight;
    }

    // Auto-scroll to bottom
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    const contentHeight = this.logEntries.length * (FONTS.small + 4);
    const viewHeight = this.getContentHeight();

    if (contentHeight > viewHeight) {
      this.scrollOffset = contentHeight - viewHeight;
      this.logContainer.y = -this.scrollOffset;
    } else {
      this.scrollOffset = 0;
      this.logContainer.y = 0;
    }
  }

  private onWheel(event: WheelEvent): void {
    const contentHeight = this.logEntries.length * (FONTS.small + 4);
    const viewHeight = this.getContentHeight();
    const maxScroll = Math.max(0, contentHeight - viewHeight);

    this.scrollOffset += event.deltaY * 0.5;
    this.scrollOffset = Math.max(0, Math.min(maxScroll, this.scrollOffset));
    this.logContainer.y = -this.scrollOffset;
  }

  protected layout(): void {
    super.layout();

    // Update mask (guard against being called before init)
    if (!this.maskGraphics) return;
    const headerHeight = 28;
    this.maskGraphics.clear();
    this.maskGraphics.rect(
      SPACING.sm,
      headerHeight + SPACING.sm,
      this.getContentWidth(),
      this.getContentHeight()
    );
    this.maskGraphics.fill({ color: 0xffffff });
  }
}
