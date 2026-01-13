/**
 * EconomySystem - Handles agent economic decisions and weekly processing
 */

import type { Agent, Location, Organization, Building } from '../../types';
import type { EconomyConfig, AgentsConfig, LocationTemplate, TransportConfig } from '../../config/ConfigLoader';
import { ActivityLog } from '../ActivityLog';
import {
  purchaseFromLocation,
  hireAgent,
  releaseAgent,
  resetWeeklyTracking,
  getHiringLocations,
  createLocation,
  findBuildingForLocation,
} from './LocationSystem';
import { transferInventory, getGoodsCount, getAvailableCapacity, type GoodsSizes } from './InventorySystem';
import { createOrganization, addLocationToOrg } from './OrgSystem';
import { findNearestLocation, isTraveling, startTravel, redirectTravel } from './TravelSystem';
import { setLocation, clearEmployment, onOrgDissolvedWithLocations } from './AgentStateHelpers';
import { needsRest, processRest } from './AgentSystem';

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
  allAgents: Agent[],
  locations: Location[],
  orgs: Organization[],
  buildings: Building[],
  economyConfig: EconomyConfig,
  agentsConfig: AgentsConfig,
  locationTemplates: Record<string, LocationTemplate>,
  transportConfig: TransportConfig,
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

  // SURVIVAL PRIORITY: Emergency hunger (>80) overrides everything
  // If agent is about to starve, redirect to food source immediately
  const EMERGENCY_HUNGER = 80;
  const hasFood = (updatedAgent.inventory['provisions'] ?? 0) >= agentsConfig.hunger.provisionsPerMeal;

  if (updatedAgent.needs.hunger > EMERGENCY_HUNGER && !hasFood) {
    const redirectResult = handleEmergencyHunger(
      updatedAgent,
      updatedLocations,
      updatedOrgs,
      economyConfig,
      transportConfig,
      phase
    );
    updatedAgent = redirectResult.agent;
    // If emergency handling started travel or redirected, skip normal decisions
    if (isTraveling(updatedAgent)) {
      return { agent: updatedAgent, locations: updatedLocations, orgs: updatedOrgs };
    }
  }

  // REST PRIORITY: Check if agent needs rest (forced or urgent)
  const restNeed = needsRest(updatedAgent, agentsConfig);

  // FORCED REST: At 100% fatigue, rest immediately wherever agent is
  if (restNeed === 'forced' && !isTraveling(updatedAgent)) {
    const currentLoc = updatedLocations.find((l) => l.id === updatedAgent.currentLocation);
    updatedAgent = processRest(updatedAgent, currentLoc, phase, agentsConfig);
    return { agent: updatedAgent, locations: updatedLocations, orgs: updatedOrgs };
  }

  // URGENT REST: At 90%+ fatigue, go home immediately (if has residence)
  // BUT: Employed agents should still go to work - they rest after their shift
  // Only forced rest (100%) truly interrupts work
  const isEmployedNeedingToWork = updatedAgent.employedAt && updatedAgent.currentLocation !== updatedAgent.employedAt;
  if (restNeed === 'urgent' && !isTraveling(updatedAgent) && !isEmployedNeedingToWork) {
    const restResult = handleUrgentRest(
      updatedAgent,
      updatedLocations,
      agentsConfig,
      transportConfig,
      phase
    );
    if (restResult.handled) {
      return { agent: restResult.agent, locations: updatedLocations, orgs: updatedOrgs };
    }
    updatedAgent = restResult.agent;
  }

  // HOMELESS CHECK: If agent has no location and isn't traveling, go to nearest public space
  if (!updatedAgent.currentLocation && !isTraveling(updatedAgent)) {
    const publicSpace = findNearestLocation(
      updatedAgent,
      updatedLocations,
      (loc) => loc.tags.includes('public')
    );
    if (publicSpace) {
      // Set agent directly at public space using atomic helper
      updatedAgent = setLocation(updatedAgent, publicSpace.id);
      ActivityLog.info(
        phase,
        'travel',
        `went to ${publicSpace.name} (homeless)`,
        updatedAgent.id,
        updatedAgent.name
      );
    }
  }

  // Decision priority:
  // 0. If shop owner + low inventory: restock shop
  // 1. If hungry + has credits + shop has goods: buy provisions
  // 2. If unemployed + shops hiring: seek job
  // 3. If has lots of credits: consider opening business
  // 4. If idle at non-public location: go to public space to hang out
  // 5. Else: stay where you are

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
    const result = tryBuyProvisions(updatedAgent, updatedLocations, updatedOrgs, economyConfig, transportConfig, phase);
    updatedAgent = result.agent;
    updatedLocations = result.locations;
    updatedOrgs = result.orgs;
  }

  // 1b. Employed agents should go to work if not already there
  // Skip if already traveling (includes travel to shop for food)
  if (
    updatedAgent.employedAt &&
    !isTraveling(updatedAgent) &&
    updatedAgent.currentLocation !== updatedAgent.employedAt
  ) {
    const workplace = updatedLocations.find((loc) => loc.id === updatedAgent.employedAt);
    if (workplace) {
      const travelingAgent = startTravel(updatedAgent, workplace, updatedLocations, transportConfig);
      if (travelingAgent !== updatedAgent) {
        ActivityLog.info(
          phase,
          'travel',
          `commuting to ${workplace.name}`,
          updatedAgent.id,
          updatedAgent.name
        );
        updatedAgent = travelingAgent;
      }
    } else {
      // Workplace no longer exists - agent is effectively unemployed
      // This can happen if the location was deleted while agent was traveling
      ActivityLog.info(
        phase,
        'employment',
        `workplace no longer exists, now unemployed`,
        updatedAgent.id,
        updatedAgent.name
      );
      updatedAgent = clearEmployment(updatedAgent);
    }
  }

  // 2. Try to get a job if unemployed
  if (updatedAgent.status === 'available' && !updatedAgent.employedAt) {
    const result = tryGetJob(updatedAgent, updatedLocations, updatedOrgs, economyConfig, phase);
    updatedAgent = result.agent;
    updatedLocations = result.locations;
  }

  // 2b. Housing search: Homeless agents with enough credits look for apartments
  if (
    !updatedAgent.residence &&
    updatedAgent.status !== 'dead' &&
    !isTraveling(updatedAgent)
  ) {
    const housingResult = tryFindHousing(updatedAgent, updatedLocations, agentsConfig, phase);
    updatedAgent = housingResult.agent;
    updatedLocations = housingResult.locations;
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

    const result = tryOpenBusiness(updatedAgent, locationTemplates, buildings, updatedLocations, allAgents, agentsConfig, phase);
    if (result.newLocation && result.newOrg) {
      updatedAgent = result.agent;
      newLocation = result.newLocation;
      newOrg = result.newOrg;
    }
  }

  // 4. REST-SEEKING: At 70%+ fatigue, head home to rest (after current activity)
  // This comes before leisure so tired agents go home instead of hanging out
  if (
    restNeed === 'seeking' &&
    !isTraveling(updatedAgent) &&
    updatedAgent.status === 'available'
  ) {
    const restResult = handleRestSeeking(
      updatedAgent,
      updatedLocations,
      agentsConfig,
      transportConfig,
      phase
    );
    if (restResult.handled) {
      return { agent: restResult.agent, locations: updatedLocations, orgs: updatedOrgs };
    }
    updatedAgent = restResult.agent;
  }

  // 5. Idle agents at non-public locations go to public spaces to hang out
  // This prevents agents from loitering at shops after buying food
  if (
    updatedAgent.status === 'available' &&
    !isHungry &&
    !isTraveling(updatedAgent) &&
    updatedAgent.currentLocation
  ) {
    const currentLoc = updatedLocations.find((l) => l.id === updatedAgent.currentLocation);
    const isAtPublicSpace = currentLoc?.tags.includes('public');

    if (currentLoc && !isAtPublicSpace) {
      const publicSpace = findNearestLocation(
        updatedAgent,
        updatedLocations,
        (loc) => loc.tags.includes('public')
      );
      if (publicSpace) {
        const travelingAgent = startTravel(updatedAgent, publicSpace, updatedLocations, transportConfig);
        if (travelingAgent !== updatedAgent) {
          ActivityLog.info(
            phase,
            'leisure',
            `heading to ${publicSpace.name} to hang out`,
            updatedAgent.id,
            updatedAgent.name
          );
          updatedAgent = travelingAgent;
        }
      }
    }
  }

  return { agent: updatedAgent, locations: updatedLocations, orgs: updatedOrgs, newLocation, newOrg };
}

