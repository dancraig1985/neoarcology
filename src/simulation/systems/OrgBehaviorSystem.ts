/**
 * OrgBehaviorSystem - Handles organization-level decisions
 *
 * Organizations make decisions independently of their human members:
 * - Procure resources (e.g., data_storage when needed for production)
 * - Expand operations (e.g., open offices when profitable)
 */

import type { Organization, Location, Building, DeliveryRequest } from '../../types';
import type { EconomyConfig, ThresholdsConfig, BusinessConfig, LogisticsConfig, LocationTemplate } from '../../config/ConfigLoader';
import type { SimulationContext } from '../../types/SimulationContext';
import { ActivityLog } from '../ActivityLog';
import { createLocation, findBuildingForLocation } from './LocationSystem';
import { addLocationToOrg } from './OrgSystem';
import { transferInventory, type GoodsSizes } from './InventorySystem';
import { recordB2BSale, recordBusinessOpened } from '../Metrics';

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

// Name generators (now use context.idGen for deterministic IDs)
function getNextOfficeName(context: SimulationContext): string {
  return context.idGen.nextOfficeName();
}

function getNextLabName(context: SimulationContext): string {
  return context.idGen.nextLaboratoryName();
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
  deliveryRequests: DeliveryRequest[];
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
  thresholdsConfig: ThresholdsConfig,
  businessConfig: BusinessConfig,
  logisticsConfig: LogisticsConfig,
  phase: number,
  context: SimulationContext,
  config: OrgBehaviorConfig = DEFAULT_ORG_BEHAVIOR_CONFIG
): OrgBehaviorResult {
  let updatedOrgs = [...orgs];
  let updatedLocations = [...locations];
  const newLocations: Location[] = [];
  const deliveryRequests: DeliveryRequest[] = [];

  for (const org of updatedOrgs) {
    // Get this org's locations
    const orgLocations = updatedLocations.filter(loc => org.locations.includes(loc.id));

    // 0. Try to transfer input goods internally within org
    const transferResult = tryTransferInputGoods(
      org,
      orgLocations,
      updatedLocations,
      locationTemplates,
      economyConfig,
      phase
    );
    updatedLocations = transferResult.locations;

    // 0.5. Try to transfer surplus goods from factories to warehouses (instant internal transfer)
    const warehouseTransferResult = tryTransferToWarehouse(
      org,
      updatedLocations.filter(loc => org.locations.includes(loc.id)),
      updatedLocations,
      locationTemplates,
      economyConfig,
      thresholdsConfig,
      phase
    );
    updatedLocations = warehouseTransferResult.locations;
    // No delivery requests created - internal transfers are instant

    // 1. Try to sell valuable_data for revenue (temporary B2B market)
    const dataRevenueResult = trySelllValuableData(
      org,
      orgLocations,
      updatedLocations,
      updatedOrgs,
      logisticsConfig,
      phase,
      context
    );
    updatedLocations = dataRevenueResult.locations;
    updatedOrgs = dataRevenueResult.orgs;

    // 2. Try to expand to warehouse if needed (corporations only)
    if (org.tags.includes('corporation')) {
      const warehouseExpandResult = tryExpandToWarehouse(
        updatedOrgs.find(o => o.id === org.id) ?? org,
        updatedLocations.filter(loc => org.locations.includes(loc.id)),
        buildings,
        updatedLocations,
        locationTemplates,
        thresholdsConfig,
        businessConfig,
        phase,
        context,
        config
      );

      if (warehouseExpandResult.newLocation) {
        newLocations.push(warehouseExpandResult.newLocation);
        // Replace if exists (orphaned purchase), otherwise add (new warehouse)
        const locationExists = updatedLocations.some(loc => loc.id === warehouseExpandResult.newLocation!.id);
        if (locationExists) {
          updatedLocations = updatedLocations.map(loc =>
            loc.id === warehouseExpandResult.newLocation!.id ? warehouseExpandResult.newLocation! : loc
          );
        } else {
          updatedLocations = [...updatedLocations, warehouseExpandResult.newLocation];
        }
        // Update the org in our list
        updatedOrgs = updatedOrgs.map(o =>
          o.id === org.id ? warehouseExpandResult.org : o
        );
      }
    }

    // 3. Try to procure data_storage if needed
    const procureResult = tryProcureDataStorage(
      updatedOrgs.find(o => o.id === org.id) ?? org,
      updatedLocations.filter(loc => org.locations.includes(loc.id)),
      updatedLocations,
      updatedOrgs,
      economyConfig,
      logisticsConfig,
      phase,
      context
    );
    updatedLocations = procureResult.locations;
    updatedOrgs = procureResult.orgs;

    // 4. Try to expand to office if profitable and has storage (corporations only)
    if (org.tags.includes('corporation')) {
      const expandResult = tryExpandToOffice(
        updatedOrgs.find(o => o.id === org.id) ?? org,
        updatedLocations.filter(loc => org.locations.includes(loc.id)),
        buildings,
        updatedLocations,
        locationTemplates,
        businessConfig,
        phase,
        context,
        config
      );

      if (expandResult.newLocation) {
        newLocations.push(expandResult.newLocation);
        // Replace if exists (orphaned purchase), otherwise add (new office)
        const locationExists = updatedLocations.some(loc => loc.id === expandResult.newLocation!.id);
        if (locationExists) {
          updatedLocations = updatedLocations.map(loc =>
            loc.id === expandResult.newLocation!.id ? expandResult.newLocation! : loc
          );
        } else {
          updatedLocations = [...updatedLocations, expandResult.newLocation];
        }
        // Update the org in our list
        updatedOrgs = updatedOrgs.map(o =>
          o.id === org.id ? expandResult.org : o
        );
      }

      // 5. Try to expand to prototype factory if very wealthy and has valuable_data production
      const prototypeExpandResult = tryExpandToPrototypeFactory(
        updatedOrgs.find(o => o.id === org.id) ?? org,
        updatedLocations.filter(loc => org.locations.includes(loc.id)),
        buildings,
        updatedLocations,
        locationTemplates,
        phase,
        context,
        config
      );

      if (prototypeExpandResult.newLocation) {
        newLocations.push(prototypeExpandResult.newLocation);
        // Replace if exists (orphaned purchase), otherwise add (new prototype lab)
        const locationExists = updatedLocations.some(loc => loc.id === prototypeExpandResult.newLocation!.id);
        if (locationExists) {
          updatedLocations = updatedLocations.map(loc =>
            loc.id === prototypeExpandResult.newLocation!.id ? prototypeExpandResult.newLocation! : loc
          );
        } else {
          updatedLocations = [...updatedLocations, prototypeExpandResult.newLocation];
        }
        // Update the org in our list
        updatedOrgs = updatedOrgs.map(o =>
          o.id === org.id ? prototypeExpandResult.org : o
        );
      }
    }
  }

  return {
    orgs: updatedOrgs,
    locations: updatedLocations,
    newLocations,
    deliveryRequests,
  };
}

