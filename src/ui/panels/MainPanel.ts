/**
 * MainPanel - Main content area for entity lists and details
 * Displays tables for Agents, Orgs, Locations based on selection
 */

import { Panel } from '../components/Panel';
import { Table } from '../components/Table';
import { COLORS } from '../UITheme';
import { AGENT_COLUMNS, ORG_COLUMNS, LOCATION_COLUMNS } from '../UIConfig';
import type { EntityType } from './NavPanel';
import type { SimulationState } from '../../simulation/Simulation';
import type { Agent, Organization, Location } from '../../types';

export class MainPanel extends Panel {
  private currentEntityType: EntityType = 'agents';
  private currentState: SimulationState | null = null;

  // Tables for each entity type
  private agentTable: Table<Agent>;
  private orgTable: Table<Organization>;
  private locationTable: Table<Location>;

  private selectedEntityId?: string;
  private onEntitySelect?: (entityType: EntityType, entityId: string) => void;

  constructor(width: number, height: number) {
    super(width, height, {
      backgroundColor: COLORS.panel,
      borderColor: COLORS.border,
      showBorder: true,
      padding: 0, // Tables handle their own padding
    });

    const tableWidth = this.getContentWidth();
    const tableHeight = this.getContentHeight();

    // Create tables
    this.agentTable = new Table<Agent>(tableWidth, tableHeight, {
      columns: AGENT_COLUMNS,
      onRowClick: (agent) => this.handleRowClick('agents', agent.id),
    });

    this.orgTable = new Table<Organization>(tableWidth, tableHeight, {
      columns: ORG_COLUMNS,
      onRowClick: (org) => this.handleRowClick('orgs', org.id),
    });

    this.locationTable = new Table<Location>(tableWidth, tableHeight, {
      columns: LOCATION_COLUMNS,
      onRowClick: (loc) => this.handleRowClick('locations', loc.id),
    });

    // Add agent table by default (visible)
    this.getContent().addChild(this.agentTable);

    this.layout();
  }

  /**
   * Set callback for entity selection
   */
  setOnEntitySelect(callback: (entityType: EntityType, entityId: string) => void): void {
    this.onEntitySelect = callback;
  }

  /**
   * Set which entity type to display
   */
  setEntityType(type: EntityType): void {
    if (type === this.currentEntityType) return;

    // Remove current table
    const content = this.getContent();
    content.removeChildren();

    // Add new table
    this.currentEntityType = type;
    const table = this.getCurrentTable();
    content.addChild(table);

    // Clear selection when switching types
    this.selectedEntityId = undefined;

    // Refresh data
    if (this.currentState) {
      this.updateTable();
    }
  }

  /**
   * Update with simulation state
   */
  update(state: SimulationState): void {
    this.currentState = state;
    this.updateTable();
  }

  /**
   * Get the currently selected entity ID
   */
  getSelectedEntityId(): string | undefined {
    return this.selectedEntityId;
  }

  private getCurrentTable(): Table<Agent> | Table<Organization> | Table<Location> {
    switch (this.currentEntityType) {
      case 'agents':
        return this.agentTable;
      case 'orgs':
        return this.orgTable;
      case 'locations':
        return this.locationTable;
    }
  }

  private updateTable(): void {
    if (!this.currentState) return;

    switch (this.currentEntityType) {
      case 'agents':
        // Sort: living first, then dead
        const sortedAgents = [...this.currentState.agents].sort((a, b) => {
          if (a.status === 'dead' && b.status !== 'dead') return 1;
          if (a.status !== 'dead' && b.status === 'dead') return -1;
          return 0;
        });
        this.agentTable.setData(sortedAgents);
        break;
      case 'orgs':
        this.orgTable.setData(this.currentState.organizations);
        break;
      case 'locations':
        this.locationTable.setData(this.currentState.locations);
        break;
    }
  }

  private handleRowClick(entityType: EntityType, entityId: string): void {
    this.selectedEntityId = entityId;

    if (this.onEntitySelect) {
      this.onEntitySelect(entityType, entityId);
    }
  }

  protected layout(): void {
    super.layout();

    // Resize tables
    const tableWidth = this._width;
    const tableHeight = this._height;

    this.agentTable?.resize(tableWidth, tableHeight);
    this.orgTable?.resize(tableWidth, tableHeight);
    this.locationTable?.resize(tableWidth, tableHeight);
  }
}
