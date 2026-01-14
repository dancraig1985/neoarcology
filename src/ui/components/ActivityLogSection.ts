/**
 * ActivityLogSection - Embedded activity log for detail panels
 * Shows recent activity log entries for a specific entity
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { UIComponent } from './UIComponent';
import { COLORS, SPACING, FONTS, CATEGORY_ICONS } from '../UITheme';
import { ActivityLog, type LogEntry } from '../../simulation/ActivityLog';

const MAX_ENTRIES = 15;
const ENTRY_HEIGHT = 18;

export class ActivityLogSection extends UIComponent {
  private entries: LogEntry[] = [];
  private contentContainer: Container;
  private scrollOffset = 0;
  private titleText: Text;
  private entityId: string | null = null;

  constructor(width: number, height: number) {
    super(width, height);

    // Title
    const titleStyle = new TextStyle({
      fontFamily: FONTS.family,
      fontSize: FONTS.body,
      fill: COLORS.text,
      fontWeight: 'bold',
    });
    this.titleText = new Text({ text: 'Recent Activity', style: titleStyle });
    this.titleText.x = 0;
    this.titleText.y = 0;
    this.addChild(this.titleText);

    // Divider under title
    const divider = new Graphics();
    divider.moveTo(0, FONTS.body + SPACING.sm);
    divider.lineTo(width, FONTS.body + SPACING.sm);
    divider.stroke({ width: 1, color: COLORS.borderDim, alpha: 0.5 });
    this.addChild(divider);

    // Content container for entries
    this.contentContainer = new Container();
    this.contentContainer.y = FONTS.body + SPACING.sm + SPACING.xs;
    this.addChild(this.contentContainer);

    // Scroll interaction
    this.eventMode = 'static';
    this.on('wheel', this.onWheel, this);

    // Create mask for scrolling
    const mask = new Graphics();
    mask.rect(0, FONTS.body + SPACING.md, width, height - FONTS.body - SPACING.md);
    mask.fill({ color: 0xffffff });
    this.addChild(mask);
    this.contentContainer.mask = mask;

    this.layout();
  }

  /**
   * Set the entity to show activity for
   */
  setEntityId(entityId: string | null): void {
    this.entityId = entityId;
    this.refresh();
  }

  /**
   * Refresh the log entries from ActivityLog
   */
  refresh(): void {
    if (!this.entityId) {
      this.entries = [];
    } else {
      const allEntries = ActivityLog.getEntriesForEntity(this.entityId);
      // Get last MAX_ENTRIES, reversed so most recent is at top
      this.entries = allEntries.slice(-MAX_ENTRIES).reverse();
    }
    this.rebuildEntries();
  }

  /**
   * Clear the section
   */
  clear(): void {
    this.entityId = null;
    this.entries = [];
    this.contentContainer.removeChildren();
  }

  private rebuildEntries(): void {
    this.contentContainer.removeChildren();

    if (this.entries.length === 0) {
      const emptyStyle = new TextStyle({
        fontFamily: FONTS.family,
        fontSize: FONTS.small,
        fill: COLORS.textDim,
        fontStyle: 'italic',
      });
      const emptyText = new Text({ text: 'No activity yet', style: emptyStyle });
      emptyText.x = SPACING.sm;
      emptyText.y = 0;
      this.contentContainer.addChild(emptyText);
      return;
    }

    const entryStyle = new TextStyle({
      fontFamily: FONTS.family,
      fontSize: 11,
      fill: COLORS.textSecondary,
    });

    const phaseStyle = new TextStyle({
      fontFamily: FONTS.family,
      fontSize: 11,
      fill: COLORS.textDim,
    });

    let yOffset = 0;

    for (const entry of this.entries) {
      // Phase number
      const phaseText = new Text({ text: `[${entry.phase}]`, style: phaseStyle });
      phaseText.x = 0;
      phaseText.y = yOffset;
      this.contentContainer.addChild(phaseText);

      // Category icon
      const icon = CATEGORY_ICONS[entry.category] ?? '•';
      const iconText = new Text({ text: icon, style: entryStyle });
      iconText.x = 45;
      iconText.y = yOffset;
      this.contentContainer.addChild(iconText);

      // Message (truncated)
      const msgStyle = new TextStyle({
        ...entryStyle,
        fill: this.getEntryColor(entry),
      });
      const msgText = new Text({ text: entry.message, style: msgStyle });
      msgText.x = 60;
      msgText.y = yOffset;

      // Truncate if needed
      const maxWidth = this._width - 70;
      if (msgText.width > maxWidth) {
        while (msgText.width > maxWidth && msgText.text.length > 3) {
          msgText.text = msgText.text.slice(0, -4) + '...';
        }
      }
      this.contentContainer.addChild(msgText);

      yOffset += ENTRY_HEIGHT;
    }

    this.scrollOffset = 0;
    this.updateScroll();
  }

  private getEntryColor(entry: LogEntry): number {
    switch (entry.level) {
      case 'critical':
        return COLORS.textCritical;
      case 'warning':
        return COLORS.textWarning;
      default:
        return COLORS.textSecondary;
    }
  }

  private onWheel(event: WheelEvent): void {
    const contentHeight = this.entries.length * ENTRY_HEIGHT;
    const viewHeight = this._height - FONTS.body - SPACING.md;
    const maxScroll = Math.max(0, contentHeight - viewHeight);

    this.scrollOffset += event.deltaY * 0.5;
    this.scrollOffset = Math.max(0, Math.min(maxScroll, this.scrollOffset));
    this.updateScroll();
  }

  private updateScroll(): void {
    this.contentContainer.y = FONTS.body + SPACING.sm + SPACING.xs - this.scrollOffset;
  }

  protected layout(): void {
    // Draw subtle background
    this.background.clear();
    this.background.rect(0, 0, this._width, this._height);
    this.background.fill({ color: COLORS.background, alpha: 0.5 });
  }
}
