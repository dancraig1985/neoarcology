/**
 * BusinessOpportunityService - Entrepreneurship and business creation
 *
 * Handles business opportunity analysis and business creation logic.
 * Extracted from EconomySystem to break circular dependencies and improve maintainability.
 *
 * This module is called by:
 * - AgentEconomicSystem (when agents decide to open businesses)
 * - Behavior executors (entrepreneurship behavior)
 */

import type { Agent, Location, Organization, Building, Vehicle, DeliveryRequest } from '../../types/entities';
import type { AgentsConfig, LocationTemplate, BusinessConfig, LogisticsConfig, EconomyConfig, ThresholdsConfig } from '../../config/ConfigLoader';
import type { SimulationContext } from '../../types/SimulationContext';
import { findBuildingForLocation } from './LocationSystem';
import { createOrganization, addLocationToOrg } from './OrgSystem';
import { createLocation } from './LocationSystem';
import { createVehicle } from './VehicleSystem';
import { getBestBusinessOpportunities, selectBusinessOpportunity } from './DemandAnalyzer';
import { ActivityLog } from '../ActivityLog';

// Name pools for businesses
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

const PUB_NAMES = [
  "The Rusty Circuit",
  "Neon Tap",
  "Binary Bar",
  "Voltage Lounge",
  "The Grid",
  "Chrome & Hops",
  "Synth Spirits",
  "The Dive",
  "Circuit Breaker",
  "The Glitch",
];

const BOUTIQUE_NAMES = [
  "Luxe Noir",
  "Velvet Circuit",
  "Gilded Edge",
  "Chrome & Diamond",
  "Stellar Goods",
  "Neo Opulence",
  "High Wire",
  "Platinum Cache",
  "Crystal Grid",
  "Prestige Lane",
];

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

// Name generators (now use context.idGen for deterministic IDs)
function getNextShopName(context: SimulationContext): string {
  return context.idGen.nextShopName();
}

function getNextPubName(context: SimulationContext): string {
  return context.idGen.nextPubName();
}

function getNextBoutiqueName(context: SimulationContext): string {
  return context.idGen.nextBoutiqueName();
}

function getNextApartmentName(context: SimulationContext): string {
  return context.idGen.nextApartmentName();
}

/**
 * Check if an agent leads any organization
 */
function leadsAnyOrg(agent: Agent, orgs: Organization[]): boolean {
  return orgs.some((org) => org.leader === agent.id);
}

/**
 * Calculate demand signals for entrepreneurship decisions
 * Returns the best business type to open based on market needs
 * Uses DemandAnalyzer for data-driven, scalable demand calculation
 */
function chooseBestBusiness(
  agents: Agent[],
  locations: Location[],
  locationTemplates: Record<string, LocationTemplate>,
  agentsConfig: AgentsConfig,
  economyConfig: EconomyConfig,
  orgs: Organization[],
  deliveryRequests: DeliveryRequest[],
  phase: number,
  context: SimulationContext
): string {
  // Use DemandAnalyzer for scalable, config-driven demand calculation
  const opportunities = getBestBusinessOpportunities(
    agents,
    locations,
    orgs,
    economyConfig,
    agentsConfig,
    locationTemplates,
    deliveryRequests
  );

  // Select using weighted random (higher demand = higher chance)
  const selected = selectBusinessOpportunity(opportunities, context);

  if (selected) {
    ActivityLog.info(
      phase,
      'entrepreneurship',
      `market analysis: ${selected.reason} (score: ${selected.finalScore.toFixed(1)})`,
      'system',
      'DemandAnalyzer'
    );
    return selected.templateId;
  }

  // Fallback to retail shop if no opportunities found
  return 'retail_shop';
}

/**
 * Try to open a new business (creates a micro-org to own it)
 */
