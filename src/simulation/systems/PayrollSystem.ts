/**
 * PayrollSystem - Weekly financial operations
 *
 * Handles weekly payroll processing, operating costs, rent collection, and org dissolution.
 * Staggered processing across 56 phases per week (each org has a unique weeklyPhaseOffset).
 *
 * This module is called by:
 * - Simulation.ts (processWeeklyEconomy in the main tick loop)
 */

import type { Agent, Location, Organization, Vehicle } from '../../types/entities';
import type { BusinessConfig } from '../../config/ConfigLoader';
import { releaseAgent, resetWeeklyTracking } from './LocationSystem';
import { onOrgDissolvedOrphanLocations } from './AgentStateHelpers';
import { onOrgDissolved as onOrgDissolvedVehicles } from './VehicleSystem';
import { trackWagePayment, trackDividendPayment, trackBusinessClosed } from '../Metrics';
import { ActivityLog } from '../ActivityLog';

/**
 * Process weekly economy for all orgs (STAGGERED)
 * Each org processes on their weeklyPhaseOffset (spread across 56 phases)
 * - Pay owner dividend (first priority)
 * - Pay employees
 * - Charge operating costs
 * - Collect rent (residential locations)
 * - Handle org dissolution (bankruptcy, insolvency, leader death)
 * - Clean up vehicles from dissolved orgs
 */