/**
 * Try to buy provisions from a retail location (has 'retail' tag)
 * Revenue goes to the org that owns the shop
 * Requires agent to be physically present at the shop
 */
function tryBuyProvisions(
  agent: Agent,
  locations: Location[],
  orgs: Organization[],
  economyConfig: EconomyConfig,
  transportConfig: TransportConfig,
  phase: number
): { agent: Agent; locations: Location[]; orgs: Organization[] } {
  // If already traveling, can't start another action
  if (isTraveling(agent)) {
    return { agent, locations, orgs };
  }

  // Find all retail locations with provisions
  const retailLocations = locations.filter(
    (loc) => loc.tags.includes('retail') && (loc.inventory['provisions'] ?? 0) > 0
  );

  if (retailLocations.length === 0) {
    console.log(`[DEBUG BUY] ${agent.name} wants to buy but NO retail locations have provisions!`);
    return { agent, locations, orgs };
  }

  // Check if agent is already at a retail location with provisions
  let currentShop = agent.currentLocation
    ? retailLocations.find((loc) => loc.id === agent.currentLocation)
    : null;
  let updatedAgent = agent;

  if (!currentShop) {
    // Not at a shop - need to travel to nearest one
    const nearestShop = findNearestLocation(
      agent,
      locations,
      (loc) => loc.tags.includes('retail') && (loc.inventory['provisions'] ?? 0) > 0
    );

    if (nearestShop) {
      const travelingAgent = startTravel(agent, nearestShop, locations, transportConfig);
      if (travelingAgent !== agent) {
        ActivityLog.info(
          phase,
          'travel',
          `heading to ${nearestShop.name} to buy provisions`,
          agent.id,
          agent.name
        );
        updatedAgent = travelingAgent;

        // If travel was instant (agent is now at shop), continue to purchase
        if (!isTraveling(updatedAgent) && updatedAgent.currentLocation === nearestShop.id) {
          currentShop = nearestShop;
        } else {
          // Still traveling - return and buy next phase
          return { agent: updatedAgent, locations, orgs };
        }
      }
    }

    // Couldn't find a shop to travel to
    if (!currentShop) {
      return { agent: updatedAgent, locations, orgs };
    }
  }

  // Agent is at a shop with provisions - try to buy
  const result = purchaseFromLocation(currentShop, updatedAgent, 'provisions', 1, economyConfig, phase);

  if (result.success) {
    // Update the location in the array
    const updatedLocations = locations.map((loc) =>
      loc.id === currentShop.id ? result.location : loc
    );

    // Transfer revenue to the org that owns the shop
    const retailPrice = economyConfig.goods['provisions']?.retailPrice ?? 10;
    const ownerOrg = orgs.find((org) => org.locations.includes(currentShop.id));

    if (ownerOrg) {
      console.log(`[DEBUG RETAIL] ${updatedAgent.name} bought from ${currentShop.name}, ${ownerOrg.name} receives ${retailPrice} credits (was: ${ownerOrg.wallet.credits}, now: ${ownerOrg.wallet.credits + retailPrice})`);
    } else {
      console.log(`[DEBUG RETAIL] WARNING: No owner org found for shop ${currentShop.id}! Shop locations in orgs:`, orgs.map(o => ({ name: o.name, locations: o.locations })));
    }

    const updatedOrgs = orgs.map((org) => {
      if (org.locations.includes(currentShop.id)) {
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

  return { agent: updatedAgent, locations, orgs };
}

/**
 * Handle emergency hunger - redirect agent to nearest shop
 * Called when hunger > 80 and agent has no food
 */
function handleEmergencyHunger(
  agent: Agent,
  locations: Location[],
  _orgs: Organization[],
  _economyConfig: EconomyConfig,
  transportConfig: TransportConfig,
  phase: number
): { agent: Agent } {
  // Find a shop with provisions
  const nearestShop = findNearestLocation(
    agent,
    locations,
    (loc) => loc.tags.includes('retail') && (loc.inventory['provisions'] ?? 0) > 0
  );

  if (!nearestShop) {
    // No shops with food - nothing we can do
    ActivityLog.warning(
      phase,
      'hunger',
      `is in emergency hunger but no shops have food!`,
      agent.id,
      agent.name
    );
    return { agent };
  }

  // Already at a shop? Buy will happen in normal flow
  if (agent.currentLocation === nearestShop.id) {
    return { agent };
  }

  // If traveling, check if already going to a shop with provisions
  if (isTraveling(agent)) {
    const destination = locations.find((l) => l.id === agent.travelingTo);
    const isGoingToShop =
      destination &&
      destination.tags.includes('retail') &&
      (destination.inventory['provisions'] ?? 0) > 0;

    if (isGoingToShop) {
      // Already going to a shop - no redirect needed
      return { agent };
    }

    // Redirect to nearest shop
    const redirectedAgent = redirectTravel(agent, nearestShop, locations, transportConfig);
    ActivityLog.warning(
      phase,
      'hunger',
      `emergency! Redirecting to ${nearestShop.name}`,
      agent.id,
      agent.name
    );
    return { agent: redirectedAgent };
  }

  // Not traveling - start travel to shop
  const travelingAgent = startTravel(agent, nearestShop, locations, transportConfig);
  if (travelingAgent !== agent) {
    ActivityLog.warning(
      phase,
      'hunger',
      `emergency! Heading to ${nearestShop.name}`,
      agent.id,
      agent.name
    );
  }
  return { agent: travelingAgent };
}

/**
 * Handle urgent rest - agent at 90%+ fatigue, needs to go home immediately
 * Returns handled: true if agent is now traveling home or resting
 */
function handleUrgentRest(
  agent: Agent,
  locations: Location[],
  agentsConfig: AgentsConfig,
  transportConfig: TransportConfig,
  phase: number
): { agent: Agent; handled: boolean } {
  // If agent has a residence, go there
  if (agent.residence) {
    const home = locations.find((l) => l.id === agent.residence);
    if (home) {
      // Already at home? Rest immediately
      if (agent.currentLocation === agent.residence) {
        const restedAgent = processRest(agent, home, phase, agentsConfig);
        return { agent: restedAgent, handled: true };
      }

      // Travel home
      const travelingAgent = startTravel(agent, home, locations, transportConfig);
      if (travelingAgent !== agent) {
        ActivityLog.info(
          phase,
          'rest',
          `urgently heading home to rest (fatigue: ${agent.needs.fatigue.toFixed(1)}%)`,
          agent.id,
          agent.name
        );
        return { agent: travelingAgent, handled: true };
      }
    }
  }

  // No residence - find a shelter (public + residential)
  const shelter = findNearestLocation(
    agent,
    locations,
    (loc) => loc.tags.includes('public') && loc.tags.includes('residential')
  );

  if (shelter) {
    // Already at shelter? Rest there
    if (agent.currentLocation === shelter.id) {
      const restedAgent = processRest(agent, shelter, phase, agentsConfig);
      return { agent: restedAgent, handled: true };
    }

    // Travel to shelter
    const travelingAgent = startTravel(agent, shelter, locations, transportConfig);
    if (travelingAgent !== agent) {
      ActivityLog.info(
        phase,
        'rest',
        `urgently heading to ${shelter.name} (homeless, fatigue: ${agent.needs.fatigue.toFixed(1)}%)`,
        agent.id,
        agent.name
      );
      return { agent: travelingAgent, handled: true };
    }
  }

  // No home or shelter available - will be forced to rest in place when hitting 100%
  return { agent, handled: false };
}

/**
 * Handle rest-seeking - agent at 70%+ fatigue, should head home after current activity
 * Returns handled: true if agent started traveling home
 */
function handleRestSeeking(
  agent: Agent,
  locations: Location[],
  agentsConfig: AgentsConfig,
  transportConfig: TransportConfig,
  phase: number
): { agent: Agent; handled: boolean } {
  // If agent has a residence, travel there
  if (agent.residence) {
    const home = locations.find((l) => l.id === agent.residence);
    if (home) {
      // Already at home? Rest
      if (agent.currentLocation === agent.residence) {
        const restedAgent = processRest(agent, home, phase, agentsConfig);
        return { agent: restedAgent, handled: true };
      }

      // Travel home
      const travelingAgent = startTravel(agent, home, locations, transportConfig);
      if (travelingAgent !== agent) {
        ActivityLog.info(
          phase,
          'rest',
          `heading home to rest (fatigue: ${agent.needs.fatigue.toFixed(1)}%)`,
          agent.id,
          agent.name
        );
        return { agent: travelingAgent, handled: true };
      }
    }
  }

  // No residence - find a shelter (but don't be as urgent about it)
  const shelter = findNearestLocation(
    agent,
    locations,
    (loc) => loc.tags.includes('public') && loc.tags.includes('residential')
  );

  if (shelter) {
    // Already at shelter? Rest there
    if (agent.currentLocation === shelter.id) {
      const restedAgent = processRest(agent, shelter, phase, agentsConfig);
      return { agent: restedAgent, handled: true };
    }

    // Travel to shelter
    const travelingAgent = startTravel(agent, shelter, locations, transportConfig);
    if (travelingAgent !== agent) {
      ActivityLog.info(
        phase,
        'rest',
        `heading to ${shelter.name} to rest (homeless, fatigue: ${agent.needs.fatigue.toFixed(1)}%)`,
        agent.id,
        agent.name
      );
      return { agent: travelingAgent, handled: true };
    }
  }

  // No home or shelter - continue normal activities until forced rest
  return { agent, handled: false };
}

/**
 * Try to find housing for a homeless agent
 * Looks for available apartments where agent can afford rent buffer
 */
function tryFindHousing(
  agent: Agent,
  locations: Location[],
  agentsConfig: AgentsConfig,
  phase: number
): { agent: Agent; locations: Location[] } {
  // Calculate rent buffer requirement (4 weeks of rent typically)
  const bufferWeeks = agentsConfig.housing.bufferWeeks;

  // Find available apartments (residential locations with space and that agent can afford)
  const availableApartments = locations.filter((loc) => {
    // Must be residential
    if (!loc.tags.includes('residential')) return false;
    // Must not be public (shelters are public + residential)
    if (loc.tags.includes('public')) return false;
    // Must have space
    const residents = loc.residents ?? [];
    const maxResidents = loc.maxResidents ?? 1;
    if (residents.length >= maxResidents) return false;
    // Must be affordable (agent needs buffer for rent)
    const rentCost = loc.rentCost ?? 0;
    const bufferRequired = rentCost * bufferWeeks;
    if (agent.wallet.credits < bufferRequired) return false;
    return true;
  });

  if (availableApartments.length === 0) {
    return { agent, locations };
  }

  // Pick a random available apartment
  const apartment = availableApartments[Math.floor(Math.random() * availableApartments.length)];
  if (!apartment) {
    return { agent, locations };
  }

  // Move in
  const updatedAgent: Agent = {
    ...agent,
    residence: apartment.id,
  };

  const updatedApartment: Location = {
    ...apartment,
    residents: [...(apartment.residents ?? []), agent.id],
  };

  const updatedLocations = locations.map((loc) =>
    loc.id === apartment.id ? updatedApartment : loc
  );

  ActivityLog.info(
    phase,
    'housing',
    `moved into ${apartment.name} (rent: ${apartment.rentCost}/week)`,
    agent.id,
    agent.name
  );

  return { agent: updatedAgent, locations: updatedLocations };
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
/**
 * Calculate demand signals for entrepreneurship decisions
 * Returns the best business type to open based on market needs
 */
function chooseBestBusiness(
  agents: Agent[],
  _locations: Location[],
  locationTemplates: Record<string, LocationTemplate>,
  agentsConfig: AgentsConfig
): string {
  // Calculate food demand: agents who are hungry and have no provisions
  const foodDemand = agents.filter((a) =>
    a.status !== 'dead' &&
    a.needs.hunger > 50 &&
    (a.inventory['provisions'] ?? 0) === 0
  ).length;

  // Calculate housing demand: agents who are homeless but can afford housing
  const bufferWeeks = agentsConfig.housing.bufferWeeks;
  const avgRent = 20; // Typical apartment rent
  const housingBuffer = avgRent * bufferWeeks;
  const housingDemand = agents.filter((a) =>
    a.status !== 'dead' &&
    !a.residence &&
    a.wallet.credits >= housingBuffer
  ).length;

  // Priority weights: food is more important (starvation kills)
  const foodPriority = 2;
  const housingPriority = 1;

  // Calculate weighted scores
  const foodScore = foodDemand * foodPriority;
  const housingScore = housingDemand * housingPriority;

  // Choose based on highest score, with a fallback to retail_shop
  if (housingScore > foodScore && locationTemplates['apartment']) {
    return 'apartment';
  }
  return 'retail_shop';
}

// Name pool for apartments
const APARTMENT_NAMES = [
  "Sky View",
  "Urban Nest",
  "Metro Living",
  "City Heights",
  "Neon Suite",
  "Cyber Loft",
  "Downtown Studio",
  "Steel Tower Unit",
  "Night City Flat",
  "Grid Apartments",
];

let apartmentNameIndex = 0;

function getNextApartmentName(): string {
  const name = APARTMENT_NAMES[apartmentNameIndex % APARTMENT_NAMES.length];
  apartmentNameIndex++;
  return name ?? "Apartment";
}

function tryOpenBusiness(
  agent: Agent,
  locationTemplates: Record<string, LocationTemplate>,
  buildings: Building[],
  locations: Location[],
  agents: Agent[],
  agentsConfig: AgentsConfig,
  phase: number
): { agent: Agent; newLocation?: Location; newOrg?: Organization } {
  // 20% chance to try opening a business each phase when eligible
  if (Math.random() > 0.2) {
    return { agent };
  }

  // Choose business type based on market demand
  const businessType = chooseBestBusiness(agents, locations, locationTemplates, agentsConfig);
  const template = locationTemplates[businessType];
  if (!template) {
    return { agent };
  }

  const config = template.balance;

  // Check if agent can afford it
  const openingCost = config.openingCost ?? 0;
  if (agent.wallet.credits < openingCost) {
    return { agent };
  }

  // Find a suitable building for the shop
  const buildingPlacement = findBuildingForLocation(
    buildings,
    template.tags ?? [],
    locations
  );

  // If no building found, agent can't open shop (no outdoor retail)
  if (!buildingPlacement) {
    return { agent };
  }

  // Create a micro-org for this business
  const orgId = getNextOrgId();
  const isApartment = businessType === 'apartment';
  const orgName = isApartment ? `${agent.name}'s Rental` : `${agent.name}'s Shop`;

  // Org gets 70% of credits REMAINING after opening cost (not 70% of total)
  const creditsAfterOpeningCost = agent.wallet.credits - openingCost;
  const businessCapital = Math.floor(creditsAfterOpeningCost * 0.7); // 70% of remaining goes to business

  let newOrg = createOrganization(
    orgId,
    orgName,
    agent.id,
    agent.name,
    businessCapital,
    phase
  );

  // Create the location owned by the org (placed in building)
  const locationId = getNextLocationId();
  const locationName = isApartment ? getNextApartmentName() : getNextShopName();

  const newLocation = createLocation(
    locationId,
    locationName,
    template,
    orgId, // Owned by org, not agent directly
    orgName,
    phase,
    buildingPlacement
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

      // Process rent collection for residential locations
      if (updatedLocation.rentCost && updatedLocation.rentCost > 0) {
        const rentResult = processRentCollection(org, updatedLocation, updatedAgents, phase);
        org = rentResult.org;
        updatedLocation = rentResult.location;
        updatedAgents = rentResult.agents;
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
    const isInsolvent = false; // Disabled: let businesses survive on thin margins

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

      // Use centralized helper to handle all agent state cleanup atomically
      // Clears employment, location, and travel state for affected agents
      const deletedLocationIds = orgLocations.map((loc) => loc.id);
      updatedAgents = onOrgDissolvedWithLocations(org.id, deletedLocationIds, updatedAgents);

      // Mark locations for removal
      for (const location of orgLocations) {
        locationsToRemove.push(location.id);
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
 * Process rent collection for a residential location
 * Tenants pay rent to org wallet, those who can't pay are evicted
 */
function processRentCollection(
  org: Organization,
  location: Location,
  agents: Agent[],
  phase: number
): { org: Organization; location: Location; agents: Agent[] } {
  const rentCost = location.rentCost ?? 0;
  if (rentCost <= 0) {
    return { org, location, agents };
  }

  let updatedOrg = org;
  let updatedLocation = location;
  let updatedAgents = [...agents];
  const residents = location.residents ?? [];

  for (const residentId of residents) {
    const residentIdx = updatedAgents.findIndex((a) => a.id === residentId);
    if (residentIdx === -1) continue;

    const resident = updatedAgents[residentIdx];
    if (!resident || resident.status === 'dead') continue;

    if (resident.wallet.credits >= rentCost) {
      // Pay rent
      updatedAgents[residentIdx] = {
        ...resident,
        wallet: {
          ...resident.wallet,
          credits: resident.wallet.credits - rentCost,
        },
      };

      updatedOrg = {
        ...updatedOrg,
        wallet: {
          ...updatedOrg.wallet,
          credits: updatedOrg.wallet.credits + rentCost,
        },
      };

      ActivityLog.info(
        phase,
        'rent',
        `paid ${rentCost} credits rent to ${org.name}`,
        resident.id,
        resident.name
      );
    } else {
      // Can't pay - evict
      ActivityLog.warning(
        phase,
        'eviction',
        `evicted from ${location.name} (can't afford ${rentCost} rent, has ${resident.wallet.credits})`,
        resident.id,
        resident.name
      );

      // Clear agent's residence
      updatedAgents[residentIdx] = {
        ...resident,
        residence: undefined,
      };

      // Remove from location's residents list
      updatedLocation = {
        ...updatedLocation,
        residents: (updatedLocation.residents ?? []).filter((id) => id !== residentId),
      };
    }
  }

  return { org: updatedOrg, location: updatedLocation, agents: updatedAgents };
}

/**
 * Fix any homeless agents by sending them to the nearest public space
 * Called after weekly economy processing to catch agents displaced by org dissolution
 */
export function fixHomelessAgents(
  agents: Agent[],
  locations: Location[],
  phase: number
): Agent[] {
  return agents.map((agent) => {
    // Skip dead agents or agents who already have a location or are traveling
    if (agent.status === 'dead') return agent;
    if (agent.currentLocation) return agent;
    if (isTraveling(agent)) return agent;

    // Agent is homeless - find nearest public space
    const publicSpace = findNearestLocation(
      agent,
      locations,
      (loc) => loc.tags.includes('public')
    );

    if (publicSpace) {
      ActivityLog.info(
        phase,
        'travel',
        `went to ${publicSpace.name} (displaced)`,
        agent.id,
        agent.name
      );
      return setLocation(agent, publicSpace.id);
    }

    // No public space found - leave agent homeless (shouldn't happen)
    return agent;
  });
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
