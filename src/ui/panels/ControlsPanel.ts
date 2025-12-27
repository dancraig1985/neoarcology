/**
 * ControlsPanel - Turn advance buttons at the bottom
 */

import { Text, TextStyle } from 'pixi.js';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { COLORS, SPACING, FONTS } from '../UITheme';
import type { TimeState } from '../../simulation/TickEngine';

export interface ControlsPanelCallbacks {
  onEndTurn: () => void;
  onAdvanceDay: () => void;
  onAdvanceWeek: () => void;
  onAdvanceMonth: () => void;
  onAdvanceYear: () => void;
}

export class ControlsPanel extends Panel {
  private buttons: Button[] = [];
  private phaseText: Text;

  constructor(width: number, callbacks: ControlsPanelCallbacks) {
    super(width, SPACING.controlsHeight, {
      backgroundColor: COLORS.panelHeader,
      borderColor: COLORS.border,
      showBorder: true,
      padding: SPACING.sm,
    });

    const buttonConfigs = [
      { label: 'End Turn', onClick: callbacks.onEndTurn, width: 90 },
      { label: '+Day', onClick: callbacks.onAdvanceDay, width: 70 },
      { label: '+Week', onClick: callbacks.onAdvanceWeek, width: 70 },
      { label: '+Month', onClick: callbacks.onAdvanceMonth, width: 80 },
      { label: '+Year', onClick: callbacks.onAdvanceYear, width: 70 },
    ];

    let xOffset = SPACING.md;
    for (const config of buttonConfigs) {
      const button = new Button({
        label: config.label,
        width: config.width,
        height: SPACING.buttonHeight,
        onClick: config.onClick,
      });
      button.x = xOffset;
      button.y = (SPACING.controlsHeight - SPACING.buttonHeight) / 2;
      this.addChild(button);
      this.buttons.push(button);
      xOffset += config.width + SPACING.sm;
    }

    // Phase display on the right
    const phaseStyle = new TextStyle({
      fontFamily: FONTS.family,
      fontSize: FONTS.body,
      fill: COLORS.textSecondary,
    });
    this.phaseText = new Text({ text: 'Phase: 0', style: phaseStyle });
    this.addChild(this.phaseText);

    this.layout();
  }

  /**
   * Update the phase display
   */
  updatePhase(time: TimeState): void {
    this.phaseText.text = `Phase: ${time.currentPhase}`;
    this.positionPhaseText();
  }

  private positionPhaseText(): void {
    if (!this.phaseText) return; // Guard against being called before init
    this.phaseText.x = this._width - this.phaseText.width - SPACING.md;
    this.phaseText.y = (SPACING.controlsHeight - this.phaseText.height) / 2;
  }

  protected layout(): void {
    super.layout();
    this.positionPhaseText();
  }
}
