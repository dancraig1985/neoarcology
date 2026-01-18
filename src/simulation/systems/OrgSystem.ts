/**
 * OrgSystem - Manages organizations and their operations
 * PLAN-003: Minimal implementation for supply chain
 */

import type { Organization, Location, Agent, AgentRef, LocationRef } from '../../types';
import type { LocationTemplate, ProductionConfig } from '../../config/ConfigLoader';
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
 * Production = present employees × amountPerEmployee (when phase aligns with cycle)
 * No employees = no production
 * Workers must be physically present at the location to produce
 * For production requiring storage (valuable_data), uses capacity-based check:
 *   1 data_storage = N valuable_data capacity (from economy.json storageCapacity)
 */
export function processFactoryProduction(
  location: Location,
  productionConfig: ProductionConfig[] | undefined,
  phase: number,
  goodsSizes?: GoodsSizes,
  agents?: Agent[]
): Location {
  // No production config = not a producing location
  if (!productionConfig || productionConfig.length === 0) {
    return location;
  }

  const totalEmployees = location.employees.length;

  // No workers employed = no production
  if (totalEmployees === 0) {
    ActivityLog.warning(
      phase,
      'production',
      `no workers - production halted (need ${location.employeeSlots} workers)`,
      location.id,
      location.name
    );
    return location;
  }

  // Count only employees who are physically present at the location
  let presentEmployeeCount = totalEmployees; // Default to all if agents not provided
  if (agents) {
    presentEmployeeCount = location.employees.filter((empId) => {
      const emp = agents.find((a) => a.id === empId);
      return emp && emp.currentLocation === location.id;
    }).length;
  }

  // No workers present = no production
  if (presentEmployeeCount === 0) {
    ActivityLog.info(
      phase,
      'production',
      `${totalEmployees} workers employed but none present - no production this phase`,
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

    // Check if production requires storage (e.g., valuable_data needs data_storage)
    // Storage is capacity-based: 1 data_storage = N valuable_data capacity
    let availableStorageSpace = Infinity; // No limit unless requiresStorage
    if (config.requiresStorage) {
      const dataStorageCount = updatedLocation.inventory['data_storage'] ?? 0;

      if (dataStorageCount === 0) {
        ActivityLog.warning(
          phase,
          'production',
          `cannot produce ${config.good} - no data_storage at this location`,
          location.id,
          location.name
        );
        continue;
      }

      // Get storage capacity per unit from config (default 10 if not specified)
      const storageCapacityPerUnit = goodsSizes?.goods['data_storage']?.storageCapacity ?? 10;
      const totalStorageCapacity = dataStorageCount * storageCapacityPerUnit;
      const currentValuableData = updatedLocation.inventory['valuable_data'] ?? 0;
      availableStorageSpace = totalStorageCapacity - currentValuableData;

      if (availableStorageSpace <= 0) {
        ActivityLog.warning(
          phase,
          'production',
          `storage full (${currentValuableData}/${totalStorageCapacity} capacity) - ${config.good} production halted`,
          location.id,
          location.name
        );
        continue;
      }

      // Log storage status periodically (every 4 phases = daily)
      if (phase % 4 === 0) {
        const percentFull = Math.round((currentValuableData / totalStorageCapacity) * 100);
        ActivityLog.info(
          phase,
          'production',
          `storage at ${currentValuableData}/${totalStorageCapacity} capacity (${percentFull}%)`,
          location.id,
          location.name
        );
      }
    }

    // Check if production requires input goods (e.g., valuable_data for prototypes)
    if (config.inputGoods) {
      let missingInputs = false;
      const inputsList: string[] = [];

      for (const [inputGood, requiredAmount] of Object.entries(config.inputGoods)) {
        const currentAmount = updatedLocation.inventory[inputGood] ?? 0;
        inputsList.push(`${inputGood}: ${currentAmount}/${requiredAmount}`);

        if (currentAmount < requiredAmount) {
          missingInputs = true;
        }
      }

      if (missingInputs) {
        ActivityLog.warning(
          phase,
          'production',
          `cannot produce ${config.good} - insufficient input goods (${inputsList.join(', ')})`,
          location.id,
          location.name
        );
        continue;
      }
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

    // Production scales with number of present employees
    // Cap to available storage space for goods requiring storage
    const rawProductionAmount = presentEmployeeCount * config.amountPerEmployee;
    const productionAmount = Math.min(rawProductionAmount, availableStorageSpace);

    // Produce up to available capacity (respects goods sizes)
    const { holder, added } = addToInventory(
      updatedLocation,
      config.good,
      productionAmount,
      goodsSizes
    );
    updatedLocation = holder as Location;

    if (added > 0) {
      // Consume input goods after successful production
      if (config.inputGoods) {
        for (const [inputGood, requiredAmount] of Object.entries(config.inputGoods)) {
          const currentAmount = updatedLocation.inventory[inputGood] ?? 0;
          updatedLocation = {
            ...updatedLocation,
            inventory: {
              ...updatedLocation.inventory,
              [inputGood]: Math.max(0, currentAmount - requiredAmount)
            }
          };
        }
      }

      const cycleDesc = config.phasesPerCycle === 1 ? '' :
                        config.phasesPerCycle === 4 ? ' (daily)' :
                        config.phasesPerCycle === 28 ? ' (weekly)' :
                        ` (every ${config.phasesPerCycle} phases)`;
      const spaceUsed = getInventorySpaceUsed(updatedLocation, goodsSizes);

      // Build input consumption message if applicable
      let inputMsg = '';
      if (config.inputGoods) {
        const consumed = Object.entries(config.inputGoods)
          .map(([good, amount]) => `${amount} ${good}`)
          .join(', ');
        inputMsg = `, consumed ${consumed}`;
      }

      ActivityLog.info(
        phase,
        'production',
        `${presentEmployeeCount} workers produced ${added} ${config.good}${cycleDesc}${inputMsg} (space: ${spaceUsed.toFixed(1)}/${updatedLocation.inventoryCapacity})`,
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
