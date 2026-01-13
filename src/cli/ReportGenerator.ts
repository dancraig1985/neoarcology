/**
 * ReportGenerator - Format simulation metrics into readable reports
 */

import type { SimulationMetrics } from '../simulation/Metrics';

/**
 * Assessment levels for different metrics
 */
export type AssessmentLevel = 'STABLE' | 'GROWING' | 'DECLINING' | 'CRITICAL' | 'COLLAPSED' |
  'HEALTHY' | 'ADEQUATE' | 'SCARCE' |
  'INFLATING' | 'DEFLATING' |
  'OK' | 'CAUTION' | 'WARNING';

export interface Assessment {
  population: AssessmentLevel;
  economy: AssessmentLevel;
  foodSupply: AssessmentLevel;
  overall: AssessmentLevel;
  populationNote: string;
  economyNote: string;
  foodNote: string;
  overallNote: string;
}

/**
 * Assess population health
 */
function assessPopulation(metrics: SimulationMetrics): { level: AssessmentLevel; note: string } {
  const { startingPopulation, finalSnapshot } = metrics;
  if (!finalSnapshot) return { level: 'CRITICAL', note: 'No data' };

  const current = finalSnapshot.population.alive;
  const survivalRate = current / startingPopulation;

  if (survivalRate >= 0.95) {
    return { level: 'STABLE', note: `${(survivalRate * 100).toFixed(0)}% survival` };
  }
  if (survivalRate >= 0.80) {
    return { level: 'DECLINING', note: `lost ${((1 - survivalRate) * 100).toFixed(0)}% of population` };
  }
  if (survivalRate >= 0.50) {
    return { level: 'CRITICAL', note: `lost ${((1 - survivalRate) * 100).toFixed(0)}% of population` };
  }
  return { level: 'COLLAPSED', note: `only ${current} agents remaining` };
}

/**
 * Assess economy health based on credit trends
 */
function assessEconomy(metrics: SimulationMetrics): { level: AssessmentLevel; note: string } {
  const { snapshots } = metrics;
  if (snapshots.length < 2) return { level: 'STABLE', note: 'insufficient data' };

  // Compare first and last few snapshots to see trend
  const recentSnapshots = snapshots.slice(-5);
  const earlySnapshots = snapshots.slice(0, Math.min(5, snapshots.length));

  const earlyAvg = earlySnapshots.reduce((sum, s) => sum + s.economy.totalCredits, 0) / earlySnapshots.length;
  const recentAvg = recentSnapshots.reduce((sum, s) => sum + s.economy.totalCredits, 0) / recentSnapshots.length;

  if (earlyAvg === 0) return { level: 'CRITICAL', note: 'no credits in system' };

  const changeRate = (recentAvg - earlyAvg) / earlyAvg;

  if (Math.abs(changeRate) < 0.10) {
    return { level: 'STABLE', note: `credits fluctuating <10%` };
  }
  if (changeRate > 0.20) {
    return { level: 'INFLATING', note: `credits up ${(changeRate * 100).toFixed(0)}%` };
  }
  if (changeRate < -0.20) {
    return { level: 'DEFLATING', note: `credits down ${(Math.abs(changeRate) * 100).toFixed(0)}%` };
  }
  if (changeRate > 0) {
    return { level: 'GROWING', note: `credits up ${(changeRate * 100).toFixed(0)}%` };
  }
  return { level: 'DECLINING', note: `credits down ${(Math.abs(changeRate) * 100).toFixed(0)}%` };
}

/**
 * Assess food supply health
 */
