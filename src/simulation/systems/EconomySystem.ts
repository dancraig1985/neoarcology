/**
 * EconomySystem - Handles agent economic decisions and weekly processing
 */

import type { Agent, Location } from '../../types';
import type { BalanceConfig } from '../../config/ConfigLoader';
import { ActivityLog } from '../ActivityLog';
import {
  purchaseFromLocation,
  hireAgent,
  releaseAgent,
  processPayroll,
  processOperatingCosts,
  resetWeeklyTracking,
  getHiringLocations,
  getLocationsWithGoods,
  createLocation,
  shouldDissolve,
} from './LocationSystem';

// Location name generator
const SHOP_NAMES = [
  "Corner Store",
  "Quick Mart",
  "Daily Goods",
  "City Supply",
  "Metro Market",
  "Urban Provisions",
  "Street Shop",
  "Neon Grocers",
  "Cyber Mart",
  "Downtown Depot",
];

let shopNameIndex = 0;
let locationIdCounter = 1;

function getNextShopName(): string {
  const name = SHOP_NAMES[shopNameIndex % SHOP_NAMES.length];
  shopNameIndex++;
  return name ?? "Shop";
}

function getNextLocationId(): string {
  return `location-${locationIdCounter++}`;
}

/**
 * Process agent economic decisions for one phase
 */
export function processAgentEconomicDecision(
  agent: Agent,
  locations: Location[],
  agents: Agent[],
  balance: BalanceConfig,
  phase: number
): { agent: Agent; locations: Location[]; newLocation?: Location } {
  // Skip dead agents
  if (agent.status === 'dead') {
    return { agent, locations };
  }

  let updatedAgent = agent;
  let updatedLocations = [...locations];
  let newLocation: Location | undefined;

  // Decision priority:
  // 1. If hungry + has credits + shop has goods: buy provisions
  // 2. If unemployed + shops hiring: seek job
  // 3. If has lots of credits: consider opening business
  // 4. Else: idle

  const isHungry = agent.needs.hunger >= balance.agent.hungerThreshold;
  const hasNoFood = (agent.inventory['provisions'] ?? 0) < balance.agent.provisionsPerMeal;
  const hasCredits = agent.wallet.credits >= balance.economy.prices.provisions;

  // 1. Try to buy provisions if hungry and no food
  if (isHungry && hasNoFood && hasCredits) {
    const result = tryBuyProvisions(updatedAgent, updatedLocations, balance, phase);
    updatedAgent = result.agent;
    updatedLocations = result.locations;
  }

  // 2. Try to get a job if unemployed
  if (updatedAgent.status === 'available' && !updatedAgent.employedAt) {
    const result = tryGetJob(updatedAgent, updatedLocations, agents, balance, phase);
    updatedAgent = result.agent;
    updatedLocations = result.locations;
  }

  // 3. Consider opening a business if wealthy enough
  if (
    updatedAgent.status === 'available' &&
    updatedAgent.wallet.credits >= balance.agent.entrepreneurThreshold &&
    !ownsAnyLocation(updatedAgent, updatedLocations)
  ) {
    const result = tryOpenBusiness(updatedAgent, balance, phase);
    if (result.newLocation) {
      updatedAgent = result.agent;
      newLocation = result.newLocation;
    }
  }

  return { agent: updatedAgent, locations: updatedLocations, newLocation };
}

/**
 * Try to buy provisions from any available shop
 */
function tryBuyProvisions(
  agent: Agent,
  locations: Location[],
  balance: BalanceConfig,
  phase: number
): { agent: Agent; locations: Location[] } {
  const shopsWithFood = getLocationsWithGoods(locations, 'provisions');

  if (shopsWithFood.length === 0) {
    return { agent, locations };
  }

  // Pick a random shop
  const shop = shopsWithFood[Math.floor(Math.random() * shopsWithFood.length)];
  if (!shop) {
    return { agent, locations };
  }

  // Try to buy 1 provision
  const result = purchaseFromLocation(shop, agent, 'provisions', 1, balance, phase);

  if (result.success) {
    // Update the location in the array
    const updatedLocations = locations.map((loc) =>
      loc.id === shop.id ? result.location : loc
    );
    return { agent: result.buyer, locations: updatedLocations };
  }

  return { agent, locations };
}

/**
 * Try to get a job at a hiring location
 */
function tryGetJob(
  agent: Agent,
  locations: Location[],
  _agents: Agent[],
  balance: BalanceConfig,
  phase: number
): { agent: Agent; locations: Location[] } {
  const hiringLocations = getHiringLocations(locations);

  if (hiringLocations.length === 0) {
    return { agent, locations };
  }

  // Pick a random hiring location
  const location = hiringLocations[Math.floor(Math.random() * hiringLocations.length)];
  if (!location) {
    return { agent, locations };
  }

  // Don't work at your own shop
  if (location.owner === agent.id) {
    return { agent, locations };
  }

  // Random salary within unskilled range
  const salaryRange = balance.economy.salary.unskilled;
  const salary = Math.floor(
    Math.random() * (salaryRange.max - salaryRange.min + 1) + salaryRange.min
  );

  const result = hireAgent(location, agent, salary, phase);

  const updatedLocations = locations.map((loc) =>
    loc.id === location.id ? result.location : loc
  );

  return { agent: result.agent, locations: updatedLocations };
}

/**
 * Check if agent owns any location
 */
