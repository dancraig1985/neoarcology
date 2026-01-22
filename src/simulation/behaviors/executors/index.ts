/**
 * Behavior Executors - Functions that execute behavior logic
 *
 * Each executor handles one or more related behaviors.
 * Executors set/clear tasks and return updated state.
 */

import type { Agent, AgentTask, Location, Organization, Vehicle, DeliveryRequest } from '../../../types/entities';
import { registerExecutor, type BehaviorContext, type TaskResult } from '../BehaviorRegistry';
import { isTraveling, startTravel, findNearestLocation, redirectTravel } from '../../systems/TravelSystem';
import { ActivityLog } from '../../ActivityLog';
import { recordRetailSale, recordBusinessOpened, recordHire } from '../../Metrics';
import { randomInt } from '../../SeededRandom';
import { setEmployment } from '../../systems/AgentStateHelpers';
import { createOrganization } from '../../systems/OrgSystem';
import {
  loadCargo,
  unloadCargo,
  boardVehicle,
  exitVehicle,
  startVehicleTravel
} from '../../systems/VehicleSystem';
import { assignDeliveryToDriver, startDelivery, completeDelivery, failDelivery, failDeliveryWithParent, findAvailableVehicle } from '../../systems/DeliverySystem';
import { createTransaction, recordTransaction } from '../../../types/Transaction';

// ============================================
// Task State Helpers
// ============================================

/**
 * Set a task on an agent
 */
function setTask(agent: Agent, task: AgentTask): Agent {
  return { ...agent, currentTask: task };
}

/**
 * Clear the current task
 */
function clearTask(agent: Agent): Agent {
  return { ...agent, currentTask: undefined };
}

// ============================================
// Travel Executor
// ============================================

/**
 * Travel executor - handles any "go somewhere" behavior
 * Used by: commuting, going_to_pub, going_home, etc.
 */
