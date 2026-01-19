/**
 * AgentEconomicSystem - Agent-level economic decisions
 *
 * Handles agent economic behaviors: buying provisions, seeking employment,
 * finding housing, leisure activities, and emergency responses (hunger/fatigue).
 *
 * This module is called by:
 * - BehaviorProcessor (via processAgentEconomicDecision)
 * - Simulation.ts (fixHomelessAgents after org dissolution)
 */

import type { Agent, Location, Organization, Building } from '../../types/entities';
import type { EconomyConfig, AgentsConfig, ThresholdsConfig, BusinessConfig, LocationTemplate, TransportConfig } from '../../config/ConfigLoader';
import type { SimulationContext } from '../../types/SimulationContext';
import { ActivityLog } from '../ActivityLog';
import {
  purchaseFromLocation,
  hireAgent,
  getHiringLocations,
} from './LocationSystem';
import { findNearestLocation, isTraveling, startTravel, redirectTravel } from './TravelSystem';
import { setLocation, clearEmployment } from './AgentStateHelpers';
import { needsRest, processRest } from './AgentSystem';
import { createTransaction, recordTransaction } from '../../types/Transaction';

/**
 * Check if an agent leads any organization
 */
function leadsAnyOrg(agent: Agent, orgs: Organization[]): boolean {
  return orgs.some((org) => org.leader === agent.id);
}

/**
 * Process agent economic decisions for one phase
 */
export function processAgentEconomicDecision(
  agent: Agent,
  _allAgents: Agent[],
  locations: Location[],
  orgs: Organization[],
  _buildings: Building[],
  economyConfig: EconomyConfig,
  agentsConfig: AgentsConfig,
  thresholdsConfig: ThresholdsConfig,
  businessConfig: BusinessConfig,
  _logisticsConfig: any,
  locationTemplates: Record<string, LocationTemplate>,
  transportConfig: TransportConfig,
  phase: number,
  context: SimulationContext
): { agent: Agent; locations: Location[]; orgs: Organization[]; newLocation?: Location; newOrg?: Organization } {
  // Skip dead agents
  if (agent.status === 'dead') {
    return { agent, locations, orgs };
  }

  let updatedAgent = agent;
  let updatedLocations = [...locations];
  let updatedOrgs = [...orgs];

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
  // 1. If hungry + has credits + shop has goods: buy provisions
  // 2. If unemployed + shops hiring: seek job
  // 3. If idle at non-public location: go to public space to hang out
  // 4. Else: stay where you are

  const isHungry = agent.needs.hunger >= agentsConfig.hunger.threshold;
  const hasNoFood = (agent.inventory['provisions'] ?? 0) < agentsConfig.hunger.provisionsPerMeal;
  const provisionsPrice = economyConfig.goods['provisions']?.retailPrice ?? 10;
  const hasCredits = agent.wallet.credits >= provisionsPrice;

  // 1. Try to buy provisions if hungry and no food
  if (isHungry && hasNoFood && hasCredits) {
    const result = tryBuyProvisions(updatedAgent, updatedLocations, updatedOrgs, economyConfig, agentsConfig, thresholdsConfig, transportConfig, phase, context);
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
    const result = tryGetJob(updatedAgent, updatedLocations, updatedOrgs, economyConfig, businessConfig, locationTemplates, phase, context);
    updatedAgent = result.agent;
    updatedLocations = result.locations;
  }

  // 2b. Housing search: Homeless agents with enough credits look for apartments
  if (
    !updatedAgent.residence &&
    updatedAgent.status !== 'dead' &&
    !isTraveling(updatedAgent)
  ) {
    const housingResult = tryFindHousing(updatedAgent, updatedLocations, agentsConfig, phase, context);
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
      phase,
      context
    );
    updatedAgent = leisureResult.agent;
    updatedLocations = leisureResult.locations;
    updatedOrgs = leisureResult.orgs;
  }

  // 3. REST-SEEKING: At 70%+ fatigue, head home to rest (after current activity)
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

  // 4. Idle agents at non-public locations go to public spaces to hang out
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

  return { agent: updatedAgent, locations: updatedLocations, orgs: updatedOrgs };
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
  agentsConfig: AgentsConfig,
  thresholdsConfig: ThresholdsConfig,
  transportConfig: TransportConfig,
  phase: number,
  context: SimulationContext
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

  const result = purchaseFromLocation(currentShop, updatedAgent, 'provisions', quantityToBuy, economyConfig, phase, context);

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
  phase: number,
  context: SimulationContext
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
  const apartment = availableApartments[Math.floor(context.rng() * availableApartments.length)];
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
  phase: number,
  context: SimulationContext
): { agent: Agent; locations: Location[]; orgs: Organization[] } {
  const alcoholPrice = economyConfig.goods['alcohol']?.retailPrice ?? 15;
  const canAffordPub = agent.wallet.credits >= alcoholPrice;

  if (canAffordPub) {
    // Try to go to a pub and buy a drink
    return tryVisitPub(agent, locations, orgs, economyConfig, agentsConfig, transportConfig, phase, context);
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
  phase: number,
  context: SimulationContext
): { agent: Agent; locations: Location[]; orgs: Organization[] } {
  // Check if already at a pub
  const currentLoc = locations.find((l) => l.id === agent.currentLocation);
  const isAtPub = currentLoc?.tags.includes('leisure') && currentLoc?.tags.includes('retail');

  if (isAtPub && currentLoc) {
    // At a pub - buy a drink
    return buyDrinkAtPub(agent, currentLoc, locations, orgs, economyConfig, agentsConfig, phase, context);
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
  phase: number,
  context: SimulationContext
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
  };

  // Find pub owner org and credit them
  const ownerOrg = orgs.find((org) => org.locations.includes(pub.id));
  let updatedOrgs = orgs;

  // Record transaction for metrics (PLAN-035)
  if (ownerOrg) {
    const transaction = createTransaction(
      phase,
      'sale',
      agent.id,
      ownerOrg.id,
      alcoholPrice,
      pub.id,
      { type: 'alcohol', quantity: 1 }
    );
    recordTransaction(context.transactionHistory, transaction);
  }
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
  businessConfig: BusinessConfig,
  locationTemplates: Record<string, LocationTemplate>,
  phase: number,
  context: SimulationContext
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
  const location = availableJobs[Math.floor(context.rng() * availableJobs.length)];
  if (!location) {
    return { agent, locations };
  }

  // Determine salary tier from location template
  // Fallback to unskilled if not specified
  const template = location.template ? locationTemplates[location.template] : undefined;
  const salaryTierName = template?.balance?.salaryTier ?? 'unskilled';
  const salaryRange = economyConfig.salary[salaryTierName] ?? economyConfig.salary.unskilled;

  const salary = Math.floor(
    context.rng() * (salaryRange.max - salaryRange.min + 1) + salaryRange.min
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

  const result = hireAgent(location, agent, salary, phase, context);

  const updatedLocations = locations.map((loc) =>
    loc.id === location.id ? result.location : loc
  );

  return { agent: result.agent, locations: updatedLocations };
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