export function processWeeklyEconomy(
  agents: Agent[],
  locations: Location[],
  orgs: Organization[],
  vehicles: Vehicle[],
  businessConfig: BusinessConfig,
  phase: number
): { agents: Agent[]; locations: Location[]; orgs: Organization[]; vehicles: Vehicle[] } {
  let updatedAgents = [...agents];
  let updatedLocations = [...locations];
  let updatedOrgs = [...orgs];
  let updatedVehicles = [...vehicles];
  const orgsToRemove: string[] = [];

  for (let orgIdx = 0; orgIdx < updatedOrgs.length; orgIdx++) {
    let org = updatedOrgs[orgIdx];
    if (!org) continue;

    // STAGGERED WEEKLY PROCESSING: Only process this org on their designated phase
    // This spreads payroll/costs across the week instead of all at once
    const currentPhaseInWeek = phase % 56;
    if (currentPhaseInWeek !== org.weeklyPhaseOffset) {
      continue; // Not this org's payday yet
    }

    const orgId = org.id; // Capture for type narrowing in filter
    const orgLeader = org.leader; // Capture for use in closures
    // Find all locations owned by this org
    const orgLocations = updatedLocations.filter((loc) => loc.owner === orgId);

    // Pay owner dividend FIRST (owner survival is priority - they need to eat!)
    // This happens before employee salaries so owner always gets paid if org has funds
    const ownerDividend = businessConfig.payroll.ownerWeeklyDividend;
    const leaderIdx = updatedAgents.findIndex((a) => a.id === orgLeader);
    if (leaderIdx !== -1 && org.wallet.credits >= ownerDividend) {
      const leader = updatedAgents[leaderIdx];
      if (leader && leader.status !== 'dead') {
        org = {
          ...org,
          wallet: {
            ...org.wallet,
            credits: org.wallet.credits - ownerDividend,
          },
        };
        updatedAgents[leaderIdx] = {
          ...leader,
          wallet: {
            ...leader.wallet,
            credits: leader.wallet.credits + ownerDividend,
          },
        };
        ActivityLog.info(
          phase,
          'dividend',
          `received ${ownerDividend} credits from ${org.name}`,
          leader.id,
          leader.name
        );

        // Track dividend payment in metrics
        trackDividendPayment(ownerDividend);
      }
    }

    for (const location of orgLocations) {
      // Find employees at this location
      const employeeIndices = location.employees
        .map((empId) => updatedAgents.findIndex((a) => a.id === empId))
        .filter((idx) => idx !== -1);

      const employees = employeeIndices
        .map((idx) => updatedAgents[idx])
        .filter((e): e is Agent => e !== undefined);

      // Process payroll from org wallet
      const payrollResult = processOrgPayroll(org, employees, phase);
      org = payrollResult.org;

      // Update paid employees
      for (const paidEmp of payrollResult.employees) {
        const idx = updatedAgents.findIndex((a) => a.id === paidEmp.id);
        if (idx !== -1) {
          updatedAgents[idx] = paidEmp;
        }
      }

      // Release unpaid employees
      let updatedLocation = location;
      for (const unpaidEmp of payrollResult.unpaidEmployees) {
        const releaseResult = releaseAgent(updatedLocation, unpaidEmp, 'unpaid', phase);
        updatedLocation = releaseResult.location;
        const idx = updatedAgents.findIndex((a) => a.id === unpaidEmp.id);
        if (idx !== -1) {
          updatedAgents[idx] = releaseResult.agent;
        }
      }

      // Process operating costs from org wallet
      if (org.wallet.credits >= updatedLocation.operatingCost) {
        ActivityLog.info(
          phase,
          'costs',
          `paid ${updatedLocation.operatingCost} credits operating costs for ${updatedLocation.name}`,
          org.id,
          org.name
        );
        org = {
          ...org,
          wallet: {
            ...org.wallet,
            credits: org.wallet.credits - updatedLocation.operatingCost,
          },
        };
        updatedLocation = {
          ...updatedLocation,
          weeklyCosts: updatedLocation.weeklyCosts + updatedLocation.operatingCost,
        };
      } else {
        ActivityLog.warning(
          phase,
          'costs',
          `cannot afford operating costs for ${updatedLocation.name}`,
          org.id,
          org.name
        );
      }

      // Process rent collection for residential locations
      if (updatedLocation.rentCost && updatedLocation.rentCost > 0) {
        const rentResult = processRentCollection(org, updatedLocation, updatedAgents, phase);
        org = rentResult.org;
        updatedLocation = rentResult.location;
        updatedAgents = rentResult.agents;
      }

      // Reset weekly tracking
      updatedLocation = resetWeeklyTracking(updatedLocation);

      // Update location in array
      const locIndex = updatedLocations.findIndex((l) => l.id === location.id);
      if (locIndex !== -1) {
        updatedLocations[locIndex] = updatedLocation;
      }
    }

    // Check for org dissolution conditions:
    // 1. Bankruptcy (credits < 0)
    // 2. Insolvency (can't afford minimum operations - less than 50 credits)
    // 3. Leader death (with no employees to take over)
    const leaderForCheck = updatedAgents.find((a) => a.id === org.leader);
    const leaderDead = !leaderForCheck || leaderForCheck.status === 'dead';
    const isBankrupt = org.wallet.credits < 0;
    const isInsolvent = false; // Disabled: let businesses survive on thin margins

    // If leader died, try auto-succession first
    if (leaderDead && !isBankrupt) {
      // Find all employees across org's locations
      const orgEmployeeIds = new Set<string>();
      for (const loc of orgLocations) {
        for (const empId of loc.employees) {
          orgEmployeeIds.add(empId);
        }
      }

      // Find living employees, sorted by hire date (earliest first = senior)
      const livingEmployees = updatedAgents
        .filter((a) => orgEmployeeIds.has(a.id) && a.status !== 'dead')
        .sort((a, b) => (a.created ?? 0) - (b.created ?? 0));

      if (livingEmployees.length > 0) {
        // Auto-succession: promote senior employee to leader
        const newLeader = livingEmployees[0];
        if (newLeader) {
          org = {
            ...org,
            leader: newLeader.id,
          };

          ActivityLog.info(
            phase,
            'succession',
            `${newLeader.name} became new leader of ${org.name} (previous leader died)`,
            newLeader.id,
            newLeader.name
          );

          // Update org in array and continue (don't dissolve)
          updatedOrgs[orgIdx] = org;
          continue;
        }
      }
    }

    // Determine dissolution reason (if any)
    let dissolutionReason = '';
    if (leaderDead) {
      dissolutionReason = 'leader died';
    } else if (isBankrupt) {
      dissolutionReason = 'bankrupt';
    } else if (isInsolvent) {
      dissolutionReason = 'insolvent';
    }

    if (dissolutionReason) {
      ActivityLog.critical(
        phase,
        'business',
        `${org.name} dissolved (${dissolutionReason})`,
        org.id,
        org.name
      );

      // Track business closing in metrics
      trackBusinessClosed(org.name);

      // Orphan locations instead of deleting them
      // Employees lose jobs, but residents stay (stop paying rent)
      const orphanResult = onOrgDissolvedOrphanLocations(
        org.id,
        updatedLocations,
        updatedAgents,
        phase
      );
      updatedAgents = orphanResult.agents;
      updatedLocations = orphanResult.locations;

      // Log orphaned locations
      for (const loc of orgLocations) {
        ActivityLog.warning(
          phase,
          'orphaned',
          `${loc.name} is now orphaned and for sale`,
          loc.id,
          loc.name
        );
      }

      orgsToRemove.push(org.id);
    }

    // Update org in array
    updatedOrgs[orgIdx] = org;
  }

  // Remove dissolved orgs (locations are now orphaned, not deleted)
  updatedOrgs = updatedOrgs.filter((org) => !orgsToRemove.includes(org.id));

  // Clean up vehicles owned by dissolved orgs
  for (const dissolvedOrgId of orgsToRemove) {
    updatedVehicles = onOrgDissolvedVehicles(updatedVehicles, dissolvedOrgId, phase);
  }

  return { agents: updatedAgents, locations: updatedLocations, orgs: updatedOrgs, vehicles: updatedVehicles };
}

