/**
 * OrgSystem - Manages organizations and their operations
 * PLAN-003: Minimal implementation for supply chain
 */

import type { Organization, Location, AgentRef, LocationRef } from '../../types';
import type { LocationTemplate, BalanceConfig, ProductionConfig } from '../../config/ConfigLoader';
import { ActivityLog } from '../ActivityLog';
import { addToInventory, getAvailableCapacity, getInventorySpaceUsed, type GoodsSizes } from './InventorySystem';

/**
 * Create a new organization
 */
export function createOrganization(
  id: string,
  name: string,
  leaderId: AgentRef,
  leaderName: string,
  startingCredits: number,
  phase: number
): Organization {
  ActivityLog.info(
    phase,
    'org',
    `founded "${name}" with ${startingCredits} credits`,
    leaderId,
    leaderName
  );

  return {
    id,
    name,
    template: 'corporation',
    tags: ['corporation'],
    created: phase,
    relationships: [],
    leader: leaderId,
    wallet: {
      credits: startingCredits,
      accounts: [],
      stashes: [],
    },
    locations: [],
  };
}

/**
 * Create a factory location owned by an organization
 */
export function createFactoryLocation(
  id: string,
  name: string,
  template: LocationTemplate,
  orgId: string,
  phase: number
): Location {
  const locationConfig = template.balance;

  ActivityLog.info(
    phase,
    'business',
    `factory "${name}" established`,
    orgId,
    'Corporation'
  );

  return {
    id,
    name,
    template: template.id,
    tags: template.tags ?? [],
    created: phase,
    relationships: [],
    x: 24, // Placeholder: industrial area (will be placed by CityGenerator)
    y: 24,
    floor: 0,
    size: 3,
    security: 30,
    owner: orgId,
    ownerType: 'org',
    previousOwners: [],
    employees: [],
    employeeSlots: locationConfig.employeeSlots ?? 0,
    baseIncome: 0,
    operatingCost: locationConfig.operatingCost ?? 0,
    weeklyRevenue: 0,
    weeklyCosts: 0,
    agentCapacity: 50,
    vehicleCapacity: 10,
    occupants: [],
    vehicles: [],
    inventory: {
      provisions: locationConfig.startingInventory ?? 0,
    },
    inventoryCapacity: locationConfig.inventoryCapacity ?? 0,
  };
}

/**
 * Process production for a location with production config
 * Supports multiple goods with different production rates and intervals
 * Production = employees × amountPerEmployee (when phase aligns with cycle)
 * No employees = no production
 */
export function processFactoryProduction(
  location: Location,
  productionConfig: ProductionConfig[] | undefined,
  phase: number,
  goodsSizes?: GoodsSizes
): Location {
  // No production config = not a producing location
  if (!productionConfig || productionConfig.length === 0) {
    return location;
  }

  const employeeCount = location.employees.length;

  // No workers = no production
  if (employeeCount === 0) {
    ActivityLog.warning(
      phase,
      'production',
      `no workers - production halted (need ${location.employeeSlots} workers)`,
      location.id,
      location.name
    );
    return location;
  }

  let updatedLocation = location;

  // Process each production config
  for (const config of productionConfig) {
    // Check if this phase is a production cycle for this good
    // phasesPerCycle: 1 = every phase, 4 = every day, 28 = every week
    if (phase % config.phasesPerCycle !== 0) {
      continue; // Not a production cycle for this good
    }

    const capacity = getAvailableCapacity(updatedLocation, goodsSizes);

    if (capacity <= 0) {
      const spaceUsed = getInventorySpaceUsed(updatedLocation, goodsSizes);
      ActivityLog.warning(
        phase,
        'production',
        `at capacity (${spaceUsed.toFixed(1)}/${updatedLocation.inventoryCapacity} space), ${config.good} production halted`,
        location.id,
        location.name
      );
      continue;
    }

    // Production scales with number of employees
    const productionAmount = employeeCount * config.amountPerEmployee;

    // Produce up to available capacity (respects goods sizes)
    const { holder, added } = addToInventory(
      updatedLocation,
      config.good,
      productionAmount,
      goodsSizes
    );
    updatedLocation = holder as Location;

    if (added > 0) {
      const cycleDesc = config.phasesPerCycle === 1 ? '' :
                        config.phasesPerCycle === 4 ? ' (daily)' :
                        config.phasesPerCycle === 28 ? ' (weekly)' :
                        ` (every ${config.phasesPerCycle} phases)`;
      const spaceUsed = getInventorySpaceUsed(updatedLocation, goodsSizes);
      ActivityLog.info(
        phase,
        'production',
        `${employeeCount} workers produced ${added} ${config.good}${cycleDesc} (space: ${spaceUsed.toFixed(1)}/${updatedLocation.inventoryCapacity})`,
        location.id,
        location.name
      );
    }
  }

  return updatedLocation;
}

/**
 * Process weekly operating costs for an org's locations
 */
export function processOrgWeeklyCosts(
  org: Organization,
  locations: Location[],
  _balance: BalanceConfig,
  phase: number
): { org: Organization; locations: Location[] } {
  let updatedOrg = { ...org };
  const updatedLocations = [...locations];

  // Find org's locations and pay operating costs
  for (let i = 0; i < updatedLocations.length; i++) {
    const location = updatedLocations[i];
    if (!location || location.owner !== org.id) continue;

    const cost = location.operatingCost;

    if (updatedOrg.wallet.credits >= cost) {
      ActivityLog.info(
        phase,
        'costs',
        `paid ${cost} credits operating costs for ${location.name}`,
        org.id,
        org.name
      );

      updatedOrg = {
        ...updatedOrg,
        wallet: {
          ...updatedOrg.wallet,
          credits: updatedOrg.wallet.credits - cost,
        },
      };

      updatedLocations[i] = {
        ...location,
        weeklyCosts: location.weeklyCosts + cost,
      };
    } else {
      ActivityLog.warning(
        phase,
        'costs',
        `cannot afford operating costs for ${location.name}`,
        org.id,
        org.name
      );
    }
  }

  return { org: updatedOrg, locations: updatedLocations };
}

/**
 * Add a location to an organization
 */
export function addLocationToOrg(
  org: Organization,
  locationId: LocationRef
): Organization {
  return {
    ...org,
    locations: [...org.locations, locationId],
  };
}
