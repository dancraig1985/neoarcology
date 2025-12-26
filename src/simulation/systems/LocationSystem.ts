/**
 * LocationSystem - Handles locations, inventory, and commerce
 */

import type { Location, Agent, AgentRef } from '../../types';
import type { LocationTemplate, BalanceConfig } from '../../config/ConfigLoader';
import { ActivityLog } from '../ActivityLog';

/**
 * Create a new location (business)
 */
export function createLocation(
  id: string,
  name: string,
  template: LocationTemplate,
  ownerId: AgentRef,
  ownerName: string,
  phase: number
): Location {
  const locationConfig = template.balance;
  if (!locationConfig) {
    throw new Error(`Unknown location template: ${template.id}`);
  }

  ActivityLog.info(
    phase,
    'business',
    `opened ${template.id} "${name}"`,
    ownerId,
    ownerName
  );

  const defaults = template.defaults as {
    size?: number;
    security?: number;
    agentCapacity?: number;
    vehicleCapacity?: number;
  };

  return {
    id,
    name,
    template: template.id,
    tags: [...template.tags, 'business'],
    created: phase,
    relationships: [],
    sector: 'downtown',
    district: 'market',
    coordinates: { distance: Math.random() * 100, vertical: 0 },
    size: defaults.size ?? 1,
    security: defaults.security ?? 10,
    owner: ownerId,
    ownerType: 'agent',
    previousOwners: [],
    employees: [],
    employeeSlots: locationConfig.employeeSlots,
    baseIncome: locationConfig.baseIncome ?? 0,
    operatingCost: locationConfig.operatingCost,
    weeklyRevenue: 0,
    weeklyCosts: 0,
    agentCapacity: defaults.agentCapacity ?? 10,
    vehicleCapacity: defaults.vehicleCapacity ?? 0,
    occupants: [],
    vehicles: [],
    inventory: {
      provisions: locationConfig.startingInventory,
    },
  };
}

/**
 * Purchase goods from a location
 * Returns updated location, buyer agent, and success status
 */
export function purchaseFromLocation(
  location: Location,
  buyer: Agent,
  goodsType: string,
  quantity: number,
  balance: BalanceConfig,
  phase: number
): { location: Location; buyer: Agent; success: boolean } {
  const price = balance.economy.prices[goodsType as keyof typeof balance.economy.prices];
  if (price === undefined) {
    return { location, buyer, success: false };
  }

  const totalCost = price * quantity;
  const available = location.inventory[goodsType] ?? 0;

  // Check if location has goods and buyer has credits
  if (available < quantity) {
    return { location, buyer, success: false };
  }
  if (buyer.wallet.credits < totalCost) {
    return { location, buyer, success: false };
  }

  // Execute transaction
  const newLocationInventory = {
    ...location.inventory,
    [goodsType]: available - quantity,
  };

  const newBuyerInventory = {
    ...buyer.inventory,
    [goodsType]: (buyer.inventory[goodsType] ?? 0) + quantity,
  };

  ActivityLog.info(
    phase,
    'commerce',
    `purchased ${quantity} ${goodsType} from ${location.name} for ${totalCost} credits`,
    buyer.id,
    buyer.name
  );

  return {
    location: {
      ...location,
      inventory: newLocationInventory,
      weeklyRevenue: location.weeklyRevenue + totalCost,
    },
    buyer: {
      ...buyer,
      inventory: newBuyerInventory,
      wallet: {
        ...buyer.wallet,
        credits: buyer.wallet.credits - totalCost,
      },
    },
    success: true,
  };
}

/**
 * Hire an agent at a location
 */
export function hireAgent(
  location: Location,
  agent: Agent,
  salary: number,
  phase: number
): { location: Location; agent: Agent } {
  ActivityLog.info(
    phase,
    'employment',
    `hired at ${location.name} (salary: ${salary}/week)`,
    agent.id,
    agent.name
  );

  return {
    location: {
      ...location,
      employees: [...location.employees, agent.id],
    },
    agent: {
      ...agent,
      status: 'employed',
      employedAt: location.id,
      salary,
    },
  };
}