/**
 * Process payroll from org wallet
 */
function processOrgPayroll(
  org: Organization,
  employees: Agent[],
  phase: number
): { org: Organization; employees: Agent[]; unpaidEmployees: Agent[] } {
  let updatedOrg = org;
  const paidEmployees: Agent[] = [];
  const unpaidEmployees: Agent[] = [];

  for (const employee of employees) {
    if (updatedOrg.wallet.credits >= employee.salary) {
      // Pay the employee from org wallet
      updatedOrg = {
        ...updatedOrg,
        wallet: {
          ...updatedOrg.wallet,
          credits: updatedOrg.wallet.credits - employee.salary,
        },
      };

      const paidEmployee = {
        ...employee,
        wallet: {
          ...employee.wallet,
          credits: employee.wallet.credits + employee.salary,
        },
      };
      paidEmployees.push(paidEmployee);

      ActivityLog.info(
        phase,
        'payroll',
        `paid ${employee.salary} credits by ${org.name}`,
        employee.id,
        employee.name
      );

      // Track wage payment in metrics
      trackWagePayment(employee.salary);
    } else {
      // Can't pay - employee will quit
      unpaidEmployees.push(employee);
      ActivityLog.warning(
        phase,
        'payroll',
        `not paid by ${org.name} (insufficient funds)`,
        employee.id,
        employee.name
      );
    }
  }

  return { org: updatedOrg, employees: paidEmployees, unpaidEmployees };
}

/**
 * Process rent collection for a residential location
 * Tenants pay rent to org wallet, those who can't pay are evicted
 */
function processRentCollection(
  org: Organization,
  location: Location,
  agents: Agent[],
  phase: number
): { org: Organization; location: Location; agents: Agent[] } {
  const rentCost = location.rentCost ?? 0;
  if (rentCost <= 0) {
    return { org, location, agents };
  }

  let updatedOrg = org;
  let updatedLocation = location;
  let updatedAgents = [...agents];
  const residents = location.residents ?? [];

  for (const residentId of residents) {
    const residentIdx = updatedAgents.findIndex((a) => a.id === residentId);
    if (residentIdx === -1) continue;

    const resident = updatedAgents[residentIdx];
    if (!resident || resident.status === 'dead') continue;

    if (resident.wallet.credits >= rentCost) {
      // Pay rent
      updatedAgents[residentIdx] = {
        ...resident,
        wallet: {
          ...resident.wallet,
          credits: resident.wallet.credits - rentCost,
        },
      };

      updatedOrg = {
        ...updatedOrg,
        wallet: {
          ...updatedOrg.wallet,
          credits: updatedOrg.wallet.credits + rentCost,
        },
      };

      ActivityLog.info(
        phase,
        'rent',
        `paid ${rentCost} credits rent to ${org.name}`,
        resident.id,
        resident.name
      );
    } else {
      // Can't pay - evict
      ActivityLog.warning(
        phase,
        'eviction',
        `evicted from ${location.name} (can't afford ${rentCost} rent, has ${resident.wallet.credits})`,
        resident.id,
        resident.name
      );

      // Clear agent's residence
      updatedAgents[residentIdx] = {
        ...resident,
        residence: undefined,
      };

      // Remove from location's residents list
      updatedLocation = {
        ...updatedLocation,
        residents: (updatedLocation.residents ?? []).filter((id) => id !== residentId),
      };
    }
  }

  return { org: updatedOrg, location: updatedLocation, agents: updatedAgents };
}
