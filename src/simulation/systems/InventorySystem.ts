/**
 * InventorySystem - Modular inventory management for any entity holding goods
 *
 * Works with Agents, Locations, Vehicles - anything implementing InventoryHolder
 * Supports variable goods sizes (e.g., provisions=0.1, heavy_weapons=2)
 */

import type { GoodsConfig } from '../../config/ConfigLoader';

/**
 * Goods sizes lookup - maps goods type to size
 * If not specified, defaults to defaultSize (typically 1)
 */
export type GoodsSizes = {
  goods: Record<string, GoodsConfig>;
  defaultGoodsSize: number;
};

/**
 * Interface for anything that can hold tangible goods
 */
export interface InventoryHolder {
  inventory: Record<string, number>;
  inventoryCapacity: number;
}

/**
 * Get the size of a single unit of a goods type
 */
export function getGoodsSize(goodsType: string, sizes?: GoodsSizes): number {
  if (!sizes) return 1;
  return sizes.goods[goodsType]?.size ?? sizes.defaultGoodsSize;
}

/**
 * Get total space used by all goods in inventory (accounts for goods sizes)
 */
export function getInventorySpaceUsed(holder: InventoryHolder, sizes?: GoodsSizes): number {
  let total = 0;
  for (const [goodsType, count] of Object.entries(holder.inventory)) {
    const size = getGoodsSize(goodsType, sizes);
    total += count * size;
  }
  return total;
}

/**
 * Get total count of all goods in inventory (ignores sizes, counts items)
 */
export function getInventoryTotal(holder: InventoryHolder): number {
  return Object.values(holder.inventory).reduce((sum, count) => sum + count, 0);
}

/**
 * Get remaining capacity (space-based when sizes provided)
 */
export function getAvailableCapacity(holder: InventoryHolder, sizes?: GoodsSizes): number {
  return holder.inventoryCapacity - getInventorySpaceUsed(holder, sizes);
}

/**
 * Check if holder can accept this amount of goods (space-based)
 */
export function canAddToInventory(
  holder: InventoryHolder,
  goodsType: string,
  amount: number,
  sizes?: GoodsSizes
): boolean {
  const itemSize = getGoodsSize(goodsType, sizes);
  const spaceNeeded = amount * itemSize;
  return getAvailableCapacity(holder, sizes) >= spaceNeeded;
}

/**
 * Add goods to inventory (returns new holder, doesn't mutate)
 * Returns { holder, added } - added may be less than requested if capacity limited
 * When sizes provided, calculates how many items fit based on available space
 */
export function addToInventory<T extends InventoryHolder>(
  holder: T,
  goodsType: string,
  amount: number,
  sizes?: GoodsSizes
): { holder: T; added: number } {
  const itemSize = getGoodsSize(goodsType, sizes);
  const availableSpace = getAvailableCapacity(holder, sizes);

  // Calculate how many items can fit in available space
  const maxItemsThatFit = Math.floor(availableSpace / itemSize);
  const toAdd = Math.min(amount, maxItemsThatFit);

  if (toAdd <= 0) {
    return { holder, added: 0 };
  }

  const currentAmount = holder.inventory[goodsType] ?? 0;

  return {
    holder: {
      ...holder,
      inventory: {
        ...holder.inventory,
        [goodsType]: currentAmount + toAdd,
      },
    },
    added: toAdd,
  };
}

/**
 * Remove goods from inventory (returns new holder, doesn't mutate)
 * Returns { holder, removed } - removed may be less than requested if not enough
 */
export function removeFromInventory<T extends InventoryHolder>(
  holder: T,
  goodsType: string,
  amount: number
): { holder: T; removed: number } {
  const currentAmount = holder.inventory[goodsType] ?? 0;
  const toRemove = Math.min(amount, currentAmount);

  if (toRemove <= 0) {
    return { holder, removed: 0 };
  }

  return {
    holder: {
      ...holder,
      inventory: {
        ...holder.inventory,
        [goodsType]: currentAmount - toRemove,
      },
    },
    removed: toRemove,
  };
}

/**
 * Transfer goods between two inventory holders
 * Atomic operation: removes from source, adds to destination
 * Returns updated holders and actual amount transferred
 */
export function transferInventory<TFrom extends InventoryHolder, TTo extends InventoryHolder>(
  from: TFrom,
  to: TTo,
  goodsType: string,
  amount: number,
  sizes?: GoodsSizes
): { from: TFrom; to: TTo; transferred: number } {
  // Calculate how much we can actually transfer
  const availableInSource = from.inventory[goodsType] ?? 0;

  // Calculate capacity in destination based on item size
  const itemSize = getGoodsSize(goodsType, sizes);
  const availableSpace = getAvailableCapacity(to, sizes);
  const maxItemsThatFit = Math.floor(availableSpace / itemSize);

  const toTransfer = Math.min(amount, availableInSource, maxItemsThatFit);

  if (toTransfer <= 0) {
    return { from, to, transferred: 0 };
  }

  // Remove from source (sizes not needed for removal)
  const { holder: updatedFrom } = removeFromInventory(from, goodsType, toTransfer);

  // Add to destination (we already calculated it fits)
  const currentAmount = to.inventory[goodsType] ?? 0;
  const updatedTo = {
    ...to,
    inventory: {
      ...to.inventory,
      [goodsType]: currentAmount + toTransfer,
    },
  } as TTo;

  return {
    from: updatedFrom,
    to: updatedTo,
    transferred: toTransfer,
  };
}

/**
 * Get amount of a specific goods type
 */
export function getGoodsCount(holder: InventoryHolder, goodsType: string): number {
  return holder.inventory[goodsType] ?? 0;
}

/**
 * Check if holder has at least this amount of a goods type
 */
export function hasGoods(holder: InventoryHolder, goodsType: string, amount: number): boolean {
  return getGoodsCount(holder, goodsType) >= amount;
}
