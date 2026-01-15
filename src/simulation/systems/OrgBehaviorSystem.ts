/**
 * OrgBehaviorSystem - Handles organization-level decisions
 *
 * Organizations make decisions independently of their human members:
 * - Procure resources (e.g., data_storage when needed for production)
 * - Expand operations (e.g., open offices when profitable)
 */

import type { Organization, Location, Building } from '../../types';
import type { EconomyConfig, LocationTemplate } from '../../config/ConfigLoader';
import { ActivityLog } from '../ActivityLog';
import { createLocation, findBuildingForLocation } from './LocationSystem';
import { addLocationToOrg } from './OrgSystem';
import { transferInventory, type GoodsSizes } from './InventorySystem';
import { trackB2BSale, trackBusinessOpened } from '../Metrics';

// Office name generator
const OFFICE_NAMES = [
  'Corporate Tower',
  'Data Center',
  'Tech Hub',
  'Innovation Center',
  'Business Complex',
  'Research Park',
  'Digital Campus',
  'Cyber Office',
  'Network HQ',
  'Systems Center',
];

const LAB_NAMES = [
  'Research Lab',
  'Innovation Lab',
  'Tech Laboratory',
  'R&D Center',
  'Science Division',
  'Data Lab',
  'Analysis Center',
  'Development Lab',
];

let officeNameIndex = 0;
let labNameIndex = 0;
let locationIdCounter = 10000; // Start high to avoid conflicts

function getNextOfficeName(): string {
  const name = OFFICE_NAMES[officeNameIndex % OFFICE_NAMES.length];
  officeNameIndex++;
  return name ?? 'Office';
}

function getNextLabName(): string {
  const name = LAB_NAMES[labNameIndex % LAB_NAMES.length];
  labNameIndex++;
  return name ?? 'Lab';
}

function getNextLocationId(): string {
  locationIdCounter++;
  return `loc-${locationIdCounter}`;
}

/**
 * Configuration for org behavior processing
 */
export interface OrgBehaviorConfig {
  expansionThreshold: number;      // Wallet credits needed to consider expansion (e.g., 1000)
  expansionChance: number;         // Probability per phase to attempt expansion (e.g., 0.05)
  minStorageForExpansion: number;  // Data storage needed before expanding to office (e.g., 1)
}

const DEFAULT_ORG_BEHAVIOR_CONFIG: OrgBehaviorConfig = {
  expansionThreshold: 1000,
  expansionChance: 0.05,
  minStorageForExpansion: 0,  // Office can open first, then buy storage
};

/**
 * Result of processing org behaviors
 */
export interface OrgBehaviorResult {
  orgs: Organization[];
  locations: Location[];
  newLocations: Location[];
}

/**
 * Process behaviors for all organizations
 * Called once per phase in the simulation tick
 */
export function processOrgBehaviors(
  orgs: Organization[],
  locations: Location[],
  buildings: Building[],
  locationTemplates: Record<string, LocationTemplate>,
  economyConfig: EconomyConfig,
  phase: number,
  config: OrgBehaviorConfig = DEFAULT_ORG_BEHAVIOR_CONFIG
): OrgBehaviorResult {
  let updatedOrgs = [...orgs];
  let updatedLocations = [...locations];
  const newLocations: Location[] = [];

  for (const org of updatedOrgs) {
    // Get this org's locations
    const orgLocations = updatedLocations.filter(loc => org.locations.includes(loc.id));

    // 1. Try to procure data_storage if needed
    const procureResult = tryProcureDataStorage(
      org,
      orgLocations,
      updatedLocations,
      updatedOrgs,
      economyConfig,
      phase
    );
    updatedLocations = procureResult.locations;
    updatedOrgs = procureResult.orgs;

    // 2. Try to expand to office if profitable and has storage
    const expandResult = tryExpandToOffice(
      updatedOrgs.find(o => o.id === org.id) ?? org,
      updatedLocations.filter(loc => org.locations.includes(loc.id)),
      buildings,
      updatedLocations,
      locationTemplates,
      phase,
      config
    );

    if (expandResult.newLocation) {
      newLocations.push(expandResult.newLocation);
      updatedLocations = [...updatedLocations, expandResult.newLocation];
      // Update the org in our list
      updatedOrgs = updatedOrgs.map(o =>
        o.id === org.id ? expandResult.org : o
      );
    }
  }

  return {
    orgs: updatedOrgs,
    locations: updatedLocations,
    newLocations,
  };
}

