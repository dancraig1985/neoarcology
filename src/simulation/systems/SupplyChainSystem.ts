/**
 * SupplyChainSystem - B2B restocking and order management
 *
 * Handles:
 * - Instant restocking (legacy) - retail shops buy from wholesale
 * - Goods order placement - retail creates B2B purchase orders
 * - Goods order fulfillment - wholesale assigns pickup locations
 * - Goods order completion - financial settlement
 *
 * Extracted from EconomySystem for focused responsibility.
 */

import type { Agent, Location, Organization, Order } from '../../types/entities';
import type { EconomyConfig, ThresholdsConfig, LogisticsConfig } from '../../config/ConfigLoader';
import type { SimulationContext } from '../../types/SimulationContext';
import { getGoodsCount, getAvailableCapacity, transferInventory, type GoodsSizes } from './InventorySystem';
import { recordWholesaleSale } from '../Metrics';
import { ActivityLog } from '../ActivityLog';
import { createTransaction, recordTransaction } from '../../types/Transaction';


/**
 * Org tries to restock their shop by buying wholesale from another org
 * Uses real supply chain: wholesale location → retail shop (B2B transaction)
 * Called automatically each phase for all orgs (not an agent behavior)
 *
 * NOTE: This is the legacy instant restock system. Being replaced by order-based system.
 */
