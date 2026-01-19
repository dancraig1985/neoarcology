/**
 * Invariant violation types for state validation
 * Used by InvariantChecker to report issues with simulation state
 */

export interface InvariantViolation {
  severity: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  entityId?: string;
  phase: number;
}

export type ViolationSeverity = 'error' | 'warning' | 'info';

export type ViolationCategory =
  | 'agent_state'
  | 'employment'
  | 'location'
  | 'economy'
  | 'inventory'
  | 'org'
  | 'orders'
  | 'travel'
  | 'housing';