/**
 * Try to transfer input goods internally within the org
 * If a location needs input goods for production, transfer from other org-owned locations
 */
function tryTransferInputGoods(
  org: Organization,
  orgLocations: Location[],
  allLocations: Location[],
  locationTemplates: Record<string, LocationTemplate>,
  economyConfig: EconomyConfig,
  phase: number
): { locations: Location[] } {
  let updatedLocations = [...allLocations];

  // Find locations that have production configs with inputGoods
  for (const location of orgLocations) {
    const template = locationTemplates[location.template];
    if (!template?.balance?.production) continue;

    for (const productionConfig of template.balance.production) {
      if (!productionConfig.inputGoods) continue;

      // This location needs input goods - check each one
      for (const [inputGood, requiredAmount] of Object.entries(productionConfig.inputGoods)) {
        const currentAmount = location.inventory[inputGood] ?? 0;

        // If we already have enough, skip
        if (currentAmount >= requiredAmount) continue;

        const needed = requiredAmount - currentAmount;

        // Find other org-owned locations that have this good
        const sourceLocations = orgLocations.filter(loc =>
          loc.id !== location.id && (loc.inventory[inputGood] ?? 0) > 0
        );

        if (sourceLocations.length === 0) {
          ActivityLog.info(
            phase,
            'transfer',
            `needs ${needed} ${inputGood} for ${productionConfig.good} production, but no org locations have stock`,
            org.id,
            org.name
          );
          continue;
        }

        // Transfer from the location with the most stock
        const sourceLocation = sourceLocations.reduce((best, loc) =>
          (loc.inventory[inputGood] ?? 0) > (best.inventory[inputGood] ?? 0) ? loc : best
        );

        const availableAmount = sourceLocation.inventory[inputGood] ?? 0;
        const transferAmount = Math.min(needed, availableAmount);

        // Perform internal transfer (no credits exchanged)
        const goodsSizes: GoodsSizes = {
          goods: economyConfig.goods,
          defaultGoodsSize: economyConfig.defaultGoodsSize,
        };

        const transferResult = transferInventory(
          sourceLocation,
          location,
          inputGood,
          transferAmount,
          goodsSizes
        );

        // Update locations in our list
        updatedLocations = updatedLocations.map(loc => {
          if (loc.id === sourceLocation.id) return transferResult.from;
          if (loc.id === location.id) return transferResult.to;
          return loc;
        });

        ActivityLog.info(
          phase,
          'transfer',
          `transferred ${transferAmount} ${inputGood} from ${sourceLocation.name} to ${location.name} for ${productionConfig.good} production`,
          org.id,
          org.name
        );
      }
    }
  }

  return { locations: updatedLocations };
}

