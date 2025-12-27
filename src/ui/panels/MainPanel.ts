/**
 * MainPanel - Main content area for entity lists and details
 * Initially a placeholder, will add Table and DetailView later
 */

import { Text, TextStyle } from 'pixi.js';
import { Panel } from '../components/Panel';
import { COLORS, SPACING, FONTS } from '../UITheme';
import type { EntityType } from './NavPanel';
import type { SimulationState } from '../../simulation/Simulation';

export class MainPanel extends Panel {
  private placeholderText: Text;
  private currentEntityType: EntityType = 'agents';

  constructor(width: number, height: number) {
    super(width, height, {
      backgroundColor: COLORS.panel,
      borderColor: COLORS.border,
      showBorder: true,
      padding: SPACING.md,
    });

    // Placeholder text until Table is implemented
    const textStyle = new TextStyle({
      fontFamily: FONTS.family,
      fontSize: FONTS.body,
      fill: COLORS.textDim,
    });
    this.placeholderText = new Text({ text: 'Select an entity type from the left panel', style: textStyle });
    this.getContent().addChild(this.placeholderText);

    this.layout();
  }

  /**
   * Set which entity type to display
   */
  setEntityType(type: EntityType): void {
    this.currentEntityType = type;
    this.updatePlaceholder();
  }

  /**
   * Update with simulation state
   */
  update(state: SimulationState): void {
    this.updatePlaceholder(state);
  }

  private updatePlaceholder(state?: SimulationState): void {
    let countText = '';
    if (state) {
      switch (this.currentEntityType) {
        case 'agents':
          const living = state.agents.filter(a => a.status !== 'dead').length;
          const dead = state.agents.filter(a => a.status === 'dead').length;
          countText = ` (${living} alive, ${dead} dead)`;
          break;
        case 'orgs':
          countText = ` (${state.organizations.length} total)`;
          break;
        case 'locations':
          countText = ` (${state.locations.length} total)`;
          break;
      }
    }

    const typeLabels: Record<EntityType, string> = {
      agents: 'AGENTS',
      orgs: 'ORGANIZATIONS',
      locations: 'LOCATIONS',
    };

    this.placeholderText.text = `${typeLabels[this.currentEntityType]}${countText}\n\n[Table view coming soon...]`;
  }

  protected layout(): void {
    super.layout();
    // Center placeholder text
    if (this.placeholderText) {
      this.placeholderText.x = SPACING.sm;
      this.placeholderText.y = SPACING.sm;
    }
  }
}
