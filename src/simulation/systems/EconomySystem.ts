/**
 * EconomySystem - Handles agent economic decisions and weekly processing
 */

import type { Agent, Location, Organization } from '../../types';
import type { EconomyConfig, AgentsConfig, LocationTemplate } from '../../config/ConfigLoader';
import { ActivityLog } from '../ActivityLog';
import {
  purchaseFromLocation,
  hireAgent,
  releaseAgent,
  resetWeeklyTracking,
  getHiringLocations,
  createLocation,
} from './LocationSystem';
import { transferInventory, getGoodsCount, getAvailableCapacity, type GoodsSizes } from './InventorySystem';
import { createOrganization, addLocationToOrg } from './OrgSystem';

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
let orgIdCounter = 100; // Start at 100 to avoid conflicts with initial orgs

function getNextShopName(): string {
  const name = SHOP_NAMES[shopNameIndex % SHOP_NAMES.length];
  shopNameIndex++;
  return name ?? "Shop";
}

function getNextLocationId(): string {
  return `location-${locationIdCounter++}`;
}

function getNextOrgId(): string {
  return `org-${orgIdCounter++}`;
}

/**
 * Process agent economic decisions for one phase
 */
export function processAgentEconomicDecision(
  agent: Agent,
  locations: Location[],
  orgs: Organization[],
  economyConfig: EconomyConfig,
  agentsConfig: AgentsConfig,
  locationTemplates: Record<string, LocationTemplate>,
  phase: number
): { agent: Agent; locations: Location[]; orgs: Organization[]; newLocation?: Location; newOrg?: Organization } {
  // Skip dead agents
  if (agent.status === 'dead') {
    return { agent, locations, orgs };
  }

  let updatedAgent = agent;
  let updatedLocations = [...locations];
  let updatedOrgs = [...orgs];
  let newLocation: Location | undefined;

  // Decision priority:
  // 0. If shop owner + low inventory: restock shop
  // 1. If hungry + has credits + shop has goods: buy provisions
  // 2. If unemployed + shops hiring: seek job
  // 3. If has lots of credits: consider opening business
  // 4. Else: idle

  const isHungry = agent.needs.hunger >= agentsConfig.hunger.threshold;
  const hasNoFood = (agent.inventory['provisions'] ?? 0) < agentsConfig.hunger.provisionsPerMeal;
  const provisionsPrice = economyConfig.goods['provisions']?.retailPrice ?? 10;
  const hasCredits = agent.wallet.credits >= provisionsPrice;

  // 0. Shop owners restock their inventory from wholesale locations
  // Find the org this agent leads (if any) and its retail locations
  const ledOrg = updatedOrgs.find((org) => org.leader === agent.id);
  if (ledOrg) {
    // Find retail locations owned by this org
    const orgRetailLocations = updatedLocations.filter(
      (loc) => ledOrg.locations.includes(loc.id) && loc.tags.includes('retail')
    );
    for (const retailLoc of orgRetailLocations) {
      const result = tryRestockFromWholesale(ledOrg, retailLoc, updatedLocations, updatedOrgs, economyConfig, phase);
      updatedLocations = result.locations;
      updatedOrgs = result.orgs;
    }
  }

  // 1. Try to buy provisions if hungry and no food
  if (isHungry && hasNoFood && hasCredits) {
    const result = tryBuyProvisions(updatedAgent, updatedLocations, updatedOrgs, economyConfig, phase);
    updatedAgent = result.agent;
    updatedLocations = result.locations;
    updatedOrgs = result.orgs;
  }

  // 2. Try to get a job if unemployed
  if (updatedAgent.status === 'available' && !updatedAgent.employedAt) {
    const result = tryGetJob(updatedAgent, updatedLocations, updatedOrgs, economyConfig, phase);
    updatedAgent = result.agent;
    updatedLocations = result.locations;
  }

  // 3. Consider opening a business if wealthy enough
  // Employed agents can quit to start a business (but not if already a business owner)
  let newOrg: Organization | undefined;
  const canStartBusiness =
    updatedAgent.wallet.credits >= economyConfig.entrepreneurThreshold &&
    !leadsAnyOrg(updatedAgent, updatedOrgs) &&
    updatedAgent.status !== 'dead';

  if (canStartBusiness) {
    // If employed, need to quit job first
    if (updatedAgent.status === 'employed' && updatedAgent.employedAt) {
      const workplace = updatedLocations.find(loc => loc.id === updatedAgent.employedAt);
      if (workplace) {
        const releaseResult = releaseAgent(workplace, updatedAgent, 'starting business', phase);
        updatedAgent = releaseResult.agent;
        updatedLocations = updatedLocations.map(loc =>
          loc.id === workplace.id ? releaseResult.location : loc
        );
      }
    }

    const result = tryOpenBusiness(updatedAgent, locationTemplates, phase);
    if (result.newLocation && result.newOrg) {
      updatedAgent = result.agent;
      newLocation = result.newLocation;
      newOrg = result.newOrg;
    }
  }

  return { agent: updatedAgent, locations: updatedLocations, orgs: updatedOrgs, newLocation, newOrg };
}

