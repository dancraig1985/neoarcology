/**
 * NavPanel - Entity type navigation sidebar
 */

import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { COLORS, SPACING } from '../UITheme';

export type EntityType = 'agents' | 'orgs' | 'locations' | 'map' | 'reports';

export interface NavPanelCallbacks {
  onSelect: (entityType: EntityType) => void;
}

export class NavPanel extends Panel {
  private buttons: Map<EntityType, Button> = new Map();
  private selectedType: EntityType = 'agents';

  constructor(width: number, height: number, callbacks: NavPanelCallbacks) {
    super(width, height, {
      title: 'ENTITIES',
      showHeader: true,
      backgroundColor: COLORS.panel,
      borderColor: COLORS.border,
      showBorder: true,
      showCornerAccents: true,
      padding: SPACING.sm,
    });

    const entityTypes: { type: EntityType; label: string }[] = [
      { type: 'agents', label: 'Agents' },
      { type: 'orgs', label: 'Organizations' },
      { type: 'locations', label: 'Locations' },
      { type: 'map', label: 'City Map' },
      { type: 'reports', label: 'Reports' },
    ];

    const content = this.getContent();
    const buttonWidth = this.getContentWidth();
    let yOffset = 0;

    for (const { type, label } of entityTypes) {
      const button = new Button({
        label,
        width: buttonWidth,
        height: SPACING.buttonHeight,
        onClick: () => {
          this.setSelected(type);
          callbacks.onSelect(type);
        },
      });
      button.y = yOffset;
      content.addChild(button);
      this.buttons.set(type, button);
      yOffset += SPACING.buttonHeight + SPACING.xs;
    }

    // Highlight initial selection
    this.setSelected('agents');
  }

  /**
   * Set the selected entity type
   */
  setSelected(type: EntityType): void {
    this.selectedType = type;
    // Update button styles to show selection
    // For now just update visually by setting different border colors
    for (const [buttonType, _button] of this.buttons) {
      if (buttonType === type) {
        // Selected - brighter appearance
        // Button doesn't support dynamic color change yet, but this sets up the pattern
      }
    }
  }

  /**
   * Get currently selected entity type
   */
  getSelected(): EntityType {
    return this.selectedType;
  }
}