function ownsAnyLocation(agent: Agent, locations: Location[]): boolean {
  return locations.some((loc) => loc.owner === agent.id);
}

/**
 * Try to open a new business
 */
function tryOpenBusiness(
  agent: Agent,
  balance: BalanceConfig,
  phase: number
): { agent: Agent; newLocation?: Location } {
  // 20% chance to try opening a business each phase when eligible
  if (Math.random() > 0.2) {
    return { agent };
  }

  // Choose retail_shop (cheaper) for now
  const template = 'retail_shop';
  const config = balance.locations[template];
  if (!config) {
    return { agent };
  }

  // Check if agent can afford it
  if (agent.wallet.credits < config.openingCost) {
    return { agent };
  }

  // Open the business
  const locationId = getNextLocationId();
  const locationName = getNextShopName();

  const newLocation = createLocation(
    locationId,
    locationName,
    template,
    agent.id,
    agent.name,
    balance,
    phase
  );

  // Deduct opening cost
  const updatedAgent: Agent = {
    ...agent,
    wallet: {
      ...agent.wallet,
      credits: agent.wallet.credits - config.openingCost,
    },
  };

  return { agent: updatedAgent, newLocation };
}

/**
 * Process weekly economy (payroll, operating costs, dissolution)
 * Called on week rollover
 */
export function processWeeklyEconomy(
  agents: Agent[],
  locations: Location[],
  balance: BalanceConfig,
  phase: number
): { agents: Agent[]; locations: Location[] } {
  let updatedAgents = [...agents];
  let updatedLocations = [...locations];
  const locationsToRemove: string[] = [];

  for (const location of updatedLocations) {
    if (location.ownerType !== 'agent' || !location.owner) {
      continue;
    }

    // Find the owner
    const ownerIndex = updatedAgents.findIndex((a) => a.id === location.owner);
    if (ownerIndex === -1) {
      continue;
    }
    let owner = updatedAgents[ownerIndex];
    if (!owner) continue;

    // Find employees
    const employeeIndices = location.employees
      .map((empId) => updatedAgents.findIndex((a) => a.id === empId))
      .filter((idx) => idx !== -1);

    const employees = employeeIndices
      .map((idx) => updatedAgents[idx])
      .filter((e): e is Agent => e !== undefined);

    // Process payroll
    const payrollResult = processPayroll(location, owner, employees, phase);
    owner = payrollResult.owner;

    // Update paid employees
    for (const paidEmp of payrollResult.employees) {
      const idx = updatedAgents.findIndex((a) => a.id === paidEmp.id);
      if (idx !== -1) {
        updatedAgents[idx] = paidEmp;
      }
    }

    // Release unpaid employees
    let updatedLocation = location;
    for (const unpaidEmp of payrollResult.unpaidEmployees) {
      const releaseResult = releaseAgent(updatedLocation, unpaidEmp, 'unpaid', phase);
      updatedLocation = releaseResult.location;
      const idx = updatedAgents.findIndex((a) => a.id === unpaidEmp.id);
      if (idx !== -1) {
        updatedAgents[idx] = releaseResult.agent;
      }
    }

    // Process operating costs
    const costResult = processOperatingCosts(updatedLocation, owner, balance, phase);
    owner = costResult.owner;
    updatedLocation = costResult.location;

    // Update owner
    updatedAgents[ownerIndex] = owner;

    // Check for dissolution
    if (shouldDissolve(owner)) {
      ActivityLog.critical(
        phase,
        'business',
        `${location.name} dissolved (owner bankrupt)`,
        location.id,
        location.name
      );

      // Release all remaining employees
      for (const empId of updatedLocation.employees) {
        const empIndex = updatedAgents.findIndex((a) => a.id === empId);
        if (empIndex !== -1) {
          const emp = updatedAgents[empIndex];
          if (emp) {
            updatedAgents[empIndex] = {
              ...emp,
              status: 'available',
              employedAt: undefined,
              salary: 0,
            };
          }
        }
      }

      locationsToRemove.push(location.id);
    } else {
      // Reset weekly tracking
      updatedLocation = resetWeeklyTracking(updatedLocation);

      // Update location in array
      const locIndex = updatedLocations.findIndex((l) => l.id === location.id);
      if (locIndex !== -1) {
        updatedLocations[locIndex] = updatedLocation;
      }
    }
  }

  // Remove dissolved locations
  updatedLocations = updatedLocations.filter((loc) => !locationsToRemove.includes(loc.id));

  return { agents: updatedAgents, locations: updatedLocations };
}

/**
 * Restock a location's inventory (owner buys provisions to sell)
 * For simplicity, provisions appear from thin air for now
 */
export function restockLocation(
  location: Location,
  owner: Agent,
  amount: number,
  balance: BalanceConfig,
  phase: number
): { location: Location; owner: Agent } {
  const cost = amount * balance.economy.prices.provisions;

  if (owner.wallet.credits < cost) {
    return { location, owner };
  }

  ActivityLog.info(
    phase,
    'restock',
    `restocked ${location.name} with ${amount} provisions for ${cost} credits`,
    owner.id,
    owner.name
  );

  return {
    location: {
      ...location,
      inventory: {
        ...location.inventory,
        provisions: (location.inventory['provisions'] ?? 0) + amount,
      },
    },
    owner: {
      ...owner,
      wallet: {
        ...owner.wallet,
        credits: owner.wallet.credits - cost,
      },
    },
  };
}
