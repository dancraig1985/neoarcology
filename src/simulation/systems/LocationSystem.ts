/**
 * LocationSystem - Handles locations, inventory, and commerce
 */

import type { Location, Agent, Building } from '../../types';
import type { LocationTemplate, EconomyConfig } from '../../config/ConfigLoader';
import { ActivityLog } from '../ActivityLog';
import { setEmployment, clearEmployment } from './AgentStateHelpers';

/**
 * Building placement info for runtime location creation
 */
export interface BuildingPlacement {
  building: Building;
  floor: number;
  unit: number;
}

/**
 * Check if a location's tags match a building's allowed tags
 */
function locationMatchesBuilding(locationTags: string[], building: Building): boolean {
  return locationTags.some((tag) => building.allowedLocationTags.includes(tag));
}

/**
 * Count how many units in a building are occupied by existing locations
 */
function getBuildingOccupancy(building: Building, locations: Location[]): number {
  return locations.filter((loc) => loc.building === building.id).length;
}

/**
 * Find a building that can accommodate a location with given tags
 * Returns the building and an available unit, or null if none found
 */
export function findBuildingForLocation(
  buildings: Building[],
  locationTags: string[],
  locations: Location[]
): BuildingPlacement | null {
  // Filter buildings that match the location tags
  const candidates = buildings.filter((b) => locationMatchesBuilding(locationTags, b));

  // Shuffle candidates for variety
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);

  // Find a building with available space
  for (const building of shuffled) {
    const occupied = getBuildingOccupancy(building, locations);
    const totalUnits = building.floors * building.unitsPerFloor;

    if (occupied >= totalUnits) continue; // Building is full

    // Find locations already in this building to know which units are taken
    const buildingLocations = locations.filter((loc) => loc.building === building.id);
    const occupiedUnits = new Set(
      buildingLocations.map((loc) => `${loc.floor}:${loc.unit ?? 0}`)
    );

    // Find an available unit
    for (let floor = 0; floor < building.floors; floor++) {
      for (let unit = 0; unit < building.unitsPerFloor; unit++) {
        const key = `${floor}:${unit}`;
        if (!occupiedUnits.has(key)) {
          return { building, floor, unit };
        }
      }
    }
  }

  return null;
}

/**
 * Create a new location (business) - owned by an organization
 * If buildingPlacement is provided, location is placed in that building
 */
export function createLocation(
  id: string,
  name: string,
  template: LocationTemplate,
  orgId: string,
  orgName: string,
  phase: number,
  buildingPlacement?: BuildingPlacement
): Location {
  const locationConfig = template.balance;
  if (!locationConfig) {
    throw new Error(`Unknown location template: ${template.id}`);
  }

  // Use building coords if placed in a building, else center of grid
  const x = buildingPlacement?.building.x ?? 16;
  const y = buildingPlacement?.building.y ?? 16;
  const floor = buildingPlacement?.floor ?? 0;

  ActivityLog.info(
    phase,
    'business',
    `${orgName} opened ${template.id} "${name}" at (${x}, ${y})${buildingPlacement ? ` floor ${floor}` : ''}`,
    orgId,
    orgName
  );

  return {
    id,
    name,
    template: template.id,
    tags: template.tags ?? [],
    created: phase,
    relationships: [],
    building: buildingPlacement?.building.id,
    floor,
    unit: buildingPlacement?.unit,
    x,
    y,
    size: 1,
    security: 10,
    owner: orgId,
    ownerType: 'org', // All businesses owned by orgs
    previousOwners: [],
    employees: [],
    employeeSlots: locationConfig.employeeSlots ?? 0,
    baseIncome: 0,
    operatingCost: locationConfig.operatingCost ?? 0,
    weeklyRevenue: 0,
    weeklyCosts: 0,
    agentCapacity: 10,
    vehicleCapacity: 0,
    vehicles: [],
    inventory: {
      provisions: locationConfig.startingInventory ?? 0,
    },
    inventoryCapacity: locationConfig.inventoryCapacity ?? 0,
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
  economyConfig: EconomyConfig,
  phase: number
): { location: Location; buyer: Agent; success: boolean } {
  const goodsConfig = economyConfig.goods[goodsType];
  if (!goodsConfig) {
    return { location, buyer, success: false };
  }
  const price = goodsConfig.retailPrice;

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
 * Uses centralized setEmployment helper for atomic state update
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

  // Set employer to the org that owns the location (if org-owned)
  const employer = location.ownerType === 'org' ? (location.owner ?? '') : '';

  return {
    location: {
      ...location,
      employees: [...location.employees, agent.id],
    },
    agent: setEmployment(agent, location.id, employer, salary),
  };
}

/**
 * Fire/release an agent from a location
 * Uses centralized clearEmployment helper for atomic state update
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
    agent: clearEmployment(agent),
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

/**
 * Remove dead agents from location employee lists
 * Call this after processing agent deaths
 */
export function cleanupDeadEmployees(
  locations: Location[],
  agents: Agent[],
  phase: number
): Location[] {
  const deadAgentIds = new Set(
    agents.filter((a) => a.status === 'dead').map((a) => a.id)
  );

  return locations.map((loc) => {
    const aliveEmployees = loc.employees.filter((id) => !deadAgentIds.has(id));

    // Log if we removed anyone
    const removedCount = loc.employees.length - aliveEmployees.length;
    if (removedCount > 0) {
      ActivityLog.info(
        phase,
        'employment',
        `removed ${removedCount} deceased employee(s) from ${loc.name}`,
        loc.owner,
        loc.name
      );
    }

    return aliveEmployees.length !== loc.employees.length
      ? { ...loc, employees: aliveEmployees }
      : loc;
  });
}