/**
 * Try to transfer surplus goods from factories to warehouses
 * Triggered when factory inventory exceeds 80% capacity
 * Uses instant internal transfer (company's own logistics, not external delivery service)
 */
function tryTransferToWarehouse(
  org: Organization,
  orgLocations: Location[],
  allLocations: Location[],
  locationTemplates: Record<string, LocationTemplate>,
  economyConfig: EconomyConfig,
  thresholdsConfig: ThresholdsConfig,
  phase: number
): { locations: Location[] } {
  // Construct goodsSizes for inventory transfers
  const goodsSizes: GoodsSizes = { goods: economyConfig.goods, defaultGoodsSize: economyConfig.defaultGoodsSize };

  // Find org-owned warehouses (storage facilities)
  const warehouses = orgLocations.filter(loc => loc.tags.includes('storage'));

  // Skip if org has no warehouses
  if (warehouses.length === 0) {
    return { locations: allLocations };
  }

  // Find production facilities (factories) with high inventory
  const productionFacilities = orgLocations.filter(loc => {
    const template = locationTemplates[loc.template];
    if (!template?.balance?.production) return false;

    // Check if factory inventory is >80% capacity
    const capacity = template.balance.inventoryCapacity ?? 100;
    const currentInventory = Object.values(loc.inventory).reduce((sum, amount) => sum + amount, 0);
    const capacityUsedPercent = (currentInventory / capacity) * 100;

    return capacityUsedPercent > thresholdsConfig.inventory.warehouseTransferThreshold;
  });

  // No transfers needed
  if (productionFacilities.length === 0) {
    return { locations: allLocations };
  }

  // For each factory with high inventory, create delivery request to warehouse
  for (const factory of productionFacilities) {
    const template = locationTemplates[factory.template];
    const capacity = template?.balance?.inventoryCapacity ?? 100;

    // Find warehouse with most available space
    const warehouse = warehouses.reduce((best, wh) => {
      const whTemplate = locationTemplates[wh.template];
      const whCapacity = whTemplate?.balance?.inventoryCapacity ?? 1000;
      const whUsed = Object.values(wh.inventory).reduce((sum, amount) => sum + amount, 0);
      const whAvailable = whCapacity - whUsed;

      const bestTemplate = locationTemplates[best.template];
      const bestCapacity = bestTemplate?.balance?.inventoryCapacity ?? 1000;
      const bestUsed = Object.values(best.inventory).reduce((sum, amount) => sum + amount, 0);
      const bestAvailable = bestCapacity - bestUsed;

      return whAvailable > bestAvailable ? wh : best;
    });

    // Check if warehouse has space
    const whTemplate = locationTemplates[warehouse.template];
    const whCapacity = whTemplate?.balance?.inventoryCapacity ?? 1000;
    const whUsed = Object.values(warehouse.inventory).reduce((sum, amount) => sum + amount, 0);
    const whAvailable = whCapacity - whUsed;

    if (whAvailable === 0) {
      ActivityLog.warning(
        phase,
        'transfer',
        `factory ${factory.name} needs to transfer surplus but warehouse ${warehouse.name} is full`,
        org.id,
        org.name
      );
      continue;
    }

    // Instant internal transfer: factory → warehouse (company's own logistics)
    // Identify goods to transfer (tangible goods only, preserve valuable_data for internal use)
    const tangibleGoods = ['provisions', 'alcohol', 'luxury_goods', 'high_tech_prototypes', 'data_storage'];

    let updatedFactory = factory;
    let updatedWarehouse = warehouse;
    let totalTransferred = 0;
    const transferredGoods: Record<string, number> = {};

    for (const good of tangibleGoods) {
      const amount = factory.inventory[good] ?? 0;
      if (amount > 0) {
        // Transfer up to 50% of factory stock (leave some buffer for immediate sales)
        const transferAmount = Math.floor(amount * 0.5);
        if (transferAmount > 0) {
          const result = transferInventory(
            updatedFactory,
            updatedWarehouse,
            good,
            transferAmount,
            goodsSizes
          );

          if (result.transferred > 0) {
            updatedFactory = result.from;
            updatedWarehouse = result.to;
            totalTransferred += result.transferred;
            transferredGoods[good] = result.transferred;
          }
        }
      }
    }

    if (totalTransferred === 0) {
      continue; // Nothing transferred (warehouse might be full)
    }

    // Log the instant transfer
    const goodsList = Object.entries(transferredGoods)
      .map(([good, amt]) => `${amt} ${good}`)
      .join(', ');

    ActivityLog.info(
      phase,
      'transfer',
      `internal transfer: ${goodsList} from ${factory.name} to ${warehouse.name}`,
      org.id,
      org.name
    );

    // Update locations in the main array
    allLocations = allLocations.map(loc => {
      if (loc.id === factory.id) return updatedFactory;
      if (loc.id === warehouse.id) return updatedWarehouse;
      return loc;
    });
  }

  return { locations: allLocations };
}

