/**
 * EconomySystem - Handles agent economic decisions and weekly processing
 */

import type { Agent, Location, Organization, Building, Vehicle, DeliveryRequest, Order } from '../../types';
import type { EconomyConfig, AgentsConfig, ThresholdsConfig, BusinessConfig, LogisticsConfig, LocationTemplate, TransportConfig } from '../../config/ConfigLoader';
import { ActivityLog } from '../ActivityLog';
import {
  purchaseFromLocation,
  hireAgent,
  releaseAgent,
  resetWeeklyTracking,
  getHiringLocations,
} from './LocationSystem';
import { transferInventory, getGoodsCount, getAvailableCapacity, type GoodsSizes } from './InventorySystem';
import { findNearestLocation, isTraveling, startTravel, redirectTravel } from './TravelSystem';
import { setLocation, clearEmployment, onOrgDissolvedWithLocations, onOrgDissolvedOrphanLocations } from './AgentStateHelpers';
import { needsRest, processRest } from './AgentSystem';
import { onOrgDissolved as onOrgDissolvedVehicles } from './VehicleSystem';
import { tryOpenBusiness } from './BusinessOpportunityService';
import {
  trackWholesaleSale,
  trackWagePayment,
  trackDividendPayment,
  trackBusinessClosed,
} from '../Metrics';