function assessFoodSupply(metrics: SimulationMetrics): { level: AssessmentLevel; note: string } {
  const { finalSnapshot } = metrics;
  if (!finalSnapshot) return { level: 'CRITICAL', note: 'No data' };

  const { supply, population } = finalSnapshot;
  const alive = population.alive;
  if (alive === 0) return { level: 'CRITICAL', note: 'no population' };

  const foodPerAgent = supply.total / alive;

  if (foodPerAgent >= 10) {
    return { level: 'HEALTHY', note: `${foodPerAgent.toFixed(1)} provisions per agent` };
  }
  if (foodPerAgent >= 5) {
    return { level: 'ADEQUATE', note: `${foodPerAgent.toFixed(1)} provisions per agent` };
  }
  if (foodPerAgent >= 2) {
    return { level: 'SCARCE', note: `only ${foodPerAgent.toFixed(1)} provisions per agent` };
  }
  return { level: 'CRITICAL', note: `only ${foodPerAgent.toFixed(1)} provisions per agent` };
}

/**
 * Overall assessment combining all factors
 */
function assessOverall(pop: AssessmentLevel, econ: AssessmentLevel, food: AssessmentLevel): { level: AssessmentLevel; note: string } {
  const critical = ['CRITICAL', 'COLLAPSED'];
  const warning = ['DECLINING', 'DEFLATING', 'SCARCE'];

  const criticalCount = [pop, econ, food].filter(a => critical.includes(a)).length;
  const warningCount = [pop, econ, food].filter(a => warning.includes(a)).length;

  if (criticalCount >= 2) {
    return { level: 'CRITICAL', note: 'multiple systems failing' };
  }
  if (criticalCount === 1) {
    return { level: 'WARNING', note: 'one system critical' };
  }
  if (warningCount >= 2) {
    return { level: 'CAUTION', note: 'multiple systems declining' };
  }
  if (warningCount === 1) {
    return { level: 'CAUTION', note: 'one system declining' };
  }
  return { level: 'OK', note: 'all systems nominal' };
}

/**
 * Generate full assessment
 */
export function generateAssessment(metrics: SimulationMetrics): Assessment {
  const pop = assessPopulation(metrics);
  const econ = assessEconomy(metrics);
  const food = assessFoodSupply(metrics);
  const overall = assessOverall(pop.level, econ.level, food.level);

  return {
    population: pop.level,
    economy: econ.level,
    foodSupply: food.level,
    overall: overall.level,
    populationNote: pop.note,
    economyNote: econ.note,
    foodNote: food.note,
    overallNote: overall.note,
  };
}

/**
 * Format number with commas
 */
function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * Generate text report
 */