/**
 * Fire/release an agent from a location
 */
export function releaseAgent(
  location: Location,
  agent: Agent,
  reason: string,
  phase: number
): { location: Location; agent: Agent } {
  ActivityLog.info(
    phase,
    'employment',
    `left job at ${location.name} (${reason})`,
    agent.id,
    agent.name
  );

  return {
    location: {
      ...location,
      employees: location.employees.filter((id) => id !== agent.id),
    },
    agent: {
      ...agent,
      status: 'available',
      employedAt: undefined,
      salary: 0,
    },
  };
}

/**
 * Process weekly payroll for a location
 * Returns updated owner and employees
 */
export function processPayroll(
  _location: Location,
  owner: Agent,
  employees: Agent[],
  phase: number
): { owner: Agent; employees: Agent[]; unpaidEmployees: Agent[] } {
  let updatedOwner = owner;
  const paidEmployees: Agent[] = [];
  const unpaidEmployees: Agent[] = [];

  for (const employee of employees) {
    if (updatedOwner.wallet.credits >= employee.salary) {
      // Pay the employee
      updatedOwner = {
        ...updatedOwner,
        wallet: {
          ...updatedOwner.wallet,
          credits: updatedOwner.wallet.credits - employee.salary,
        },
      };

      const paidEmployee = {
        ...employee,
        wallet: {
          ...employee.wallet,
          credits: employee.wallet.credits + employee.salary,
        },
      };
      paidEmployees.push(paidEmployee);

      ActivityLog.info(
        phase,
        'payroll',
        `paid ${employee.salary} credits by ${owner.name}`,
        employee.id,
        employee.name
      );
    } else {
      // Can't pay - employee will quit
      unpaidEmployees.push(employee);
      ActivityLog.warning(
        phase,
        'payroll',
        `not paid by ${owner.name} (insufficient funds)`,
        employee.id,
        employee.name
      );
    }
  }

  return { owner: updatedOwner, employees: paidEmployees, unpaidEmployees };
}

/**
 * Process weekly operating costs for a location
 */
export function processOperatingCosts(
  location: Location,
  owner: Agent,
  _balance: BalanceConfig,
  phase: number
): { location: Location; owner: Agent } {
  const cost = location.operatingCost;

  if (owner.wallet.credits >= cost) {
    ActivityLog.info(
      phase,
      'costs',
      `paid ${cost} credits operating costs for ${location.name}`,
      owner.id,
      owner.name
    );

    return {
      location: {
        ...location,
        weeklyCosts: location.weeklyCosts + cost,
      },
      owner: {
        ...owner,
        wallet: {
          ...owner.wallet,
          credits: owner.wallet.credits - cost,
        },
      },
    };
  } else {
    ActivityLog.warning(
      phase,
      'costs',
      `cannot afford operating costs for ${location.name}`,
      owner.id,
      owner.name
    );
    return { location, owner };
  }
}

/**
 * Check if a location should be dissolved (owner bankrupt)
 */
export function shouldDissolve(owner: Agent): boolean {
  return owner.wallet.credits < 0;
}

/**
 * Reset weekly tracking for a location
 */
export function resetWeeklyTracking(location: Location): Location {
  return {
    ...location,
    weeklyRevenue: 0,
    weeklyCosts: 0,
  };
}

/**
 * Get locations that are hiring
 */
export function getHiringLocations(locations: Location[]): Location[] {
  return locations.filter((loc) => loc.employees.length < loc.employeeSlots);
}

/**
 * Get locations with goods in stock
 */
export function getLocationsWithGoods(
  locations: Location[],
  goodsType: string
): Location[] {
  return locations.filter((loc) => (loc.inventory[goodsType] ?? 0) > 0);
}
