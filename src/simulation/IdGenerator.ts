/**
 * IdGenerator - Deterministic ID generation for reproducible simulations
 *
 * All IDs are generated from state stored in SimulationState.idState, ensuring
 * that simulations with the same seed produce identical IDs in the same order.
 *
 * This replaces module-level counters which break reproducibility.
 */

/**
 * ID generation state stored in SimulationState
 * All counters start from their initial values and increment deterministically
 */
export interface IdState {
  nextLocationId: number;
  nextOrgId: number;
  nextGoodsOrderId: number;
  nextVehicleId: number;
  nextAgentId: number;
  nextDeliveryId: number;
  nameCounters: {
    shop: number;
    pub: number;
    boutique: number;
    apartment: number;
    office: number;
    laboratory: number;
  };
}

/**
 * IdGenerator provides deterministic ID generation methods
 * All methods mutate the internal state, ensuring sequential IDs
 */
export class IdGenerator {
  constructor(private state: IdState) {}

  // Location IDs
  nextLocationId(): string {
    return `loc_${this.state.nextLocationId++}`;
  }

  // Organization IDs
  nextOrgId(): string {
    return `org_${this.state.nextOrgId++}`;
  }

  // Goods order IDs (B2B commerce)
  nextGoodsOrderId(): string {
    return `order_goods_${this.state.nextGoodsOrderId++}`;
  }

  // Vehicle IDs
  nextVehicleId(): string {
    return `vehicle_${this.state.nextVehicleId++}`;
  }

  // Agent IDs (for immigrants)
  nextAgentId(): string {
    return `agent_imm_${this.state.nextAgentId++}`;
  }

  // Delivery request IDs
  nextDeliveryId(): string {
    return `delivery_${this.state.nextDeliveryId++}`;
  }

  // Name generation with counters
  nextShopName(): string {
    return `Shop ${this.state.nameCounters.shop++}`;
  }

  nextPubName(): string {
    return `Pub ${this.state.nameCounters.pub++}`;
  }

  nextBoutiqueName(): string {
    return `Boutique ${this.state.nameCounters.boutique++}`;
  }

  nextApartmentName(): string {
    return `Apartment ${this.state.nameCounters.apartment++}`;
  }

  nextOfficeName(): string {
    return `Office ${this.state.nameCounters.office++}`;
  }

  nextLaboratoryName(): string {
    return `Laboratory ${this.state.nameCounters.laboratory++}`;
  }

  // Get current state (for debugging/testing)
  getState(): IdState {
    return this.state;
  }
}

/**
 * Create initial ID state for a new simulation
 * Called during city generation
 */
export function createInitialIdState(): IdState {
  return {
    nextLocationId: 1,
    nextOrgId: 100, // Start at 100 to distinguish from initial city orgs
    nextGoodsOrderId: 1,
    nextVehicleId: 1,
    nextAgentId: 10000, // Start high to distinguish from initial city agents
    nextDeliveryId: 1,
    nameCounters: {
      shop: 0,
      pub: 0,
      boutique: 0,
      apartment: 0,
      office: 0,
      laboratory: 0,
    },
  };
}
