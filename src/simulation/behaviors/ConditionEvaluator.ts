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
