/**
 * ActivityLogSection - Embedded activity log for detail panels
 * Shows recent activity log entries for a specific entity
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { UIComponent } from './UIComponent';
import { COLORS, SPACING, FONTS, CATEGORY_ICONS } from '../UITheme';
import { ActivityLog, type LogEntry } from '../../simulation/ActivityLog';

const MAX_ENTRIES = 15;
const MIN_ENTRY_HEIGHT = 18;
const LINE_HEIGHT = 14;

export class ActivityLogSection extends UIComponent {
  private entries: LogEntry[] = [];
  private contentContainer: Container;
  private scrollOffset = 0;
  private titleText: Text;
  private entityId: string | null = null;
  private totalContentHeight = 0;

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
    this.totalContentHeight = 0;

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

    const phaseStyle = new TextStyle({
      fontFamily: FONTS.family,
      fontSize: 11,
      fill: COLORS.textDim,
    });

    let yOffset = 0;
    const msgStartX = 60;
    const maxMsgWidth = this._width - msgStartX - SPACING.sm;

    for (const entry of this.entries) {
      // Phase number
      const phaseText = new Text({ text: `[${entry.phase}]`, style: phaseStyle });
      phaseText.x = 0;
      phaseText.y = yOffset;
      this.contentContainer.addChild(phaseText);

      // Category icon
      const iconStyle = new TextStyle({
        fontFamily: FONTS.family,
        fontSize: 11,
        fill: COLORS.textSecondary,
      });
      const icon = CATEGORY_ICONS[entry.category] ?? '•';
      const iconText = new Text({ text: icon, style: iconStyle });
      iconText.x = 45;
      iconText.y = yOffset;
      this.contentContainer.addChild(iconText);

      // Message with word wrap
      const msgStyle = new TextStyle({
        fontFamily: FONTS.family,
        fontSize: 11,
        fill: this.getEntryColor(entry),
        wordWrap: true,
        wordWrapWidth: maxMsgWidth,
        lineHeight: LINE_HEIGHT,
      });
      const msgText = new Text({ text: entry.message, style: msgStyle });
      msgText.x = msgStartX;
      msgText.y = yOffset;
      this.contentContainer.addChild(msgText);

      // Calculate entry height based on wrapped text
      const entryHeight = Math.max(MIN_ENTRY_HEIGHT, msgText.height + 4);
      yOffset += entryHeight;
    }

    this.totalContentHeight = yOffset;
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
    // Stop propagation to prevent parent DetailView from also scrolling
    event.stopPropagation();

    const viewHeight = this._height - FONTS.body - SPACING.md;
    const maxScroll = Math.max(0, this.totalContentHeight - viewHeight);

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
