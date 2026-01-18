/**
 * UIConfig - Column and field definitions for entity views
 * This is the extensibility point - add new entity types/columns here
 */

import type { Agent, Organization, Location, Vehicle } from '../types';
import type { DetailSection } from './components/DetailView';

/**
 * Column definition for tables
 */
export interface ColumnDef<T> {
  key: string;
  label: string;
  width: number;
  align?: 'left' | 'center' | 'right';
  render?: (item: T) => string;
  sortValue?: (item: T) => string | number; // Value to sort by (if different from key)
}

/**
 * Get nested property from object using dot notation
 */
function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce((acc: unknown, part) => {
    if (acc && typeof acc === 'object' && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

/**
 * Default renderer - gets value by key path
 */
function defaultRender<T>(item: T, key: string): string {
  const value = getNestedValue(item, key);
  if (value === undefined || value === null) return '-';
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.length.toString();
  return String(value);
}

/**
 * Agent table columns
 */
export const AGENT_COLUMNS: ColumnDef<Agent>[] = [
  {
    key: 'name',
    label: 'Name',
    width: 160,
  },
  {
    key: 'status',
    label: 'Status',
    width: 80,
    render: (a) => a.status,
  },
  {
    key: 'wallet.credits',
    label: 'Credits',
    width: 80,
    align: 'right',
  },
  {
    key: 'needs.hunger',
    label: 'Hunger',
    width: 70,
    align: 'right',
    render: (a) => `${Math.round(a.needs.hunger)}%`,
  },
  {
    key: 'needs.fatigue',
    label: 'Fatigue',
    width: 70,
    align: 'right',
    render: (a) => `${Math.round(a.needs.fatigue ?? 0)}%`,
  },
  {
    key: 'inventory.provisions',
    label: 'Food',
    width: 60,
    align: 'right',
    render: (a) => (a.inventory['provisions'] ?? 0).toString(),
  },
  {
    key: 'employerName',
    label: 'Employer',
    width: 130,
  },
  {
    key: 'locationName',
    label: 'Location',
    width: 150,
  },
  {
    key: 'activity',
    label: 'Activity',
    width: 200,
  },
];

/**
 * Organization table columns
 */
export const ORG_COLUMNS: ColumnDef<Organization>[] = [
  {
    key: 'name',
    label: 'Organization',
    width: 180,
  },
  {
    key: 'template',
    label: 'Type',
    width: 100,
  },
  {
    key: 'wallet.credits',
    label: 'Credits',
    width: 80,
    align: 'right',
  },
  {
    key: 'locations',
    label: 'Locations',
    width: 80,
    align: 'right',
    render: (o) => o.locations.length.toString(),
    sortValue: (o) => o.locations.length,
  },
  {
    key: 'leaderName',
    label: 'Leader',
    width: 120,
  },
];

/**
 * Location table columns
 */
export const LOCATION_COLUMNS: ColumnDef<Location>[] = [
  {
    key: 'name',
    label: 'Location',
    width: 150,
  },
  {
    key: 'template',
    label: 'Type',
    width: 100,
  },
  {
    key: 'tags',
    label: 'Tags',
    width: 120,
    render: (l) => l.tags.slice(0, 2).join(', '),
  },
  {
    key: 'inventory.provisions',
    label: 'Stock',
    width: 60,
    align: 'right',
    render: (l) => (l.inventory['provisions'] ?? 0).toString(),
  },
  {
    key: 'employees',
    label: 'Staff',
    width: 50,
    align: 'right',
    render: (l) => l.employees.length.toString(),
    sortValue: (l) => l.employees.length,
  },
  {
    key: 'weeklyRevenue',
    label: 'Revenue',
    width: 70,
    align: 'right',
    render: (l) => l.weeklyRevenue.toString(),
  },
];

/**
 * Vehicle table columns
 */
export const VEHICLE_COLUMNS: ColumnDef<Vehicle>[] = [
  {
    key: 'name',
    label: 'Vehicle',
    width: 150,
  },
  {
    key: 'template',
    label: 'Type',
    width: 100,
  },
  {
    key: 'operator',
    label: 'Operator',
    width: 120,
    render: (v) => v.operator ?? 'Parked',
  },
  {
    key: 'building',
    label: 'Location',
    width: 120,
  },
  {
    key: 'cargo',
    label: 'Cargo',
    width: 80,
    align: 'right',
    render: (v) => {
      const total = Object.values(v.cargo).reduce((sum, amt) => sum + amt, 0);
      return total.toString();
    },
  },
  {
    key: 'cargoCapacity',
    label: 'Capacity',
    width: 80,
    align: 'right',
  },
];

/**
 * Render a cell value using column definition
 */
export function renderCell<T>(item: T, column: ColumnDef<T>): string {
  if (column.render) {
    return column.render(item);
  }
  return defaultRender(item, column.key);
}

// ============================================
// Detail View Definitions
// ============================================

/**
 * Agent detail sections
 */
export const AGENT_DETAILS: DetailSection[] = [
  {
    title: 'Identity',
    fields: [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name' },
      { key: 'status', label: 'Status' },
      { key: 'activity', label: 'Activity' },
      { key: 'created', label: 'Born (phase)' },
    ],
  },
  {
    title: 'Location',
    fields: [
      {
        key: 'locationName',
        label: 'Current Location',
      },
      {
        key: 'travelPhasesRemaining',
        label: 'Travel Time',
        render: (a) => {
          const agent = a as Agent;
          if (agent.travelPhasesRemaining !== undefined) {
            return `${agent.travelPhasesRemaining} phases`;
          }
          return '-';
        },
      },
      {
        key: 'workplaceName',
        label: 'Workplace',
      },
    ],
  },
  {
    title: 'Employment',
    fields: [
      { key: 'employerName', label: 'Employer' },
      { key: 'salary', label: 'Salary/week' },
    ],
  },
  {
    title: 'Stats',
    fields: [
      { key: 'stats.force', label: 'Force' },
      { key: 'stats.mobility', label: 'Mobility' },
      { key: 'stats.tech', label: 'Tech' },
      { key: 'stats.social', label: 'Social' },
      { key: 'stats.business', label: 'Business' },
      { key: 'stats.engineering', label: 'Engineering' },
    ],
  },
  {
    title: 'Needs & Resources',
    fields: [
      { key: 'needs.hunger', label: 'Hunger', render: (a) => `${Math.round((a as Agent).needs.hunger)}%` },
      { key: 'needs.fatigue', label: 'Fatigue', render: (a) => `${Math.round((a as Agent).needs.fatigue ?? 0)}%` },
      { key: 'needs.leisure', label: 'Leisure', render: (a) => `${Math.round((a as Agent).needs.leisure ?? 0)}%` },
      { key: 'wallet.credits', label: 'Credits' },
      {
        key: 'inventory',
        label: 'Inventory',
        render: (a) => {
          const inv = (a as Agent).inventory;
          const items = Object.entries(inv)
            .filter(([, v]) => v > 0)
            .map(([k, v]) => `${k}: ${v}`);
          return items.length > 0 ? items.join(', ') : 'Empty';
        },
      },
    ],
  },
  {
    title: 'Housing',
    fields: [
      {
        key: 'residence',
        label: 'Residence',
        render: (a) => (a as Agent).residence ?? 'Homeless',
      },
    ],
  },
];

/**
 * Organization detail sections
 */
export const ORG_DETAILS: DetailSection[] = [
  {
    title: 'Identity',
    fields: [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name' },
      { key: 'template', label: 'Type' },
      { key: 'created', label: 'Founded (phase)' },
    ],
  },
  {
    title: 'Leadership',
    fields: [
      { key: 'leader', label: 'Leader ID' },
      { key: 'leaderName', label: 'Leader Name' },
    ],
  },
  {
    title: 'Finances',
    fields: [
      { key: 'wallet.credits', label: 'Credits' },
    ],
  },
  {
    title: 'Assets',
    fields: [
      {
        key: 'locations',
        label: 'Locations',
        render: (o) => {
          const locs = (o as Organization).locations;
          return locs.length > 0 ? locs.join(', ') : 'None';
        },
      },
      { key: 'tags', label: 'Tags' },
    ],
  },
];

/**
 * Location detail sections
 */
export const LOCATION_DETAILS: DetailSection[] = [
  {
    title: 'Identity',
    fields: [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name' },
      { key: 'template', label: 'Type' },
      { key: 'tags', label: 'Tags' },
    ],
  },
  {
    title: 'Ownership',
    fields: [
      { key: 'owner', label: 'Owner ID' },
      { key: 'ownerType', label: 'Owner Type' },
    ],
  },
  {
    title: 'Operations',
    fields: [
      {
        key: 'employees',
        label: 'Employees',
        render: (l) => `${(l as Location).employees.length} / ${(l as Location).employeeSlots}`,
      },
      { key: 'operatingCost', label: 'Operating Cost' },
      { key: 'weeklyRevenue', label: 'Weekly Revenue' },
      { key: 'weeklyCosts', label: 'Weekly Costs' },
    ],
  },
  {
    title: 'Residential',
    fields: [
      {
        key: 'residents',
        label: 'Residents',
        render: (l) => {
          const loc = l as Location;
          const residents = loc.residents ?? [];
          const max = loc.maxResidents ?? 0;
          if (max === 0) return '-';
          return `${residents.length} / ${max}`;
        },
      },
      {
        key: 'rentCost',
        label: 'Rent/week',
        render: (l) => {
          const loc = l as Location;
          return loc.rentCost !== undefined ? loc.rentCost.toString() : '-';
        },
      },
    ],
  },
  {
    title: 'Inventory',
    fields: [
      {
        key: 'inventory',
        label: 'Stock',
        render: (l) => {
          const inv = (l as Location).inventory;
          const items = Object.entries(inv)
            .filter(([, v]) => v > 0)
            .map(([k, v]) => `${k}: ${v}`);
          return items.length > 0 ? items.join(', ') : 'Empty';
        },
      },
      { key: 'inventoryCapacity', label: 'Capacity' },
    ],
  },
  {
    title: 'Position',
    fields: [
      {
        key: 'building',
        label: 'Building',
        render: (l) => {
          const loc = l as Location;
          if (loc.building) {
            return loc.building;
          }
          return 'Outdoor';
        },
      },
      {
        key: 'position',
        label: 'Coordinates',
        render: (l) => `(${(l as Location).x}, ${(l as Location).y})`,
      },
      { key: 'floor', label: 'Floor' },
      {
        key: 'unit',
        label: 'Unit',
        render: (l) => {
          const loc = l as Location;
          if (loc.unit !== undefined) {
            return loc.unit.toString();
          }
          return '-';
        },
      },
    ],
  },
];

/**
 * Vehicle detail sections
 */
export const VEHICLE_DETAILS: DetailSection[] = [
  {
    title: 'Identity',
    fields: [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name' },
      { key: 'template', label: 'Type' },
      { key: 'created', label: 'Spawned (phase)' },
    ],
  },
  {
    title: 'Ownership',
    fields: [
      { key: 'owner', label: 'Owner ID' },
      {
        key: 'operator',
        label: 'Operator',
        render: (v) => (v as Vehicle).operator ?? 'Parked (no operator)',
      },
    ],
  },
  {
    title: 'Location',
    fields: [
      { key: 'building', label: 'Parked At (Building ID)' },
    ],
  },
  {
    title: 'Cargo',
    fields: [
      {
        key: 'cargo',
        label: 'Current Cargo',
        render: (v) => {
          const cargo = (v as Vehicle).cargo;
          const items = Object.entries(cargo)
            .filter(([, amt]) => amt > 0)
            .map(([good, amt]) => `${good}: ${amt}`);
          return items.length > 0 ? items.join(', ') : 'Empty';
        },
      },
      { key: 'cargoCapacity', label: 'Capacity' },
    ],
  },
];
