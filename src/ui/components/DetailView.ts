/**
 * DetailView - Key-value display for entity details
 * Shows detailed information about a selected entity
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { UIComponent } from './UIComponent';
import { COLORS, SPACING, FONTS } from '../UITheme';
import { ActivityLogSection } from './ActivityLogSection';

export interface DetailField {
  key: string;
  label: string;
  render?: (item: unknown) => string;
}

export interface DetailSection {
  title: string;
  fields: DetailField[];
}

interface FieldRow {
  label: Text;
  value: Text;
}

export class DetailView extends UIComponent {
  private sections: DetailSection[];
  private titleText: Text;
  private fieldRows: FieldRow[] = [];
  private contentContainer: Container;
  private contentMask: Graphics;
  private scrollOffset = 0;
  private contentHeight = 0;
  private activityLogSection: ActivityLogSection;
  private showActivityLog: boolean;
  private readonly LOG_HEIGHT = 180;

  constructor(width: number, height: number, sections: DetailSection[], showActivityLog = true) {
    super(width, height);
    this.sections = sections;
    this.showActivityLog = showActivityLog;

    // Title
    const titleStyle = new TextStyle({
      fontFamily: FONTS.family,
      fontSize: FONTS.heading,
      fill: COLORS.text,
      fontWeight: 'bold',
    });
    this.titleText = new Text({ text: 'Select an entity', style: titleStyle });
    this.titleText.x = SPACING.md;
    this.titleText.y = SPACING.md;
    this.addChild(this.titleText);

    // Content container for scrolling
    this.contentContainer = new Container();
    this.contentContainer.y = SPACING.md + FONTS.heading + SPACING.md;
    this.addChild(this.contentContainer);

    // Create mask to clip content above activity log
    this.contentMask = new Graphics();
    this.addChild(this.contentMask);
    this.contentContainer.mask = this.contentMask;

    // Activity log section at the bottom
    this.activityLogSection = new ActivityLogSection(width - SPACING.md * 2, this.LOG_HEIGHT);
    this.activityLogSection.x = SPACING.md;
    this.activityLogSection.visible = showActivityLog;
    this.addChild(this.activityLogSection);

    // Scroll interaction
    this.eventMode = 'static';
    this.on('wheel', this.onWheel, this);

    this.layout();
  }

  /**
   * Update the detail view with entity data
   * @param title - Display title
   * @param data - Entity data object
   * @param entityId - Optional entity ID for activity log filtering
   */
  setData(title: string, data: unknown, entityId?: string): void {
    this.titleText.text = title;
    this.rebuildFields(data);

    // Update activity log section
    if (this.showActivityLog && entityId) {
      this.activityLogSection.setEntityId(entityId);
      this.activityLogSection.visible = true;
    } else {
      this.activityLogSection.visible = false;
    }
  }

  /**
   * Clear the detail view
   */
  clear(): void {
    this.titleText.text = 'Select an entity';
    this.contentContainer.removeChildren();
    this.fieldRows = [];
    this.activityLogSection.clear();
    this.activityLogSection.visible = false;
  }

  private rebuildFields(data: unknown): void {
    this.contentContainer.removeChildren();
    this.fieldRows = [];

    const labelStyle = new TextStyle({
      fontFamily: FONTS.family,
      fontSize: FONTS.small,
      fill: COLORS.textDim,
    });

    const valueStyle = new TextStyle({
      fontFamily: FONTS.family,
      fontSize: FONTS.small,
      fill: COLORS.textSecondary,
    });

    const sectionTitleStyle = new TextStyle({
      fontFamily: FONTS.family,
      fontSize: FONTS.body,
      fill: COLORS.text,
      fontWeight: 'bold',
    });

    let yOffset = 0;
    const labelWidth = 100;
    const valueX = labelWidth + SPACING.md;

    for (const section of this.sections) {
      // Section title
      const sectionTitle = new Text({ text: section.title, style: sectionTitleStyle });
      sectionTitle.x = 0;
      sectionTitle.y = yOffset;
      this.contentContainer.addChild(sectionTitle);
      yOffset += FONTS.body + SPACING.sm;

      // Section divider
      const divider = new Graphics();
      divider.moveTo(0, yOffset);
      divider.lineTo(this._width - SPACING.md * 2, yOffset);
      divider.stroke({ width: 1, color: COLORS.borderDim, alpha: 0.5 });
      this.contentContainer.addChild(divider);
      yOffset += SPACING.sm;

      // Fields
      for (const field of section.fields) {
        const label = new Text({ text: field.label + ':', style: labelStyle });
        label.x = SPACING.sm;
        label.y = yOffset;

        const valueText = this.getFieldValue(data, field);
        const value = new Text({ text: valueText, style: valueStyle });
        value.x = valueX;
        value.y = yOffset;

        // Truncate long values
        const maxValueWidth = this._width - valueX - SPACING.md * 2;
        if (value.width > maxValueWidth) {
          while (value.width > maxValueWidth && value.text.length > 3) {
            value.text = value.text.slice(0, -4) + '...';
          }
        }

        this.contentContainer.addChild(label);
        this.contentContainer.addChild(value);
        this.fieldRows.push({ label, value });

        yOffset += FONTS.small + SPACING.xs;
      }

      yOffset += SPACING.md; // Space between sections
    }

    this.contentHeight = yOffset;
    this.scrollOffset = 0;
    this.updateScroll();
  }

  private getFieldValue(data: unknown, field: DetailField): string {
    if (field.render) {
      return field.render(data);
    }

    // Get nested value by key path
    const value = field.key.split('.').reduce((acc: unknown, part) => {
      if (acc && typeof acc === 'object' && part in acc) {
        return (acc as Record<string, unknown>)[part];
      }
      return undefined;
    }, data);

    if (value === undefined || value === null) return '-';
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  private onWheel(event: WheelEvent): void {
    const topOffset = SPACING.md + FONTS.heading + SPACING.md;
    const logSpace = this.showActivityLog ? this.LOG_HEIGHT + SPACING.md : 0;
    const viewHeight = this._height - topOffset - logSpace;
    const maxScroll = Math.max(0, this.contentHeight - viewHeight);

    this.scrollOffset += event.deltaY * 0.5;
    this.scrollOffset = Math.max(0, Math.min(maxScroll, this.scrollOffset));
    this.updateScroll();
  }

  private updateScroll(): void {
    const topOffset = SPACING.md + FONTS.heading + SPACING.md;
    this.contentContainer.y = topOffset - this.scrollOffset;
  }

  protected layout(): void {
    this.fillBackground(COLORS.panel);
    this.drawBorder(this.background, COLORS.border);

    const topOffset = SPACING.md + FONTS.heading + SPACING.md;
    const logSpace = this.showActivityLog ? this.LOG_HEIGHT + SPACING.md : 0;
    const contentAreaHeight = this._height - topOffset - logSpace;

    // Update mask to clip content area
    this.contentMask.clear();
    this.contentMask.rect(0, topOffset, this._width, contentAreaHeight);
    this.contentMask.fill({ color: 0xffffff });

    // Position activity log at bottom
    if (this.showActivityLog) {
      this.activityLogSection.y = this._height - this.LOG_HEIGHT - SPACING.md;
      this.activityLogSection.resize(this._width - SPACING.md * 2, this.LOG_HEIGHT);
    }
  }
}