export function tryRestockFromWholesale(
  buyerOrg: Organization,
  shop: Location,
  locations: Location[],
  orgs: Organization[],
  economyConfig: EconomyConfig,
  thresholdsConfig: ThresholdsConfig,
  phase: number,
  context: SimulationContext
): { locations: Location[]; orgs: Organization[] } {
  const goodsSizes: GoodsSizes = { goods: economyConfig.goods, defaultGoodsSize: economyConfig.defaultGoodsSize };

  // Determine what good this shop sells based on its tags
  // Pubs (leisure tag) sell alcohol, luxury boutiques sell luxury_goods, others sell provisions
  const goodType = shop.tags.includes('leisure')
    ? 'alcohol'
    : shop.tags.includes('luxury')
      ? 'luxury_goods'
      : 'provisions';

  const currentStock = getGoodsCount(shop, goodType);
  const restockThreshold = thresholdsConfig.inventory.restockThreshold;
  const shopCapacity = getAvailableCapacity(shop, goodsSizes);
  const wholesalePrice = economyConfig.goods[goodType]?.wholesalePrice ?? 5;

  // Only restock if inventory is low
  if (currentStock >= restockThreshold) {
    return { locations, orgs };
  }

  // Find a wholesale location with the needed goods (has 'wholesale' tag)
  // Exclude our own locations (can't buy from yourself)
  const wholesaleLocations = locations.filter(
    (loc) => loc.tags.includes('wholesale') &&
             getGoodsCount(loc, goodType) > 0 &&
             !buyerOrg.locations.includes(loc.id)
  );

  if (wholesaleLocations.length === 0) {
    // No wholesale locations with stock - can't restock
    return { locations, orgs };
  }

  // Pick a random wholesale location
  const wholesaler = wholesaleLocations[Math.floor(context.rng() * wholesaleLocations.length)];
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
  const goodSize = economyConfig.goods[goodType]?.size ?? economyConfig.defaultGoodsSize;
  const maxItemsThatFit = Math.floor(shopCapacity / goodSize);
  const wholesalerStock = getGoodsCount(wholesaler, goodType);
  const desiredAmount = Math.min(thresholdsConfig.inventory.desiredRestockAmount, maxItemsThatFit);
  const affordableAmount = Math.floor(buyerOrg.wallet.credits / wholesalePrice);
  const amountToBuy = Math.min(desiredAmount, wholesalerStock, affordableAmount);

  if (amountToBuy <= 0) {
    return { locations, orgs };
  }

  const totalCost = amountToBuy * wholesalePrice;

  // Transfer inventory from wholesaler to shop (respects goods sizes)
  const { from: updatedWholesaler, to: updatedShop, transferred } = transferInventory(
    wholesaler,
    shop,
    goodType,
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

  ActivityLog.info(
    phase,
    'wholesale',
    `${buyerOrg.name} bought ${transferred} ${goodType} from ${wholesaler.name} for ${totalCost} credits`,
    buyerOrg.id,
    buyerOrg.name
  );

  // Record wholesale sale in metrics
  recordWholesaleSale(context.metrics, goodType);

  // Record transaction for metrics (PLAN-035)
  const transaction = createTransaction(
    phase,
    'sale',
    buyerOrg.id,
    sellerOrg.id,
    totalCost,
    wholesaler.id,
    { type: goodType, quantity: transferred }
  );
  recordTransaction(context.transactionHistory, transaction);

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
 * Place a goods order from retail shop to seller organization
 * Creates an Order entity with orderType='goods'
 * Note: pickupLocation is NOT set here - seller assigns it during fulfillment
 */
export function placeGoodsOrder(
  buyerOrg: Organization,
  shop: Location,
  goodType: string,
  quantity: number,
  sellerOrg: Organization,
  economyConfig: EconomyConfig,
  phase: number,
  context: SimulationContext
): Order {
  const wholesalePrice = economyConfig.goods[goodType]?.wholesalePrice ?? 5;
  const totalPrice = quantity * wholesalePrice;

  const order: Order = {
    id: context.idGen.nextGoodsOrderId(),
    orderType: 'goods',
    created: phase,
    buyer: buyerOrg.id,
    seller: sellerOrg.id,
    status: 'pending',

    // Goods order specific fields
    good: goodType,
    quantity,
    totalPrice,
    // pickupLocation: assigned by seller during fulfillment
    deliveryLocation: shop.id,
  };

  ActivityLog.info(
    phase,
    'order',
    `${buyerOrg.name} placed order for ${quantity} ${goodType} from ${sellerOrg.name} (${totalPrice} credits)`,
    buyerOrg.id,
    buyerOrg.name
  );

  return order;
}

/**
 * Try to place a goods order for a retail shop that needs restocking
 * Returns the new order if placed, or null if no order needed/possible
 */
export function tryPlaceGoodsOrder(
  buyerOrg: Organization,
  shop: Location,
  locations: Location[],
  orgs: Organization[],
  existingOrders: Order[],
  economyConfig: EconomyConfig,
  thresholdsConfig: ThresholdsConfig,
  phase: number,
  context: SimulationContext
): Order | null {
  const goodsSizes: GoodsSizes = { goods: economyConfig.goods, defaultGoodsSize: economyConfig.defaultGoodsSize };

  // Determine what good this shop sells
  const goodType = shop.tags.includes('leisure')
    ? 'alcohol'
    : shop.tags.includes('luxury')
      ? 'luxury_goods'
      : 'provisions';

  const currentStock = getGoodsCount(shop, goodType);
  const restockThreshold = thresholdsConfig.inventory.restockThreshold;

  // Only order if inventory is low
  if (currentStock >= restockThreshold) {
    return null;
  }

  // Check if there's already a pending order for this shop
  const hasPendingOrder = existingOrders.some(
    (order) =>
      order.orderType === 'goods' &&
      order.deliveryLocation === shop.id &&
      order.good === goodType &&
      (order.status === 'pending' || order.status === 'in_production' || order.status === 'ready' || order.status === 'in_transit')
  );

  if (hasPendingOrder) {
    return null; // Don't place duplicate orders
  }

  // Find orgs that have wholesale locations (factories/producers)
  // Don't filter by current stock - seller will find stock during fulfillment
  const wholesaleOrgs = orgs.filter((org) => {
    // Must own at least one wholesale location
    const hasWholesaleLocation = locations.some(
      (loc) => org.locations.includes(loc.id) && loc.tags.includes('wholesale')
    );
    // Don't order from yourself
    const isNotSelf = org.id !== buyerOrg.id;
    return hasWholesaleLocation && isNotSelf;
  });

  if (wholesaleOrgs.length === 0) {
    return null;
  }

  // Pick a random seller organization
  const sellerOrg = wholesaleOrgs[Math.floor(context.rng() * wholesaleOrgs.length)];
  if (!sellerOrg) {
    return null;
  }

  // Calculate order quantity (same logic as instant restock)
  const shopCapacity = getAvailableCapacity(shop, goodsSizes);
  const goodSize = economyConfig.goods[goodType]?.size ?? economyConfig.defaultGoodsSize;
  const maxItemsThatFit = Math.floor(shopCapacity / goodSize);
  const desiredAmount = Math.min(thresholdsConfig.inventory.desiredRestockAmount, maxItemsThatFit);
  const wholesalePrice = economyConfig.goods[goodType]?.wholesalePrice ?? 5;
  const affordableAmount = Math.floor(buyerOrg.wallet.credits / wholesalePrice);
  const orderQuantity = Math.min(desiredAmount, affordableAmount);

  if (orderQuantity <= 0) {
    return null;
  }

  // Place the order (seller will assign pickup location during fulfillment)
  return placeGoodsOrder(
    buyerOrg,
    shop,
    goodType,
    orderQuantity,
    sellerOrg,
    economyConfig,
    phase,
    context
  );
}

/**
 * Process goods orders - check if wholesaler has produced the goods
 * When ready, mark order as ready and create a logistics delivery order
 * Returns updated orders array and any new logistics orders created
 */
export function processGoodsOrders(
  orders: Order[],
  locations: Location[],
  orgs: Organization[],
  economyConfig: EconomyConfig,
  logisticsConfig: LogisticsConfig,
  phase: number
): { orders: Order[]; newLogisticsOrders: Order[] } {
  const updatedOrders: Order[] = [];
  const newLogisticsOrders: Order[] = [];

  for (const order of orders) {
    // Only process goods orders that are pending
    if (order.orderType !== 'goods' || order.status !== 'pending') {
      updatedOrders.push(order);
      continue;
    }

    // Seller-driven fulfillment: seller org decides where to ship from
    const goodType = order.good ?? 'provisions';
    const quantity = order.quantity ?? 0;

    // Find seller organization
    const sellerOrg = orgs.find(org => org.id === order.seller);
    if (!sellerOrg) {
      // Seller org no longer exists - cancel order
      updatedOrders.push({
        ...order,
        status: 'cancelled',
        fulfilled: phase,
      });
      continue;
    }

    // Check delivery location still exists
    const deliveryLoc = locations.find(loc => loc.id === order.deliveryLocation);
    if (!deliveryLoc) {
      // Delivery location doesn't exist - cancel order
      updatedOrders.push({
        ...order,
        status: 'cancelled',
        fulfilled: phase,
      });
      continue;
    }

    // Intelligent fulfillment: search seller's locations for stock
    // Priority 1: Warehouses (designed for storage)
    // Priority 2: Factories (production locations)
    const sellerLocations = locations.filter(loc => sellerOrg.locations.includes(loc.id));

    const warehouses = sellerLocations.filter(loc => loc.tags.includes('storage'));
    const factories = sellerLocations.filter(loc => loc.tags.includes('wholesale'));

    // Search in priority order
    const searchOrder = [...warehouses, ...factories];

    let pickupLoc: Location | undefined = undefined;
    for (const loc of searchOrder) {
      const stock = getGoodsCount(loc, goodType);
      if (stock >= quantity) {
        pickupLoc = loc;
        break; // Found a location with enough stock
      }
    }

    if (pickupLoc) {
      // Order is ready! Assign pickup location and create logistics order
      const updatedOrder: Order = {
        ...order,
        status: 'ready',
        pickupLocation: pickupLoc.id, // Seller assigns pickup location
      };

      // Create logistics order (delivery request) for this goods order
      const cargo: Record<string, number> = { [goodType]: quantity };

      // Calculate delivery payment
      const distance = Math.abs((pickupLoc.x ?? 0) - (deliveryLoc.x ?? 0)) +
                      Math.abs((pickupLoc.y ?? 0) - (deliveryLoc.y ?? 0));
      const totalGoods = quantity;
      const payment = totalGoods * logisticsConfig.delivery.perGoodRate + distance * logisticsConfig.delivery.perDistanceRate;
      const deliveryPayment = Math.max(logisticsConfig.delivery.basePayment, Math.floor(payment));

      const logisticsOrder: Order = {
        id: `logistics_for_${order.id}`,
        orderType: 'logistics',
        created: phase,
        buyer: order.buyer, // Retail shop's org pays for delivery
        seller: '', // Logistics company will be assigned
        status: 'pending',
        parentOrderId: order.id, // Link back to goods order
        fromLocation: pickupLoc.id,
        toLocation: deliveryLoc.id,
        cargo,
        payment: deliveryPayment,
        urgency: 'medium',
      };

      ActivityLog.info(
        phase,
        'order',
        `${sellerOrg.name} fulfilled order ${order.id} - shipping ${quantity} ${goodType} from ${pickupLoc.name}`,
        order.seller,
        sellerOrg.name
      );

      updatedOrders.push(updatedOrder);
      newLogisticsOrders.push(logisticsOrder);
    } else {
      // Not ready yet - seller doesn't have stock in any single location
      // Keep pending (Option 2: wait for consolidation)
      updatedOrders.push(order);
    }
  }

  return { orders: updatedOrders, newLogisticsOrders };
}

/**
 * Complete a goods order - transfer credits from buyer to seller
 * Called when the logistics delivery for a goods order completes
 */
export function completeGoodsOrder(
  logisticsOrder: Order,
  allOrders: Order[],
  orgs: Organization[],
  phase: number,
  context: SimulationContext
): { orders: Order[]; orgs: Organization[] } {
  // Find the parent goods order
  const goodsOrderId = logisticsOrder.parentOrderId;
  if (!goodsOrderId) {
    // This logistics order isn't linked to a goods order, nothing to do
    return { orders: allOrders, orgs };
  }

  const goodsOrder = allOrders.find(o => o.id === goodsOrderId);
  if (!goodsOrder || goodsOrder.orderType !== 'goods') {
    // Parent order not found or wrong type
    return { orders: allOrders, orgs };
  }

  // Find buyer and seller orgs
  const buyerOrg = orgs.find(o => o.id === goodsOrder.buyer);
  const sellerOrg = orgs.find(o => o.id === goodsOrder.seller);

  if (!buyerOrg || !sellerOrg) {
    // Orgs no longer exist - mark order as failed
    const updatedOrders = allOrders.map(o =>
      o.id === goodsOrder.id
        ? { ...o, status: 'failed' as const, fulfilled: phase }
        : o
    );
    return { orders: updatedOrders, orgs };
  }

  const totalPrice = goodsOrder.totalPrice ?? 0;

  // Check if buyer can afford (should be affordable since they placed the order, but verify)
  if (buyerOrg.wallet.credits < totalPrice) {
    // Can't afford - mark as failed
    ActivityLog.warning(
      phase,
      'order',
      `goods order ${goodsOrder.id} failed - buyer cannot afford (${buyerOrg.wallet.credits}/${totalPrice} credits)`,
      buyerOrg.id,
      buyerOrg.name
    );

    const updatedOrders = allOrders.map(o =>
      o.id === goodsOrder.id
        ? { ...o, status: 'failed' as const, fulfilled: phase }
        : o
    );
    return { orders: updatedOrders, orgs };
  }

  // Transfer credits from buyer to seller
  const updatedBuyerOrg: Organization = {
    ...buyerOrg,
    wallet: {
      ...buyerOrg.wallet,
      credits: buyerOrg.wallet.credits - totalPrice,
    },
  };

  const updatedSellerOrg: Organization = {
    ...sellerOrg,
    wallet: {
      ...sellerOrg.wallet,
      credits: sellerOrg.wallet.credits + totalPrice,
    },
  };

  // Mark goods order as delivered
  const updatedOrders = allOrders.map(o =>
    o.id === goodsOrder.id
      ? { ...o, status: 'delivered' as const, fulfilled: phase }
      : o
  );

  const updatedOrgs = orgs.map(o => {
    if (o.id === buyerOrg.id) return updatedBuyerOrg;
    if (o.id === sellerOrg.id) return updatedSellerOrg;
    return o;
  });

  ActivityLog.info(
    phase,
    'order',
    `goods order ${goodsOrder.id} completed - ${buyerOrg.name} paid ${totalPrice} credits to ${sellerOrg.name}`,
    buyerOrg.id,
    buyerOrg.name
  );

  // Record wholesale sale in metrics
  recordWholesaleSale(context.metrics, goodsOrder.good ?? 'provisions');

  return { orders: updatedOrders, orgs: updatedOrgs };
}

/**
 * Restock a location's inventory (owner buys provisions to sell)
 * For simplicity, provisions appear from thin air for now
 *
 * NOTE: This function appears to be unused (no call sites found)
 * Keeping for now but marked for potential removal
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
