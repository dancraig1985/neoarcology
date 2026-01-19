/**
 * MetricsCalculator - Compute entity metrics from transaction history
 *
 * PLAN-035: Separates derived metrics from entity state.
 * Instead of storing weeklyRevenue/weeklyCosts on entities, we calculate
 * them on-demand from the transaction log.
 *
 * Benefits:
 * - Clean separation: entities contain only core simulation state
 * - Event-sourced: metrics derived from immutable transaction history
 * - Recalculable: can compute any metric from any time window
 * - Extensible: add new metrics without modifying entity types
 */

import type { LocationRef } from '../../types/entities';
import type { Transaction, TransactionHistory } from '../../types/Transaction';

/**
 * Location-level metrics computed from transactions
 */
export interface LocationMetrics {
  locationId: LocationRef;
  weeklyRevenue: number;  // Sum of all sales at this location
  weeklyCosts: number;    // Sum of all operating costs for this location
}

/**
 * Calculate metrics for a specific location from transaction history
 */
export function calculateLocationMetrics(
  locationId: LocationRef,
  transactionHistory: TransactionHistory,
  currentPhase: number
): LocationMetrics {
  const windowStart = currentPhase - transactionHistory.windowSize;

  // Get all transactions for this location within the time window
  const locationTransactions = transactionHistory.transactions.filter(
    txn => txn.locationId === locationId && txn.phase > windowStart
  );

  // Calculate revenue: sum of all 'sale' transactions
  const weeklyRevenue = locationTransactions
    .filter(txn => txn.type === 'sale')
    .reduce((sum, txn) => sum + txn.amount, 0);

  // Calculate costs: sum of all 'operating' transactions
  const weeklyCosts = locationTransactions
    .filter(txn => txn.type === 'operating')
    .reduce((sum, txn) => sum + txn.amount, 0);

  return {
    locationId,
    weeklyRevenue,
    weeklyCosts,
  };
}

/**
 * Calculate metrics for all locations
 * Returns a Map for efficient lookup
 */
export function calculateAllLocationMetrics(
  locationIds: LocationRef[],
  transactionHistory: TransactionHistory,
  currentPhase: number
): Map<LocationRef, LocationMetrics> {
  const metricsMap = new Map<LocationRef, LocationMetrics>();

  for (const locationId of locationIds) {
    const metrics = calculateLocationMetrics(locationId, transactionHistory, currentPhase);
    metricsMap.set(locationId, metrics);
  }

  return metricsMap;
}

/**
 * Helper: Get weekly revenue for a location (convenience function)
 */
export function getLocationWeeklyRevenue(
  locationId: LocationRef,
  transactionHistory: TransactionHistory,
  currentPhase: number
): number {
  const metrics = calculateLocationMetrics(locationId, transactionHistory, currentPhase);
  return metrics.weeklyRevenue;
}

/**
 * Helper: Get weekly costs for a location (convenience function)
 */
export function getLocationWeeklyCosts(
  locationId: LocationRef,
  transactionHistory: TransactionHistory,
  currentPhase: number
): number {
  const metrics = calculateLocationMetrics(locationId, transactionHistory, currentPhase);
  return metrics.weeklyCosts;
}
