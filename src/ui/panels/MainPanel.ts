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
  VEHICLE_COLUMNS,
  ORDER_COLUMNS,
  AGENT_DETAILS,
  ORG_DETAILS,
  LOCATION_DETAILS,
  VEHICLE_DETAILS,
  ORDER_DETAILS,
  createLocationColumns,
  createLocationDetails,
  type VehicleWithNames,
  type OrderWithNames,
} from '../UIConfig';
import type { EntityType } from './NavPanel';
import type { SimulationState } from '../../simulation/Simulation';
import type { Agent, Organization, Location, Vehicle, Order } from '../../types';
import { ActivityLog } from '../../simulation/ActivityLog';
import { computeAgentActivity } from '../../simulation/helpers/ActivityHelper';

const DETAIL_WIDTH = 360;

// Enriched org type with computed fields for display
type OrgWithLeaderName = Organization & { leaderName: string };

// Enriched agent type with computed fields for display
type AgentWithNames = Agent & { employerName: string; locationName: string; activity: string };

export class MainPanel extends Panel {
  private currentEntityType: EntityType = 'agents';
  private currentState: SimulationState | null = null;

  // Layout containers
  private tableContainer: Container;
  private detailContainer: Container;
  private divider: Graphics;

  // Tables for each entity type
  private agentTable: Table<AgentWithNames>;
  private orgTable: Table<OrgWithLeaderName>;
  private locationTable: Table<Location>;
  private vehicleTable: Table<VehicleWithNames>;
  private orderTable: Table<OrderWithNames>;

  // Detail views for each entity type
  private agentDetail: DetailView;
  private orgDetail: DetailView;
  private locationDetail: DetailView;
  private vehicleDetail: DetailView;
  private orderDetail: DetailView;

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
    this.agentTable = new Table<AgentWithNames>(tableWidth, contentHeight, {
      columns: AGENT_COLUMNS as typeof AGENT_COLUMNS,
      onRowClick: (agent) => this.handleRowClick('agents', agent),
    });

    this.orgTable = new Table<OrgWithLeaderName>(tableWidth, contentHeight, {
      columns: ORG_COLUMNS as typeof ORG_COLUMNS,
      onRowClick: (org) => this.handleRowClick('orgs', org),
    });

    this.locationTable = new Table<Location>(tableWidth, contentHeight, {
      columns: LOCATION_COLUMNS,
      onRowClick: (loc) => this.handleRowClick('locations', loc),
    });

    this.vehicleTable = new Table<VehicleWithNames>(tableWidth, contentHeight, {
      columns: VEHICLE_COLUMNS,
      onRowClick: (vehicle) => this.handleRowClick('vehicles', vehicle),
    });

    this.orderTable = new Table<OrderWithNames>(tableWidth, contentHeight, {
      columns: ORDER_COLUMNS,
      onRowClick: (order) => this.handleRowClick('orders', order),
    });

    // Create detail views
    this.agentDetail = new DetailView(DETAIL_WIDTH, contentHeight, AGENT_DETAILS);
    this.orgDetail = new DetailView(DETAIL_WIDTH, contentHeight, ORG_DETAILS);
    this.locationDetail = new DetailView(DETAIL_WIDTH, contentHeight, LOCATION_DETAILS);
    this.vehicleDetail = new DetailView(DETAIL_WIDTH, contentHeight, VEHICLE_DETAILS);
    this.orderDetail = new DetailView(DETAIL_WIDTH, contentHeight, ORDER_DETAILS);

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

    // Update location table columns with current transaction history (PLAN-035)
    if (this.currentEntityType === 'locations') {
      this.updateLocationTableColumns(state);
    }

    this.updateTable();

