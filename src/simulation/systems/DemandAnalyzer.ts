/**
 * DemandAnalyzer - Calculates market demand for goods and business opportunities
 *
 * This system analyzes agent needs and org requirements to determine demand for
 * goods across all economic verticals. Used by entrepreneurs to make informed
 * business decisions.
 */

import type { Agent, Location, Organization, DeliveryRequest } from '../../types';
import type { EconomyConfig, AgentsConfig, LocationTemplate, VerticalConfig } from '../../config/ConfigLoader';
import type { SimulationContext } from '../../types/SimulationContext';

/**
 * Demand signal for a single vertical/good type
 */
export interface DemandSignal {
  good: string;                          // Good type (e.g., 'provisions', 'alcohol')
  vertical: VerticalConfig | undefined;  // Vertical config from economy.json
  demandType: 'consumer' | 'business';   // Who wants this good
  score: number;                         // Calculated demand intensity (number of demanders)
  supplierCount: number;                 // Existing locations that produce/sell this good
  consumerCount: number;                 // Agents/orgs that want this good
  productionTemplate: string | null;     // Template for production location
  retailTemplate: string | null;         // Template for retail location
}

/**
 * Business opportunity recommendation
 */
export interface BusinessOpportunity {
  templateId: string;       // Location template to open
  demandScore: number;      // How much demand exists
  competitionScore: number; // How saturated the market is (lower = better)
  finalScore: number;       // Combined score for comparison
  reason: string;           // Human-readable explanation
}

/**
 * Calculate consumer demand for a good based on agent needs
 */
function calculateConsumerDemand(
  _good: string,
  vertical: VerticalConfig,
  agents: Agent[],
  _agentsConfig: AgentsConfig
): number {
  const livingAgents = agents.filter(a => a.status !== 'dead');

  // Get the needs field and threshold from vertical config
  const needsField = vertical.needsField;
  const needsThreshold = vertical.needsThreshold ?? 50;
  const minCredits = vertical.minCredits ?? 0;

  if (!needsField) {
    return 0;
  }

  // Count agents who have the need above threshold and can afford
  return livingAgents.filter(agent => {
    // Check if need is above threshold
    const needValue = agent.needs[needsField as keyof typeof agent.needs] ?? 0;
    if (needValue < needsThreshold) return false;

    // Check if agent can afford (if minCredits specified)
    if (minCredits > 0 && agent.wallet.credits < minCredits) return false;

    // For hunger specifically, also check if they have no provisions
    if (needsField === 'hunger') {
      const hasFood = (agent.inventory['provisions'] ?? 0) > 0;
      if (hasFood) return false;
    }

    return true;
  }).length;
}

/**
 * Calculate business (B2B) demand for a good
 */
function calculateBusinessDemand(
  _good: string,
  vertical: VerticalConfig,
  locations: Location[],
  orgs: Organization[]
): number {
  const condition = vertical.demandCondition;

  if (!condition) {
    return 0;
  }

  switch (condition) {
    case 'needsDataStorage':
      // Orgs that produce valuable_data but have no data_storage
      return orgs.filter(org => {
        const orgLocs = locations.filter(loc => org.locations.includes(loc.id));
        const producesData = orgLocs.some(loc =>
          loc.tags.includes('office') || loc.tags.includes('laboratory')
        );
        const hasStorage = orgLocs.some(loc =>
          (loc.inventory['data_storage'] ?? 0) > 0
        );
        return producesData && !hasStorage;
      }).length;

    case 'hasDataStorage':
      // Orgs that have data_storage and could benefit from offices
      return orgs.filter(org => {
        const orgLocs = locations.filter(loc => org.locations.includes(loc.id));
        const hasStorage = orgLocs.some(loc =>
          (loc.inventory['data_storage'] ?? 0) > 0
        );
        return hasStorage && org.wallet.credits > 1000;
      }).length;

    default:
      return 0;
  }
}

/**
 * Count suppliers (locations that produce or sell a good)
 */