/**
 * Try to buy provisions from a retail location (has 'retail' tag)
 * Revenue goes to the org that owns the shop
 */
function tryBuyProvisions(
  agent: Agent,
  locations: Location[],
  orgs: Organization[],
  economyConfig: EconomyConfig,
  phase: number
): { agent: Agent; locations: Location[]; orgs: Organization[] } {
  // Only buy from locations with 'retail' tag
  const retailLocations = locations.filter(
    (loc) => loc.tags.includes('retail') && (loc.inventory['provisions'] ?? 0) > 0
  );

  if (retailLocations.length === 0) {
    console.log(`[DEBUG BUY] ${agent.name} wants to buy but NO retail locations have provisions!`);
    return { agent, locations, orgs };
  }

  // Pick a random retail location
  const shop = retailLocations[Math.floor(Math.random() * retailLocations.length)];
  if (!shop) {
    return { agent, locations, orgs };
  }

  // Try to buy 1 provision
  const result = purchaseFromLocation(shop, agent, 'provisions', 1, economyConfig, phase);

  if (result.success) {
    // Update the location in the array
    const updatedLocations = locations.map((loc) =>
      loc.id === shop.id ? result.location : loc
    );

    // Transfer revenue to the org that owns the shop
    const retailPrice = economyConfig.goods['provisions']?.retailPrice ?? 10;
    const ownerOrg = orgs.find((org) => org.locations.includes(shop.id));

    if (ownerOrg) {
      console.log(`[DEBUG RETAIL] ${agent.name} bought from ${shop.name}, ${ownerOrg.name} receives ${retailPrice} credits (was: ${ownerOrg.wallet.credits}, now: ${ownerOrg.wallet.credits + retailPrice})`);
    } else {
      console.log(`[DEBUG RETAIL] WARNING: No owner org found for shop ${shop.id}! Shop locations in orgs:`, orgs.map(o => ({ name: o.name, locations: o.locations })));
    }

    const updatedOrgs = orgs.map((org) => {
      if (org.locations.includes(shop.id)) {
        return {
          ...org,
          wallet: {
            ...org.wallet,
            credits: org.wallet.credits + retailPrice,
          },
        };
      }
      return org;
    });

    return { agent: result.buyer, locations: updatedLocations, orgs: updatedOrgs };
  }

  return { agent, locations, orgs };
}

/**
 * Try to get a job at a hiring location (factory or shop)
 */