/**
 * Try to sell valuable_data for revenue (temporary B2B market simulation)
 * Triggered weekly when org has valuable_data in inventory
 * Limits sales to 5 units/week to ensure surplus for prototype production
 */
function trySelllValuableData(
  org: Organization,
  orgLocations: Location[],
  allLocations: Location[],
  allOrgs: Organization[],
  logisticsConfig: LogisticsConfig,
  phase: number,
  context: SimulationContext
): { locations: Location[]; orgs: Organization[] } {
  // Only process weekly (phase 56, 112, 168, etc.)
  if (phase % 56 !== 0 || phase === 0) {
    return { locations: allLocations, orgs: allOrgs };
  }

  // Check if org has any valuable_data across all locations
  const totalValuableData = orgLocations.reduce(
    (sum, loc) => sum + (loc.inventory['valuable_data'] ?? 0),
    0
  );

  // Reserve valuable_data for prototype production (don't sell strategic reserves)
  const reserveAmount = logisticsConfig.procurement.valuableDataReserveAmount;
  const availableForSale = Math.max(0, totalValuableData - reserveAmount);

  if (availableForSale === 0) {
    return { locations: allLocations, orgs: allOrgs };
  }

  // Sell valuable_data to B2B market (models selling research/consulting services)
  const unitsToSell = Math.min(logisticsConfig.procurement.valuableDataMaxSaleUnits, availableForSale);
  const pricePerUnit = logisticsConfig.procurement.valuableDataSalePrice;
  const totalRevenue = unitsToSell * pricePerUnit;

  // Find location(s) with valuable_data and deduct from inventory
  let remainingToSell = unitsToSell;
  let updatedLocations = [...allLocations];

  for (const location of orgLocations) {
    if (remainingToSell === 0) break;

    const availableData = location.inventory['valuable_data'] ?? 0;
    if (availableData === 0) continue;

    const soldFromThisLocation = Math.min(remainingToSell, availableData);

    // Remove sold data from this location
    const updatedLocation = {
      ...location,
      inventory: {
        ...location.inventory,
        valuable_data: availableData - soldFromThisLocation
      }
    };

    updatedLocations = updatedLocations.map(loc =>
      loc.id === location.id ? updatedLocation : loc
    );

    remainingToSell -= soldFromThisLocation;
  }

  // Add revenue to org wallet
  const updatedOrg: Organization = {
    ...org,
    wallet: { ...org.wallet, credits: org.wallet.credits + totalRevenue },
  };

  const updatedOrgs = allOrgs.map(o =>
    o.id === org.id ? updatedOrg : o
  );

  ActivityLog.info(
    phase,
    'revenue',
    `sold ${unitsToSell} valuable_data for ${totalRevenue} credits (data services revenue)`,
    org.id,
    org.name
  );

  // Record B2B sale in metrics
  for (let i = 0; i < unitsToSell; i++) {
    recordB2BSale(context.metrics, 'valuable_data');
  }

  return { locations: updatedLocations, orgs: updatedOrgs };
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
  logisticsConfig: LogisticsConfig,
  phase: number,
  context: SimulationContext
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

  if (totalStorageUnits > 0 && capacityUsedPercent < logisticsConfig.procurement.storageCapacityTrigger) {
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

  // Record B2B sale in metrics
  recordB2BSale(context.metrics, 'data_storage');

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
  businessConfig: BusinessConfig,
  phase: number,
  context: SimulationContext,
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
  if (org.wallet.credits < businessConfig.expansion.minCreditsRequired) {
    return { org };
  }

  // Random chance to expand (don't spam expansions)
  if (context.rng() > businessConfig.expansion.expansionChancePerPhase) {
    return { org };
  }

  // Check if org has data_storage (needed to produce valuable_data)
  const totalStorage = orgLocations.reduce(
    (sum, loc) => sum + (loc.inventory['data_storage'] ?? 0),
    0
  );

  if (totalStorage < businessConfig.expansion.minStorageForExpansion) {
    // Try to buy storage first (will be handled in next cycle)
    return { org };
  }

  // Choose office or laboratory (50/50)
  const templateName = context.rng() < 0.5 ? 'office' : 'laboratory';
  const template = locationTemplates[templateName];

  if (!template) {
    return { org };
  }

  const openingCost = template.balance?.openingCost ?? 600;

  // Double-check affordability with opening cost
  if (org.wallet.credits < openingCost + businessConfig.expansion.warehouseCostBuffer) {
    return { org };
  }

  // Find a building for the office
  const buildingPlacement = findBuildingForLocation(
    buildings,
    template.tags ?? [],
    allLocations,
    context
  );

  if (!buildingPlacement) {
    return { org };
  }

  // Create the location
  const locationId = context.idGen.nextLocationId();
  const locationName = templateName === 'office' ? getNextOfficeName(context) : getNextLabName(context);

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

  // Record business opening in metrics
  recordBusinessOpened(context.metrics, locationName);

  return { org: updatedOrg, newLocation };
}

/**
 * Try to expand org by opening a warehouse (storage expansion)
 * Triggered when org has production facilities hitting capacity and needs bulk storage
 */
function tryExpandToWarehouse(
  org: Organization,
  orgLocations: Location[],
  buildings: Building[],
  allLocations: Location[],
  locationTemplates: Record<string, LocationTemplate>,
  thresholdsConfig: ThresholdsConfig,
  businessConfig: BusinessConfig,
  phase: number,
  context: SimulationContext,
  config: OrgBehaviorConfig
): { org: Organization; newLocation?: Location } {
  // Check if org has warehouse capacity available
  const warehouses = orgLocations.filter(loc => loc.tags.includes('storage'));

  if (warehouses.length > 0) {
    // Have warehouses - check if they have available capacity
    const averageCapacityUsed = warehouses.reduce((sum, wh) => {
      const template = locationTemplates[wh.template];
      const capacity = template?.balance?.inventoryCapacity ?? 1000;
      const inventory = Object.values(wh.inventory).reduce((total, amt) => total + amt, 0);
      return sum + (inventory / capacity);
    }, 0) / warehouses.length;

    // If average warehouse capacity is below threshold, we have enough warehouse space
    if (averageCapacityUsed < (businessConfig.expansion.warehouseAverageCapacityThreshold / 100)) {
      return { org }; // Existing warehouses have space
    }
  }

  // Check if org has any production facilities (factories, breweries, etc.)
  const productionFacilities = orgLocations.filter(loc => {
    const template = locationTemplates[loc.template];
    // Must have production config AND wholesale tag (not just offices/labs)
    return template?.balance?.production &&
           template.balance.production.length > 0 &&
           (loc.tags.includes('wholesale') || loc.tags.includes('production'));
  });

  if (productionFacilities.length === 0) {
    return { org }; // No production facilities, no need for warehouse
  }

  // Check if any factory is at high capacity (>80%)
  const hasCapacityIssue = productionFacilities.some(loc => {
    const template = locationTemplates[loc.template];
    const capacity = template?.balance?.inventoryCapacity ?? 100;
    const currentInventory = Object.values(loc.inventory).reduce((sum, amount) => sum + amount, 0);
    const capacityUsedPercent = (currentInventory / capacity) * 100;
    return capacityUsedPercent > thresholdsConfig.inventory.warehouseTransferThreshold;
  });

  if (!hasCapacityIssue) {
    return { org }; // Factories aren't full, no urgent need for warehouse
  }

  // Get warehouse template
  const template = locationTemplates['warehouse'];

  if (!template) {
    return { org };
  }

  const openingCost = template.balance?.openingCost ?? 800;

  // Check if org can afford it (opening cost + buffer)
  if (org.wallet.credits < openingCost + 300) {
    return { org };
  }

  // Random chance to expand (5% per phase when eligible)
  // Higher than office expansion since this is a practical need, not speculative R&D
  if (context.rng() > 0.05) {
    return { org };
  }

  // FIRST: Check resale market for orphaned warehouses (60% discount)
  const resaleDiscount = 0.6; // Standard resale discount
  const orphanedWarehouses = allLocations.filter(
    loc => loc.forSale === true && loc.tags.includes('storage')
  );

  if (orphanedWarehouses.length > 0) {
    const resalePrice = Math.floor(openingCost * resaleDiscount); // 480 credits for 800 opening cost

    if (org.wallet.credits >= resalePrice + 300) {
      // Can afford to purchase orphaned warehouse
      const targetWarehouse = orphanedWarehouses[0]; // Pick first available

      // Purchase the orphaned warehouse
      const updatedOrg = addLocationToOrg(
        {
          ...org,
          wallet: { ...org.wallet, credits: org.wallet.credits - resalePrice },
        },
        targetWarehouse.id
      );

      // Update warehouse: new owner, no longer for sale
      const updatedWarehouse: Location = {
        ...targetWarehouse,
        owner: org.id,
        ownerType: 'org',
        forSale: false,
        previousOwners: [
          ...(targetWarehouse.previousOwners ?? []),
          // Previous "orphaned" period already recorded
        ],
      };

      ActivityLog.info(
        phase,
        'purchase',
        `purchased orphaned ${targetWarehouse.name} for ${resalePrice} credits (60% discount) - provides bulk storage for factory overflow`,
        org.id,
        org.name
      );

      recordBusinessOpened(context.metrics,`${org.name}'s ${targetWarehouse.name}`);

      return { org: updatedOrg, newLocation: updatedWarehouse };
    }
  }

  // No affordable orphaned warehouses - open a new one
  // Find a building for the warehouse
  const buildingPlacement = findBuildingForLocation(
    buildings,
    template.tags ?? [],
    allLocations,
    context
  );

  if (!buildingPlacement) {
    return { org };
  }

  // Create the location
  const locationId = context.idGen.nextLocationId();
  const locationName = 'Storage Warehouse';

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
    `opened ${locationName} for ${openingCost} credits - provides bulk storage for factory overflow`,
    org.id,
    org.name
  );

  // Track business opening in metrics
  recordBusinessOpened(context.metrics,locationName);

  return { org: updatedOrg, newLocation };
}