function countSuppliers(
  good: string,
  vertical: VerticalConfig | undefined,
  locations: Location[]
): number {
  if (!vertical) {
    return 0;
  }

  // Count production locations
  const productionCount = locations.filter(loc =>
    loc.tags.includes('production') &&
    loc.tags.includes('wholesale') &&
    (loc.inventory[good] !== undefined ||
     loc.tags.some(t => t === vertical.productionTemplate?.replace('_factory', '').replace('_', '-')))
  ).length;

  // Count retail locations (if applicable)
  const retailCount = vertical.retailTemplate
    ? locations.filter(loc =>
        loc.tags.includes('retail') &&
        (loc.inventory[good] !== undefined ||
         loc.tags.includes(good.replace('_', '-')))
      ).length
    : 0;

  return productionCount + retailCount;
}

/**
 * Analyze demand for all configured verticals
 */
export function analyzeAllDemand(
  agents: Agent[],
  locations: Location[],
  orgs: Organization[],
  economyConfig: EconomyConfig,
  agentsConfig: AgentsConfig
): DemandSignal[] {
  const signals: DemandSignal[] = [];

  for (const [good, config] of Object.entries(economyConfig.goods)) {
    const vertical = config.vertical;

    if (!vertical) {
      continue; // Skip goods without vertical config
    }

    let score = 0;

    if (vertical.demandType === 'consumer') {
      score = calculateConsumerDemand(good, vertical, agents, agentsConfig);
    } else if (vertical.demandType === 'business') {
      score = calculateBusinessDemand(good, vertical, locations, orgs);
    }

    const supplierCount = countSuppliers(good, vertical, locations);

    signals.push({
      good,
      vertical,
      demandType: vertical.demandType,
      score,
      supplierCount,
      consumerCount: score,
      productionTemplate: vertical.productionTemplate,
      retailTemplate: vertical.retailTemplate,
    });
  }

  return signals;
}

/**
 * Calculate housing demand (special case - not a goods vertical)
 */
export function analyzeHousingDemand(
  agents: Agent[],
  locations: Location[],
  agentsConfig: AgentsConfig
): { demand: number; supply: number } {
  const bufferWeeks = agentsConfig.housing.bufferWeeks;
  const avgRent = 20;
  const housingBuffer = avgRent * bufferWeeks;

  // Agents who need housing and can afford it
  const demand = agents.filter(a =>
    a.status !== 'dead' &&
    !a.residence &&
    a.wallet.credits >= housingBuffer
  ).length;

  // Available apartment slots
  const apartments = locations.filter(loc =>
    loc.tags.includes('residential') &&
    !loc.tags.includes('public')
  );

  const supply = apartments.reduce((total, apt) => {
    const maxResidents = apt.maxResidents ?? 1;
    const currentResidents = apt.residents?.length ?? 0;
    return total + (maxResidents - currentResidents);
  }, 0);

  return { demand, supply };
}

/**
 * Analyze wholesale supply shortage
 * Returns goods where retail exists but wholesale is insufficient
 */
export function analyzeWholesaleShortage(
  locations: Location[],
  economyConfig: EconomyConfig
): DemandSignal[] {
  const shortages: DemandSignal[] = [];

  for (const [good, config] of Object.entries(economyConfig.goods)) {
    const vertical = config.vertical;

    if (!vertical || !vertical.retailTemplate) {
      continue; // Skip non-retail goods
    }

    // Count retail locations for this good
    const retailCount = locations.filter(loc =>
      loc.tags.includes('retail') &&
      (loc.inventory[good] !== undefined || loc.tags.includes(good.replace('_goods', '')))
    ).length;

    // Count wholesale/production locations for this good
    const wholesaleCount = locations.filter(loc =>
      loc.tags.includes('wholesale') &&
      loc.tags.includes('production') &&
      (loc.inventory[good] !== undefined || loc.tags.includes(good.replace('_goods', '')))
    ).length;

    // If retail exists but wholesale is scarce, there's opportunity
    if (retailCount > 0 && wholesaleCount < 2) {
      shortages.push({
        good,
        vertical,
        demandType: 'business',
        score: retailCount * 2, // High priority - supply chain broken
        supplierCount: wholesaleCount,
        consumerCount: retailCount,
        productionTemplate: vertical.productionTemplate,
        retailTemplate: vertical.retailTemplate,
      });
    }
  }

  return shortages;
}