// [MIGRATED TO BusinessOpportunityService]
// Name pools, ID counters, and tryOpenBusiness moved to BusinessOpportunityService.ts

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
  thresholdsConfig: ThresholdsConfig,
  businessConfig: BusinessConfig,
  logisticsConfig: LogisticsConfig,
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

  // SURVIVAL PRIORITY: Emergency hunger overrides everything
  // If agent is about to starve, redirect to food source immediately
  const EMERGENCY_HUNGER = thresholdsConfig.agent.emergencyHunger;
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
    const result = tryGetJob(updatedAgent, updatedLocations, updatedOrgs, economyConfig, locationTemplates, phase);
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

  // 2c. Leisure-seeking: Agents with high leisure need seek entertainment
  const leisureNeed = updatedAgent.needs.leisure ?? 0;
  const leisureThreshold = agentsConfig.leisure.threshold;
  const needsLeisure = leisureNeed >= leisureThreshold;

  if (
    needsLeisure &&
    updatedAgent.status !== 'dead' &&
    !isTraveling(updatedAgent)
  ) {
    const leisureResult = trySeekLeisure(
      updatedAgent,
      updatedLocations,
      updatedOrgs,
      economyConfig,
      agentsConfig,
      transportConfig,
      phase
    );
    updatedAgent = leisureResult.agent;
    updatedLocations = leisureResult.locations;
    updatedOrgs = leisureResult.orgs;
  }

  // 3. Consider opening a business if wealthy enough and UNEMPLOYED
  // Only available (unemployed) agents consider entrepreneurship - employed agents keep their jobs
  let newOrg: Organization | undefined;
  const canStartBusiness =
    updatedAgent.wallet.credits >= economyConfig.entrepreneurThreshold &&
    !leadsAnyOrg(updatedAgent, updatedOrgs) &&
    updatedAgent.status === 'available'; // Must be unemployed

  if (canStartBusiness) {
    const result = tryOpenBusiness(updatedAgent, locationTemplates, buildings, updatedLocations, allAgents, updatedOrgs, agentsConfig, economyConfig, [], [], phase);
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

  // Agent is at a shop with provisions - buy enough to fill up inventory
  // Buy as many as possible (up to inventory capacity) while affordable
  const retailPrice = economyConfig.goods['provisions']?.retailPrice ?? 10;
  const inventoryCapacity = agentsConfig.inventoryCapacity;
  const currentProvisions = updatedAgent.inventory['provisions'] ?? 0;
  const shopStock = currentShop.inventory['provisions'] ?? 0;
  const maxCanAfford = Math.floor(updatedAgent.wallet.credits / retailPrice);
  const spaceInInventory = inventoryCapacity - currentProvisions;
  const quantityToBuy = Math.min(shopStock, maxCanAfford, spaceInInventory, thresholdsConfig.agent.maxPurchaseQuantity);

  if (quantityToBuy <= 0) {
    return { agent: updatedAgent, locations, orgs };
  }

  const result = purchaseFromLocation(currentShop, updatedAgent, 'provisions', quantityToBuy, economyConfig, phase);

  if (result.success) {
    // Update the location in the array
    const updatedLocations = locations.map((loc) =>
      loc.id === currentShop.id ? result.location : loc
    );

    // Transfer revenue to the org that owns the shop
    const totalRevenue = retailPrice * quantityToBuy;

    const updatedOrgs = orgs.map((org) => {
      if (org.locations.includes(currentShop.id)) {
        return {
          ...org,
          wallet: {
            ...org.wallet,
            credits: org.wallet.credits + totalRevenue,
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
 * Try to satisfy leisure need by going to a pub (if can afford) or park (free)
 * Credits-based decision: wealthy agents go to pubs, broke agents go to parks
 */
function trySeekLeisure(
  agent: Agent,
  locations: Location[],
  orgs: Organization[],
  economyConfig: EconomyConfig,
  agentsConfig: AgentsConfig,
  transportConfig: TransportConfig,
  phase: number
): { agent: Agent; locations: Location[]; orgs: Organization[] } {
  const alcoholPrice = economyConfig.goods['alcohol']?.retailPrice ?? 15;
  const canAffordPub = agent.wallet.credits >= alcoholPrice;

  if (canAffordPub) {
    // Try to go to a pub and buy a drink
    return tryVisitPub(agent, locations, orgs, economyConfig, agentsConfig, transportConfig, phase);
  } else {
    // Go to a park (free leisure, handled by existing idle behavior)
    // Just let them naturally flow to parks via the idle check
    return { agent, locations, orgs };
  }
}

/**
 * Agent goes to pub, buys alcohol, satisfies leisure need
 */
function tryVisitPub(
  agent: Agent,
  locations: Location[],
  orgs: Organization[],
  economyConfig: EconomyConfig,
  agentsConfig: AgentsConfig,
  transportConfig: TransportConfig,
  phase: number
): { agent: Agent; locations: Location[]; orgs: Organization[] } {
  // Check if already at a pub
  const currentLoc = locations.find((l) => l.id === agent.currentLocation);
  const isAtPub = currentLoc?.tags.includes('leisure') && currentLoc?.tags.includes('retail');

  if (isAtPub && currentLoc) {
    // At a pub - buy a drink
    return buyDrinkAtPub(agent, currentLoc, locations, orgs, economyConfig, agentsConfig, phase);
  }

  // Find nearest pub with alcohol
  const pubsWithStock = locations.filter(
    (loc) => loc.tags.includes('leisure') &&
             loc.tags.includes('retail') &&
             (loc.inventory['alcohol'] ?? 0) > 0
  );

  if (pubsWithStock.length === 0) {
    return { agent, locations, orgs };
  }

  // Find nearest pub
  const nearestPub = findNearestLocation(agent, locations, (loc) =>
    loc.tags.includes('leisure') &&
    loc.tags.includes('retail') &&
    (loc.inventory['alcohol'] ?? 0) > 0
  );

  if (!nearestPub) {
    return { agent, locations, orgs };
  }

  // Start traveling to pub
  const travelingAgent = startTravel(agent, nearestPub, locations, transportConfig);
  if (travelingAgent !== agent) {
    ActivityLog.info(
      phase,
      'leisure',
      `heading to ${nearestPub.name} for a drink`,
      agent.id,
      agent.name
    );
    return { agent: travelingAgent, locations, orgs };
  }

  return { agent, locations, orgs };
}

/**
 * Agent buys a drink at the pub they're at
 */
function buyDrinkAtPub(
  agent: Agent,
  pub: Location,
  locations: Location[],
  orgs: Organization[],
  economyConfig: EconomyConfig,
  agentsConfig: AgentsConfig,
  phase: number
): { agent: Agent; locations: Location[]; orgs: Organization[] } {
  const alcoholStock = pub.inventory['alcohol'] ?? 0;
  const alcoholPrice = economyConfig.goods['alcohol']?.retailPrice ?? 15;

  if (alcoholStock <= 0 || agent.wallet.credits < alcoholPrice) {
    return { agent, locations, orgs };
  }

  // Buy one drink
  const updatedPub: Location = {
    ...pub,
    inventory: {
      ...pub.inventory,
      alcohol: alcoholStock - 1,
    },
    weeklyRevenue: pub.weeklyRevenue + alcoholPrice,
  };

  // Find pub owner org and credit them
  const ownerOrg = orgs.find((org) => org.locations.includes(pub.id));
  let updatedOrgs = orgs;
  if (ownerOrg) {
    const updatedOwnerOrg: Organization = {
      ...ownerOrg,
      wallet: {
        ...ownerOrg.wallet,
        credits: ownerOrg.wallet.credits + alcoholPrice,
      },
    };
    updatedOrgs = orgs.map((org) => (org.id === ownerOrg.id ? updatedOwnerOrg : org));
  }

  // Reduce agent leisure need and deduct credits
  const leisureSatisfaction = agentsConfig.leisure.pubSatisfaction;
  const newLeisure = Math.max(0, (agent.needs.leisure ?? 0) - leisureSatisfaction);

  const updatedAgent: Agent = {
    ...agent,
    needs: {
      ...agent.needs,
      leisure: newLeisure,
    },
    wallet: {
      ...agent.wallet,
      credits: agent.wallet.credits - alcoholPrice,
    },
  };

  const updatedLocations = locations.map((loc) => (loc.id === pub.id ? updatedPub : loc));

  ActivityLog.info(
    phase,
    'leisure',
    `had a drink at ${pub.name} (leisure: ${agent.needs.leisure?.toFixed(0) ?? 0} -> ${newLeisure.toFixed(0)}, -${alcoholPrice} credits)`,
    agent.id,
    agent.name
  );

  return { agent: updatedAgent, locations: updatedLocations, orgs: updatedOrgs };
}

/**
 * Try to get a job at a hiring location (factory or shop)
 * Uses salary tiers from location templates for stratified pay
 */
function tryGetJob(
  agent: Agent,
  locations: Location[],
  orgs: Organization[],
  economyConfig: EconomyConfig,
  locationTemplates: Record<string, LocationTemplate>,
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

  // Determine salary tier from location template
  // Fallback to unskilled if not specified
  const template = location.template ? locationTemplates[location.template] : undefined;
  const salaryTierName = template?.balance?.salaryTier ?? 'unskilled';
  const salaryRange = economyConfig.salary[salaryTierName] ?? economyConfig.salary.unskilled;

  const salary = Math.floor(
    Math.random() * (salaryRange.max - salaryRange.min + 1) + salaryRange.min
  );

  // AFFORDABILITY CHECK: Verify employer can afford 4 weeks of salary before hiring
  // This prevents hiring when the org will immediately fire due to unpaid payroll
  const employerOrg = orgs.find((o) => o.id === location.owner);
  if (employerOrg) {
    const weeksBuffer = businessConfig.payroll.hiringBufferWeeks;
    const requiredCredits = salary * weeksBuffer;
    if (employerOrg.wallet.credits < requiredCredits) {
      // Can't afford to hire - skip this job opportunity
      ActivityLog.info(
        phase,
        'employment',
        `${location.name} cannot afford to hire (need ${requiredCredits} credits for ${weeksBuffer} weeks salary, have ${employerOrg.wallet.credits})`,
        employerOrg.id,
        employerOrg.name
      );
      return { agent, locations };
    }
  }

  const result = hireAgent(location, agent, salary, phase);

  const updatedLocations = locations.map((loc) =>
    loc.id === location.id ? result.location : loc
  );

  return { agent: result.agent, locations: updatedLocations };
}

// [MIGRATED TO BusinessOpportunityService]
// leadsAnyOrg, chooseBestBusiness, tryOpenBusiness, APARTMENT_NAMES moved to BusinessOpportunityService.ts

// [MIGRATED TO SupplyChainSystem]
// tryRestockFromWholesale, placeGoodsOrder, tryPlaceGoodsOrder, processGoodsOrders, completeGoodsOrder moved to SupplyChainSystem.ts

/**
 * Process weekly economy for all organizations
 * - Owner dividend paid FIRST (owner survival priority)
 * - Org pays employee salaries from org wallet
 * - Org pays operating costs from org wallet
 * - Dissolve orgs that go bankrupt or lose their owner
 */
export function processWeeklyEconomy(
  agents: Agent[],
  locations: Location[],
  orgs: Organization[],
  vehicles: Vehicle[],
  businessConfig: BusinessConfig,
  phase: number
): { agents: Agent[]; locations: Location[]; orgs: Organization[]; vehicles: Vehicle[] } {
  let updatedAgents = [...agents];
  let updatedLocations = [...locations];
  let updatedOrgs = [...orgs];
  let updatedVehicles = [...vehicles];
  const orgsToRemove: string[] = [];

  for (let orgIdx = 0; orgIdx < updatedOrgs.length; orgIdx++) {
    let org = updatedOrgs[orgIdx];
    if (!org) continue;

    // STAGGERED WEEKLY PROCESSING: Only process this org on their designated phase
    // This spreads payroll/costs across the week instead of all at once
    const currentPhaseInWeek = phase % 56;
    if (currentPhaseInWeek !== org.weeklyPhaseOffset) {
      continue; // Not this org's payday yet
    }

    const orgId = org.id; // Capture for type narrowing in filter
    const orgLeader = org.leader; // Capture for use in closures
    // Find all locations owned by this org
    const orgLocations = updatedLocations.filter((loc) => loc.owner === orgId);

    // Pay owner dividend FIRST (owner survival is priority - they need to eat!)
    // This happens before employee salaries so owner always gets paid if org has funds
    const ownerDividend = businessConfig.payroll.ownerWeeklyDividend;
    const leaderIdx = updatedAgents.findIndex((a) => a.id === orgLeader);
    if (leaderIdx !== -1 && org.wallet.credits >= ownerDividend) {
      const leader = updatedAgents[leaderIdx];
      if (leader && leader.status !== 'dead') {
        org = {
          ...org,
          wallet: {
            ...org.wallet,
            credits: org.wallet.credits - ownerDividend,
          },
        };
        updatedAgents[leaderIdx] = {
          ...leader,
          wallet: {
            ...leader.wallet,
            credits: leader.wallet.credits + ownerDividend,
          },
        };
        ActivityLog.info(
          phase,
          'dividend',
          `received ${ownerDividend} credits from ${org.name}`,
          leader.id,
          leader.name
        );

        // Track dividend payment in metrics
        trackDividendPayment(ownerDividend);
      }
    }

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

    // Check for org dissolution conditions:
    // 1. Bankruptcy (credits < 0)
    // 2. Insolvency (can't afford minimum operations - less than 50 credits)
    // 3. Leader death (with no employees to take over)
    const leaderForCheck = updatedAgents.find((a) => a.id === org.leader);
    const leaderDead = !leaderForCheck || leaderForCheck.status === 'dead';
    const isBankrupt = org.wallet.credits < 0;
    const isInsolvent = false; // Disabled: let businesses survive on thin margins

    // If leader died, try auto-succession first
    if (leaderDead && !isBankrupt) {
      // Find all employees across org's locations
      const orgEmployeeIds = new Set<string>();
      for (const loc of orgLocations) {
        for (const empId of loc.employees) {
          orgEmployeeIds.add(empId);
        }
      }

      // Find living employees, sorted by hire date (earliest first = senior)
      const livingEmployees = updatedAgents
        .filter((a) => orgEmployeeIds.has(a.id) && a.status !== 'dead')
        .sort((a, b) => (a.created ?? 0) - (b.created ?? 0));

      if (livingEmployees.length > 0) {
        // Auto-succession: promote senior employee to leader
        const newLeader = livingEmployees[0];
        if (newLeader) {
          org = {
            ...org,
            leader: newLeader.id,
          };

          ActivityLog.info(
            phase,
            'succession',
            `${newLeader.name} became new leader of ${org.name} (previous leader died)`,
            newLeader.id,
            newLeader.name
          );

          // Update org in array and continue (don't dissolve)
          updatedOrgs[orgIdx] = org;
          continue;
        }
      }
    }

    // Determine dissolution reason (if any)
    let dissolutionReason = '';
    if (leaderDead) {
      dissolutionReason = 'leader died';
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

      // Track business closing in metrics
      trackBusinessClosed(org.name);

      // Orphan locations instead of deleting them
      // Employees lose jobs, but residents stay (stop paying rent)
      const orphanResult = onOrgDissolvedOrphanLocations(
        org.id,
        updatedLocations,
        updatedAgents,
        phase
      );
      updatedAgents = orphanResult.agents;
      updatedLocations = orphanResult.locations;

      // Log orphaned locations
      for (const loc of orgLocations) {
        ActivityLog.warning(
          phase,
          'orphaned',
          `${loc.name} is now orphaned and for sale`,
          loc.id,
          loc.name
        );
      }

      orgsToRemove.push(org.id);
    }

    // Update org in array
    updatedOrgs[orgIdx] = org;
  }

  // Remove dissolved orgs (locations are now orphaned, not deleted)
  updatedOrgs = updatedOrgs.filter((org) => !orgsToRemove.includes(org.id));

  // Clean up vehicles owned by dissolved orgs
  for (const dissolvedOrgId of orgsToRemove) {
    updatedVehicles = onOrgDissolvedVehicles(updatedVehicles, dissolvedOrgId, phase);
  }

  return { agents: updatedAgents, locations: updatedLocations, orgs: updatedOrgs, vehicles: updatedVehicles };
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

      // Track wage payment in metrics
      trackWagePayment(employee.salary);
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

// [MIGRATED TO SupplyChainSystem]
// restockLocation moved to SupplyChainSystem.ts (appears unused)
