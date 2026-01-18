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
    passengers: [], // No passengers initially
    currentBuilding: building.id, // Parked at this building
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
      currentBuilding: buildingId,
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

/**
 * Process vehicle travel for one phase
 * Handles vehicles in transit, decrementing travel time and processing arrivals
 */
export function processVehicleTravel(
  vehicle: Vehicle,
  phase: number
): Vehicle {
  // Skip if vehicle is not traveling
  if (!vehicle.travelingToBuilding || vehicle.travelPhasesRemaining === undefined) {
    return vehicle;
  }

  // Decrement travel time
  const remainingPhases = vehicle.travelPhasesRemaining - 1;

  // Still traveling
  if (remainingPhases > 0) {
    return {
      ...vehicle,
      travelPhasesRemaining: remainingPhases,
    };
  }

  // Arrived at destination
  ActivityLog.info(
    phase,
    'vehicle',
    `${vehicle.name} arrived at destination`,
    vehicle.operator ?? 'system',
    vehicle.name
  );

  return {
    ...vehicle,
    currentBuilding: vehicle.travelingToBuilding,
    travelingFromBuilding: undefined,
    travelingToBuilding: undefined,
    travelMethod: undefined,
    travelPhasesRemaining: undefined,
  };
}

/**
 * Start vehicle travel to a destination building
 * Uses transport system to calculate travel time
 */
export function startVehicleTravel(
  vehicle: Vehicle,
  fromBuilding: Building,
  toBuilding: Building,
  travelMethod: string,
  transportConfig: any,
  phase: number
): Vehicle {
  // Calculate travel time using transport system
  const distance = Math.sqrt(
    Math.pow(toBuilding.x - fromBuilding.x, 2) +
    Math.pow(toBuilding.y - fromBuilding.y, 2)
  );

  // Get phases for this travel method and distance
  const mode = transportConfig.transportModes[travelMethod];
  if (!mode) {
    console.warn(`[VehicleSystem] Unknown travel method: ${travelMethod}, using transit`);
    return vehicle;
  }

  const thresholds = mode.distanceThresholds;
  let phases = thresholds[thresholds.length - 1].phases; // Default to longest
  for (const threshold of thresholds) {
    if (distance <= threshold.maxDistance) {
      phases = threshold.phases;
      break;
    }
  }

  ActivityLog.info(
    phase,
    'vehicle',
    `${vehicle.name} started traveling to destination (${phases} phases)`,
    vehicle.operator ?? 'system',
    vehicle.name
  );

  return {
    ...vehicle,
    currentBuilding: undefined, // In transit, not at any building
    travelingFromBuilding: fromBuilding.id,
    travelingToBuilding: toBuilding.id,
    travelMethod,
    travelPhasesRemaining: phases,
  };
}

/**
 * Move a vehicle to a new building
 * Should be called when the driver arrives at a new location
 */
export function moveVehicleToBuilding(
  vehicle: Vehicle,
  buildingId: string,
  phase: number
): Vehicle {
  if (vehicle.currentBuilding === buildingId) {
    return vehicle; // Already at this building
  }

  ActivityLog.info(
    phase,
    'vehicle',
    `${vehicle.name} arrived at new location`,
    vehicle.operator ?? 'system',
    vehicle.name
  );

  return {
    ...vehicle,
    currentBuilding: buildingId,
  };
}

/**
 * Agent boards a vehicle (as operator or passenger)
 * Updates both vehicle and agent state
 * Agent must be at the same building as the vehicle
 */
export function boardVehicle(
  vehicle: Vehicle,
  agent: Agent,
  asOperator: boolean,
  phase: number
): { vehicle: Vehicle; agent: Agent; success: boolean; reason?: string } {
  // Check if vehicle already has an operator (if trying to board as operator)
  if (asOperator && vehicle.operator) {
    return {
      vehicle,
      agent,
      success: false,
      reason: 'Vehicle already has an operator'
    };
  }

  // Check if agent is already in a vehicle
  if (agent.inVehicle) {
    return {
      vehicle,
      agent,
      success: false,
      reason: 'Agent is already in a vehicle'
    };
  }

  // Check if agent is in transit (can't board while traveling)
  if (agent.travelingTo) {
    return {
      vehicle,
      agent,
      success: false,
      reason: 'Agent is currently in transit'
    };
  }

  const role = asOperator ? 'operator' : 'passenger';

  ActivityLog.info(
    phase,
    'vehicle',
    `boarded ${vehicle.name} as ${role}`,
    agent.id,
    agent.name
  );

  // Update vehicle
  const updatedVehicle: Vehicle = {
    ...vehicle,
    operator: asOperator ? agent.id : vehicle.operator,
    passengers: asOperator ? vehicle.passengers : [...vehicle.passengers, agent.id],
  };

  // Update agent
  const updatedAgent: Agent = {
    ...agent,
    inVehicle: vehicle.id,
    currentLocation: undefined, // Agent location is now determined by vehicle
  };

  return {
    vehicle: updatedVehicle,
    agent: updatedAgent,
    success: true,
  };
}

/**
 * Agent exits a vehicle
 * Updates both vehicle and agent state
 * Agent will be at the vehicle's current building
 */
export function exitVehicle(
  vehicle: Vehicle,
  agent: Agent,
  _buildings: Building[],
  phase: number
): { vehicle: Vehicle; agent: Agent; success: boolean; reason?: string } {
  // Check if agent is actually in this vehicle
  if (agent.inVehicle !== vehicle.id) {
    return {
      vehicle,
      agent,
      success: false,
      reason: 'Agent is not in this vehicle'
    };
  }

  // Check if vehicle is in transit (can't exit while moving)
  if (vehicle.travelingToBuilding) {
    return {
      vehicle,
      agent,
      success: false,
      reason: 'Cannot exit vehicle while in transit'
    };
  }

  // Check if vehicle is at a building
  if (!vehicle.currentBuilding) {
    return {
      vehicle,
      agent,
      success: false,
      reason: 'Vehicle is not at a building'
    };
  }

  const wasOperator = vehicle.operator === agent.id;

  ActivityLog.info(
    phase,
    'vehicle',
    `exited ${vehicle.name}`,
    agent.id,
    agent.name
  );

  // Update vehicle
  const updatedVehicle: Vehicle = {
    ...vehicle,
    operator: wasOperator ? undefined : vehicle.operator,
    passengers: vehicle.passengers.filter(p => p !== agent.id),
  };

  // Update agent - clear inVehicle, set currentLocation to undefined (they're at building level)
  // Agent will need to move to a specific location within the building
  const updatedAgent: Agent = {
    ...agent,
    inVehicle: undefined,
    currentLocation: undefined, // Agent is at building but not in a specific location yet
  };

  return {
    vehicle: updatedVehicle,
    agent: updatedAgent,
    success: true,
  };
}
