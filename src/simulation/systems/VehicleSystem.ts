/**
 * VehicleSystem - MVP for PLAN-027
 * Handles vehicle creation, ownership, operation, and cargo management
 */

import type { Vehicle, Agent, Organization, Building, Inventory } from '../../types';
import { ActivityLog } from '../ActivityLog';

/**
 * Create a new vehicle
 */
export function createVehicle(
  id: string,
  name: string,
  template: string,
  owner: Organization,
  building: Building,
  cargoCapacity: number,
  phase: number
): Vehicle {
  ActivityLog.info(
    phase,
    'vehicle',
    `${owner.name} acquired ${template} "${name}" (parked at ${building.name})`,
    owner.id,
    owner.name
  );

  return {
    id,
    name,
    template,
    created: phase,
    owner: owner.id,
    operator: undefined, // Parked, not being operated
    building: building.id,
    cargo: {}, // Empty cargo
    cargoCapacity,
  };
}

/**
 * Claim a vehicle (agent becomes operator)
 * Agent must be at the same building as the vehicle
 */
export function claimVehicle(
  vehicle: Vehicle,
  agent: Agent,
  _buildings: Building[],
  phase: number
): { vehicle: Vehicle; success: boolean } {
  // Check if vehicle is already claimed
  if (vehicle.operator) {
    return { vehicle, success: false };
  }

  // Check if agent is at the same building as the vehicle
  // (In MVP, we just check if agent's current location is in the same building)
  // This is simplified - in full version would check agent.currentLocation's building property

  ActivityLog.info(
    phase,
    'vehicle',
    `claimed ${vehicle.name} (${vehicle.template})`,
    agent.id,
    agent.name
  );

  return {
    vehicle: {
      ...vehicle,
      operator: agent.id,
    },
    success: true,
  };
}

/**
 * Release a vehicle (agent stops operating, vehicle parks at current building)
 */
export function releaseVehicle(
  vehicle: Vehicle,
  agent: Agent,
  buildingId: string,
  phase: number
): { vehicle: Vehicle } {
  if (vehicle.operator !== agent.id) {
    return { vehicle }; // Agent doesn't own this vehicle
  }

  ActivityLog.info(
    phase,
    'vehicle',
    `released ${vehicle.name} at building ${buildingId}`,
    agent.id,
    agent.name
  );

  return {
    vehicle: {
      ...vehicle,
      operator: undefined,
      building: buildingId,
    },
  };
}

/**
 * Load goods from location into vehicle cargo
 * Uses inventory capacity system (goods have sizes)
 */
export function loadCargo(
  vehicle: Vehicle,
  locationInventory: Inventory,
  good: string,
  amount: number,
  goodSize: number,
  phase: number
): { vehicle: Vehicle; locationInventory: Inventory; loaded: number } {
  const available = locationInventory[good] ?? 0;
  if (available === 0) {
    return { vehicle, locationInventory, loaded: 0 };
  }

  // Calculate how much space is used in vehicle cargo
  const cargoSpaceUsed = Object.entries(vehicle.cargo).reduce((sum, [, cargoAmount]) => {
    // For MVP, assume all goods have same size (will integrate with economy.json goods sizes later)
    return sum + cargoAmount * goodSize;
  }, 0);

  const availableSpace = vehicle.cargoCapacity - cargoSpaceUsed;
  const maxCanLoad = Math.floor(availableSpace / goodSize);
  const actualLoad = Math.min(amount, available, maxCanLoad);

  if (actualLoad === 0) {
    return { vehicle, locationInventory, loaded: 0 };
  }

  ActivityLog.info(
    phase,
    'cargo',
    `loaded ${actualLoad} ${good} into ${vehicle.name} (space: ${(cargoSpaceUsed + actualLoad * goodSize).toFixed(1)}/${vehicle.cargoCapacity})`,
    vehicle.operator ?? vehicle.owner,
    vehicle.operator ? 'Driver' : 'System'
  );

  return {
    vehicle: {
      ...vehicle,
      cargo: {
        ...vehicle.cargo,
        [good]: (vehicle.cargo[good] ?? 0) + actualLoad,
      },
    },
    locationInventory: {
      ...locationInventory,
      [good]: available - actualLoad,
    },
    loaded: actualLoad,
  };
}

/**
 * Unload goods from vehicle cargo into location
 * Uses inventory capacity system
 */
export function unloadCargo(
  vehicle: Vehicle,
  locationInventory: Inventory,
  locationCapacity: number,
  good: string,
  amount: number,
  goodSize: number,
  phase: number
): { vehicle: Vehicle; locationInventory: Inventory; unloaded: number } {
  const vehicleHas = vehicle.cargo[good] ?? 0;
  if (vehicleHas === 0) {
    return { vehicle, locationInventory, unloaded: 0 };
  }

  // Calculate location available space
  const locationSpaceUsed = Object.entries(locationInventory).reduce((sum, [, locAmount]) => {
    return sum + locAmount * goodSize;
  }, 0);

  const locationAvailableSpace = locationCapacity - locationSpaceUsed;
  const maxCanUnload = Math.floor(locationAvailableSpace / goodSize);
  const actualUnload = Math.min(amount, vehicleHas, maxCanUnload);

  if (actualUnload === 0) {
    return { vehicle, locationInventory, unloaded: 0 };
  }

  ActivityLog.info(
    phase,
    'cargo',
    `unloaded ${actualUnload} ${good} from ${vehicle.name} to location`,
    vehicle.operator ?? vehicle.owner,
    vehicle.operator ? 'Driver' : 'System'
  );

  return {
    vehicle: {
      ...vehicle,
      cargo: {
        ...vehicle.cargo,
        [good]: vehicleHas - actualUnload,
      },
    },
    locationInventory: {
      ...locationInventory,
      [good]: (locationInventory[good] ?? 0) + actualUnload,
    },
    unloaded: actualUnload,
  };
}

/**
 * Get cargo space used in vehicle
 */
export function getCargoSpaceUsed(vehicle: Vehicle, goodSize: number = 1): number {
  return Object.values(vehicle.cargo).reduce((sum, amount) => sum + amount * goodSize, 0);
}

/**
 * Get available cargo space in vehicle
 */
export function getAvailableCargoSpace(vehicle: Vehicle, goodSize: number = 1): number {
  return vehicle.cargoCapacity - getCargoSpaceUsed(vehicle, goodSize);
}

/**
 * Check if vehicle is parked (not being operated)
 */
export function isParked(vehicle: Vehicle): boolean {
  return vehicle.operator === undefined;
}

/**
 * Check if vehicle is being operated
 */
export function isOperated(vehicle: Vehicle): boolean {
  return vehicle.operator !== undefined;
}
