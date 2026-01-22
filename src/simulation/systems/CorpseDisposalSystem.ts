/**
 * CorpseDisposalSystem - PLAN-039
 * Removes corpses from clinics at a fixed rate (5 per phase per clinic)
 */

import type { Location } from '../../types/entities';
import { ActivityLog } from '../ActivityLog';

const DISPOSAL_RATE = 5; // corpses per phase per clinic

/**
 * Process corpse disposal at all clinics
 * Removes up to 5 corpses per phase from each clinic
 */
export function processCorpseDisposal(
  locations: Location[],
  phase: number
): Location[] {
  return locations.map(location => {
    if (!location.tags.includes('clinic')) {
      return location;
    }

    const corpsesStored = location.inventory['corpse'] ?? 0;
    if (corpsesStored === 0) {
      return location;
    }

    const corpsesDisposed = Math.min(corpsesStored, DISPOSAL_RATE);
    const remaining = corpsesStored - corpsesDisposed;

    ActivityLog.info(
      phase,
      'disposal',
      `disposed ${corpsesDisposed} corpse(s) (${remaining} remaining)`,
      'system',
      location.name
    );

    const updatedInventory = { ...location.inventory };
    if (remaining === 0) {
      delete updatedInventory['corpse'];
    } else {
      updatedInventory['corpse'] = remaining;
    }

    return { ...location, inventory: updatedInventory };
  });
}