/**
 * Try to purchase data_storage from a server factory if org needs it
 * Triggered when org has office/lab that needs storage for valuable_data production
 */
function tryProcureDataStorage(
  org: Organization,
  orgLocations: Location[],
  allLocations: Location[],
  allOrgs: Organization[],
  economyConfig: EconomyConfig,
  phase: number
): { locations: Location[]; orgs: Organization[] } {
  // Check if org has any location that produces valuable_data
  const hasDataProduction = orgLocations.some(loc =>
    loc.tags.includes('office') || loc.tags.includes('laboratory')
  );

  if (!hasDataProduction) {
    return { locations: allLocations, orgs: allOrgs };
  }

  // Check storage capacity vs current valuable_data usage
  // Buy more when storage is filling up (>= 80% full)
  const totalStorageUnits = orgLocations.reduce(
    (sum, loc) => sum + (loc.inventory['data_storage'] ?? 0),
    0
  );
  const totalValuableData = orgLocations.reduce(
    (sum, loc) => sum + (loc.inventory['valuable_data'] ?? 0),
    0
  );

  // Get storage capacity per unit from config (default 10)
  const storageCapacityPerUnit = economyConfig.goods['data_storage']?.storageCapacity ?? 10;
  const totalStorageCapacity = totalStorageUnits * storageCapacityPerUnit;

  // Only procure if: no storage at all, or storage is >= 80% full
  const capacityUsedPercent = totalStorageCapacity > 0
    ? (totalValuableData / totalStorageCapacity) * 100
    : 100; // No storage = effectively 100% used

  if (totalStorageUnits > 0 && capacityUsedPercent < 80) {
    return { locations: allLocations, orgs: allOrgs };
  }

  // Org needs data_storage - try to buy from a server factory
  const wholesalePrice = economyConfig.goods['data_storage']?.wholesalePrice ?? 50;

  // Can org afford it?
  if (org.wallet.credits < wholesalePrice) {
    ActivityLog.info(
      phase,
      'procurement',
      `needs data_storage but cannot afford (${org.wallet.credits}/${wholesalePrice} credits)`,
      org.id,
      org.name
    );
    return { locations: allLocations, orgs: allOrgs };
  }

  // Find a server factory with stock (has 'tech' tag and produces data_storage)
  const serverFactories = allLocations.filter(
    loc =>
      loc.tags.includes('wholesale') &&
      loc.tags.includes('tech') &&
      (loc.inventory['data_storage'] ?? 0) > 0 &&
      !org.locations.includes(loc.id) // Can't buy from yourself
  );

  if (serverFactories.length === 0) {
    ActivityLog.warning(
      phase,
      'procurement',
      `needs data_storage but no server factories have stock`,
      org.id,
      org.name
    );
    return { locations: allLocations, orgs: allOrgs };
  }

  // Buy from first available factory
  const factory = serverFactories[0];
  if (!factory) {
    return { locations: allLocations, orgs: allOrgs };
  }
  const factoryOrg = allOrgs.find(o => o.locations.includes(factory.id));

  if (!factoryOrg) {
    return { locations: allLocations, orgs: allOrgs };
  }

  // Find a location in org to receive the storage (prefer office/lab)
  const receivingLoc = orgLocations.find(
    loc => loc.tags.includes('office') || loc.tags.includes('laboratory')
  ) ?? orgLocations[0];

  if (!receivingLoc) {
    return { locations: allLocations, orgs: allOrgs };
  }

  // Transfer 1 data_storage
  const goodsSizes: GoodsSizes = {
    goods: economyConfig.goods,
    defaultGoodsSize: economyConfig.defaultGoodsSize,
  };

  const transferResult = transferInventory(
    factory,
    receivingLoc,
    'data_storage',
    1,
    goodsSizes
  );

  if (transferResult.transferred === 0) {
    return { locations: allLocations, orgs: allOrgs };
  }

  // Update locations
  let updatedLocations = allLocations.map(loc => {
    if (loc.id === factory.id) return transferResult.from as Location;
    if (loc.id === receivingLoc.id) return transferResult.to as Location;
    return loc;
  });

  // Transfer money
  const updatedBuyerOrg: Organization = {
    ...org,
    wallet: { ...org.wallet, credits: org.wallet.credits - wholesalePrice },
  };

  const updatedSellerOrg: Organization = {
    ...factoryOrg,
    wallet: { ...factoryOrg.wallet, credits: factoryOrg.wallet.credits + wholesalePrice },
  };

  let updatedOrgs = allOrgs.map(o => {
    if (o.id === org.id) return updatedBuyerOrg;
    if (o.id === factoryOrg.id) return updatedSellerOrg;
    return o;
  });

  // Log with storage status context
  const newTotalStorage = totalStorageUnits + 1;
  const newCapacity = newTotalStorage * storageCapacityPerUnit;
  const usageAfterPurchase = Math.round((totalValuableData / newCapacity) * 100);
  ActivityLog.info(
    phase,
    'procurement',
    `purchased 1 data_storage from ${factory.name} for ${wholesalePrice} credits (now ${newTotalStorage} units, ${usageAfterPurchase}% used)`,
    org.id,
    org.name
  );

  // Track B2B sale in metrics
  trackB2BSale('data_storage');

  return { locations: updatedLocations, orgs: updatedOrgs };
}