/**
 * Try to expand org by opening a prototype factory (second-stage expansion)
 * Triggered when org is very wealthy, already has office/lab producing valuable_data
 */
function tryExpandToPrototypeFactory(
  org: Organization,
  orgLocations: Location[],
  buildings: Building[],
  allLocations: Location[],
  locationTemplates: Record<string, LocationTemplate>,
  phase: number,
  context: SimulationContext,
  config: OrgBehaviorConfig
): { org: Organization; newLocation?: Location } {
  // Check if org already has a prototype factory
  const hasPrototypeFactory = orgLocations.some(
    loc => loc.template === 'prototype_factory'
  );

  if (hasPrototypeFactory) {
    return { org };
  }

  // Check if org has office or laboratory (produces valuable_data)
  const hasOffice = orgLocations.some(
    loc => loc.tags.includes('office') || loc.tags.includes('laboratory')
  );

  if (!hasOffice) {
    return { org };
  }

  // Check if org has valuable_data in inventory (proves production is working)
  const totalValuableData = orgLocations.reduce(
    (sum, loc) => sum + (loc.inventory['valuable_data'] ?? 0),
    0
  );

  if (totalValuableData < 100) {
    // Need at least 1 production cycle's worth of input
    return { org };
  }

  // Get prototype factory template
  const template = locationTemplates['prototype_factory'];

  if (!template) {
    return { org };
  }

  const openingCost = template.balance?.openingCost ?? 1500;

  // Check if org is wealthy enough (opening cost + small buffer)
  if (org.wallet.credits < openingCost + 500) {
    return { org };
  }

  // Very low random chance to expand (rare, expensive end-game content)
  // 0.01 = 1% chance per phase when eligible
  if (context.rng() > 0.01) {
    return { org };
  }

  // Find a building for the prototype factory
  const buildingPlacement = findBuildingForLocation(
    buildings,
    template.tags ?? [],
    allLocations,
    context
  );

  if (!buildingPlacement) {
    return { org };
  }

  // Create the location
  const locationId = context.idGen.nextLocationId();
  const locationName = 'Prototyping Facility';

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
    `opened ${locationName} for ${openingCost} credits - will consume valuable_data to produce high-tech prototypes`,
    org.id,
    org.name
  );

  // Track business opening in metrics
  recordBusinessOpened(context.metrics,locationName);

  return { org: updatedOrg, newLocation };
}