/**
 * Analyze demand for logistics services based on delivery backlog
 */
function analyzeLogisticsDemand(
  deliveryRequests: DeliveryRequest[],
  locations: Location[],
  orgs: Organization[]
): number {
  // Count pending delivery requests (unmet demand)
  const pendingDeliveries = deliveryRequests.filter(req => req.status === 'pending').length;

  // Count existing logistics companies and their capacity
  const logisticsOrgs = orgs.filter(org => org.tags.includes('logistics'));
  const depots = locations.filter(loc => loc.tags.includes('depot'));

  // Each depot can support ~5 drivers (employee slots)
  const totalCapacity = depots.reduce((sum, depot) => sum + (depot.employeeSlots ?? 5), 0);
  const currentDrivers = depots.reduce((sum, depot) => sum + depot.employees.length, 0);
  const availableCapacity = totalCapacity - currentDrivers;

  // Demand score: pending deliveries that exceed available capacity
  // If we have 10 pending deliveries but only capacity for 5 more drivers, score is 5
  const demandScore = Math.max(0, pendingDeliveries - availableCapacity);

  return demandScore;
}

/**
 * Calculate market saturation for retail businesses
 * Returns a saturation multiplier based on shops-per-capita ratio
 */
function calculateRetailSaturation(
  agents: Agent[],
  locations: Location[]
): number {
  const livingAgents = agents.filter(a => a.status !== 'dead').length;
  const retailShops = locations.filter(loc => loc.tags.includes('retail')).length;

  if (livingAgents === 0) return 0;

  // Target: 1 shop per 15 agents (healthy market)
  const shopsPerAgent = retailShops / livingAgents;
  const targetRatio = 1 / 15; // 0.0667

  // Saturation: 0 = undersaturated, 1+ = oversaturated
  const saturation = shopsPerAgent / targetRatio;

  return saturation;
}

/**
 * Calculate market saturation for wholesale/production businesses
 * Returns a saturation multiplier based on factories per retail shop ratio
 */
function calculateWholesaleSaturation(
  locations: Location[]
): number {
  const retailShops = locations.filter(loc => loc.tags.includes('retail')).length;
  const productionFacilities = locations.filter(loc =>
    loc.tags.includes('production') && loc.tags.includes('wholesale')
  ).length;

  if (retailShops === 0) return 0;

  // Target: 1 factory per 3 retail shops (healthy supply chain)
  const factoriesPerShop = productionFacilities / retailShops;
  const targetRatio = 1 / 3; // 0.333

  // Saturation: 0 = undersaturated, 1+ = oversaturated
  const saturation = factoriesPerShop / targetRatio;

  return saturation;
}

/**
 * Get best business opportunities based on current market conditions
 * Returns sorted list of opportunities with scores
 * Can return empty array if market is oversaturated (no good opportunities)
 */
