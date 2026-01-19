/**
 * InvariantChecker - Validates simulation state consistency
 * Catches bugs early by checking business rules and invariants
 */

import type { SimulationState } from '../Simulation';
import type { InvariantViolation } from '../../types/InvariantViolation';
import type { EconomyConfig } from '../../config/ConfigLoader';
import { checkAgentInvariants } from './AgentInvariants';
import { checkLocationInvariants } from './LocationInvariants';
import { checkOrgInvariants, checkEmploymentInvariants } from './OrgInvariants';
import { checkOrderInvariants } from './OrderInvariants';

export interface InvariantCheckConfig {
  enabled: boolean;
  failOnErrors: boolean;
  logWarnings: boolean;
  logInfo: boolean;
  checkEveryNPhases: number;
}

export class InvariantChecker {
  private config: InvariantCheckConfig;
  private economyConfig: EconomyConfig;

  constructor(config: InvariantCheckConfig, economyConfig: EconomyConfig) {
    this.config = config;
    this.economyConfig = economyConfig;
  }

  /**
   * Check all invariants and return violations
   */
  check(state: SimulationState): InvariantViolation[] {
    if (!this.config.enabled) {
      return [];
    }

    // Only check if we're on the right phase interval
    if (state.time.currentPhase % this.config.checkEveryNPhases !== 0) {
      return [];
    }

    const violations: InvariantViolation[] = [];

    violations.push(...checkAgentInvariants(state));
    violations.push(...checkLocationInvariants(state, this.economyConfig));
    violations.push(...checkOrgInvariants(state));
    violations.push(...checkEmploymentInvariants(state));
    violations.push(...checkOrderInvariants(state));

    return violations;
  }

  /**
   * Check and log violations
   * Returns true if there are errors and failOnErrors is enabled
   */
  checkAndLog(state: SimulationState): boolean {
    const violations = this.check(state);

    // Log violations based on config
    for (const violation of violations) {
      if (violation.severity === 'error') {
        const prefix = '❌';
        console.log(`${prefix} [${violation.category}] ${violation.message}`);
      } else if (violation.severity === 'warning' && this.config.logWarnings) {
        const prefix = '⚠️';
        console.log(`${prefix} [${violation.category}] ${violation.message}`);
      } else if (violation.severity === 'info' && this.config.logInfo) {
        const prefix = 'ℹ️';
        console.log(`${prefix} [${violation.category}] ${violation.message}`);
      }
    }

    // Check if we should fail on errors
    const errors = violations.filter((v) => v.severity === 'error');
    return errors.length > 0 && this.config.failOnErrors;
  }

  /**
   * Get summary statistics of violations
   */
  getSummary(violations: InvariantViolation[]): {
    total: number;
    errors: number;
    warnings: number;
    info: number;
    byCategory: Record<string, number>;
  } {
    const summary = {
      total: violations.length,
      errors: 0,
      warnings: 0,
      info: 0,
      byCategory: {} as Record<string, number>,
    };

    for (const v of violations) {
      if (v.severity === 'error') summary.errors++;
      else if (v.severity === 'warning') summary.warnings++;
      else if (v.severity === 'info') summary.info++;

      summary.byCategory[v.category] = (summary.byCategory[v.category] || 0) + 1;
    }

    return summary;
  }
}

/**
 * Create default invariant checker with sensible defaults
 */
export function createInvariantChecker(
  economyConfig: EconomyConfig,
  overrides?: Partial<InvariantCheckConfig>
): InvariantChecker {
  const defaultConfig: InvariantCheckConfig = {
    enabled: true,
    failOnErrors: false,
    logWarnings: true,
    logInfo: false,
    checkEveryNPhases: 1,
  };

  return new InvariantChecker({ ...defaultConfig, ...overrides }, economyConfig);
}