function tryGetJob(
  agent: Agent,
  locations: Location[],
  orgs: Organization[],
  economyConfig: EconomyConfig,
  phase: number
): { agent: Agent; locations: Location[] } {
  const hiringLocations = getHiringLocations(locations);

  if (hiringLocations.length === 0) {
    return { agent, locations };
  }

  // Find orgs this agent leads (can't work at your own business)
  const ledOrgIds = orgs.filter((org) => org.leader === agent.id).map((org) => org.id);

  // Filter out locations owned by orgs this agent leads
  const availableJobs = hiringLocations.filter(
    (loc) => !ledOrgIds.includes(loc.owner ?? '')
  );

  if (availableJobs.length === 0) {
    return { agent, locations };
  }

  // Pick a random hiring location
  const location = availableJobs[Math.floor(Math.random() * availableJobs.length)];
  if (!location) {
    return { agent, locations };
  }

  // Random salary within unskilled range
  const salaryRange = economyConfig.salary.unskilled;
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
 * Check if agent leads any organization (i.e., is a business owner)
 */
function leadsAnyOrg(agent: Agent, orgs: Organization[]): boolean {
  return orgs.some((org) => org.leader === agent.id);
}

/**
 * Try to open a new business (creates a micro-org to own it)
 */
function tryOpenBusiness(
  agent: Agent,
  locationTemplates: Record<string, LocationTemplate>,
  phase: number
): { agent: Agent; newLocation?: Location; newOrg?: Organization } {
  // 20% chance to try opening a business each phase when eligible
  if (Math.random() > 0.2) {
    return { agent };
  }

  // Choose retail_shop (cheaper) for now
  const template = locationTemplates['retail_shop'];
  if (!template) {
    return { agent };
  }

  const config = template.balance;

  // Check if agent can afford it
  const openingCost = config.openingCost ?? 0;
  if (agent.wallet.credits < openingCost) {
    return { agent };
  }

  // Create a micro-org for this business
  const orgId = getNextOrgId();
  const orgName = `${agent.name}'s Shop`;

  // Org gets most of the agent's credits as business capital
  const businessCapital = Math.floor(agent.wallet.credits * 0.7); // 70% goes to business

  let newOrg = createOrganization(
    orgId,
    orgName,
    agent.id,
    agent.name,
    businessCapital,
    phase
  );

  // Create the location owned by the org
  const locationId = getNextLocationId();
  const locationName = getNextShopName();

  const newLocation = createLocation(
    locationId,
    locationName,
    template,
    orgId, // Owned by org, not agent directly
    orgName,
    phase
  );

  // Link location to org
  newOrg = addLocationToOrg(newOrg, locationId);

  // Deduct opening cost + business capital from agent
  const totalCost = openingCost + businessCapital;
  const updatedAgent: Agent = {
    ...agent,
    status: 'employed', // Now running their own business
    employer: orgId,
    wallet: {
      ...agent.wallet,
      credits: agent.wallet.credits - totalCost,
    },
  };

  return { agent: updatedAgent, newLocation, newOrg };
}

/**
 * Org tries to restock their shop by buying wholesale from another org
 * Uses real supply chain: wholesale location → retail shop (B2B transaction)
 */
function tryRestockFromWholesale(
  buyerOrg: Organization,
  shop: Location,
  locations: Location[],
  orgs: Organization[],
  economyConfig: EconomyConfig,
  phase: number
): { locations: Location[]; orgs: Organization[] } {
  const goodsSizes: GoodsSizes = { goods: economyConfig.goods, defaultGoodsSize: economyConfig.defaultGoodsSize };
  const currentStock = getGoodsCount(shop, 'provisions');
  const restockThreshold = 15; // Restock when below this
  const shopCapacity = getAvailableCapacity(shop, goodsSizes);
  const wholesalePrice = economyConfig.goods['provisions']?.wholesalePrice ?? 5;

  // Only restock if inventory is low
  if (currentStock >= restockThreshold) {
    return { locations, orgs };
  }

  console.log(`[DEBUG WHOLESALE] ${buyerOrg.name} trying to restock ${shop.name} (stock: ${currentStock}, credits: ${buyerOrg.wallet.credits})`);

  // Find a wholesale location with provisions (has 'wholesale' tag)
  // Exclude our own locations (can't buy from yourself)
  const wholesaleLocations = locations.filter(
    (loc) => loc.tags.includes('wholesale') &&
             getGoodsCount(loc, 'provisions') > 0 &&
             !buyerOrg.locations.includes(loc.id)
  );

  if (wholesaleLocations.length === 0) {
    // No wholesale locations with stock - can't restock
    console.log(`[DEBUG WHOLESALE] No wholesale locations found with stock!`);
    return { locations, orgs };
  }

  // Pick a random wholesale location
  const wholesaler = wholesaleLocations[Math.floor(Math.random() * wholesaleLocations.length)];
  if (!wholesaler) {
    return { locations, orgs };
  }

  // Find the org that owns this wholesale location
  const sellerOrg = orgs.find((org) => org.locations.includes(wholesaler.id));
  if (!sellerOrg) {
    // Wholesale location has no owner org - shouldn't happen but handle gracefully
    return { locations, orgs };
  }

  // Calculate how much to buy (limited by wholesaler stock, shop capacity, and buyer org credits)
  // shopCapacity is now space-based, so calculate max items that fit
  const provisionSize = economyConfig.goods['provisions']?.size ?? economyConfig.defaultGoodsSize;
  const maxItemsThatFit = Math.floor(shopCapacity / provisionSize);
  const wholesalerStock = getGoodsCount(wholesaler, 'provisions');
  const desiredAmount = Math.min(30, maxItemsThatFit); // Try to buy up to 30
  const affordableAmount = Math.floor(buyerOrg.wallet.credits / wholesalePrice);
  const amountToBuy = Math.min(desiredAmount, wholesalerStock, affordableAmount);

  console.log(`[DEBUG WHOLESALE] Calculation: desired=${desiredAmount}, wholesalerStock=${wholesalerStock}, affordable=${affordableAmount}, buying=${amountToBuy}`);

  if (amountToBuy <= 0) {
    console.log(`[DEBUG WHOLESALE] Can't buy anything! (no credits or no stock)`);
    return { locations, orgs };
  }

  const totalCost = amountToBuy * wholesalePrice;

  // Transfer inventory from wholesaler to shop (respects goods sizes)
  const { from: updatedWholesaler, to: updatedShop, transferred } = transferInventory(
    wholesaler,
    shop,
    'provisions',
    amountToBuy,
    goodsSizes
  );

  if (transferred <= 0) {
    return { locations, orgs };
  }

  // Transfer credits from buyer org to seller org
  const updatedBuyerOrg: Organization = {
    ...buyerOrg,
    wallet: {
      ...buyerOrg.wallet,
      credits: buyerOrg.wallet.credits - totalCost,
    },
  };

  const updatedSellerOrg: Organization = {
    ...sellerOrg,
    wallet: {
      ...sellerOrg.wallet,
      credits: sellerOrg.wallet.credits + totalCost,
    },
  };

  console.log(`[DEBUG WHOLESALE] SUCCESS: ${buyerOrg.name} bought ${transferred} from ${wholesaler.name}. Buyer credits: ${buyerOrg.wallet.credits} -> ${updatedBuyerOrg.wallet.credits}, Seller credits: ${sellerOrg.wallet.credits} -> ${updatedSellerOrg.wallet.credits}`);

  ActivityLog.info(
    phase,
    'wholesale',
    `${buyerOrg.name} bought ${transferred} provisions from ${wholesaler.name} for ${totalCost} credits`,
    buyerOrg.id,
    buyerOrg.name
  );

  // Update locations and orgs arrays
  const updatedLocations = locations.map((loc) => {
    if (loc.id === wholesaler.id) return updatedWholesaler as Location;
    if (loc.id === shop.id) return updatedShop as Location;
    return loc;
  });

  const updatedOrgs = orgs.map((org) => {
    if (org.id === buyerOrg.id) return updatedBuyerOrg;
    if (org.id === sellerOrg.id) return updatedSellerOrg;
    return org;
  });

  return { locations: updatedLocations, orgs: updatedOrgs };
}

/**
 * Process weekly economy for all organizations
 * - Org pays employee salaries from org wallet
 * - Org pays operating costs from org wallet
 * - Dissolve orgs that go bankrupt
 */
export function processWeeklyEconomy(
  agents: Agent[],
  locations: Location[],
  orgs: Organization[],
  phase: number
): { agents: Agent[]; locations: Location[]; orgs: Organization[] } {
  let updatedAgents = [...agents];
  let updatedLocations = [...locations];
  let updatedOrgs = [...orgs];
  const orgsToRemove: string[] = [];
  const locationsToRemove: string[] = [];

  for (let orgIdx = 0; orgIdx < updatedOrgs.length; orgIdx++) {
    let org = updatedOrgs[orgIdx];
    if (!org) continue;

    const orgId = org.id; // Capture for type narrowing in filter
    // Find all locations owned by this org
    const orgLocations = updatedLocations.filter((loc) => loc.owner === orgId);

    for (const location of orgLocations) {
      // Find employees at this location
      const employeeIndices = location.employees
        .map((empId) => updatedAgents.findIndex((a) => a.id === empId))
        .filter((idx) => idx !== -1);

      const employees = employeeIndices
        .map((idx) => updatedAgents[idx])
        .filter((e): e is Agent => e !== undefined);

      // Process payroll from org wallet
      const payrollResult = processOrgPayroll(org, employees, phase);
      org = payrollResult.org;

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

      // Process operating costs from org wallet
      if (org.wallet.credits >= updatedLocation.operatingCost) {
        ActivityLog.info(
          phase,
          'costs',
          `paid ${updatedLocation.operatingCost} credits operating costs for ${updatedLocation.name}`,
          org.id,
          org.name
        );
        org = {
          ...org,
          wallet: {
            ...org.wallet,
            credits: org.wallet.credits - updatedLocation.operatingCost,
          },
        };
        updatedLocation = {
          ...updatedLocation,
          weeklyCosts: updatedLocation.weeklyCosts + updatedLocation.operatingCost,
        };
      } else {
        ActivityLog.warning(
          phase,
          'costs',
          `cannot afford operating costs for ${updatedLocation.name}`,
          org.id,
          org.name
        );
      }

      // Reset weekly tracking
      updatedLocation = resetWeeklyTracking(updatedLocation);

      // Update location in array
      const locIndex = updatedLocations.findIndex((l) => l.id === location.id);
      if (locIndex !== -1) {
        updatedLocations[locIndex] = updatedLocation;
      }
    }

    // Pay owner dividend/salary (owner extracts profits from the business)
    const ownerSalary = 30; // Owner takes 30 credits/week as salary
    const currentOrg = org; // Capture for type narrowing
    if (!currentOrg) continue;
    const leaderIdx = updatedAgents.findIndex((a) => a.id === currentOrg.leader);
    if (leaderIdx !== -1 && currentOrg.wallet.credits >= ownerSalary) {
      const leader = updatedAgents[leaderIdx];
      if (leader && leader.status !== 'dead') {
        org = {
          ...currentOrg,
          wallet: {
            ...currentOrg.wallet,
            credits: currentOrg.wallet.credits - ownerSalary,
          },
        };
        updatedAgents[leaderIdx] = {
          ...leader,
          wallet: {
            ...leader.wallet,
            credits: leader.wallet.credits + ownerSalary,
          },
        };
        ActivityLog.info(
          phase,
          'dividend',
          `received ${ownerSalary} credits from ${currentOrg.name}`,
          leader.id,
          leader.name
        );
      }
    }

    // Check for org dissolution conditions:
    // 1. Bankruptcy (credits < 0)
    // 2. Insolvency (can't afford minimum operations - less than 50 credits)
    // 3. Leader death
    const leaderForCheck = updatedAgents.find((a) => a.id === org.leader);
    const leaderDead = !leaderForCheck || leaderForCheck.status === 'dead';
    const isBankrupt = org.wallet.credits < 0;
    const isInsolvent = org.wallet.credits < 50; // Can't afford to restock or operate

    let dissolutionReason = '';
    if (leaderDead) {
      dissolutionReason = 'owner died';
    } else if (isBankrupt) {
      dissolutionReason = 'bankrupt';
    } else if (isInsolvent) {
      dissolutionReason = 'insolvent';
    }

    if (dissolutionReason) {
      ActivityLog.critical(
        phase,
        'business',
        `${org.name} dissolved (${dissolutionReason})`,
        org.id,
        org.name
      );

      // Release all employees from all org locations
      for (const location of orgLocations) {
        for (const empId of location.employees) {
          const empIndex = updatedAgents.findIndex((a) => a.id === empId);
          if (empIndex !== -1) {
            const emp = updatedAgents[empIndex];
            if (emp && emp.status !== 'dead') {
              updatedAgents[empIndex] = {
                ...emp,
                status: 'available',
                employedAt: undefined,
                employer: undefined,
                salary: 0,
              };
            }
          }
        }
        locationsToRemove.push(location.id);
      }

      // Release the leader too (if alive)
      if (leaderForCheck && leaderForCheck.status !== 'dead') {
        const leaderIdx = updatedAgents.findIndex((a) => a.id === org.leader);
        if (leaderIdx !== -1) {
          updatedAgents[leaderIdx] = {
            ...leaderForCheck,
            status: 'available',
            employer: undefined,
          };
        }
      }

      orgsToRemove.push(org.id);
    }

    // Update org in array
    updatedOrgs[orgIdx] = org;
  }

  // Remove dissolved orgs and their locations
  updatedOrgs = updatedOrgs.filter((org) => !orgsToRemove.includes(org.id));
  updatedLocations = updatedLocations.filter((loc) => !locationsToRemove.includes(loc.id));

  return { agents: updatedAgents, locations: updatedLocations, orgs: updatedOrgs };
}

/**
 * Process payroll from org wallet
 */
function processOrgPayroll(
  org: Organization,
  employees: Agent[],
  phase: number
): { org: Organization; employees: Agent[]; unpaidEmployees: Agent[] } {
  let updatedOrg = org;
  const paidEmployees: Agent[] = [];
  const unpaidEmployees: Agent[] = [];

  for (const employee of employees) {
    if (updatedOrg.wallet.credits >= employee.salary) {
      // Pay the employee from org wallet
      updatedOrg = {
        ...updatedOrg,
        wallet: {
          ...updatedOrg.wallet,
          credits: updatedOrg.wallet.credits - employee.salary,
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
        `paid ${employee.salary} credits by ${org.name}`,
        employee.id,
        employee.name
      );
    } else {
      // Can't pay - employee will quit
      unpaidEmployees.push(employee);
      ActivityLog.warning(
        phase,
        'payroll',
        `not paid by ${org.name} (insufficient funds)`,
        employee.id,
        employee.name
      );
    }
  }

  return { org: updatedOrg, employees: paidEmployees, unpaidEmployees };
}

/**
 * Restock a location's inventory (owner buys provisions to sell)
 * For simplicity, provisions appear from thin air for now
 */
export function restockLocation(
  location: Location,
  owner: Agent,
  amount: number,
  economyConfig: EconomyConfig,
  phase: number
): { location: Location; owner: Agent } {
  const cost = amount * (economyConfig.goods['provisions']?.retailPrice ?? 10);

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
