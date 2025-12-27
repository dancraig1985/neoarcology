/**
 * MainPanel - Main content area for entity lists and details
 * Displays tables on the left, detail view on the right when an entity is selected
 */

import { Container, Graphics } from 'pixi.js';
import { Panel } from '../components/Panel';
import { Table } from '../components/Table';
import { DetailView } from '../components/DetailView';
import { COLORS } from '../UITheme';
import {
  AGENT_COLUMNS,
  ORG_COLUMNS,
  LOCATION_COLUMNS,
  AGENT_DETAILS,
  ORG_DETAILS,
  LOCATION_DETAILS,
} from '../UIConfig';
import type { EntityType } from './NavPanel';
import type { SimulationState } from '../../simulation/Simulation';
import type { Agent, Organization, Location } from '../../types';

const DETAIL_WIDTH = 280;

export class MainPanel extends Panel {
  private currentEntityType: EntityType = 'agents';
  private currentState: SimulationState | null = null;

  // Layout containers
  private tableContainer: Container;
  private detailContainer: Container;
  private divider: Graphics;

  // Tables for each entity type
  private agentTable: Table<Agent>;
  private orgTable: Table<Organization>;
  private locationTable: Table<Location>;

  // Detail views for each entity type
  private agentDetail: DetailView;
  private orgDetail: DetailView;
  private locationDetail: DetailView;

  private selectedEntityId?: string;

  constructor(width: number, height: number) {
    super(width, height, {
      backgroundColor: COLORS.panel,
      borderColor: COLORS.border,
      showBorder: true,
      padding: 0,
    });

    const tableWidth = width - DETAIL_WIDTH;
    const contentHeight = height;

    // Table container (left side)
    this.tableContainer = new Container();
    this.addChild(this.tableContainer);

    // Divider line
    this.divider = new Graphics();
    this.addChild(this.divider);

    // Detail container (right side)
    this.detailContainer = new Container();
    this.detailContainer.x = tableWidth;
    this.addChild(this.detailContainer);

    // Create tables
    this.agentTable = new Table<Agent>(tableWidth, contentHeight, {
      columns: AGENT_COLUMNS,
      onRowClick: (agent) => this.handleRowClick('agents', agent),
    });

    this.orgTable = new Table<Organization>(tableWidth, contentHeight, {
      columns: ORG_COLUMNS,
      onRowClick: (org) => this.handleRowClick('orgs', org),
    });

    this.locationTable = new Table<Location>(tableWidth, contentHeight, {
      columns: LOCATION_COLUMNS,
      onRowClick: (loc) => this.handleRowClick('locations', loc),
    });

    // Create detail views
    this.agentDetail = new DetailView(DETAIL_WIDTH, contentHeight, AGENT_DETAILS);
    this.orgDetail = new DetailView(DETAIL_WIDTH, contentHeight, ORG_DETAILS);
    this.locationDetail = new DetailView(DETAIL_WIDTH, contentHeight, LOCATION_DETAILS);

    // Add agent table and detail by default
    this.tableContainer.addChild(this.agentTable);
    this.detailContainer.addChild(this.agentDetail);

    this.layout();
  }

  /**
   * Set which entity type to display
   */
  setEntityType(type: EntityType): void {
    if (type === this.currentEntityType) return;

    // Remove current table and detail
    this.tableContainer.removeChildren();
    this.detailContainer.removeChildren();

    // Add new table and detail
    this.currentEntityType = type;
    this.tableContainer.addChild(this.getCurrentTable());
    this.detailContainer.addChild(this.getCurrentDetail());

    // Clear selection when switching types
    this.selectedEntityId = undefined;
    this.getCurrentDetail().clear();

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

    // Update detail view if something is selected
    if (this.selectedEntityId) {
      this.updateDetailView();
    }
  }

  /**
   * Get the currently selected entity ID
   */
  getSelectedEntityId(): string | undefined {
    return this.selectedEntityId;
  }

  /**
   * Select an entity by ID (navigates to it)
   */
  selectEntity(entityId: string): void {
    if (!this.currentState) return;

    this.selectedEntityId = entityId;
    this.getCurrentTable().setSelected(entityId);
    this.updateDetailView();
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

  private getCurrentDetail(): DetailView {
    switch (this.currentEntityType) {
      case 'agents':
        return this.agentDetail;
      case 'orgs':
        return this.orgDetail;
      case 'locations':
        return this.locationDetail;
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

  private updateDetailView(): void {
    if (!this.currentState || !this.selectedEntityId) return;

    switch (this.currentEntityType) {
      case 'agents': {
        const agent = this.currentState.agents.find((a) => a.id === this.selectedEntityId);
        if (agent) {
          this.agentDetail.setData(agent.name, agent);
        }
        break;
      }
      case 'orgs': {
        const org = this.currentState.organizations.find((o) => o.id === this.selectedEntityId);
        if (org) {
          this.orgDetail.setData(org.name, org);
        }
        break;
      }
      case 'locations': {
        const loc = this.currentState.locations.find((l) => l.id === this.selectedEntityId);
        if (loc) {
          this.locationDetail.setData(loc.name, loc);
        }
        break;
      }
    }
  }

  private handleRowClick(
    _entityType: EntityType,
    entity: Agent | Organization | Location
  ): void {
    this.selectedEntityId = entity.id;
    this.updateDetailView();
  }

  protected layout(): void {
    super.layout();

    // Guard against being called before child properties are initialized
    if (!this.detailContainer) return;

    const tableWidth = this._width - DETAIL_WIDTH;
    const contentHeight = this._height;

    // Position detail container
    this.detailContainer.x = tableWidth;

    // Draw divider
    if (this.divider) {
      this.divider.clear();
      this.divider.moveTo(tableWidth, 0);
      this.divider.lineTo(tableWidth, contentHeight);
      this.divider.stroke({ width: 1, color: COLORS.border, alpha: 0.8 });
    }

    // Resize tables
    this.agentTable?.resize(tableWidth, contentHeight);
    this.orgTable?.resize(tableWidth, contentHeight);
    this.locationTable?.resize(tableWidth, contentHeight);

    // Resize detail views
    this.agentDetail?.resize(DETAIL_WIDTH, contentHeight);
    this.orgDetail?.resize(DETAIL_WIDTH, contentHeight);
    this.locationDetail?.resize(DETAIL_WIDTH, contentHeight);
  }
}
