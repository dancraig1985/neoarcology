/**
 * HeaderPanel - Title bar with time display
 */

import { Text, TextStyle } from 'pixi.js';
import { Panel } from '../components/Panel';
import { COLORS, SPACING, FONTS } from '../UITheme';
import type { TimeState } from '../../simulation/TickEngine';

export class HeaderPanel extends Panel {
  private titleText: Text;
  private timeText: Text;

  constructor(width: number) {
    super(width, SPACING.headerHeight, {
      backgroundColor: COLORS.panelHeader,
      borderColor: COLORS.border,
      showBorder: true,
      padding: SPACING.md,
    });

    // Title on the left
    const titleStyle = new TextStyle({
      fontFamily: FONTS.family,
      fontSize: FONTS.heading,
      fill: COLORS.text,
      fontWeight: 'bold',
    });
    this.titleText = new Text({ text: 'NEOARCOLOGY OBSERVER', style: titleStyle });
    this.titleText.x = SPACING.md;
    this.titleText.y = (SPACING.headerHeight - this.titleText.height) / 2;
    this.addChild(this.titleText);

    // Time display on the right
    const timeStyle = new TextStyle({
      fontFamily: FONTS.family,
      fontSize: FONTS.body,
      fill: COLORS.textSecondary,
    });
    this.timeText = new Text({ text: 'Phase: 0 | Day 1 | Week 1', style: timeStyle });
    this.addChild(this.timeText);

    this.layout();
  }

  /**
   * Update the time display
   */
  updateTime(time: TimeState): void {
    this.timeText.text = `Phase: ${time.currentPhase} | Day ${time.day} | Week ${time.week}`;
    this.positionTimeText();
  }

  private positionTimeText(): void {
    if (!this.timeText) return; // Guard against being called before init
    this.timeText.x = this._width - this.timeText.width - SPACING.md;
    this.timeText.y = (SPACING.headerHeight - this.timeText.height) / 2;
  }

  protected layout(): void {
    super.layout();
    this.positionTimeText();
  }
}