export function tryOpenBusiness(
  agent: Agent,
  locationTemplates: Record<string, LocationTemplate>,
  buildings: Building[],
  locations: Location[],
  agents: Agent[],
  orgs: Organization[],
  agentsConfig: AgentsConfig,
  economyConfig: EconomyConfig,
  thresholdsConfig: ThresholdsConfig,
  businessConfig: BusinessConfig,
  logisticsConfig: LogisticsConfig,
  deliveryRequests: DeliveryRequest[],
  vehicles: Vehicle[], // Used for signature compatibility, not needed internally
  phase: number,
  context: SimulationContext
): { agent: Agent; newLocation?: Location; newOrg?: Organization; newVehicles?: Vehicle[] } {
  void vehicles; // Suppress unused variable warning
  void thresholdsConfig; // Not currently used but keeping for consistency

  // Chance to try opening a business each phase when eligible
  if (context.rng() > businessConfig.entrepreneurship.openingChancePerPhase) {
    return { agent };
  }

  // Choose business type based on market demand (uses DemandAnalyzer)
  const businessType = chooseBestBusiness(agents, locations, locationTemplates, agentsConfig, economyConfig, orgs, deliveryRequests, phase, context);
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
    locations,
    context
  );

  // If no building found, agent can't open shop (no outdoor retail)
  if (!buildingPlacement) {
    return { agent };
  }

  // Create a micro-org for this business
  const orgId = context.idGen.nextOrgId();
  const templateTags = template.tags ?? [];
  const isProduction = templateTags.includes('production') || templateTags.includes('wholesale');
  const isResidential = templateTags.includes('residential');
  const isLeisure = templateTags.includes('leisure');
  const isLuxury = templateTags.includes('luxury');
  const isLogistics = templateTags.includes('depot') || businessType === 'depot';

  // Generate org name based on business type
  const lastName = agent.name.split(' ')[1] ?? agent.name;
  let orgName: string;
  if (isLogistics) {
    orgName = `${lastName} Logistics`;
  } else if (isProduction) {
    orgName = `${lastName} Industries`;
  } else if (isResidential) {
    orgName = `${agent.name}'s Rental`;
  } else if (isLeisure) {
    orgName = `${agent.name}'s Bar`;
  } else if (isLuxury) {
    orgName = `${agent.name}'s Boutique`;
  } else {
    orgName = `${agent.name}'s Shop`;
  }

  // Org gets 70% of credits REMAINING after opening cost (not 70% of total)
  // Minimum capital must cover: owner dividend + some buffer for restocking
  // Factories/production need more capital for operations
  const minBusinessCapital = isProduction ? businessConfig.entrepreneurship.minCapital.production : businessConfig.entrepreneurship.minCapital.retail;
  const creditsAfterOpeningCost = agent.wallet.credits - openingCost;
  const calculatedCapital = Math.floor(creditsAfterOpeningCost * businessConfig.entrepreneurship.capitalAllocationPercent);
  const businessCapital = Math.max(calculatedCapital, minBusinessCapital);

  // Agent must have enough for opening cost + minimum capital
  if (agent.wallet.credits < openingCost + minBusinessCapital) {
    return { agent };
  }

  let newOrg = createOrganization(
    orgId,
    orgName,
    agent.id,
    agent.name,
    businessCapital,
    phase,
    context
  );

  // Create the location owned by the org (placed in building)
  const locationId = context.idGen.nextLocationId();
  // Generate location name based on business type
  let locationName: string;
  if (isProduction) {
    locationName = `${lastName} Factory`;
  } else if (isResidential) {
    locationName = getNextApartmentName(context);
  } else if (isLeisure) {
    locationName = getNextPubName(context);
  } else if (isLuxury) {
    locationName = getNextBoutiqueName(context);
  } else {
    locationName = getNextShopName(context);
  }

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

  // Tag logistics orgs for easy identification
  if (isLogistics) {
    newOrg = {
      ...newOrg,
      tags: [...(newOrg.tags ?? []), 'logistics'],
    };
  }

  // Spawn free trucks for new logistics companies
  const newVehicles: Vehicle[] = [];
  if (isLogistics && buildingPlacement) {
    const building = buildings.find(b => b.id === buildingPlacement.building.id);
    if (building) {
      const numTrucks = logisticsConfig.trucking.minTrucks + Math.floor(context.rng() * (logisticsConfig.trucking.maxTrucks - logisticsConfig.trucking.minTrucks + 1));
      for (let i = 0; i < numTrucks; i++) {
        const vehicleId = context.idGen.nextVehicleId();
        const truckName = `${lastName} Truck ${i + 1}`;
        const truck = createVehicle(
          vehicleId,
          truckName,
          'truck',
          newOrg,
          building,
          100, // Cargo capacity
          phase
        );
        newVehicles.push(truck);
      }

      ActivityLog.info(
        phase,
        'business',
        `${orgName} received ${numTrucks} free trucks`,
        orgId,
        orgName
      );
    }
  }

  // Deduct opening cost + business capital from agent
  const totalCost = openingCost + businessCapital;
  const updatedAgent: Agent = {
    ...agent,
    status: 'employed', // Now running their own business
    employer: orgId,
    employedAt: locationId, // Owner works at their business location
    wallet: {
      ...agent.wallet,
      credits: agent.wallet.credits - totalCost,
    },
  };

  return { agent: updatedAgent, newLocation, newOrg, newVehicles: newVehicles.length > 0 ? newVehicles : undefined };
}
