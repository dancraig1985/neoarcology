/**
 * Transaction - Records economic activity for metrics calculation
 *
 * Transactions enable event-sourced metrics: instead of accumulating
 * derived fields on entities (weeklyRevenue, weeklyCosts), we record
 * each transaction and calculate metrics on-demand from history.
 */

import type { EntityRef, LocationRef } from './entities';

export type TransactionType =
  | 'sale'        // Retail/wholesale sale of goods
  | 'wage'        // Wage payment to employee
  | 'rent'        // Rent payment for housing
  | 'dividend'    // Dividend payment to owner
  | 'operating'   // Operating cost payment
  | 'delivery';   // Delivery/logistics payment

export interface Transaction {
  /** Phase when transaction occurred */
  phase: number;

  /** Type of transaction */
  type: TransactionType;

  /** Entity paying (source of funds) */
  from: EntityRef;

  /** Entity receiving (destination of funds) */
  to: EntityRef;

  /** Amount of credits transferred */
  amount: number;

  /** Location where transaction occurred (for location-level metrics) */
  locationId?: LocationRef;

  /** Goods exchanged (for sale transactions) */
  goods?: {
    type: string;
    quantity: number;
  };
}

/**
 * Transaction history with efficient windowing
 * Keeps only recent transactions needed for current metrics
 */
export interface TransactionHistory {
  /** All recent transactions (rolling window) */
  transactions: Transaction[];

  /** Window size in phases (default: 56 = 1 week) */
  windowSize: number;
}

/**
 * Helper to create a new transaction
 */
export function createTransaction(
  phase: number,
  type: TransactionType,
  from: EntityRef,
  to: EntityRef,
  amount: number,
  locationId?: LocationRef,
  goods?: { type: string; quantity: number }
): Transaction {
  return {
    phase,
    type,
    from,
    to,
    amount,
    locationId,
    goods,
  };
}

/**
 * Helper to add transaction to history with automatic windowing
 */
export function addTransaction(
  history: TransactionHistory,
  transaction: Transaction
): TransactionHistory {
  const allTransactions = [...history.transactions, transaction];

  // Keep only transactions within window (last N phases)
  const cutoffPhase = transaction.phase - history.windowSize;
  const recentTransactions = allTransactions.filter(
    txn => txn.phase > cutoffPhase
  );

  return {
    ...history,
    transactions: recentTransactions,
  };
}

/**
 * Helper to record transaction directly (mutates history in-place)
 * Use this during simulation tick for performance
 */
export function recordTransaction(
  history: TransactionHistory,
  transaction: Transaction
): void {
  history.transactions.push(transaction);

  // Periodically clean old transactions to keep memory bounded
  if (history.transactions.length > 1000) {
    const cutoffPhase = transaction.phase - history.windowSize;
    history.transactions = history.transactions.filter(
      txn => txn.phase > cutoffPhase
    );
  }
}

/**
 * Create initial (empty) transaction history
 */
export function createTransactionHistory(windowSize: number = 56): TransactionHistory {
  return {
    transactions: [],
    windowSize,
  };
}
