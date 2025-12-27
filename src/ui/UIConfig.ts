/**
 * UIConfig - Column and field definitions for entity views
 * This is the extensibility point - add new entity types/columns here
 */

import type { Agent, Organization, Location } from '../types';

/**
 * Column definition for tables
 */
export interface ColumnDef<T> {
  key: string;
  label: string;
  width: number;
  align?: 'left' | 'center' | 'right';
  render?: (item: T) => string;
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
    width: 140,
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
    key: 'inventory.provisions',
    label: 'Food',
    width: 60,
    align: 'right',
    render: (a) => (a.inventory['provisions'] ?? 0).toString(),
  },
  {
    key: 'employer',
    label: 'Employer',
    width: 130,
    render: (a) => a.employer ?? '-',
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
 * Render a cell value using column definition
 */
export function renderCell<T>(item: T, column: ColumnDef<T>): string {
  if (column.render) {
    return column.render(item);
  }
  return defaultRender(item, column.key);
}