export function generateTextReport(metrics: SimulationMetrics, totalTicks: number): string {
  const { finalSnapshot, transactions, snapshots, startingPopulation, startingBusinesses, seed } = metrics;
  if (!finalSnapshot) return 'No simulation data collected.';

  const weeks = Math.floor(totalTicks / 28);
  const months = (weeks / 4).toFixed(1);
  const assessment = generateAssessment(metrics);

  const lines: string[] = [];

  lines.push('================================================================================');
  lines.push('SIMULATION REPORT');
  lines.push('================================================================================');
  lines.push(`Duration: ${formatNumber(totalTicks)} ticks (${weeks} weeks, ~${months} months)`);
  lines.push(`Seed: ${seed ?? 'random'}`);
  lines.push('');

  // Population
  lines.push('POPULATION');
  lines.push(`  Starting: ${startingPopulation} agents`);
  lines.push(`  Current:  ${finalSnapshot.population.alive} agents (${finalSnapshot.population.dead} dead)`);
  const survivalRate = ((finalSnapshot.population.alive / startingPopulation) * 100).toFixed(0);
  lines.push(`  Survival Rate: ${survivalRate}%`);
  if (Object.keys(transactions.deathsByCause).length > 0) {
    lines.push('  Deaths by Cause:');
    for (const [cause, count] of Object.entries(transactions.deathsByCause)) {
      lines.push(`    - ${cause}: ${count}`);
    }
  }
  lines.push('');

  // Employment
  lines.push('EMPLOYMENT');
  const alive = finalSnapshot.population.alive;
  const employedPct = alive > 0 ? ((finalSnapshot.population.employed / alive) * 100).toFixed(0) : '0';
  const unemployedPct = alive > 0 ? ((finalSnapshot.population.unemployed / alive) * 100).toFixed(0) : '0';
  lines.push(`  Employed: ${finalSnapshot.population.employed} (${employedPct}%)`);
  lines.push(`  Unemployed: ${finalSnapshot.population.unemployed} (${unemployedPct}%)`);
  lines.push(`  Business Owners: ${finalSnapshot.population.businessOwners}`);
  lines.push('');

  // Economy
  lines.push('ECONOMY');
  lines.push(`  Total Credits: ${formatNumber(finalSnapshot.economy.totalCredits)}`);
  const totalCredits = finalSnapshot.economy.totalCredits;
  const agentPct = totalCredits > 0 ? ((finalSnapshot.economy.agentCredits / totalCredits) * 100).toFixed(0) : '0';
  const orgPct = totalCredits > 0 ? ((finalSnapshot.economy.orgCredits / totalCredits) * 100).toFixed(0) : '0';
  lines.push(`    - Agent wallets: ${formatNumber(finalSnapshot.economy.agentCredits)} (${agentPct}%)`);
  lines.push(`    - Org wallets: ${formatNumber(finalSnapshot.economy.orgCredits)} (${orgPct}%)`);
  const creditsPerAgent = alive > 0 ? finalSnapshot.economy.totalCredits / alive : 0;
  lines.push(`  Credits per living agent: ${formatNumber(Math.round(creditsPerAgent))}`);
  lines.push('');

  // Businesses
  lines.push('BUSINESSES');
  lines.push(`  Active: ${finalSnapshot.businesses.active} (${finalSnapshot.businesses.retail} retail, ${finalSnapshot.businesses.wholesale} wholesale)`);
  lines.push(`  Closed this run: ${transactions.businessesClosed}`);
  lines.push(`  New this run: ${transactions.businessesOpened}`);
  lines.push('');

  // Food Supply
  lines.push('FOOD SUPPLY');
  lines.push(`  Factory inventory: ${formatNumber(finalSnapshot.supply.factoryInventory)} provisions`);
  lines.push(`  Shop inventory: ${formatNumber(finalSnapshot.supply.shopInventory)} provisions`);
  lines.push(`  Agent inventory: ${formatNumber(finalSnapshot.supply.agentInventory)} provisions`);
  lines.push(`  Total: ${formatNumber(finalSnapshot.supply.total)} provisions`);
  const provisionsPerAgent = alive > 0 ? finalSnapshot.supply.total / alive : 0;
  lines.push(`  Provisions per agent: ${provisionsPerAgent.toFixed(1)}`);
  lines.push('');

  // Transactions
  lines.push('TRANSACTIONS (this run)');
  const retailAvg = weeks > 0 ? (transactions.retailSales / weeks).toFixed(1) : '0';
  const wholesaleAvg = weeks > 0 ? (transactions.wholesaleSales / weeks).toFixed(1) : '0';
  lines.push(`  Retail sales: ${formatNumber(transactions.retailSales)} (avg ${retailAvg}/week)`);
  lines.push(`  Wholesale sales: ${formatNumber(transactions.wholesaleSales)} (avg ${wholesaleAvg}/week)`);
  lines.push(`  Wages paid: ${formatNumber(transactions.wagesPaid)} total`);
  lines.push(`  Dividends paid: ${formatNumber(transactions.dividendsPaid)} total`);
  lines.push(`  Hires: ${transactions.hires}, Fires: ${transactions.fires}`);
  lines.push(`  Immigrants: ${transactions.immigrants}`);
  lines.push('');

  // Weekly Trend (last 10 weeks)
  const recentSnapshots = snapshots.slice(-10);
  if (recentSnapshots.length > 1) {
    lines.push('WEEKLY TREND (last 10 weeks)');
    for (const snap of recentSnapshots) {
      lines.push(`  Week ${snap.week}: ${snap.population.alive} pop, ${snap.businesses.active} biz, ${formatNumber(snap.economy.totalCredits)} credits, ${snap.supply.total} food`);
    }
    lines.push('');
  }

  // Assessment
  lines.push('ASSESSMENT');
  lines.push(`  Population: ${assessment.population} (${assessment.populationNote})`);
  lines.push(`  Economy: ${assessment.economy} (${assessment.economyNote})`);
  lines.push(`  Food Supply: ${assessment.foodSupply} (${assessment.foodNote})`);
  lines.push(`  Overall: ${assessment.overall} - ${assessment.overallNote}`);
  lines.push('================================================================================');

  return lines.join('\n');
}