export function getBestBusinessOpportunities(
  agents: Agent[],
  locations: Location[],
  orgs: Organization[],
  economyConfig: EconomyConfig,
  agentsConfig: AgentsConfig,
  locationTemplates: Record<string, LocationTemplate>,
  deliveryRequests?: DeliveryRequest[]
): BusinessOpportunity[] {
  const opportunities: BusinessOpportunity[] = [];

  // Analyze all demand signals
  const demandSignals = analyzeAllDemand(agents, locations, orgs, economyConfig, agentsConfig);
  const wholesaleShortages = analyzeWholesaleShortage(locations, economyConfig);
  const housingDemand = analyzeHousingDemand(agents, locations, agentsConfig);

  // Calculate market saturation for retail and wholesale
  const retailSaturation = calculateRetailSaturation(agents, locations);
  const wholesaleSaturation = calculateWholesaleSaturation(locations);

  // Convert demand signals to business opportunities
  for (const signal of demandSignals) {
    if (signal.score < 3) {
      continue; // Minimum demand threshold
    }

    // Add retail opportunity if retail template exists
    if (signal.retailTemplate && locationTemplates[signal.retailTemplate]) {
      const competition = locations.filter(loc =>
        loc.tags.includes('retail') &&
        (loc.inventory[signal.good] !== undefined || loc.tags.includes(signal.good.replace('_goods', '')))
      ).length;

      // Calculate finalScore with proper competition penalty and saturation factor
      // Base: demandScore (how many want it)
      // Penalty 1: Existing competition (each competitor reduces score by 2)
      // Penalty 2: Market saturation (if oversaturated, further reduce score)
      const competitionPenalty = competition * 2;
      const saturationPenalty = retailSaturation > 1 ? (retailSaturation - 1) * 10 : 0;
      const finalScore = signal.score - competitionPenalty - saturationPenalty;

      // Only add if opportunity is positive (market not oversaturated)
      if (finalScore > 0) {
        opportunities.push({
          templateId: signal.retailTemplate,
          demandScore: signal.score,
          competitionScore: competition,
          finalScore,
          reason: `${signal.consumerCount} ${signal.demandType === 'consumer' ? 'agents' : 'orgs'} want ${signal.good}`,
        });
      }
    }
  }

  // Add wholesale opportunities from shortages
  for (const shortage of wholesaleShortages) {
    if (shortage.productionTemplate && locationTemplates[shortage.productionTemplate]) {
      // Calculate finalScore with saturation penalty
      // Base: demandScore (supply chain gap urgency)
      // Penalty: Wholesale market saturation (if oversaturated, reduce score)
      const saturationPenalty = wholesaleSaturation > 1 ? (wholesaleSaturation - 1) * 10 : 0;
      const finalScore = (shortage.score * 2) - saturationPenalty;

      // Only add if opportunity is positive (wholesale market not oversaturated)
      if (finalScore > 0) {
        opportunities.push({
          templateId: shortage.productionTemplate,
          demandScore: shortage.score,
          competitionScore: shortage.supplierCount,
          finalScore,
          reason: `Supply chain gap: ${shortage.consumerCount} retail locations need ${shortage.good}`,
        });
      }
    }
  }

  // Add housing opportunity if demand exists
  if (housingDemand.demand >= 3 && housingDemand.supply < housingDemand.demand && locationTemplates['apartment']) {
    opportunities.push({
      templateId: 'apartment',
      demandScore: housingDemand.demand,
      competitionScore: Math.floor(housingDemand.supply / 10),
      finalScore: housingDemand.demand - housingDemand.supply,
      reason: `${housingDemand.demand} homeless agents with funds, only ${housingDemand.supply} available units`,
    });
  }

  // Add logistics opportunity if delivery backlog exists
  if (deliveryRequests && locationTemplates['depot']) {
    const logisticsDemand = analyzeLogisticsDemand(deliveryRequests, locations, orgs);
    if (logisticsDemand >= 3) {
      const existingDepots = locations.filter(loc => loc.tags.includes('depot')).length;
      const finalScore = logisticsDemand - (existingDepots * 2);

      // Only add if opportunity is positive
      if (finalScore > 0) {
        opportunities.push({
          templateId: 'depot',
          demandScore: logisticsDemand,
          competitionScore: existingDepots,
          finalScore,
          reason: `${logisticsDemand} unmet delivery requests, ${existingDepots} existing logistics companies`,
        });
      }
    }
  }

  // REMOVED: No longer include guaranteed retail_shop fallback
  // Market analysis can now return "no opportunity" if market is oversaturated

  // Sort by final score descending
  // Note: Can return empty array if no viable opportunities exist
  return opportunities.sort((a, b) => b.finalScore - a.finalScore);
}

/**
 * Select a business opportunity using weighted random selection
 * Higher-scored opportunities are more likely to be chosen
 */
export function selectBusinessOpportunity(
  opportunities: BusinessOpportunity[],
  context: SimulationContext
): BusinessOpportunity | null {
  if (opportunities.length === 0) {
    return null;
  }

  // Ensure all scores are positive for weighting
  const adjustedOpportunities = opportunities.map(opp => ({
    ...opp,
    weight: Math.max(opp.finalScore, 1),
  }));

  const totalWeight = adjustedOpportunities.reduce((sum, opp) => sum + opp.weight, 0);
  let roll = context.rng() * totalWeight;

  for (const opp of adjustedOpportunities) {
    roll -= opp.weight;
    if (roll <= 0) {
      return opp;
    }
  }

  // Fallback to first opportunity
  return opportunities[0] ?? null;
}
