/**
 * ConditionEvaluator - Evaluates behavior conditions against agent state
 *
 * Maps JSON condition definitions to actual agent state checks.
 */

import type { Agent, Location, Organization, AgentNeeds } from '../../types/entities';
import type { BehaviorConditions } from '../../config/ConfigLoader';
import { isTraveling } from '../systems/TravelSystem';

/**
 * Get a need value by name (type-safe accessor)
 */
function getNeedValue(agent: Agent, need: string): number {
  const key = need as keyof AgentNeeds;
  if (key in agent.needs) {
    return agent.needs[key];
  }
  return 0;
}

/**
 * Context needed for condition evaluation
 */
export interface EvaluationContext {
  locations: Location[];
  orgs: Organization[];
  currentPhase: number; // Needed for phase-based conditions
}

/**
 * Evaluate all conditions in a BehaviorConditions object
 * All conditions must be true (AND logic) unless using 'or' array
 */
export function evaluateConditions(
  agent: Agent,
  conditions: BehaviorConditions,
  ctx: EvaluationContext
): boolean {
  // Handle 'never' - always returns false (for tasks that never complete naturally)
  if (conditions.never) {
    return false;
  }

  // Handle 'or' - any one of the conditions must be true
  if (conditions.or && conditions.or.length > 0) {
    return conditions.or.some(orCondition =>
      evaluateConditions(agent, orCondition, ctx)
    );
  }

  // Check all conditions (AND logic)

  // needsAbove: { hunger: 25 } → agent.needs.hunger > 25
  if (conditions.needsAbove) {
    for (const [need, threshold] of Object.entries(conditions.needsAbove)) {
      const value = getNeedValue(agent, need);
      if (value <= threshold) return false;
    }
  }

  // needsBelow: { hunger: 80 } → agent.needs.hunger < 80
  if (conditions.needsBelow) {
    for (const [need, threshold] of Object.entries(conditions.needsBelow)) {
      const value = getNeedValue(agent, need);
      if (value >= threshold) return false;
    }
  }

  // inventoryAbove: { provisions: 0 } → agent.inventory.provisions > 0
  if (conditions.inventoryAbove) {
    for (const [item, threshold] of Object.entries(conditions.inventoryAbove)) {
      const value = agent.inventory[item] ?? 0;
      if (value <= threshold) return false;
    }
  }

  // inventoryBelow: { provisions: 1 } → agent.inventory.provisions < 1
  if (conditions.inventoryBelow) {
    for (const [item, threshold] of Object.entries(conditions.inventoryBelow)) {
      const value = agent.inventory[item] ?? 0;
      if (value >= threshold) return false;
    }
  }

  // hasCredits: true → agent.wallet.credits > 0
  if (conditions.hasCredits !== undefined) {
    const hasAny = agent.wallet.credits > 0;
    if (conditions.hasCredits !== hasAny) return false;
  }

  // hasCreditsAbove: 80 → agent.wallet.credits > 80
  if (conditions.hasCreditsAbove !== undefined) {
    if (agent.wallet.credits <= conditions.hasCreditsAbove) return false;
  }

  // hasEmployment: true → agent.employedAt !== undefined
  if (conditions.hasEmployment !== undefined) {
    const employed = agent.employedAt !== undefined;
    if (conditions.hasEmployment !== employed) return false;
  }

  // unemployed: true → agent.employedAt === undefined
  if (conditions.unemployed !== undefined) {
    const isUnemployed = agent.employedAt === undefined;
    if (conditions.unemployed !== isUnemployed) return false;
  }

  // atWorkplace: true → agent.currentLocation === agent.employedAt
  if (conditions.atWorkplace !== undefined) {
    const atWork = agent.currentLocation !== undefined &&
                   agent.currentLocation === agent.employedAt;
    if (conditions.atWorkplace !== atWork) return false;
  }

  // notAtWorkplace: true → agent.currentLocation !== agent.employedAt (or no workplace)
  if (conditions.notAtWorkplace !== undefined) {
    const atWork = agent.currentLocation !== undefined &&
                   agent.currentLocation === agent.employedAt;
    if (conditions.notAtWorkplace === atWork) return false;
  }

  // notTraveling: true → !isTraveling(agent)
  if (conditions.notTraveling !== undefined) {
    const traveling = isTraveling(agent);
    if (conditions.notTraveling === traveling) return false;
  }

  // homeless: true → agent.residence === undefined
  if (conditions.homeless !== undefined) {
    const isHomeless = agent.residence === undefined;
    if (conditions.homeless !== isHomeless) return false;
  }

  // hasResidence: true → agent.residence !== undefined
  if (conditions.hasResidence !== undefined) {
    const hasHome = agent.residence !== undefined;
    if (conditions.hasResidence !== hasHome) return false;
  }

  // atPublicSpace: true → current location has 'public' tag
  if (conditions.atPublicSpace !== undefined) {
    const currentLoc = ctx.locations.find(l => l.id === agent.currentLocation);
    const atPublic = currentLoc?.tags.includes('public') ?? false;
    if (conditions.atPublicSpace !== atPublic) return false;
  }

  // notAtPublicSpace: true → current location doesn't have 'public' tag
  if (conditions.notAtPublicSpace !== undefined) {
    const currentLoc = ctx.locations.find(l => l.id === agent.currentLocation);
    const atPublic = currentLoc?.tags.includes('public') ?? false;
    if (conditions.notAtPublicSpace === atPublic) return false;
  }

  // isShopOwner: true → agent leads an org that owns retail locations
  if (conditions.isShopOwner !== undefined) {
    const ledOrg = ctx.orgs.find(org => org.leader === agent.id);
    const ownsRetail = ledOrg !== undefined &&
      ctx.locations.some(loc =>
        ledOrg.locations.includes(loc.id) && loc.tags.includes('retail')
      );
    if (conditions.isShopOwner !== ownsRetail) return false;
  }

  // shopNeedsStock: true → agent's shop is below 50% inventory capacity
  if (conditions.shopNeedsStock !== undefined) {
    const ledOrg = ctx.orgs.find(org => org.leader === agent.id);
    const needsStock = ledOrg !== undefined &&
      ctx.locations.some(loc => {
        if (!ledOrg.locations.includes(loc.id)) return false;
        if (!loc.tags.includes('retail')) return false;
        const currentStock = loc.inventory['provisions'] ?? 0;
        return currentStock < loc.inventoryCapacity * 0.5;
      });
    if (conditions.shopNeedsStock !== needsStock) return false;
  }

  // shopHasStock: true → agent's shop is above 50% inventory capacity
  if (conditions.shopHasStock !== undefined) {
    const ledOrg = ctx.orgs.find(org => org.leader === agent.id);
    const hasStock = ledOrg !== undefined &&
      ctx.locations.every(loc => {
        if (!ledOrg.locations.includes(loc.id)) return true;
        if (!loc.tags.includes('retail')) return true;
        const currentStock = loc.inventory['provisions'] ?? 0;
        return currentStock >= loc.inventoryCapacity * 0.5;
      });
    if (conditions.shopHasStock !== hasStock) return false;
  }

  // atLocation: "employedAt" → agent.currentLocation === agent.employedAt
  if (conditions.atLocation !== undefined) {
    let targetLocationId: string | undefined;

    if (conditions.atLocation === 'employedAt') {
      targetLocationId = agent.employedAt;
    } else if (conditions.atLocation === 'residence') {
      targetLocationId = agent.residence;
    }

    const atTarget = agent.currentLocation !== undefined &&
                     agent.currentLocation === targetLocationId;
    if (!atTarget) return false;
  }

  // atLocationWithTag: "depot" → current location has 'depot' tag
  if (conditions.atLocationWithTag !== undefined) {
    const currentLoc = ctx.locations.find(l => l.id === agent.currentLocation);
    const hasTag = currentLoc?.tags.includes(conditions.atLocationWithTag) ?? false;
    if (!hasTag) return false;
  }

  // notAtLocationWithTag: "depot" → current location does NOT have 'depot' tag
  if (conditions.notAtLocationWithTag !== undefined) {
    const currentLoc = ctx.locations.find(l => l.id === agent.currentLocation);
    const hasTag = currentLoc?.tags.includes(conditions.notAtLocationWithTag) ?? false;
    if (hasTag) return false; // Fail if location HAS the tag
  }

  // phasesSinceWorkShift: 8 → (currentPhase - agent.shiftState?.lastShiftEndPhase) >= 8
  if (conditions.phasesSinceWorkShift !== undefined) {
    const lastShiftEnd = agent.shiftState?.lastShiftEndPhase ?? 0;
    const phasesSinceShift = ctx.currentPhase - lastShiftEnd;

    // Special case: never worked before (allow immediate start)
    if (lastShiftEnd === 0) {
      // No previous shift - condition passes
    } else if (phasesSinceShift < conditions.phasesSinceWorkShift) {
      return false; // Still in cooldown period
    }
  }

  // phasesWorkedThisShift: 16 → agent.shiftState.phasesWorked >= 16
  if (conditions.phasesWorkedThisShift !== undefined) {
    const phasesWorked = agent.shiftState?.phasesWorked ?? 0;
    if (phasesWorked < conditions.phasesWorkedThisShift) {
      return false; // Haven't worked long enough yet
    }
  }

  // phasesSinceDeliveryShift: 8 → (currentPhase - agent.deliveryShiftState?.lastShiftEndPhase) >= 8
  if (conditions.phasesSinceDeliveryShift !== undefined) {
    const lastShiftEnd = agent.deliveryShiftState?.lastShiftEndPhase ?? 0;
    const phasesSinceShift = ctx.currentPhase - lastShiftEnd;

    // Special case: never delivered before (allow immediate start)
    if (lastShiftEnd === 0) {
      // No previous shift - condition passes
    } else if (phasesSinceShift < conditions.phasesSinceDeliveryShift) {
      return false; // Still in cooldown period
    }
  }

  // phasesDeliveredThisShift: 16 → agent.deliveryShiftState.phasesDelivered >= 16
  if (conditions.phasesDeliveredThisShift !== undefined) {
    const phasesDelivered = agent.deliveryShiftState?.phasesDelivered ?? 0;
    if (phasesDelivered < conditions.phasesDeliveredThisShift) {
      return false; // Haven't delivered long enough yet
    }
  }

  // phasesSinceCorpseShift: 8 → (currentPhase - agent.corpseShiftState?.lastShiftEndPhase) >= 8 (PLAN-039)
  if (conditions.phasesSinceCorpseShift !== undefined) {
    const lastShiftEnd = agent.corpseShiftState?.lastShiftEndPhase ?? 0;
    const phasesSinceShift = ctx.currentPhase - lastShiftEnd;

    // Special case: never collected before (allow immediate start)
    if (lastShiftEnd === 0) {
      // No previous shift - condition passes
    } else if (phasesSinceShift < conditions.phasesSinceCorpseShift) {
      return false; // Still in cooldown period
    }
  }

  // marketHasGoods: "provisions" → at least one retail location has this good in stock
  if (conditions.marketHasGoods !== undefined) {
    const goodType = conditions.marketHasGoods;
    const hasMarketSupply = ctx.locations.some(loc =>
      loc.tags.includes('retail') && (loc.inventory[goodType] ?? 0) > 0
    );
    if (!hasMarketSupply) return false; // Skip behavior if no market supply
  }

  // atResidence: true → agent.currentLocation === agent.residence
  if (conditions.atResidence !== undefined) {
    const atHome = agent.currentLocation !== undefined &&
                   agent.currentLocation === agent.residence;
    if (conditions.atResidence !== atHome) return false;
  }

  // notAtResidence: true → agent.currentLocation !== agent.residence (or no residence)
  if (conditions.notAtResidence !== undefined) {
    const atHome = agent.currentLocation !== undefined &&
                   agent.currentLocation === agent.residence;
    if (conditions.notAtResidence === atHome) return false;
  }

  // phasesAtPub: 4 → agent.pubVisitState.phasesAtPub >= 4
  if (conditions.phasesAtPub !== undefined) {
    const phasesAtPub = agent.pubVisitState?.phasesAtPub ?? 0;
    if (phasesAtPub < conditions.phasesAtPub) {
      return false; // Haven't been at pub long enough yet
    }
  }

  // All conditions passed
  return true;
}

/**
 * Check if a task is complete based on completion conditions
 */
export function isTaskComplete(
  agent: Agent,
  conditions: BehaviorConditions,
  ctx: EvaluationContext
): boolean {
  return evaluateConditions(agent, conditions, ctx);
}

/**
 * Find the first applicable behavior from a list
 */
export function findApplicableBehavior<T extends { conditions: BehaviorConditions }>(
  agent: Agent,
  behaviors: T[],
  ctx: EvaluationContext
): T | undefined {
  return behaviors.find(behavior =>
    evaluateConditions(agent, behavior.conditions, ctx)
  );
}