/**
 * Generate verbose report with weekly events
 */
export function generateVerboseReport(metrics: SimulationMetrics, totalTicks: number): string {
  const baseReport = generateTextReport(metrics, totalTicks);
  const { weeklyEvents } = metrics;

  if (weeklyEvents.length === 0) {
    return baseReport;
  }

  const lines: string[] = [baseReport, '', 'WEEKLY EVENTS'];
  lines.push('================================================================================');

  for (const week of weeklyEvents) {
    const hasEvents = week.deaths.length > 0 ||
      week.businessesOpened.length > 0 ||
      week.businessesClosed.length > 0 ||
      week.hires > 0 || week.fires > 0;

    if (!hasEvents) continue;

    lines.push(`--- Week ${week.week} ---`);
    if (week.deaths.length > 0) {
      for (const death of week.deaths) {
        lines.push(`  Death: "${death.name}" - ${death.cause}`);
      }
    }
    if (week.businessesOpened.length > 0) {
      for (const biz of week.businessesOpened) {
        lines.push(`  Business Opened: "${biz}"`);
      }
    }
    if (week.businessesClosed.length > 0) {
      for (const biz of week.businessesClosed) {
        lines.push(`  Business Closed: "${biz}"`);
      }
    }
    if (week.hires > 0 || week.fires > 0) {
      lines.push(`  Hires: ${week.hires}, Fires: ${week.fires}`);
    }
  }

  return lines.join('\n');
}

/**
 * Generate JSON report
 */
export function generateJsonReport(metrics: SimulationMetrics, totalTicks: number): string {
  const assessment = generateAssessment(metrics);
  const weeks = Math.floor(totalTicks / 28);

  const report = {
    duration: {
      ticks: totalTicks,
      weeks,
    },
    seed: metrics.seed,
    population: {
      starting: metrics.startingPopulation,
      current: metrics.finalSnapshot?.population.alive ?? 0,
      dead: metrics.finalSnapshot?.population.dead ?? 0,
      survivalRate: metrics.startingPopulation > 0
        ? (metrics.finalSnapshot?.population.alive ?? 0) / metrics.startingPopulation
        : 0,
      deathsByCause: metrics.transactions.deathsByCause,
    },
    employment: {
      employed: metrics.finalSnapshot?.population.employed ?? 0,
      unemployed: metrics.finalSnapshot?.population.unemployed ?? 0,
      businessOwners: metrics.finalSnapshot?.population.businessOwners ?? 0,
    },
    economy: {
      totalCredits: metrics.finalSnapshot?.economy.totalCredits ?? 0,
      agentCredits: metrics.finalSnapshot?.economy.agentCredits ?? 0,
      orgCredits: metrics.finalSnapshot?.economy.orgCredits ?? 0,
    },
    businesses: {
      active: metrics.finalSnapshot?.businesses.active ?? 0,
      retail: metrics.finalSnapshot?.businesses.retail ?? 0,
      wholesale: metrics.finalSnapshot?.businesses.wholesale ?? 0,
      openedThisRun: metrics.transactions.businessesOpened,
      closedThisRun: metrics.transactions.businessesClosed,
    },
    supply: {
      factoryInventory: metrics.finalSnapshot?.supply.factoryInventory ?? 0,
      shopInventory: metrics.finalSnapshot?.supply.shopInventory ?? 0,
      agentInventory: metrics.finalSnapshot?.supply.agentInventory ?? 0,
      total: metrics.finalSnapshot?.supply.total ?? 0,
    },
    transactions: metrics.transactions,
    assessment,
    weeklySnapshots: metrics.snapshots,
  };

  return JSON.stringify(report, null, 2);
}