/**
 * Try to expand org by opening an office or laboratory
 * Triggered when org is profitable. Office can open without storage,
 * but will need to buy data_storage before it can produce valuable_data.
 */
function tryExpandToOffice(
  org: Organization,
  orgLocations: Location[],
  buildings: Building[],
  allLocations: Location[],
  locationTemplates: Record<string, LocationTemplate>,
  phase: number,
  config: OrgBehaviorConfig
): { org: Organization; newLocation?: Location } {
  // Check if org already has an office or laboratory
  const hasOffice = orgLocations.some(
    loc => loc.tags.includes('office') || loc.tags.includes('laboratory')
  );

  if (hasOffice) {
    return { org };
  }

  // Check if org has revenue-generating locations (factory, retail, etc.)
  const hasRevenue = orgLocations.some(
    loc =>
      loc.tags.includes('wholesale') ||
      loc.tags.includes('retail') ||
      loc.tags.includes('residential')
  );

  if (!hasRevenue) {
    return { org };
  }

  // Check if org has enough credits for expansion
  if (org.wallet.credits < config.expansionThreshold) {
    return { org };
  }

  // Random chance to expand (don't spam expansions)
  if (Math.random() > config.expansionChance) {
    return { org };
  }

  // Check if org has data_storage (needed to produce valuable_data)
  const totalStorage = orgLocations.reduce(
    (sum, loc) => sum + (loc.inventory['data_storage'] ?? 0),
    0
  );

  if (totalStorage < config.minStorageForExpansion) {
    // Try to buy storage first (will be handled in next cycle)
    return { org };
  }

  // Choose office or laboratory (50/50)
  const templateName = Math.random() < 0.5 ? 'office' : 'laboratory';
  const template = locationTemplates[templateName];

  if (!template) {
    return { org };
  }

  const openingCost = template.balance?.openingCost ?? 600;

  // Double-check affordability with opening cost
  if (org.wallet.credits < openingCost + 200) {
    return { org };
  }

  // Find a building for the office
  const buildingPlacement = findBuildingForLocation(
    buildings,
    template.tags ?? [],
    allLocations
  );

  if (!buildingPlacement) {
    return { org };
  }

  // Create the location
  const locationId = getNextLocationId();
  const locationName = templateName === 'office' ? getNextOfficeName() : getNextLabName();

  const newLocation = createLocation(
    locationId,
    locationName,
    template,
    org.id,
    org.name,
    phase,
    buildingPlacement
  );

  // Link location to org
  const updatedOrg = addLocationToOrg(
    {
      ...org,
      wallet: { ...org.wallet, credits: org.wallet.credits - openingCost },
    },
    locationId
  );

  ActivityLog.info(
    phase,
    'expansion',
    `opened ${locationName} (${templateName}) for ${openingCost} credits - needs data_storage to begin R&D`,
    org.id,
    org.name
  );

  // Track business opening in metrics
  trackBusinessOpened(locationName);

  return { org: updatedOrg, newLocation };
}