function executeTravelBehavior(
  agent: Agent,
  task: AgentTask,
  ctx: BehaviorContext
): TaskResult {
  // If already traveling, check if we need to redirect for commuting
  if (isTraveling(agent)) {
    // If this is a commuting task, redirect to workplace
    if (task.type === 'commuting' || task.params?.destination === 'employedAt') {
      const workplace = ctx.locations.find(l => l.id === agent.employedAt);

      // Only redirect if not already heading to workplace
      if (workplace && agent.travelingTo !== workplace.id) {
        const redirectedAgent = redirectTravel(agent, workplace, ctx.locations, ctx.transportConfig);

        ActivityLog.info(
          ctx.phase,
          'travel',
          `redirecting to ${workplace.name} (work shift ready)`,
          agent.id,
          agent.name
        );

        return {
          agent: setTask(redirectedAgent, { ...task, targetId: workplace.id, targetName: workplace.name }),
          locations: ctx.locations,
          orgs: ctx.orgs,
          complete: false,
        };
      }
    }

    // Otherwise, continue current travel
    return {
      agent,
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: false,
    };
  }

  // Determine destination based on task params
  const destination = task.params?.destination as string | undefined;
  let targetLocationId: string | undefined;

  if (destination === 'employedAt') {
    targetLocationId = agent.employedAt;
  } else if (destination === 'residence') {
    targetLocationId = agent.residence;
  } else if (task.targetId) {
    targetLocationId = task.targetId;
  }

  // If already at destination, task is complete
  if (targetLocationId && agent.currentLocation === targetLocationId) {
    return {
      agent: clearTask(agent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true,
    };
  }

  // Find destination location
  const targetLoc = ctx.locations.find(l => l.id === targetLocationId);
  if (!targetLoc) {
    // Destination doesn't exist - clear task
    ActivityLog.warning(
      ctx.phase,
      'behavior',
      `travel destination not found`,
      agent.id,
      agent.name
    );
    return {
      agent: clearTask(agent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true,
    };
  }

  // Start travel
  const travelingAgent = startTravel(agent, targetLoc, ctx.locations, ctx.transportConfig);

  if (travelingAgent !== agent) {
    // Travel started (or instant arrival)
    const taskWithTarget: AgentTask = {
      ...task,
      targetId: targetLoc.id,
      targetName: targetLoc.name,
    };

    ActivityLog.info(
      ctx.phase,
      'travel',
      `${task.type === 'commuting' ? 'commuting to' : 'heading to'} ${targetLoc.name}`,
      agent.id,
      agent.name
    );

    // Check if arrived instantly
    if (!isTraveling(travelingAgent) && travelingAgent.currentLocation === targetLoc.id) {
      return {
        agent: clearTask(travelingAgent),
        locations: ctx.locations,
        orgs: ctx.orgs,
        complete: true,
      };
    }

    return {
      agent: setTask(travelingAgent, taskWithTarget),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: false,
    };
  }

  // Couldn't start travel - something wrong
  return {
    agent,
    locations: ctx.locations,
    orgs: ctx.orgs,
    complete: false,
  };
}

// ============================================
// Work Executor
// ============================================

/**
 * Work executor - handles staying at workplace
 * Used by: working
 */
function executeWorkBehavior(
  agent: Agent,
  task: AgentTask,
  ctx: BehaviorContext
): TaskResult {
  // Initialize shift state if first time working
  if (!agent.shiftState) {
    // Stagger shift start times by giving first shift a random shortened duration
    // This makes agents complete at different times and stay staggered thereafter
    const shiftDuration = ctx.agentsConfig.work.shiftDuration;
    const randomOffset = randomInt(0, shiftDuration / 2, ctx.context.rng);

    const newAgent = {
      ...agent,
      shiftState: {
        phasesWorked: randomOffset, // Start partway through first shift
        lastShiftEndPhase: 0,
        shiftStartPhase: ctx.phase,
      },
    };

    ActivityLog.info(
      ctx.phase,
      'employment',
      `started work shift (first shift reduced by ${randomOffset} phases)`,
      agent.id,
      agent.name
    );

    return {
      agent: newAgent.currentTask ? newAgent : setTask(newAgent, task),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: false,
    };
  }

  // Increment phases worked
  const updatedAgent = {
    ...agent,
    shiftState: {
      ...agent.shiftState,
      phasesWorked: agent.shiftState.phasesWorked + 1,
    },
  };

  // Check if shift should end (completion conditions handle this, but we log)
  const shiftDuration = ctx.agentsConfig.work.shiftDuration;
  if (updatedAgent.shiftState.phasesWorked >= shiftDuration) {
    // Shift completed - record end time
    const finishedAgent = {
      ...updatedAgent,
      shiftState: {
        ...updatedAgent.shiftState,
        lastShiftEndPhase: ctx.phase,
        phasesWorked: 0, // Reset for next shift
      },
    };

    ActivityLog.info(
      ctx.phase,
      'employment',
      `completed work shift (${shiftDuration} phases)`,
      agent.id,
      agent.name
    );

    return {
      agent: clearTask(finishedAgent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true, // Signal shift is over
    };
  }

  // Continue working
  return {
    agent: updatedAgent.currentTask ? updatedAgent : setTask(updatedAgent, task),
    locations: ctx.locations,
    orgs: ctx.orgs,
    complete: false,
  };
}

// ============================================
// Rest Executor
// ============================================

/**
 * Rest executor - handles rest behaviors
 * Used by: forced_rest, urgent_rest
 */
function executeRestBehavior(
  agent: Agent,
  task: AgentTask,
  ctx: BehaviorContext
): TaskResult {
  const restType = task.params?.restType as string | undefined;

  // If needs to travel home first (urgent rest)
  if (restType === 'urgent' && agent.residence && agent.currentLocation !== agent.residence) {
    // Redirect to travel home
    const home = ctx.locations.find(l => l.id === agent.residence);
    if (home && !isTraveling(agent)) {
      const travelingAgent = startTravel(agent, home, ctx.locations, ctx.transportConfig);
      if (travelingAgent !== agent) {
        ActivityLog.info(
          ctx.phase,
          'travel',
          `heading home to rest`,
          agent.id,
          agent.name
        );
        return {
          agent: setTask(travelingAgent, task),
          locations: ctx.locations,
          orgs: ctx.orgs,
          complete: false,
        };
      }
    }
  }

  // Actually rest - reduce fatigue based on location type
  const currentLoc = ctx.locations.find(l => l.id === agent.currentLocation);
  let fatigueReset: number;

  if (agent.currentLocation === agent.residence) {
    fatigueReset = ctx.agentsConfig.fatigue.homeRestReset; // Best rest at home
  } else if (currentLoc?.tags.includes('shelter')) {
    fatigueReset = ctx.agentsConfig.fatigue.shelterRestReset; // Decent rest at shelter
  } else {
    fatigueReset = ctx.agentsConfig.fatigue.forcedRestReset; // Poor rest elsewhere
  }

  const updatedAgent = {
    ...agent,
    needs: {
      ...agent.needs,
      fatigue: fatigueReset,
    },
    currentTask: task,
  };

  ActivityLog.info(
    ctx.phase,
    'rest',
    `resting${currentLoc ? ` at ${currentLoc.name}` : ''} (fatigue → ${fatigueReset})`,
    agent.id,
    agent.name
  );

  // Check if rest is complete (fatigue below threshold)
  const complete = updatedAgent.needs.fatigue < 70;

  return {
    agent: complete ? clearTask(updatedAgent) : updatedAgent,
    locations: ctx.locations,
    orgs: ctx.orgs,
    complete,
  };
}

// ============================================
// Purchase Executor
// ============================================

/**
 * Purchase executor - handles buying goods
 * Used by: buying_food
 */
function executePurchaseBehavior(
  agent: Agent,
  task: AgentTask,
  ctx: BehaviorContext
): TaskResult {
  const goodsType = (task.params?.goodsType as string) ?? 'provisions';
  const locationTag = (task.params?.locationTag as string) ?? 'retail';

  // If already traveling, wait for arrival
  if (isTraveling(agent)) {
    return {
      agent: agent.currentTask ? agent : setTask(agent, task),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: false,
    };
  }

  // Check if we have what we need
  const currentAmount = agent.inventory[goodsType] ?? 0;
  if (currentAmount > 0) {
    // Task complete - we have provisions
    return {
      agent: clearTask(agent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true,
    };
  }

  // Find shops with stock
  const shopsWithStock = ctx.locations.filter(
    loc => loc.tags.includes(locationTag) && (loc.inventory[goodsType] ?? 0) > 0
  );

  if (shopsWithStock.length === 0) {
    // No shops have stock - fail task
    ActivityLog.warning(
      ctx.phase,
      'purchase',
      `no shops have ${goodsType} in stock!`,
      agent.id,
      agent.name
    );
    return {
      agent: clearTask(agent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true, // Complete (failed) so we don't get stuck
    };
  }

  // Check if at a shop with stock
  const currentShop = agent.currentLocation
    ? shopsWithStock.find(loc => loc.id === agent.currentLocation)
    : undefined;

  if (!currentShop) {
    // Debug: Check if agent is at ANY location with retail tag
    const currentLoc = ctx.locations.find(l => l.id === agent.currentLocation);
    if (currentLoc && currentLoc.tags.includes(locationTag)) {
      // Agent is at a retail location but it's not in shopsWithStock
      ActivityLog.warning(
        ctx.phase,
        'purchase',
        `at ${currentLoc.name} but it has no ${goodsType} (stock: ${currentLoc.inventory[goodsType] ?? 0})`,
        agent.id,
        agent.name
      );
    }

    // Travel to nearest shop
    const nearestShop = findNearestLocation(
      agent,
      ctx.locations,
      loc => loc.tags.includes(locationTag) && (loc.inventory[goodsType] ?? 0) > 0
    );

    if (nearestShop) {
      const travelingAgent = startTravel(agent, nearestShop, ctx.locations, ctx.transportConfig);
      if (travelingAgent !== agent) {
        ActivityLog.info(
          ctx.phase,
          'travel',
          `heading to ${nearestShop.name} to buy ${goodsType}`,
          agent.id,
          agent.name
        );
        return {
          agent: setTask(travelingAgent, { ...task, targetId: nearestShop.id, targetName: nearestShop.name }),
          locations: ctx.locations,
          orgs: ctx.orgs,
          complete: false,
        };
      }
    }

    return {
      agent,
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: false,
    };
  }

  // At shop - buy provisions
  const retailPrice = ctx.economyConfig.goods[goodsType]?.retailPrice ?? 10;
  const shopStock = currentShop.inventory[goodsType] ?? 0;
  const maxCanAfford = Math.floor(agent.wallet.credits / retailPrice);
  const spaceInInventory = agent.inventoryCapacity - currentAmount;
  const quantityToBuy = Math.min(shopStock, maxCanAfford, spaceInInventory, 5);

  if (quantityToBuy <= 0) {
    // Can't afford or no space
    return {
      agent: clearTask(agent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true,
    };
  }

  // Execute purchase
  const totalCost = retailPrice * quantityToBuy;

  const updatedAgent = {
    ...agent,
    wallet: { ...agent.wallet, credits: agent.wallet.credits - totalCost },
    inventory: { ...agent.inventory, [goodsType]: currentAmount + quantityToBuy },
  };

  const updatedLocation = {
    ...currentShop,
    inventory: { ...currentShop.inventory, [goodsType]: shopStock - quantityToBuy },
  };

  const updatedLocations = ctx.locations.map(loc =>
    loc.id === currentShop.id ? updatedLocation : loc
  );

  // Find shop owner org for transaction recording
  const shopOwnerOrg = ctx.orgs.find(org => org.locations.includes(currentShop.id));

  // Record transaction for metrics (PLAN-035)
  if (shopOwnerOrg) {
    const transaction = createTransaction(
      ctx.context.phase,
      'sale',
      agent.id,
      shopOwnerOrg.id,
      totalCost,
      currentShop.id,
      { type: goodsType, quantity: quantityToBuy }
    );
    recordTransaction(ctx.context.transactionHistory, transaction);
  }

  // Transfer revenue to shop owner org
  const updatedOrgs = ctx.orgs.map(org => {
    if (org.locations.includes(currentShop.id)) {
      return {
        ...org,
        wallet: { ...org.wallet, credits: org.wallet.credits + totalCost },
      };
    }
    return org;
  });

  ActivityLog.info(
    ctx.phase,
    'purchase',
    `bought ${quantityToBuy} ${goodsType} for ${totalCost} credits at ${currentShop.name}`,
    agent.id,
    agent.name
  );

  // Track retail sale in metrics
  recordRetailSale(ctx.context.metrics,goodsType);

  return {
    agent: clearTask(updatedAgent),
    locations: updatedLocations,
    orgs: updatedOrgs,
    complete: true,
  };
}

// ============================================
// Leisure Executor
// ============================================

/**
 * Leisure executor - handles entertainment seeking
 * Used by: seeking_leisure
 */
function executeLeisureBehavior(
  agent: Agent,
  task: AgentTask,
  ctx: BehaviorContext
): TaskResult {
  // If traveling, wait
  if (isTraveling(agent)) {
    return {
      agent: agent.currentTask ? agent : setTask(agent, task),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: false,
    };
  }

  // Check if leisure need is satisfied
  if (agent.needs.leisure < 30) {
    return {
      agent: clearTask(agent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true,
    };
  }

  // Check if at leisure location (pub with 'leisure' tag, or public space with 'public' tag)
  const currentLoc = ctx.locations.find(l => l.id === agent.currentLocation);
  const atPub = currentLoc?.tags.includes('leisure');
  const atPark = currentLoc?.tags.includes('public');
  const atLeisureLocation = atPub || atPark;

  if (!atLeisureLocation) {
    // Find best leisure destination based on affordability and stock
    const alcoholPrice = ctx.economyConfig.goods['alcohol']?.retailPrice ?? 15;
    const canAffordAlcohol = agent.wallet.credits >= alcoholPrice;

    // Priority 1: If can afford, find pub with alcohol stock
    let leisureLoc = canAffordAlcohol
      ? findNearestLocation(
          agent,
          ctx.locations,
          loc => loc.tags.includes('leisure') && (loc.inventory['alcohol'] ?? 0) > 0
        )
      : null;

    // Priority 2: Public space (free leisure)
    if (!leisureLoc) {
      leisureLoc = findNearestLocation(
        agent,
        ctx.locations,
        loc => loc.tags.includes('public')
      );
    }

    // Priority 3: Any leisure location (including empty pubs) as last resort
    if (!leisureLoc) {
      leisureLoc = findNearestLocation(
        agent,
        ctx.locations,
        loc => loc.tags.includes('leisure')
      );
    }

    if (leisureLoc) {
      const travelingAgent = startTravel(agent, leisureLoc, ctx.locations, ctx.transportConfig);
      if (travelingAgent !== agent) {
        ActivityLog.info(
          ctx.phase,
          'travel',
          `heading to ${leisureLoc.name} for leisure`,
          agent.id,
          agent.name
        );
        return {
          agent: setTask(travelingAgent, { ...task, targetId: leisureLoc.id, targetName: leisureLoc.name }),
          locations: ctx.locations,
          orgs: ctx.orgs,
          complete: false,
        };
      }
    }

    return {
      agent,
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: false,
    };
  }

  // At leisure location - reduce leisure need
  let leisureReduction = 0;
  let updatedLocations = ctx.locations;
  let updatedOrgs = ctx.orgs;
  let updatedAgent = agent;

  if (atPub && currentLoc) {
    // At a pub - try to buy alcohol for full satisfaction
    const alcoholStock = currentLoc.inventory['alcohol'] ?? 0;
    const alcoholPrice = ctx.economyConfig.goods['alcohol']?.retailPrice ?? 15;

    if (alcoholStock > 0 && agent.wallet.credits >= alcoholPrice) {
      // Purchase alcohol - transfer money to pub's org
      const pubOrg = ctx.orgs.find(org => org.locations.includes(currentLoc.id));

      // Update agent wallet (pay for drink)
      updatedAgent = {
        ...agent,
        wallet: { ...agent.wallet, credits: agent.wallet.credits - alcoholPrice },
      };

      // Update pub inventory
      const updatedPub: Location = {
        ...currentLoc,
        inventory: { ...currentLoc.inventory, alcohol: alcoholStock - 1 },
      };
      updatedLocations = ctx.locations.map(loc =>
        loc.id === currentLoc.id ? updatedPub : loc
      );

      // Record transaction for metrics (PLAN-035)
      if (pubOrg) {
        const transaction = createTransaction(
          ctx.context.phase,
          'sale',
          agent.id,
          pubOrg.id,
          alcoholPrice,
          currentLoc.id,
          { type: 'alcohol', quantity: 1 }
        );
        recordTransaction(ctx.context.transactionHistory, transaction);
      }

      // Update pub org wallet (receive payment)
      if (pubOrg) {
        const updatedPubOrg: Organization = {
          ...pubOrg,
          wallet: { ...pubOrg.wallet, credits: pubOrg.wallet.credits + alcoholPrice },
        };
        updatedOrgs = ctx.orgs.map(org =>
          org.id === pubOrg.id ? updatedPubOrg : org
        );
      }

      ActivityLog.info(
        ctx.phase,
        'purchase',
        `bought a drink at ${currentLoc.name} for ${alcoholPrice} credits`,
        agent.id,
        agent.name
      );

      // Track alcohol retail sale in metrics
      recordRetailSale(ctx.context.metrics,'alcohol');

      // Full satisfaction when buying alcohol
      leisureReduction = ctx.agentsConfig.leisure.pubSatisfaction;
    } else {
      // No alcohol or can't afford - just hang out (reduced satisfaction)
      leisureReduction = ctx.agentsConfig.leisure.parkSatisfactionPerPhase;

      if (alcoholStock === 0) {
        ActivityLog.info(
          ctx.phase,
          'leisure',
          `hanging out at ${currentLoc.name} (no drinks available)`,
          agent.id,
          agent.name
        );
      }
    }
  } else if (atPark) {
    // At park/public space - slower satisfaction, but free
    leisureReduction = ctx.agentsConfig.leisure.parkSatisfactionPerPhase;
  }

  const newLeisure = Math.max(0, updatedAgent.needs.leisure - leisureReduction);
  updatedAgent = {
    ...updatedAgent,
    needs: { ...updatedAgent.needs, leisure: newLeisure },
    currentTask: task,
  };

  const complete = newLeisure < 30;

  return {
    agent: complete ? clearTask(updatedAgent) : updatedAgent,
    locations: updatedLocations,
    orgs: updatedOrgs,
    complete,
  };
}

// ============================================
// Seek Job Executor
// ============================================

/**
 * Seek job executor - handles job hunting
 * Used by: seeking_job
 */
function executeSeekJobBehavior(
  agent: Agent,
  _task: AgentTask,
  ctx: BehaviorContext
): TaskResult {
  // If already employed, task is complete
  if (agent.employedAt) {
    return {
      agent: clearTask(agent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true,
    };
  }

  // Find locations with open job slots
  const hiringLocations = ctx.locations.filter(
    loc => loc.employeeSlots > loc.employees.length
  );

  if (hiringLocations.length === 0) {
    // No jobs available
    return {
      agent: clearTask(agent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true, // Complete (failed)
    };
  }

  // Apply to nearest hiring location (simplified)
  // In reality this would involve traveling there, but for MVP just hire instantly
  const nearestJob = findNearestLocation(agent, ctx.locations, loc =>
    loc.employeeSlots > loc.employees.length
  );

  if (!nearestJob) {
    return {
      agent: clearTask(agent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true,
    };
  }

  // Find the org that owns this location
  const ownerOrg = ctx.orgs.find(org => org.locations.includes(nearestJob.id));

  if (!ownerOrg) {
    return {
      agent: clearTask(agent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true,
    };
  }

  // Hire the agent
  const salary = ctx.economyConfig.salary.unskilled.min +
    Math.floor(ctx.context.rng() * (ctx.economyConfig.salary.unskilled.max - ctx.economyConfig.salary.unskilled.min));

  // Use setEmployment helper to ensure proper state initialization
  const updatedAgent = setEmployment(agent, nearestJob.id, ownerOrg.id, salary);

  const updatedLocation = {
    ...nearestJob,
    employees: [...nearestJob.employees, agent.id],
  };

  const updatedLocations = ctx.locations.map(loc =>
    loc.id === nearestJob.id ? updatedLocation : loc
  );

  ActivityLog.info(
    ctx.phase,
    'employment',
    `hired at ${nearestJob.name} for ${salary}/week`,
    agent.id,
    agent.name
  );

  // Record hire in metrics
  recordHire(ctx.context.metrics);

  return {
    agent: clearTask(updatedAgent),
    locations: updatedLocations,
    orgs: ctx.orgs,
    complete: true,
  };
}

// ============================================
// Seek Housing Executor
// ============================================

/**
 * Seek housing executor - handles apartment hunting
 * Used by: finding_housing
 */
function executeSeekHousingBehavior(
  agent: Agent,
  _task: AgentTask,
  ctx: BehaviorContext
): TaskResult {
  // If already has residence, task is complete
  if (agent.residence) {
    return {
      agent: clearTask(agent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true,
    };
  }

  // Find available apartments
  const availableApartments = ctx.locations.filter(loc => {
    if (!loc.tags.includes('residential')) return false;
    if (loc.tags.includes('shelter')) return false; // Shelters aren't rentable
    const residents = loc.residents ?? [];
    const maxResidents = loc.maxResidents ?? 1;
    return residents.length < maxResidents;
  });

  if (availableApartments.length === 0) {
    return {
      agent: clearTask(agent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true, // No housing available
    };
  }

  // Check if agent can afford rent (need buffer weeks of rent)
  const cheapestApt = availableApartments.reduce((cheapest, apt) =>
    (apt.rentCost ?? 0) < (cheapest.rentCost ?? 0) ? apt : cheapest
  );

  const rentCost = cheapestApt.rentCost ?? 0;
  const bufferWeeks = ctx.agentsConfig.housing.bufferWeeks;
  const minCredits = rentCost * bufferWeeks;

  if (agent.wallet.credits < minCredits) {
    return {
      agent: clearTask(agent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true, // Can't afford
    };
  }

  // Move in
  const updatedAgent = {
    ...agent,
    residence: cheapestApt.id,
  };

  const updatedApartment = {
    ...cheapestApt,
    residents: [...(cheapestApt.residents ?? []), agent.id],
  };

  const updatedLocations = ctx.locations.map(loc =>
    loc.id === cheapestApt.id ? updatedApartment : loc
  );

  ActivityLog.info(
    ctx.phase,
    'housing',
    `moved into ${cheapestApt.name} (rent: ${rentCost}/week)`,
    agent.id,
    agent.name
  );

  return {
    agent: clearTask(updatedAgent),
    locations: updatedLocations,
    orgs: ctx.orgs,
    complete: true,
  };
}

// ============================================
// Emergency Food Executor
// ============================================

/**
 * Emergency food executor - critical hunger response
 * Used by: emergency_hunger
 *
 * CRITICAL: This can interrupt travel to redirect to nearest shop
 */
function executeEmergencyFoodBehavior(
  agent: Agent,
  task: AgentTask,
  ctx: BehaviorContext
): TaskResult {
  // If has food now, complete
  if ((agent.inventory['provisions'] ?? 0) > 0) {
    return {
      agent: clearTask(agent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true,
    };
  }

  // If hunger dropped below emergency, complete
  if (agent.needs.hunger < 80) {
    return {
      agent: clearTask(agent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true,
    };
  }

  // Find nearest shop with provisions
  const nearestShop = findNearestLocation(
    agent,
    ctx.locations,
    loc => loc.tags.includes('retail') && (loc.inventory['provisions'] ?? 0) > 0
  );

  if (!nearestShop) {
    // No shops with food - nothing we can do
    ActivityLog.warning(
      ctx.phase,
      'hunger',
      `is in emergency hunger but no shops have food!`,
      agent.id,
      agent.name
    );
    return {
      agent,
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: false,
    };
  }

  // If agent is already traveling, check if they need to redirect
  if (isTraveling(agent)) {
    // Check if already heading to a shop with provisions
    const currentDestination = ctx.locations.find(l => l.id === agent.travelingTo);
    const alreadyGoingToShop = currentDestination &&
      currentDestination.tags.includes('retail') &&
      (currentDestination.inventory['provisions'] ?? 0) > 0;

    if (!alreadyGoingToShop) {
      // Redirect to nearest shop with provisions
      const redirectedAgent = redirectTravel(agent, nearestShop, ctx.locations, ctx.transportConfig);
      ActivityLog.warning(
        ctx.phase,
        'hunger',
        `emergency! Redirecting to ${nearestShop.name}`,
        agent.id,
        agent.name
      );
      return {
        agent: setTask(redirectedAgent, { ...task, targetId: nearestShop.id, targetName: nearestShop.name }),
        locations: ctx.locations,
        orgs: ctx.orgs,
        complete: false,
      };
    }

    // Already going to a shop - just wait
    return {
      agent: setTask(agent, task),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: false,
    };
  }

  // Not traveling - delegate to purchase executor
  const purchaseTask: AgentTask = {
    ...task,
    params: { goodsType: 'provisions', locationTag: 'retail' },
  };

  return executePurchaseBehavior(agent, purchaseTask, ctx);
}

// ============================================
// Restock Executor
// ============================================

/**
 * Restock executor - shop owner restocking
 * Used by: restocking
 */
function executeRestockBehavior(
  agent: Agent,
  _task: AgentTask,
  ctx: BehaviorContext
): TaskResult {
  // Find org led by this agent
  const ledOrg = ctx.orgs.find(org => org.leader === agent.id);
  if (!ledOrg) {
    return {
      agent: clearTask(agent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true,
    };
  }

  // Find retail locations owned by org
  const retailLocations = ctx.locations.filter(
    loc => ledOrg.locations.includes(loc.id) && loc.tags.includes('retail')
  );

  if (retailLocations.length === 0) {
    return {
      agent: clearTask(agent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true,
    };
  }

  // Check if any shop needs stock
  const shopNeedingStock = retailLocations.find(loc => {
    const currentStock = loc.inventory['provisions'] ?? 0;
    const capacity = loc.inventoryCapacity;
    return currentStock < capacity * 0.5; // Below 50% capacity
  });

  if (!shopNeedingStock) {
    return {
      agent: clearTask(agent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true,
    };
  }

  // Find wholesale source
  const wholesale = ctx.locations.find(
    loc => loc.tags.includes('wholesale') && (loc.inventory['provisions'] ?? 0) > 0
  );

  if (!wholesale) {
    return {
      agent: clearTask(agent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true, // No wholesale available
    };
  }

  // Buy from wholesale
  const wholesalePrice = ctx.economyConfig.goods['provisions']?.wholesalePrice ?? 5;
  const shopCapacity = shopNeedingStock.inventoryCapacity;
  const currentStock = shopNeedingStock.inventory['provisions'] ?? 0;
  const spaceAvailable = shopCapacity - currentStock;
  const wholesaleStock = wholesale.inventory['provisions'] ?? 0;
  const maxCanAfford = Math.floor(ledOrg.wallet.credits / wholesalePrice);
  const quantityToBuy = Math.min(spaceAvailable, wholesaleStock, maxCanAfford, 20);

  if (quantityToBuy <= 0) {
    return {
      agent: clearTask(agent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true,
    };
  }

  // Execute wholesale purchase
  const totalCost = wholesalePrice * quantityToBuy;

  const updatedOrg = {
    ...ledOrg,
    wallet: { ...ledOrg.wallet, credits: ledOrg.wallet.credits - totalCost },
  };

  const updatedLocations = ctx.locations.map(loc => {
    if (loc.id === shopNeedingStock.id) {
      return {
        ...loc,
        inventory: {
          ...loc.inventory,
          provisions: currentStock + quantityToBuy,
        },
      };
    }
    if (loc.id === wholesale.id) {
      return {
        ...loc,
        inventory: {
          ...loc.inventory,
          provisions: wholesaleStock - quantityToBuy,
        },
      };
    }
    return loc;
  });

  const updatedOrgs = ctx.orgs.map(org =>
    org.id === ledOrg.id ? updatedOrg : org
  );

  ActivityLog.info(
    ctx.phase,
    'restock',
    `restocked ${shopNeedingStock.name} with ${quantityToBuy} provisions`,
    agent.id,
    agent.name
  );

  return {
    agent: clearTask(agent),
    locations: updatedLocations,
    orgs: updatedOrgs,
    complete: true,
  };
}

// ============================================
// Wander Executor
// ============================================

/**
 * Wander executor - idle behavior
 * Used by: wandering
 */
function executeWanderBehavior(
  agent: Agent,
  task: AgentTask,
  ctx: BehaviorContext
): TaskResult {
  // If traveling, wait
  if (isTraveling(agent)) {
    return {
      agent: agent.currentTask ? agent : setTask(agent, task),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: false,
    };
  }

  // Check if at public space
  const currentLoc = ctx.locations.find(l => l.id === agent.currentLocation);
  if (currentLoc?.tags.includes('public')) {
    return {
      agent: clearTask(agent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true,
    };
  }

  // Find nearest public space
  const publicSpace = findNearestLocation(agent, ctx.locations, loc =>
    loc.tags.includes('public')
  );

  if (publicSpace) {
    const travelingAgent = startTravel(agent, publicSpace, ctx.locations, ctx.transportConfig);
    if (travelingAgent !== agent) {
      ActivityLog.info(
        ctx.phase,
        'travel',
        `wandering to ${publicSpace.name}`,
        agent.id,
        agent.name
      );

      // Check instant arrival
      if (!isTraveling(travelingAgent) && travelingAgent.currentLocation === publicSpace.id) {
        return {
          agent: clearTask(travelingAgent),
          locations: ctx.locations,
          orgs: ctx.orgs,
          complete: true,
        };
      }

      return {
        agent: setTask(travelingAgent, { ...task, targetId: publicSpace.id, targetName: publicSpace.name }),
        locations: ctx.locations,
        orgs: ctx.orgs,
        complete: false,
      };
    }
  }

  // No public space found - just stay put
  return {
    agent: clearTask(agent),
    locations: ctx.locations,
    orgs: ctx.orgs,
    complete: true,
  };
}

// ============================================
// Entrepreneur Executor
// ============================================

import { tryOpenBusiness } from '../../systems/BusinessOpportunityService';
import { completeGoodsOrder } from '../../systems/SupplyChainSystem';

/**
 * Entrepreneur executor - handles business creation
 * Used by: starting_business
 */
function executeEntrepreneurBehavior(
  agent: Agent,
  _task: AgentTask,
  ctx: BehaviorContext
): TaskResult {
  // If already employed, task is complete
  if (agent.employedAt) {
    return {
      agent: clearTask(agent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true,
    };
  }

  // Try to open a business
  const result = tryOpenBusiness(
    agent,
    ctx.locationTemplates,
    ctx.buildings,
    ctx.locations,
    ctx.agents,
    ctx.orgs,
    ctx.agentsConfig,
    ctx.economyConfig,
    ctx.thresholdsConfig,
    ctx.businessConfig,
    ctx.logisticsConfig,
    ctx.deliveryRequests ?? [],
    ctx.vehicles ?? [],
    ctx.phase,
    ctx.context
  );

  // If business was created, return with new entities
  if (result.newLocation || result.newOrg) {
    const businessName = result.newOrg?.name ?? result.newLocation?.name ?? 'a new business';
    ActivityLog.info(
      ctx.phase,
      'business',
      `opened ${result.newLocation?.name ?? 'a new business'}`,
      result.agent.id,
      result.agent.name
    );

    // Track business opening in metrics
    recordBusinessOpened(ctx.context.metrics,businessName);

    // Add new vehicles to the result if any were created
    const updatedVehicles = result.newVehicles
      ? [...(ctx.vehicles ?? []), ...result.newVehicles]
      : ctx.vehicles;

    return {
      agent: clearTask(result.agent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      vehicles: updatedVehicles,
      newLocation: result.newLocation,
      newOrg: result.newOrg,
      complete: true,
    };
  }

  // Business not opened (random chance or conditions not met)
  // Keep trying (don't complete task)
  return {
    agent,
    locations: ctx.locations,
    orgs: ctx.orgs,
    complete: false,
  };
}

// ============================================
// Consume Luxury Executor
// ============================================

function executeConsumeLuxuryBehavior(
  agent: Agent,
  _task: AgentTask,
  ctx: BehaviorContext
): TaskResult {
  // Check if agent has luxury_goods
  const luxuryCount = agent.inventory['luxury_goods'] ?? 0;

  if (luxuryCount <= 0) {
    // No luxury goods to consume
    return {
      agent: clearTask(agent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true,
    };
  }

  // Consume 1 luxury_goods
  const newInventory = { ...agent.inventory };
  newInventory['luxury_goods'] = luxuryCount - 1;
  if (newInventory['luxury_goods'] <= 0) {
    delete newInventory['luxury_goods'];
  }

  // Apply leisure satisfaction
  const luxurySatisfaction = ctx.agentsConfig.leisure.luxurySatisfaction ?? 70;
  const newLeisure = Math.max(0, agent.needs.leisure - luxurySatisfaction);

  const updatedAgent: Agent = {
    ...agent,
    inventory: newInventory,
    needs: { ...agent.needs, leisure: newLeisure },
  };

  ActivityLog.info(
    ctx.phase,
    'leisure',
    `enjoyed a luxury item (leisure: ${agent.needs.leisure.toFixed(0)} → ${newLeisure.toFixed(0)})`,
    agent.id,
    agent.name
  );

  return {
    agent: clearTask(updatedAgent),
    locations: ctx.locations,
    orgs: ctx.orgs,
    complete: true,
  };
}

// ============================================
// Purchase Orphaned Location Executor
// ============================================

/**
 * Purchase orphaned location executor - buy locations that have no owner
 * Used by: purchasing_location
 */
function executePurchaseOrphanedLocationBehavior(
  agent: Agent,
  _task: AgentTask,
  ctx: BehaviorContext
): TaskResult {
  // If already employed, task is complete
  if (agent.employedAt) {
    return {
      agent: clearTask(agent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true,
    };
  }

  // Find orphaned locations for sale
  const orphanedLocations = ctx.locations.filter(
    (loc) => loc.owner === undefined && loc.forSale === true
  );

  if (orphanedLocations.length === 0) {
    // No orphaned locations available
    return {
      agent: clearTask(agent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true,
    };
  }

  // Calculate resale discount
  const resaleDiscount = ctx.economyConfig.resaleDiscount ?? 0.6;

  // Helper to get base price from template's openingCost
  const getBasePrice = (loc: Location): number => {
    const template = ctx.locationTemplates[loc.template];
    return template?.balance?.openingCost ?? 100; // Default to 100 if no template
  };

  // Find an affordable location using template openingCost
  const affordableLocations = orphanedLocations.filter((loc) => {
    const basePrice = getBasePrice(loc);
    const resalePrice = Math.floor(basePrice * resaleDiscount);
    return agent.wallet.credits >= resalePrice + 50; // Need some buffer after purchase
  });

  if (affordableLocations.length === 0) {
    // Can't afford any orphaned locations
    return {
      agent: clearTask(agent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true,
    };
  }

  // Random chance to actually purchase (like entrepreneur behavior)
  if (ctx.context.rng() > 0.1) {
    // 10% chance per phase to purchase
    return {
      agent,
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: false,
    };
  }

  // Pick the first affordable location (could be random or by preference)
  const targetLocation = affordableLocations[0];
  if (!targetLocation) {
    return {
      agent: clearTask(agent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true,
    };
  }

  // Calculate purchase price using template openingCost
  const basePrice = getBasePrice(targetLocation);
  const purchasePrice = Math.floor(basePrice * resaleDiscount);

  // Create a new organization for this agent
  const orgId = ctx.context.idGen.nextOrgId();
  const orgName = `${agent.name}'s ${targetLocation.template === 'apartment' ? 'Properties' : 'Business'}`;

  // Agent pays the purchase price (goes to "the market" - money disappears)
  const updatedAgent: Agent = {
    ...agent,
    wallet: {
      ...agent.wallet,
      credits: agent.wallet.credits - purchasePrice,
    },
    employer: orgId,
    employedAt: targetLocation.id,
    status: 'employed',
  };

  // Create the new org with remaining agent credits as seed capital
  const seedCapital = Math.floor(updatedAgent.wallet.credits * 0.5); // Transfer half remaining credits to business
  const newOrg = createOrganization(
    orgId,
    orgName,
    agent.id,
    agent.name,
    seedCapital,
    ctx.phase,
    ctx.context
  );

  // Update agent wallet after transferring to org
  updatedAgent.wallet.credits -= seedCapital;

  // Add location to org
  newOrg.locations.push(targetLocation.id);

  // Update the location: new owner, no longer for sale, add buyer as employee
  const updatedLocation: Location = {
    ...targetLocation,
    owner: orgId,
    ownerType: 'org',
    forSale: false,
    employees: [agent.id], // Buyer works at their new business
    previousOwners: [
      ...(targetLocation.previousOwners ?? []),
      // Previous "orphaned" period already recorded when orphaned
    ],
  };

  // Update locations array
  const updatedLocations = ctx.locations.map((loc) =>
    loc.id === targetLocation.id ? updatedLocation : loc
  );

  ActivityLog.info(
    ctx.phase,
    'purchase',
    `purchased orphaned ${targetLocation.name} for ${purchasePrice} credits`,
    agent.id,
    agent.name
  );

  recordBusinessOpened(ctx.context.metrics,orgName);

  return {
    agent: clearTask(updatedAgent),
    locations: updatedLocations,
    orgs: ctx.orgs,
    newOrg,
    complete: true,
  };
}

// ============================================
// Deliver Goods Executor
// ============================================

/**
 * Deliver goods executor - handles trucking deliveries
 * PHASE 5: Uses simplified 3-action system (legacy 6-phase code removed)
 *
 * Actions:
 * 1. traveling_to_pickup: Assign order, board vehicle, travel to pickup
 * 2. loading_and_traveling: Load goods into vehicle, travel to delivery
 * 3. unloading: Unload goods, complete order, pay logistics company
 *
 * State stored in agent.deliveryShiftState.activeDelivery (not task.params)
 */
function executeDeliverGoodsBehavior(
  agent: Agent,
  task: AgentTask,
  ctx: BehaviorContext
): TaskResult {
  // PHASE 5: All deliveries use new 3-action system
  return executeDeliverGoodsBehaviorNew(agent, task, ctx);
}

/**
 * NEW: Simplified 3-action delivery executor
 * Replaces 6-phase state machine with atomic actions
 * State stored in agent.deliveryShiftState.activeDelivery (not task.params)
 *
 * Actions:
 * 1. traveling_to_pickup: Assign order, board vehicle, travel to pickup
 * 2. loading_and_traveling: Load goods into vehicle, travel to delivery
 * 3. unloading: Unload goods, complete order, pay logistics company
 */
function executeDeliverGoodsBehaviorNew(
  agent: Agent,
  task: AgentTask,
  ctx: BehaviorContext
): TaskResult {
  // Initialize delivery shift state if first time (like work behavior)
  if (!agent.deliveryShiftState) {
    const shiftDuration = 16; // Same as work shifts
    const randomOffset = randomInt(0, shiftDuration / 2, ctx.context.rng);

    const newAgent = {
      ...agent,
      deliveryShiftState: {
        phasesDelivered: randomOffset,
        lastShiftEndPhase: 0,
        shiftStartPhase: ctx.phase,
      },
    };

    ActivityLog.info(
      ctx.phase,
      'employment',
      `started delivery shift (first shift reduced by ${randomOffset} phases)`,
      agent.id,
      agent.name
    );

    return {
      agent: newAgent.currentTask ? newAgent : setTask(newAgent, task),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: false,
    };
  }

  // Increment shift counter when actively working (has assigned delivery)
  const hasActiveDelivery = task.params?.deliveryId;
  const currentDeliveryPhase = (task.params?.deliveryPhase as string) ?? 'assigning';
  let currentAgent = agent;

  if (hasActiveDelivery) {
    // Actively working on delivery - increment shift time
    currentAgent = {
      ...agent,
      deliveryShiftState: {
        ...agent.deliveryShiftState!,
        phasesDelivered: agent.deliveryShiftState!.phasesDelivered + 1,
      },
    };

    // Log delivery progress every 5 ticks
    if (currentAgent.deliveryShiftState!.phasesDelivered % 5 === 0) {
      ActivityLog.info(
        ctx.phase,
        'delivery',
        `shift progress: ${currentAgent.deliveryShiftState!.phasesDelivered} phases, current phase: ${currentDeliveryPhase}, delivery: ${hasActiveDelivery}`,
        agent.id,
        agent.name
      );
    }
  }

  // Check if shift should end (only when NOT mid-delivery AND no assigned delivery)
  const shiftDuration = 64;
  const deliveryPhaseParam = task.params?.deliveryPhase as string | undefined;
  const hasAssignedDelivery = task.params?.deliveryId;

  // Don't end shift if: (1) mid-delivery OR (2) just assigned a delivery
  const canEndShift = !hasAssignedDelivery;

  if (currentAgent.deliveryShiftState!.phasesDelivered >= shiftDuration && canEndShift) {
    // Shift complete - end behavior
    const finishedAgent = {
      ...currentAgent,
      deliveryShiftState: {
        ...currentAgent.deliveryShiftState!,
        lastShiftEndPhase: ctx.phase,
        phasesDelivered: 0,
      },
    };

    ActivityLog.info(
      ctx.phase,
      'employment',
      `completed delivery shift (${shiftDuration} phases)`,
      agent.id,
      agent.name
    );

    return {
      agent: clearTask(finishedAgent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true,
    };
  }

  // Continue with delivery logic
  agent = currentAgent;

  // Find the logistics company this agent works for
  const logisticsCompany = ctx.orgs.find(org => org.id === agent.employer);

  if (!logisticsCompany || !logisticsCompany.tags.includes('logistics')) {
    // Agent doesn't work for logistics company - can't deliver
    ActivityLog.warning(
      ctx.phase,
      'delivery',
      `cannot deliver goods - not employed by logistics company`,
      agent.id,
      agent.name
    );
    return {
      agent: clearTask(agent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true,
    };
  }

  // Get delivery state from task params
  const deliveryId = task.params?.deliveryId as string | undefined;
  const deliveryPhase = (task.params?.deliveryPhase as string) ?? 'assigning';

  let deliveryRequest: DeliveryRequest | undefined;

  // Phase 1: Assign delivery if not already assigned
  if (!deliveryId || deliveryPhase === 'assigning') {
    // Find a pending LOGISTICS order to assign (not goods orders!)
    const pendingDeliveries = (ctx.deliveryRequests ?? []).filter(
      req => req.orderType === 'logistics' && req.status === 'pending'
    );

    if (pendingDeliveries.length === 0) {
      // No deliveries available - wait at depot (don't end shift)
      if (ctx.phase % 10 === 0) {
        ActivityLog.info(
          ctx.phase,
          'delivery',
          `no pending logistics orders available, idling at depot (shift: ${agent.deliveryShiftState?.phasesDelivered ?? 0}/64)`,
          agent.id,
          agent.name
        );
      }
      return {
        agent,
        locations: ctx.locations,
        orgs: ctx.orgs,
        complete: false, // Keep shift going - just idle until new orders arrive
      };
    }

    // Check if agent is too tired to start a new delivery (prevents mid-delivery interruption by urgent_rest)
    if (agent.needs.fatigue >= 85) {
      // Too tired - don't assign delivery, let them rest first
      return {
        agent,
        locations: ctx.locations,
        orgs: ctx.orgs,
        complete: false, // Keep shift going but idle until rested
      };
    }

    // Assign first pending delivery to this driver
    deliveryRequest = pendingDeliveries[0]!;
    const availableVehicle = findAvailableVehicle(logisticsCompany, ctx.vehicles ?? []);

    if (!availableVehicle) {
      // No vehicles available - wait
      return {
        agent,
        locations: ctx.locations,
        orgs: ctx.orgs,
        complete: false,
      };
    }

    // CRITICAL: If agent is still in a vehicle from a previous delivery, exit it first
    let currentAgent = agent;
    let currentVehicles = ctx.vehicles ?? [];

    if (agent.inVehicle) {
      const oldVehicle = currentVehicles.find(v => v.id === agent.inVehicle);
      if (oldVehicle) {
        ActivityLog.warning(
          ctx.phase,
          'delivery',
          `agent still in vehicle ${oldVehicle.id} from previous delivery - exiting before new assignment`,
          agent.id,
          agent.name
        );

        const exitResult = exitVehicle(oldVehicle, agent, ctx.buildings, ctx.phase);
        if (exitResult.success) {
          currentAgent = exitResult.agent;
          currentVehicles = currentVehicles.map(v =>
            v.id === oldVehicle.id ? exitResult.vehicle : v
          );
        } else {
          // Can't exit old vehicle - can't assign new delivery
          ActivityLog.warning(
            ctx.phase,
            'delivery',
            `can't exit old vehicle ${oldVehicle.id} (${exitResult.reason}) - skipping assignment`,
            agent.id,
            agent.name
          );
          return {
            agent,
            locations: ctx.locations,
            orgs: ctx.orgs,
            complete: false,
          };
        }
      }
    }

    // Assign delivery
    const assignedDelivery = assignDeliveryToDriver(deliveryRequest, currentAgent, availableVehicle, ctx.phase);
    const updatedDeliveryRequests = (ctx.deliveryRequests ?? []).map(req =>
      req.id === deliveryRequest!.id ? assignedDelivery : req
    );

    ActivityLog.info(
      ctx.phase,
      'delivery',
      `assigned to delivery ${assignedDelivery.id}, vehicle ${availableVehicle.id}`,
      currentAgent.id,
      currentAgent.name
    );

    // Update task with delivery ID and next phase
    const updatedTask: AgentTask = {
      ...task,
      params: {
        ...task.params,
        deliveryId: assignedDelivery.id,
        deliveryPhase: 'boarding'
      },
    };

    return {
      agent: setTask(currentAgent, updatedTask),
      locations: ctx.locations,
      orgs: ctx.orgs,
      vehicles: currentVehicles,
      deliveryRequests: updatedDeliveryRequests,
      complete: false,
    };
  }

  // Get the assigned delivery request
  deliveryRequest = ctx.deliveryRequests?.find(req => req.id === deliveryId);

  // If delivery no longer exists or is already completed/failed, task is done
  if (!deliveryRequest || deliveryRequest.status === 'delivered' || deliveryRequest.status === 'failed') {
    return {
      agent: clearTask(agent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true,
    };
  }

  // Validate locations and vehicle exist
  const fromLocation = ctx.locations.find(loc => loc.id === deliveryRequest!.fromLocation);
  const toLocation = ctx.locations.find(loc => loc.id === deliveryRequest!.toLocation);

  if (!fromLocation || !toLocation) {
    // Locations don't exist - fail delivery with detailed logging
    const missingFrom = !fromLocation ? `from=${deliveryRequest!.fromLocation}` : '';
    const missingTo = !toLocation ? `to=${deliveryRequest!.toLocation}` : '';
    const missing = [missingFrom, missingTo].filter(Boolean).join(', ');

    ActivityLog.warning(
      ctx.phase,
      'delivery',
      `order ${deliveryRequest!.id} failed - location not found: ${missing}`,
      agent.id,
      agent.name
    );

    const updatedDeliveryRequests = failDeliveryWithParent(
      deliveryRequest!,
      ctx.deliveryRequests ?? [],
      'location not found',
      ctx.phase
    );

    return {
      agent: clearTask(agent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      deliveryRequests: updatedDeliveryRequests,
      complete: true,
    };
  }

  // Get assigned vehicle
  const assignedVehicle = (ctx.vehicles ?? []).find(v => v.id === deliveryRequest!.assignedVehicle);

  if (!assignedVehicle) {
    // Vehicle doesn't exist - fail delivery
    const updatedDeliveryRequests = failDeliveryWithParent(
      deliveryRequest!,
      ctx.deliveryRequests ?? [],
      'vehicle not found',
      ctx.phase
    );

    return {
      agent: clearTask(agent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      deliveryRequests: updatedDeliveryRequests,
      complete: true,
    };
  }

  // Get pickup and delivery buildings
  const fromBuilding = ctx.buildings.find(b => b.id === fromLocation.building);
  const toBuilding = ctx.buildings.find(b => b.id === toLocation.building);

  if (!fromBuilding || !toBuilding) {
    // Buildings don't exist - fail delivery
    const updatedDeliveryRequests = failDeliveryWithParent(
      deliveryRequest!,
      ctx.deliveryRequests ?? [],
      'building not found',
      ctx.phase
    );

    return {
      agent: clearTask(agent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      deliveryRequests: updatedDeliveryRequests,
      complete: true,
    };
  }

  // Phase-based state machine for delivery workflow
  // Phases: boarding → to_pickup → loading → to_delivery → unloading → completing

  // PHASE: boarding - Board the vehicle at depot
  if (deliveryPhase === 'boarding') {
    ActivityLog.info(
      ctx.phase,
      'delivery',
      `boarding vehicle ${assignedVehicle.id} for delivery ${deliveryId}`,
      agent.id,
      agent.name
    );

    // Agent must board the vehicle as operator
    if (!agent.inVehicle) {
      const boardResult = boardVehicle(assignedVehicle, agent, true, ctx.phase);
      if (boardResult.success) {
        const updatedVehicles = (ctx.vehicles ?? []).map(v =>
          v.id === assignedVehicle.id ? boardResult.vehicle : v
        );

        const updatedTask: AgentTask = {
          ...task,
          params: { ...task.params, deliveryPhase: 'to_pickup' },
        };

        return {
          agent: setTask(boardResult.agent, updatedTask),
          locations: ctx.locations,
          orgs: ctx.orgs,
          vehicles: updatedVehicles,
          complete: false,
        };
      }

      // Failed to board - fail delivery
      const updatedDeliveryRequests = failDeliveryWithParent(
        deliveryRequest!,
        ctx.deliveryRequests ?? [],
        'cannot board vehicle',
        ctx.phase
      );

      return {
        agent: clearTask(agent),
        locations: ctx.locations,
        orgs: ctx.orgs,
        deliveryRequests: updatedDeliveryRequests,
        complete: true,
      };
    }

    // Already in vehicle - move to next phase
    const updatedTask: AgentTask = {
      ...task,
      params: { ...task.params, deliveryPhase: 'to_pickup' },
    };

    return {
      agent: setTask(agent, updatedTask),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: false,
    };
  }

  // PHASE: to_pickup - Drive vehicle to pickup building
  if (deliveryPhase === 'to_pickup') {
    // Check if vehicle is already traveling
    if (assignedVehicle.travelingToBuilding) {
      // Wait for vehicle to arrive
      return {
        agent,
        locations: ctx.locations,
        orgs: ctx.orgs,
        complete: false,
      };
    }

    // Check if vehicle is at pickup building
    if (assignedVehicle.currentBuilding === fromBuilding.id) {
      // Arrived - move to loading phase
      ActivityLog.info(
        ctx.phase,
        'delivery',
        `arrived at pickup building ${fromBuilding.name}, starting loading for delivery ${deliveryId}`,
        agent.id,
        agent.name
      );

      const updatedTask: AgentTask = {
        ...task,
        params: { ...task.params, deliveryPhase: 'loading' },
      };

      return {
        agent: setTask(agent, updatedTask),
        locations: ctx.locations,
        orgs: ctx.orgs,
        complete: false,
      };
    }

    // Validate vehicle has a current building
    if (!assignedVehicle.currentBuilding) {
      ActivityLog.warning(
        ctx.phase,
        'delivery',
        `vehicle has no currentBuilding, cannot travel - failing delivery`,
        agent.id,
        agent.name
      );

      const updatedDeliveryRequests = failDeliveryWithParent(
        deliveryRequest!,
        ctx.deliveryRequests ?? [],
        'vehicle has no location',
        ctx.phase
      );

      return {
        agent: clearTask(agent),
        locations: ctx.locations,
        orgs: ctx.orgs,
        deliveryRequests: updatedDeliveryRequests,
        complete: true,
      };
    }

    // Find the current building
    const currentBuilding = ctx.buildings.find(b => b.id === assignedVehicle.currentBuilding);
    if (!currentBuilding) {
      ActivityLog.warning(
        ctx.phase,
        'delivery',
        `vehicle currentBuilding not found: ${assignedVehicle.currentBuilding} - failing delivery`,
        agent.id,
        agent.name
      );

      const updatedDeliveryRequests = failDeliveryWithParent(
        deliveryRequest!,
        ctx.deliveryRequests ?? [],
        'current building not found',
        ctx.phase
      );

      return {
        agent: clearTask(agent),
        locations: ctx.locations,
        orgs: ctx.orgs,
        deliveryRequests: updatedDeliveryRequests,
        complete: true,
      };
    }

    // Start vehicle travel to pickup building
    const distance = Math.abs(currentBuilding.x - fromBuilding.x) + Math.abs(currentBuilding.y - fromBuilding.y);
    ActivityLog.info(
      ctx.phase,
      'delivery',
      `starting travel to pickup (${currentBuilding.name} → ${fromBuilding.name}, distance ${distance}) for delivery ${deliveryId}`,
      agent.id,
      agent.name
    );

    const travelingVehicle = startVehicleTravel(
      assignedVehicle,
      currentBuilding,
      fromBuilding,
      'truck',
      ctx.transportConfig,
      ctx.phase
    );

    const updatedVehicles = (ctx.vehicles ?? []).map(v =>
      v.id === assignedVehicle.id ? travelingVehicle : v
    );

    return {
      agent,
      locations: ctx.locations,
      orgs: ctx.orgs,
      vehicles: updatedVehicles,
      complete: false,
    };
  }

  // PHASE: loading - Exit vehicle, load goods, board again
  if (deliveryPhase === 'loading') {
    ActivityLog.info(
      ctx.phase,
      'delivery',
      `loading phase - agent.inVehicle=${agent.inVehicle}, vehicle.id=${assignedVehicle.id}, vehicle.operator=${assignedVehicle.operator}`,
      agent.id,
      agent.name
    );

    // If in vehicle, exit first
    if (agent.inVehicle) {
      const exitResult = exitVehicle(assignedVehicle, agent, ctx.buildings, ctx.phase);
      if (exitResult.success) {
        const updatedVehicles = (ctx.vehicles ?? []).map(v =>
          v.id === assignedVehicle.id ? exitResult.vehicle : v
        );

        ActivityLog.info(
          ctx.phase,
          'delivery',
          `exited vehicle to load cargo for delivery ${deliveryId}`,
          agent.id,
          agent.name
        );

        return {
          agent: exitResult.agent,
          locations: ctx.locations,
          orgs: ctx.orgs,
          vehicles: updatedVehicles,
          complete: false,
        };
      } else {
        // Failed to exit vehicle - fail delivery
        ActivityLog.warning(
          ctx.phase,
          'delivery',
          `failed to exit vehicle during loading (reason: ${exitResult.reason || 'unknown'}) - failing delivery ${deliveryId}`,
          agent.id,
          agent.name
        );

        const updatedDeliveryRequests = failDeliveryWithParent(
          deliveryRequest!,
          ctx.deliveryRequests ?? [],
          `cannot exit vehicle: ${exitResult.reason || 'unknown'}`,
          ctx.phase
        );

        return {
          agent: clearTask(agent),
          locations: ctx.locations,
          orgs: ctx.orgs,
          deliveryRequests: updatedDeliveryRequests,
          complete: true,
        };
      }
    }

    // Agent is out of vehicle - now move to location and load goods
    // For simplicity, we'll assume agent can instantly access the location in the building
    // In a more detailed sim, agent would need to travel within the building

    let updatedVehicle = assignedVehicle;
    let updatedLocation = fromLocation;

    // Load each good type into vehicle
    for (const [good, amount] of Object.entries(deliveryRequest!.cargo ?? {})) {
      const goodConfig = ctx.economyConfig.goods[good];
      const goodSize = goodConfig?.size ?? ctx.economyConfig.defaultGoodsSize;

      const loadResult = loadCargo(
        updatedVehicle,
        updatedLocation.inventory,
        good,
        amount,
        goodSize,
        ctx.phase
      );

      updatedVehicle = loadResult.vehicle;
      updatedLocation = {
        ...updatedLocation,
        inventory: loadResult.locationInventory,
      };
    }

    // Board vehicle again
    const boardResult = boardVehicle(updatedVehicle, agent, true, ctx.phase);
    if (!boardResult.success) {
      // Failed to board - fail delivery
      const updatedDeliveryRequests = failDeliveryWithParent(
        deliveryRequest!,
        ctx.deliveryRequests ?? [],
        'cannot reboard vehicle',
        ctx.phase
      );

      return {
        agent: clearTask(agent),
        locations: ctx.locations,
        orgs: ctx.orgs,
        deliveryRequests: updatedDeliveryRequests,
        complete: true,
      };
    }

    // Update delivery status to 'in_transit'
    const inTransitDelivery = startDelivery(deliveryRequest!, ctx.phase);

    const updatedVehicles = (ctx.vehicles ?? []).map(v =>
      v.id === assignedVehicle.id ? boardResult.vehicle : v
    );

    const updatedLocations = ctx.locations.map(loc =>
      loc.id === fromLocation.id ? updatedLocation : loc
    );

    const updatedDeliveryRequests = (ctx.deliveryRequests ?? []).map(req =>
      req.id === deliveryRequest!.id ? inTransitDelivery : req
    );

    const updatedTask: AgentTask = {
      ...task,
      params: { ...task.params, deliveryPhase: 'to_delivery' },
    };

    return {
      agent: setTask(boardResult.agent, updatedTask),
      locations: updatedLocations,
      orgs: ctx.orgs,
      vehicles: updatedVehicles,
      deliveryRequests: updatedDeliveryRequests,
      complete: false,
    };
  }

  // PHASE: to_delivery - Drive vehicle to delivery building
  if (deliveryPhase === 'to_delivery') {
    // Check if vehicle is already traveling
    if (assignedVehicle.travelingToBuilding) {
      // Wait for vehicle to arrive
      return {
        agent,
        locations: ctx.locations,
        orgs: ctx.orgs,
        complete: false,
      };
    }

    // Check if vehicle is at delivery building
    if (assignedVehicle.currentBuilding === toBuilding.id) {
      // Arrived - move to unloading phase
      const updatedTask: AgentTask = {
        ...task,
        params: { ...task.params, deliveryPhase: 'unloading' },
      };

      return {
        agent: setTask(agent, updatedTask),
        locations: ctx.locations,
        orgs: ctx.orgs,
        complete: false,
      };
    }

    // Validate vehicle has a current building
    if (!assignedVehicle.currentBuilding) {
      ActivityLog.warning(
        ctx.phase,
        'delivery',
        `vehicle has no currentBuilding, cannot travel - failing delivery`,
        agent.id,
        agent.name
      );

      const updatedDeliveryRequests = failDeliveryWithParent(
        deliveryRequest!,
        ctx.deliveryRequests ?? [],
        'vehicle has no location',
        ctx.phase
      );

      return {
        agent: clearTask(agent),
        locations: ctx.locations,
        orgs: ctx.orgs,
        deliveryRequests: updatedDeliveryRequests,
        complete: true,
      };
    }

    // Find the current building
    const currentBuilding = ctx.buildings.find(b => b.id === assignedVehicle.currentBuilding);
    if (!currentBuilding) {
      ActivityLog.warning(
        ctx.phase,
        'delivery',
        `vehicle currentBuilding not found: ${assignedVehicle.currentBuilding} - failing delivery`,
        agent.id,
        agent.name
      );

      const updatedDeliveryRequests = failDeliveryWithParent(
        deliveryRequest!,
        ctx.deliveryRequests ?? [],
        'current building not found',
        ctx.phase
      );

      return {
        agent: clearTask(agent),
        locations: ctx.locations,
        orgs: ctx.orgs,
        deliveryRequests: updatedDeliveryRequests,
        complete: true,
      };
    }

    // Start vehicle travel to delivery building
    const travelingVehicle = startVehicleTravel(
      assignedVehicle,
      currentBuilding,
      toBuilding,
      'truck',
      ctx.transportConfig,
      ctx.phase
    );

    const updatedVehicles = (ctx.vehicles ?? []).map(v =>
      v.id === assignedVehicle.id ? travelingVehicle : v
    );

    return {
      agent,
      locations: ctx.locations,
      orgs: ctx.orgs,
      vehicles: updatedVehicles,
      complete: false,
    };
  }

  // PHASE: unloading - Exit vehicle, unload goods
  if (deliveryPhase === 'unloading') {
    // If in vehicle, exit first
    if (agent.inVehicle) {
      const exitResult = exitVehicle(assignedVehicle, agent, ctx.buildings, ctx.phase);
      if (exitResult.success) {
        const updatedVehicles = (ctx.vehicles ?? []).map(v =>
          v.id === assignedVehicle.id ? exitResult.vehicle : v
        );

        return {
          agent: exitResult.agent,
          locations: ctx.locations,
          orgs: ctx.orgs,
          vehicles: updatedVehicles,
          complete: false,
        };
      }
    }

    // Agent is out of vehicle - unload goods
    let updatedVehicle = assignedVehicle;
    let updatedLocation = toLocation;

    // Unload each good type from vehicle
    for (const [good, amount] of Object.entries(deliveryRequest!.cargo ?? {})) {
      const goodConfig = ctx.economyConfig.goods[good];
      const goodSize = goodConfig?.size ?? ctx.economyConfig.defaultGoodsSize;

      const unloadResult = unloadCargo(
        updatedVehicle,
        updatedLocation.inventory,
        updatedLocation.inventoryCapacity,
        good,
        amount,
        goodSize,
        ctx.phase
      );

      updatedVehicle = unloadResult.vehicle;
      updatedLocation = {
        ...updatedLocation,
        inventory: unloadResult.locationInventory,
      };
    }

    // Complete delivery (pay logistics company)
    const deliveryResult = completeDelivery(deliveryRequest!, logisticsCompany, ctx.phase);

    const updatedVehicles = (ctx.vehicles ?? []).map(v =>
      v.id === assignedVehicle.id ? updatedVehicle : v
    );

    const updatedLocations = ctx.locations.map(loc =>
      loc.id === toLocation.id ? updatedLocation : loc
    );

    let updatedOrgsAfterDelivery = ctx.orgs.map(org =>
      org.id === logisticsCompany.id ? deliveryResult.company : org
    );

    let updatedDeliveryRequestsAfterDelivery = (ctx.deliveryRequests ?? []).map(req =>
      req.id === deliveryRequest!.id ? deliveryResult.request : req
    );

    // If this logistics order is linked to a goods order, complete the goods order too
    if (deliveryRequest!.parentOrderId) {
      const goodsResult = completeGoodsOrder(
        deliveryRequest!,
        updatedDeliveryRequestsAfterDelivery,
        updatedOrgsAfterDelivery,
        ctx.phase,
        ctx.context
      );
      updatedOrgsAfterDelivery = goodsResult.orgs;
      updatedDeliveryRequestsAfterDelivery = goodsResult.orders;
    }

    const updatedOrgs = updatedOrgsAfterDelivery;
    const updatedDeliveryRequests = updatedDeliveryRequestsAfterDelivery;

    // Delivery complete - shift counter already incremented above
    // Just clear task and continue (shift might have more time or might end naturally)
    return {
      agent: clearTask(agent),
      locations: updatedLocations,
      orgs: updatedOrgs,
      vehicles: updatedVehicles,
      deliveryRequests: updatedDeliveryRequests,
      complete: false, // Keep behavior running - let normal flow check shift completion
    };
  }

  // Unknown phase - fail delivery
  const updatedDeliveryRequests = failDeliveryWithParent(
    deliveryRequest!,
    ctx.deliveryRequests ?? [],
    `unknown phase: ${deliveryPhase}`,
    ctx.phase
  );

  return {
    agent: clearTask(agent),
    locations: ctx.locations,
    orgs: ctx.orgs,
    deliveryRequests: updatedDeliveryRequests,
    complete: true,
  };
}

// ============================================
// Pub Visit Executor
// ============================================

/**
 * Visit pub executor - agent travels to pub, pays fee, stays for duration
 * Used by: visiting_pub behavior
 */
function executeVisitPubBehavior(
  agent: Agent,
  _task: AgentTask,
  ctx: BehaviorContext
): TaskResult {
  // Find nearest pub (location with 'leisure' tag)
  const pub = findNearestLocation(agent, ctx.locations, loc =>
    loc.tags.includes('leisure')
  );

  if (!pub) {
    // No pub available
    return {
      agent: clearTask(agent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true,
    };
  }

  // Initialize pub visit state if needed
  if (!agent.pubVisitState) {
    agent.pubVisitState = {
      phasesAtPub: 0,
      pubId: pub.id,
    };
  }

  // Travel to pub if not there yet
  if (agent.currentLocation !== pub.id) {
    if (isTraveling(agent)) {
      // Already traveling, continue
      return {
        agent,
        locations: ctx.locations,
        orgs: ctx.orgs,
        complete: false,
      };
    }

    // Start travel to pub
    const travelingAgent = startTravel(agent, pub, ctx.locations, ctx.transportConfig);

    ActivityLog.info(
      ctx.phase,
      'leisure',
      `heading to ${pub.name}`,
      agent.id,
      agent.name
    );

    return {
      agent: travelingAgent,
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: false,
    };
  }

  // At pub - first phase: pay fee
  if (agent.pubVisitState.phasesAtPub === 0) {
    const pubFee = ctx.agentsConfig.leisure.pubFee ?? 20;

    if (agent.wallet.credits < pubFee) {
      // Can't afford - abort
      const updatedAgent = { ...agent };
      delete updatedAgent.pubVisitState;

      ActivityLog.warning(
        ctx.phase,
        'leisure',
        `can't afford pub fee (${pubFee} credits)`,
        agent.id,
        agent.name
      );

      return {
        agent: clearTask(updatedAgent),
        locations: ctx.locations,
        orgs: ctx.orgs,
        complete: true,
      };
    }

    // Pay pub owner
    const pubOrg = ctx.orgs.find(o => o.id === pub.owner);
    if (!pubOrg) {
      // No owner - still charge but money disappears
      ActivityLog.warning(
        ctx.phase,
        'economy',
        `pub has no owner, fee lost`,
        agent.id,
        agent.name
      );
    }

    // Create and record transaction (service sale)
    const transaction = createTransaction(
      ctx.phase,
      'sale',
      agent.id,
      pubOrg?.id ?? 'unknown',
      pubFee,
      pub.id,
      { type: 'pub_visit', quantity: 1 }
    );
    recordTransaction(ctx.context.transactionHistory, transaction);

    // Update wallet balances
    agent.wallet.credits -= pubFee;
    if (pubOrg) {
      pubOrg.wallet.credits += pubFee;
    }

    ActivityLog.info(
      ctx.phase,
      'service',
      `paid ${pubFee} credits at ${pub.name}`,
      agent.id,
      agent.name
    );
  }

  // Stay at pub, increment counter
  agent.pubVisitState.phasesAtPub++;

  // Reduce leisure over time (40 total over 4 phases = 10 per phase)
  const leisureReductionPerPhase = (ctx.agentsConfig.leisure.pubSatisfaction ?? 40) / 4;
  const newLeisure = Math.max(0, agent.needs.leisure - leisureReductionPerPhase);

  const updatedAgent: Agent = {
    ...agent,
    needs: { ...agent.needs, leisure: newLeisure },
  };

  // Check if visit is complete (handled by completion conditions)
  // Just return updated state
  return {
    agent: clearTask(updatedAgent),
    locations: ctx.locations,
    orgs: ctx.orgs,
    complete: false,
  };
}

// ============================================
// Consume Entertainment Executor
// ============================================

/**
 * Consume entertainment executor - agent consumes entertainment_media from inventory
 * Used by: consume_entertainment behavior
 */
function executeConsumeEntertainmentBehavior(
  agent: Agent,
  _task: AgentTask,
  ctx: BehaviorContext
): TaskResult {
  // Check if agent has entertainment_media
  const mediaCount = agent.inventory['entertainment_media'] ?? 0;

  if (mediaCount <= 0) {
    // No media to consume
    return {
      agent: clearTask(agent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true,
    };
  }

  // Consume 1 entertainment_media
  const newInventory = { ...agent.inventory };
  newInventory['entertainment_media'] = mediaCount - 1;
  if (newInventory['entertainment_media'] <= 0) {
    delete newInventory['entertainment_media'];
  }

  // Apply leisure satisfaction
  const mediaSatisfaction = ctx.agentsConfig.leisure.entertainmentMediaSatisfaction ?? 30;
  const newLeisure = Math.max(0, agent.needs.leisure - mediaSatisfaction);

  const updatedAgent: Agent = {
    ...agent,
    inventory: newInventory,
    needs: { ...agent.needs, leisure: newLeisure },
  };

  ActivityLog.info(
    ctx.phase,
    'leisure',
    `enjoyed entertainment media at home (leisure: ${agent.needs.leisure.toFixed(0)} → ${newLeisure.toFixed(0)})`,
    agent.id,
    agent.name
  );

  return {
    agent: clearTask(updatedAgent),
    locations: ctx.locations,
    orgs: ctx.orgs,
    complete: true,
  };
}

// ============================================
// Relax at Home Executor
// ============================================

/**
 * Relax at home executor - agent slowly reduces leisure need while at home
 * Used by: relax_at_home behavior
 */
function executeRelaxHomeBehavior(
  agent: Agent,
  _task: AgentTask,
  ctx: BehaviorContext
): TaskResult {
  // Slow leisure reduction
  const reduction = ctx.agentsConfig.leisure.relaxAtHomeSatisfactionPerPhase ?? 5;
  const newLeisure = Math.max(0, agent.needs.leisure - reduction);

  const updatedAgent: Agent = {
    ...agent,
    needs: { ...agent.needs, leisure: newLeisure },
  };

  // Log periodically (not every phase - too spammy)
  if (ctx.phase % 10 === 0) {
    ActivityLog.info(
      ctx.phase,
      'leisure',
      `relaxing at home (leisure: ${agent.needs.leisure.toFixed(0)})`,
      agent.id,
      agent.name
    );
  }

  return {
    agent: clearTask(updatedAgent),
    locations: ctx.locations,
    orgs: ctx.orgs,
    complete: false, // Continues until completion condition met
  };
}

// ============================================
// Corpse Collection Executor (PLAN-039)
// ============================================

/**
 * Corpse collection executor - handles corpse collection for public health workers
 * Used by: collecting_corpses behavior
 *
 * Simplified 3-phase system:
 * 1. scanning: Find corpses, board ambulance, travel to corpse location
 * 2. loading: Load corpses into ambulance (instant)
 * 3. returning: Return to clinic, unload (instant), repeat
 *
 * Shift duration: 16 phases (not 64 like delivery)
 */
function executeCorpseCollectionBehavior(
  agent: Agent,
  task: AgentTask,
  ctx: BehaviorContext
): TaskResult {
  // Initialize corpse shift state if first time
  if (!agent.corpseShiftState) {
    const shiftDuration = 16;
    const randomOffset = randomInt(0, 8, ctx.context.rng); // 0-8 phase offset

    const newAgent = {
      ...agent,
      corpseShiftState: {
        phasesWorked: randomOffset,
        lastShiftEndPhase: 0,
        shiftStartPhase: ctx.phase,
        currentPhase: 'scanning' as const,
      },
    };

    ActivityLog.info(
      ctx.phase,
      'corpse',
      `started corpse collection shift (first shift reduced by ${randomOffset} phases)`,
      agent.id,
      agent.name
    );

    return {
      agent: newAgent.currentTask ? newAgent : setTask(newAgent, task),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: false,
    };
  }

  // Increment phases worked each tick
  const updatedAgent = {
    ...agent,
    corpseShiftState: {
      ...agent.corpseShiftState,
      phasesWorked: agent.corpseShiftState.phasesWorked + 1,
    },
  };
  agent = updatedAgent;

  // Check if shift should end (16 phases, only when idle in scanning phase)
  const shiftDuration = 16;
  const currentPhase = agent.corpseShiftState.currentPhase;

  // CRITICAL: Check for early termination due to hunger/fatigue (completion conditions from behavior.json)
  // This handles the case where the behavior system ends the task but the executor needs to clean up
  const earlyTerminationDueToNeeds = agent.needs.hunger >= 80 || agent.needs.fatigue >= 90;

  if (earlyTerminationDueToNeeds) {
    // Clean up agent state before ending shift
    let cleanedAgent = agent;

    // Exit vehicle if in one
    if (cleanedAgent.inVehicle && ctx.vehicles) {
      const ambulance = ctx.vehicles.find(v => v.id === cleanedAgent.inVehicle);
      if (ambulance) {
        const exitResult = exitVehicle(ambulance, cleanedAgent, ctx.buildings, ctx.phase);
        if (exitResult.success) {
          cleanedAgent = exitResult.agent;
          const updatedVehicles = ctx.vehicles.map(v =>
            v.id === ambulance.id ? exitResult.vehicle : v
          );
          ctx = { ...ctx, vehicles: updatedVehicles };

          ActivityLog.info(
            ctx.phase,
            'corpse',
            `exited ambulance due to ${agent.needs.hunger >= 80 ? 'hunger' : 'fatigue'} emergency`,
            agent.id,
            agent.name
          );
        }
      }
    }

    // Clear shift state
    const finishedAgent = {
      ...cleanedAgent,
      corpseShiftState: {
        ...cleanedAgent.corpseShiftState!,
        lastShiftEndPhase: ctx.phase,
        phasesWorked: 0,
        currentPhase: 'scanning' as const,
        targetLocationId: undefined,
        vehicleId: undefined,
      },
    };

    ActivityLog.info(
      ctx.phase,
      'corpse',
      `ended shift early due to ${agent.needs.hunger >= 80 ? 'hunger' : 'fatigue'}`,
      agent.id,
      agent.name
    );

    return {
      agent: clearTask(finishedAgent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      vehicles: ctx.vehicles,
      complete: true,
    };
  }

  if (agent.corpseShiftState.phasesWorked >= shiftDuration && currentPhase === 'scanning' && !agent.corpseShiftState.targetLocationId) {
    // Shift complete
    const finishedAgent = {
      ...agent,
      corpseShiftState: {
        ...agent.corpseShiftState,
        lastShiftEndPhase: ctx.phase,
        phasesWorked: 0,
      },
    };

    ActivityLog.info(
      ctx.phase,
      'corpse',
      `completed corpse collection shift (${shiftDuration} phases)`,
      agent.id,
      agent.name
    );

    return {
      agent: clearTask(finishedAgent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true,
    };
  }

  // Find the clinic (agent's workplace)
  const clinic = ctx.locations.find(loc => loc.id === agent.employedAt);
  if (!clinic) {
    ActivityLog.warning(
      ctx.phase,
      'corpse',
      `clinic not found - cannot collect corpses`,
      agent.id,
      agent.name
    );
    return {
      agent: clearTask(agent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true,
    };
  }

  // Find clinic's owner org to get ambulances
  const healthOrg = ctx.orgs.find(org => org.id === clinic.owner);
  if (!healthOrg) {
    return {
      agent: clearTask(agent),
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: true,
    };
  }

  // State machine
  const phase = agent.corpseShiftState.currentPhase;

  // SCANNING: Find corpses, board ambulance, start travel
  if (phase === 'scanning') {
    // Find locations with corpses
    const locationsWithCorpses = ctx.locations.filter(
      loc => (loc.inventory['corpse'] ?? 0) > 0
    );

    if (locationsWithCorpses.length === 0) {
      // No corpses available - idle at clinic
      if (ctx.phase % 10 === 0) {
        ActivityLog.info(
          ctx.phase,
          'corpse',
          `no corpses to collect, idling at clinic`,
          agent.id,
          agent.name
        );
      }
      return {
        agent,
        locations: ctx.locations,
        orgs: ctx.orgs,
        complete: false,
      };
    }

    // Find nearest location with corpses
    const targetLocation = findNearestLocation(
      agent,
      ctx.locations,
      loc => (loc.inventory['corpse'] ?? 0) > 0
    );

    if (!targetLocation) {
      return {
        agent,
        locations: ctx.locations,
        orgs: ctx.orgs,
        complete: false,
      };
    }

    // Find available ambulance
    const availableVehicles = (ctx.vehicles ?? []).filter(
      v => v.template === 'ambulance' && healthOrg.id === v.owner && !v.operator
    );

    if (availableVehicles.length === 0) {
      // No ambulances available - wait
      return {
        agent,
        locations: ctx.locations,
        orgs: ctx.orgs,
        complete: false,
      };
    }

    const ambulance = availableVehicles[0]!;

    // Board ambulance
    const boardResult = boardVehicle(ambulance, agent, true, ctx.phase);
    if (!boardResult.success) {
      return {
        agent,
        locations: ctx.locations,
        orgs: ctx.orgs,
        complete: false,
      };
    }

    // Start travel to corpse location
    const targetBuilding = ctx.buildings.find(b => b.id === targetLocation.building);
    const clinicBuilding = ctx.buildings.find(b => b.id === clinic.building);

    if (!targetBuilding || !clinicBuilding) {
      return {
        agent,
        locations: ctx.locations,
        orgs: ctx.orgs,
        complete: false,
      };
    }

    const travelingVehicle = startVehicleTravel(
      boardResult.vehicle,
      clinicBuilding,
      targetBuilding,
      'truck',
      ctx.transportConfig,
      ctx.phase
    );

    ActivityLog.info(
      ctx.phase,
      'corpse',
      `traveling to ${targetLocation.name} to collect corpses`,
      agent.id,
      agent.name
    );

    const updatedVehicles = (ctx.vehicles ?? []).map(v =>
      v.id === ambulance.id ? travelingVehicle : v
    );

    const newAgent = {
      ...boardResult.agent,
      corpseShiftState: {
        ...boardResult.agent.corpseShiftState!,
        currentPhase: 'traveling_to_corpse' as const,
        targetLocationId: targetLocation.id,
        vehicleId: ambulance.id,
      },
    };

    return {
      agent: setTask(newAgent, task),
      locations: ctx.locations,
      orgs: ctx.orgs,
      vehicles: updatedVehicles,
      complete: false,
    };
  }

  // TRAVELING_TO_CORPSE: Wait for arrival
  if (phase === 'traveling_to_corpse') {
    const ambulance = (ctx.vehicles ?? []).find(v => v.id === agent.corpseShiftState?.vehicleId);
    const targetLocation = ctx.locations.find(loc => loc.id === agent.corpseShiftState?.targetLocationId);

    if (!ambulance || !targetLocation) {
      // Lost vehicle or target - reset to scanning
      const resetAgent = {
        ...agent,
        corpseShiftState: {
          ...agent.corpseShiftState,
          currentPhase: 'scanning' as const,
          targetLocationId: undefined,
          vehicleId: undefined,
        },
      };
      return {
        agent: resetAgent,
        locations: ctx.locations,
        orgs: ctx.orgs,
        complete: false,
      };
    }

    // Check if arrived
    if (!ambulance.travelingToBuilding && ambulance.currentBuilding === targetLocation.building) {
      // Arrived - move to loading phase
      ActivityLog.info(
        ctx.phase,
        'corpse',
        `arrived at ${targetLocation.name}, loading corpses`,
        agent.id,
        agent.name
      );

      const loadingAgent = {
        ...agent,
        corpseShiftState: {
          ...agent.corpseShiftState,
          currentPhase: 'loading' as const,
        },
      };

      return {
        agent: setTask(loadingAgent, task),
        locations: ctx.locations,
        orgs: ctx.orgs,
        complete: false,
      };
    }

    // Still traveling
    return {
      agent,
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: false,
    };
  }

  // LOADING: Load corpses into ambulance
  if (phase === 'loading') {
    const ambulance = (ctx.vehicles ?? []).find(v => v.id === agent.corpseShiftState?.vehicleId);
    const targetLocation = ctx.locations.find(loc => loc.id === agent.corpseShiftState?.targetLocationId);

    if (!ambulance || !targetLocation) {
      // Lost vehicle or target - reset to scanning
      const resetAgent = {
        ...agent,
        corpseShiftState: {
          ...agent.corpseShiftState,
          currentPhase: 'scanning' as const,
          targetLocationId: undefined,
          vehicleId: undefined,
        },
      };
      return {
        agent: resetAgent,
        locations: ctx.locations,
        orgs: ctx.orgs,
        complete: false,
      };
    }

    // Load up to 5 corpses (ambulance capacity is 25, corpse size is 5.0)
    const corpsesAtLocation = targetLocation.inventory['corpse'] ?? 0;
    const corpseSize = ctx.economyConfig.goods['corpse']?.size ?? 5.0;
    const maxCorpses = Math.floor(ambulance.cargoCapacity / corpseSize);
    const corpsesToLoad = Math.min(corpsesAtLocation, maxCorpses);

    if (corpsesToLoad <= 0) {
      // No corpses to load - reset to scanning
      ActivityLog.warning(
        ctx.phase,
        'corpse',
        `no corpses at ${targetLocation.name} - returning to clinic`,
        agent.id,
        agent.name
      );

      const resetAgent = {
        ...agent,
        corpseShiftState: {
          ...agent.corpseShiftState,
          currentPhase: 'scanning' as const,
          targetLocationId: undefined,
          vehicleId: undefined,
        },
      };
      return {
        agent: resetAgent,
        locations: ctx.locations,
        orgs: ctx.orgs,
        complete: false,
      };
    }

    // Load corpses
    const loadResult = loadCargo(
      ambulance,
      targetLocation.inventory,
      'corpse',
      corpsesToLoad,
      corpseSize,
      ctx.phase
    );

    const updatedLocation = {
      ...targetLocation,
      inventory: loadResult.locationInventory,
    };

    ActivityLog.info(
      ctx.phase,
      'corpse',
      `loaded ${corpsesToLoad} corpse(s) from ${targetLocation.name}`,
      agent.id,
      agent.name
    );

    // Start return travel to clinic
    const clinicBuilding = ctx.buildings.find(b => b.id === clinic.building);
    const currentBuilding = ctx.buildings.find(b => b.id === loadResult.vehicle.currentBuilding);

    if (!clinicBuilding || !currentBuilding) {
      return {
        agent,
        locations: ctx.locations,
        orgs: ctx.orgs,
        complete: false,
      };
    }

    const returningVehicle = startVehicleTravel(
      loadResult.vehicle,
      currentBuilding,
      clinicBuilding,
      'truck',
      ctx.transportConfig,
      ctx.phase
    );

    const updatedVehicles = (ctx.vehicles ?? []).map(v =>
      v.id === ambulance.id ? returningVehicle : v
    );

    const updatedLocations = ctx.locations.map(loc =>
      loc.id === targetLocation.id ? updatedLocation : loc
    );

    const returningAgent = {
      ...agent,
      corpseShiftState: {
        ...agent.corpseShiftState,
        currentPhase: 'returning' as const,
      },
    };

    return {
      agent: setTask(returningAgent, task),
      locations: updatedLocations,
      orgs: ctx.orgs,
      vehicles: updatedVehicles,
      complete: false,
    };
  }

  // RETURNING: Travel back to clinic, unload
  if (phase === 'returning') {
    const ambulance = (ctx.vehicles ?? []).find(v => v.id === agent.corpseShiftState?.vehicleId);

    if (!ambulance) {
      // Lost vehicle - reset to scanning
      const resetAgent = {
        ...agent,
        corpseShiftState: {
          ...agent.corpseShiftState,
          currentPhase: 'scanning' as const,
          targetLocationId: undefined,
          vehicleId: undefined,
        },
      };
      return {
        agent: resetAgent,
        locations: ctx.locations,
        orgs: ctx.orgs,
        complete: false,
      };
    }

    // Check if arrived at clinic
    if (!ambulance.travelingToBuilding && ambulance.currentBuilding === clinic.building) {
      // Arrived - unload corpses
      const corpsesInVehicle = ambulance.cargo['corpse'] ?? 0;

      if (corpsesInVehicle > 0) {
        const corpseSize = ctx.economyConfig.goods['corpse']?.size ?? 5.0;
        const unloadResult = unloadCargo(
          ambulance,
          clinic.inventory,
          clinic.inventoryCapacity,
          'corpse',
          corpsesInVehicle,
          corpseSize,
          ctx.phase
        );

        const updatedClinic = {
          ...clinic,
          inventory: unloadResult.locationInventory,
        };

        ActivityLog.info(
          ctx.phase,
          'corpse',
          `delivered ${corpsesInVehicle} corpse(s) to clinic`,
          agent.id,
          agent.name
        );

        const updatedVehicles = (ctx.vehicles ?? []).map(v =>
          v.id === ambulance.id ? unloadResult.vehicle : v
        );

        const updatedLocations = ctx.locations.map(loc =>
          loc.id === clinic.id ? updatedClinic : loc
        );

        // Reset to scanning for next collection
        const scanningAgent = {
          ...agent,
          corpseShiftState: {
            ...agent.corpseShiftState,
            currentPhase: 'scanning' as const,
            targetLocationId: undefined,
            vehicleId: undefined,
          },
        };

        return {
          agent: setTask(scanningAgent, task),
          locations: updatedLocations,
          orgs: ctx.orgs,
          vehicles: updatedVehicles,
          complete: false,
        };
      } else {
        // No corpses to unload - reset to scanning
        const scanningAgent = {
          ...agent,
          corpseShiftState: {
            ...agent.corpseShiftState,
            currentPhase: 'scanning' as const,
            targetLocationId: undefined,
            vehicleId: undefined,
          },
        };

        return {
          agent: setTask(scanningAgent, task),
          locations: ctx.locations,
          orgs: ctx.orgs,
          complete: false,
        };
      }
    }

    // Still traveling back
    return {
      agent,
      locations: ctx.locations,
      orgs: ctx.orgs,
      complete: false,
    };
  }

  // Unknown phase - reset to scanning
  const resetAgent = {
    ...agent,
    corpseShiftState: {
      ...agent.corpseShiftState,
      currentPhase: 'scanning' as const,
      targetLocationId: undefined,
      vehicleId: undefined,
    },
  };

  return {
    agent: resetAgent,
    locations: ctx.locations,
    orgs: ctx.orgs,
    complete: false,
  };
}

// ============================================
// Register All Executors
// ============================================

export function registerAllExecutors(): void {
  registerExecutor('travel', executeTravelBehavior);
  registerExecutor('work', executeWorkBehavior);
  registerExecutor('rest', executeRestBehavior);
  registerExecutor('purchase', executePurchaseBehavior);
  registerExecutor('leisure', executeLeisureBehavior);
  registerExecutor('seek_job', executeSeekJobBehavior);
  registerExecutor('seek_housing', executeSeekHousingBehavior);
  registerExecutor('emergency_food', executeEmergencyFoodBehavior);
  registerExecutor('restock', executeRestockBehavior);
  registerExecutor('wander', executeWanderBehavior);
  registerExecutor('entrepreneur', executeEntrepreneurBehavior);
  registerExecutor('consume_luxury', executeConsumeLuxuryBehavior);
  registerExecutor('purchase_orphaned', executePurchaseOrphanedLocationBehavior);
  registerExecutor('deliver_goods', executeDeliverGoodsBehavior);
  registerExecutor('visit_pub', executeVisitPubBehavior);
  registerExecutor('consume_entertainment', executeConsumeEntertainmentBehavior);
  registerExecutor('relax_home', executeRelaxHomeBehavior);
  registerExecutor('collect_corpses', executeCorpseCollectionBehavior);
}

// Auto-register on import
registerAllExecutors();
