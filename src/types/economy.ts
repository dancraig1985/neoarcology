/**
 * Economy types for NeoArcology
 * Credits are the universal currency (1 credit ~ $100 USD equivalent)
 */

import type { AgentRef, LocationRef, OrgRef } from './entities';

/**
 * Time system constants
 * Phase is the basic unit of simulation time
 */
export const TIME = {
  PHASES_PER_DAY: 4, // Dawn, Day, Dusk, Night
  PHASES_PER_WEEK: 28,
  PHASES_PER_MONTH: 112, // 4 weeks
  PHASES_PER_YEAR: 1344, // 12 months
} as const;

export type PhaseOfDay = 'dawn' | 'day' | 'dusk' | 'night';

/**
 * When income is generated
 */
export type IncomeTiming = 'per_phase' | 'per_day' | 'per_week' | 'per_month';

/**
 * Income source types for organizations
 */
export type OrgIncomeType =
  | 'legitimate_business'
  | 'protection_racket'
  | 'smuggling'
  | 'drug_trade'
  | 'gambling_operation'
  | 'data_brokerage'
  | 'contract_work'
  | 'manufacturing'
  | 'theft_fencing'
  | 'investment_returns';

/**
 * Income source types for agents
 */
export type AgentIncomeType =
  | 'salary'
  | 'mission_cut'
  | 'personal_deal'
  | 'investment'
  | 'theft'
  | 'extortion'
  | 'inheritance'
  | 'gambling';

/**
 * Income stream for an organization
 */
export interface IncomeStream {
  type: OrgIncomeType;
  location?: LocationRef;
  baseAmount: number;
  timing: IncomeTiming;
  volatility: number; // 0-1, how much it fluctuates
  risk: number; // 0-1, chance of attracting heat
  requirements: {
    agents: number;
    minSkill?: StatRequirement;
  };
}

export interface StatRequirement {
  stat: string;
  minValue: number;
}

/**
 * Expense for an organization
 */
export interface Expense {
  type: ExpenseType;
  amount: number;
  timing: IncomeTiming;
  description: string;
  locationId?: LocationRef;
}

export type ExpenseType =
  | 'salary'
  | 'rent'
  | 'maintenance'
  | 'supplies'
  | 'equipment'
  | 'bribes'
  | 'legal_fees'
  | 'medical'
  | 'other';

/**
 * Debt owed by an agent or organization
 */
export interface Debt {
  creditor: AgentRef | OrgRef;
  principal: number;
  interest: number; // Per week
  duePhase?: number;
  payments: number[];
}

/**
 * Personal asset owned by an agent
 */
export interface PersonalAsset {
  type: string;
  value: number;
  locationId?: LocationRef;
}

/**
 * Salary tiers for agents
 */
export type SalaryTier =
  | 'unskilled'
  | 'skilled'
  | 'specialist'
  | 'lieutenant'
  | 'executive'
  | 'leader';

export const SALARY_RANGES: Record<SalaryTier, { min: number; max: number }> = {
  unskilled: { min: 100, max: 300 },
  skilled: { min: 300, max: 600 },
  specialist: { min: 600, max: 1500 },
  lieutenant: { min: 1500, max: 4000 },
  executive: { min: 4000, max: 10000 },
  leader: { min: 0, max: 0 }, // Leaders take profits, not salary
};

/**
 * Goods categories (~16 broad categories)
 */
export type GoodsCategory =
  | 'small_arms'
  | 'heavy_weapons'
  | 'armor'
  | 'vehicles'
  | 'narcotics'
  | 'pharmaceuticals'
  | 'electronics'
  | 'data_storage'
  | 'cyberware'
  | 'food_supplies'
  | 'luxury_goods'
  | 'raw_materials'
  | 'contraband'
  | 'counterfeit'
  | 'intel'
  | 'software';

/**
 * Job definition
 */
export interface Job {
  id: string;
  title: string;
  orgId: OrgRef;
  salaryTier: SalaryTier;
  requirements: {
    stats?: Partial<Record<string, number>>;
    tags?: string[];
  };
  missionCutPercent: number; // 0-100
  duties: string[];
}

/**
 * Transaction record
 */
export interface Transaction {
  id: string;
  phase: number;
  fromId: AgentRef | OrgRef;
  toId: AgentRef | OrgRef;
  amount: number;
  type: TransactionType;
  description: string;
}

export type TransactionType =
  | 'salary'
  | 'mission_payment'
  | 'trade'
  | 'extortion'
  | 'bribe'
  | 'loan'
  | 'repayment'
  | 'theft'
  | 'reward'
  | 'expense';