    // Update detail view if something is selected
    if (this.selectedEntityId) {
      this.updateDetailView();
    }
  }

  /**
   * Update location table columns with current transaction history (PLAN-035)
   */
  private updateLocationTableColumns(state: SimulationState): void {
    const newColumns = createLocationColumns(state.transactionHistory, state.time.currentPhase);
    // Recreate the table with new columns
    const tableWidth = this.width - DETAIL_WIDTH;
    const contentHeight = this.height;

    // Remove old table
    this.tableContainer.removeChild(this.locationTable);

    // Create new table with updated columns
    this.locationTable = new Table<Location>(tableWidth, contentHeight, {
      columns: newColumns,
      onRowClick: (loc) => this.handleRowClick('locations', loc),
    });
    this.tableContainer.addChild(this.locationTable);

    // Restore selection if any
    if (this.selectedEntityId) {
      this.locationTable.setSelected(this.selectedEntityId);
    }
  }

  /**
   * Update location detail sections with current transaction history (PLAN-035)
   */
  private updateLocationDetail(): void {
    if (!this.currentState) return;

    const newSections = createLocationDetails(
      this.currentState.transactionHistory,
      this.currentState.time.currentPhase
    );

    // Recreate the detail view with new sections
    const contentHeight = this.height;

    // Remove old detail view
    this.detailContainer.removeChild(this.locationDetail);

    // Create new detail view with updated sections
    this.locationDetail = new DetailView(DETAIL_WIDTH, contentHeight, newSections);
    this.detailContainer.addChild(this.locationDetail);
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

  private getCurrentTable(): Table<AgentWithNames> | Table<OrgWithLeaderName> | Table<Location> | Table<VehicleWithNames> | Table<OrderWithNames> {
    switch (this.currentEntityType) {
      case 'agents':
        return this.agentTable;
      case 'orgs':
        return this.orgTable;
      case 'locations':
        return this.locationTable;
      case 'vehicles':
        return this.vehicleTable;
      case 'orders':
        return this.orderTable;
      default:
        return this.agentTable;
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
      case 'vehicles':
        return this.vehicleDetail;
      case 'orders':
        return this.orderDetail;
      default:
        return this.agentDetail;
    }
  }

  private updateTable(): void {
    if (!this.currentState) return;

    switch (this.currentEntityType) {
      case 'agents':
        // Enrich agents with employer, location names, and activity
        const currentPhase = this.currentState.time.currentPhase;
        const enrichedAgents: AgentWithNames[] = this.currentState.agents.map((agent) => {
          const employer = this.currentState!.organizations.find((o) => o.id === agent.employer);
          // For location, check both currentLocation and travelingTo
          let locationName = '-';
          if (agent.travelingTo) {
            const dest = this.currentState!.locations.find((l) => l.id === agent.travelingTo);
            locationName = dest ? `→ ${dest.name}` : '→ ?';
          } else if (agent.currentLocation) {
            const loc = this.currentState!.locations.find((l) => l.id === agent.currentLocation);
            locationName = loc?.name ?? '-';
          }
          // Compute current activity
          const recentLogs = ActivityLog.getEntriesForEntity(agent.id).filter(
            (e) => e.phase === currentPhase
          );
          const { detail: activity } = computeAgentActivity(
            agent,
            this.currentState!.locations,
            recentLogs
          );
          return {
            ...agent,
            employerName: employer?.name ?? '-',
            locationName,
            activity,
          };
        });
        // Sort: living first, then dead
        const sortedAgents = enrichedAgents.sort((a, b) => {
          if (a.status === 'dead' && b.status !== 'dead') return 1;
          if (a.status !== 'dead' && b.status === 'dead') return -1;
          return 0;
        });
        this.agentTable.setData(sortedAgents);
        break;
      case 'orgs':
        // Enrich orgs with leader names computed from agents
        const orgsWithLeaders: OrgWithLeaderName[] = this.currentState.organizations.map((org) => {
          const leader = this.currentState!.agents.find((a) => a.id === org.leader);
          return { ...org, leaderName: leader?.name ?? '-' };
        });
        this.orgTable.setData(orgsWithLeaders);
        break;
      case 'locations':
        this.locationTable.setData(this.currentState.locations);
        break;
      case 'vehicles': {
        // Enrich vehicles with operator and location names
        const enrichedVehicles: VehicleWithNames[] = this.currentState.vehicles.map((vehicle) => {
          // Look up operator name from agents
          const operator = vehicle.operator
            ? this.currentState!.agents.find((a) => a.id === vehicle.operator)
            : null;
          const operatorName = operator?.name ?? 'Parked';

          // Look up location name
          let locationName = '-';
          if (vehicle.travelingToBuilding) {
            locationName = 'In Transit';
          } else if (vehicle.currentBuilding) {
            const building = this.currentState!.buildings?.find((b) => b.id === vehicle.currentBuilding);
            locationName = building?.name ?? vehicle.currentBuilding;
          }

          return { ...vehicle, operatorName, locationName };
        });
        this.vehicleTable.setData(enrichedVehicles);
        break;
      }
      case 'orders': {
        // Enrich orders with buyer and seller names
        const enrichedOrders: OrderWithNames[] = this.currentState.deliveryRequests.map((order) => {
          // Look up buyer org name
          const buyer = this.currentState!.organizations.find((o) => o.id === order.buyer);
          const buyerName = buyer?.name ?? order.buyer;

          // Look up seller org name
          const seller = order.seller
            ? this.currentState!.organizations.find((o) => o.id === order.seller)
            : null;
          const sellerName = seller?.name ?? (order.seller || 'Unassigned');

          return { ...order, buyerName, sellerName };
        });
        this.orderTable.setData(enrichedOrders);
        break;
      }
    }
  }

  private updateDetailView(): void {
    if (!this.currentState || !this.selectedEntityId) return;

    switch (this.currentEntityType) {
      case 'agents': {
        const agent = this.currentState.agents.find((a) => a.id === this.selectedEntityId);
        if (agent) {
          // Enrich with computed names and activity for detail view
          const employer = this.currentState.organizations.find((o) => o.id === agent.employer);
          let locationName = '-';
          if (agent.travelingTo) {
            const dest = this.currentState.locations.find((l) => l.id === agent.travelingTo);
            locationName = dest ? `→ ${dest.name}` : '→ ?';
          } else if (agent.currentLocation) {
            const loc = this.currentState.locations.find((l) => l.id === agent.currentLocation);
            locationName = loc?.name ?? '-';
          }
          const workplaceLoc = this.currentState.locations.find((l) => l.id === agent.employedAt);
          // Compute current activity
          const detailPhase = this.currentState.time.currentPhase;
          const recentLogs = ActivityLog.getEntriesForEntity(agent.id).filter(
            (e) => e.phase === detailPhase
          );
          const { detail: activity } = computeAgentActivity(
            agent,
            this.currentState.locations,
            recentLogs
          );
          const enrichedAgent = {
            ...agent,
            employerName: employer?.name ?? '-',
            locationName,
            workplaceName: workplaceLoc?.name ?? '-',
            activity,
          };
          this.agentDetail.setData(agent.name, enrichedAgent, agent.id);
        }
        break;
      }
      case 'orgs': {
        const org = this.currentState.organizations.find((o) => o.id === this.selectedEntityId);
        if (org) {
          // Enrich with computed leaderName
          const leader = this.currentState.agents.find((a) => a.id === org.leader);
          const enrichedOrg = { ...org, leaderName: leader?.name ?? '-' };
          this.orgDetail.setData(org.name, enrichedOrg, org.id);
        }
        break;
      }
      case 'locations': {
        const loc = this.currentState.locations.find((l) => l.id === this.selectedEntityId);
        if (loc) {
          // Update location detail with current transaction history (PLAN-035)
          this.updateLocationDetail();
          this.locationDetail.setData(loc.name, loc, loc.id);
        }
        break;
      }
      case 'vehicles': {
        const vehicle = this.currentState.vehicles.find((v) => v.id === this.selectedEntityId);
        if (vehicle) {
          this.vehicleDetail.setData(vehicle.name, vehicle, vehicle.id);
        }
        break;
      }
      case 'orders': {
        const order = this.currentState.deliveryRequests.find((o) => o.id === this.selectedEntityId);
        if (order) {
          const title = `Order: ${order.id}`;
          this.orderDetail.setData(title, order, order.id);
        }
        break;
      }
    }
  }

  private handleRowClick(
    _entityType: EntityType,
    entity: Agent | Organization | Location | Vehicle | Order
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
