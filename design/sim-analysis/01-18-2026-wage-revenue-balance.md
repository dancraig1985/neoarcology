# Wage/Revenue Balance Analysis

## Current Economic Configuration

### Prices
| Good | Retail Price | Wholesale Price | Margin | Margin % |
|------|--------------|-----------------|--------|----------|
| **Provisions** | 20 | 3 | 17 | 567% |
| **Alcohol** | 25 | 5 | 20 | 400% |
| **Luxury Goods** | 200 | 120 | 80 | 67% |
| **Data Storage** | - | 50 | - | B2B |

### Salaries (Weekly)
| Tier | Range | Average |
|------|-------|---------|
| **Unskilled** | 70-90 | 80 |
| **Skilled** | 90-110 | 100 |
| **Professional** | 120-160 | 140 |

### Owner Dividend
- **75 credits/week** (paid to business owner from org wallet)

### Operating Costs
- **Most locations: 0 credits/week**
- **Depot only: 50 credits/week**

---

## Break-Even Analysis by Business Type

### 1. Retail Shop (Provisions)
**Configuration:**
- 1 employee (unskilled, 80 credits/week avg)
- Starting inventory: 15 provisions
- Capacity: 40 provisions
- Buys provisions at 3 credits, sells at 20 credits (17 credit margin)

**Weekly Costs:**
- Employee salary: 80 credits
- Owner dividend: 75 credits
- **Total: 155 credits/week**

**Break-even sales:**
- Need: 155 credits revenue
- Per sale: 17 credit margin
- **Requires: 9.1 sales/week** (155 / 17)

**Reality check:**
- Average: 12.3 retail sales/week across ~40 shops
- Per shop: 12.3 / 40 = **0.31 sales/week per shop** ❌

**PROBLEM: Shops need 9 sales/week but only get 0.3 sales/week!**

### 2. Pub (Alcohol)
**Configuration:**
- 1 employee (unskilled, 80 credits/week avg)
- Capacity: 40 drinks
- Buys alcohol at 5 credits, sells at 25 credits (20 credit margin)

**Weekly Costs:**
- Employee salary: 80 credits
- Owner dividend: 75 credits
- **Total: 155 credits/week**

**Break-even sales:**
- Need: 155 credits revenue
- Per sale: 20 credit margin
- **Requires: 7.75 sales/week** (155 / 20)

**Reality check:**
- Very few alcohol sales observed in logs (leisure is optional)
- **PROBLEM: Similar to provisions, insufficient demand**

### 3. Luxury Boutique
**Configuration:**
- 1 employee (skilled, 100 credits/week avg)
- Capacity: ~20 items
- Buys luxury goods at 120 credits, sells at 200 credits (80 credit margin)

**Weekly Costs:**
- Employee salary: 100 credits
- Owner dividend: 75 credits
- **Total: 175 credits/week**

**Break-even sales:**
- Need: 175 credits revenue
- Per sale: 80 credit margin
- **Requires: 2.2 sales/week** (175 / 80)

**Reality check:**
- Luxury goods require minCredits: 250 (only rich agents buy)
- Small market, very few sales
- **PROBLEM: High barrier to entry, low demand**

### 4. Provisions Factory (Wholesale)
**Configuration:**
- 4 employees (unskilled, 80 credits/week avg each)
- Production: 4 provisions per cycle (every 2 phases = 224 per week)
- Sells at 3 credits/provision

**Weekly Costs:**
- Employee salaries: 4 × 80 = 320 credits
- Owner dividend: 75 credits
- **Total: 395 credits/week**

**Weekly Revenue:**
- Production: 224 provisions/week
- Price: 3 credits each
- **Revenue: 672 credits/week** (224 × 3)

**Profit:**
- Revenue: 672 credits
- Costs: 395 credits
- **Net: +277 credits/week** ✅

**PROFITABLE!** (if all goods are sold)

### 5. Brewery (Alcohol Factory)
**Configuration:**
- 3 employees (skilled, 100 credits/week avg each)
- Production: 3 alcohol per day (84 per week)
- Sells at 5 credits/alcohol

**Weekly Costs:**
- Employee salaries: 3 × 100 = 300 credits
- Owner dividend: 75 credits
- **Total: 375 credits/week**

**Weekly Revenue:**
- Production: 84 alcohol/week
- Price: 5 credits each
- **Revenue: 420 credits/week** (84 × 5)

**Profit:**
- Revenue: 420 credits
- Costs: 375 credits
- **Net: +45 credits/week** ✅

**BARELY PROFITABLE** (tight margins)

### 6. Luxury Factory
**Configuration:**
- 3 employees (skilled, 100 credits/week avg each)
- Production: 3 luxury goods per 16 phases = 10.5 per week
- Sells at 120 credits/item (wholesale)

**Weekly Costs:**
- Employee salaries: 3 × 100 = 300 credits
- Owner dividend: 75 credits
- **Total: 375 credits/week**

**Weekly Revenue:**
- Production: 10.5 luxury goods/week
- Price: 120 credits each
- **Revenue: 1,260 credits/week** (10.5 × 120)

**Profit:**
- Revenue: 1,260 credits
- Costs: 375 credits
- **Net: +885 credits/week** ✅

**VERY PROFITABLE!**

### 7. Corporate Office (Valuable Data)
**Configuration:**
- 3 employees (skilled, 100 credits/week avg each)
- Production: 3 valuable_data per 16 phases = 10.5 per week
- No revenue (data not sold yet)

**Weekly Costs:**
- Employee salaries: 3 × 100 = 300 credits
- Owner dividend: 75 credits
- **Total: 375 credits/week**

**Weekly Revenue:**
- **0 credits** (no buyer for valuable_data)

**Profit:**
- Revenue: 0 credits
- Costs: 375 credits
- **Net: -375 credits/week** ❌

**UNPROFITABLE!** (money sink, no revenue)

---

## Summary: Where Money Goes

### Money Creation (Weekly)
1. **Retail sales revenue**: ~250 credits/week (12.3 sales × 20 credits avg)
2. **Wholesale sales revenue**: ~350 credits/week (3.5 sales × 100 credits avg)
3. **B2B sales (data_storage)**: minimal
4. **Immigration**: 175 agents × 200-400 starting credits = massive one-time injection

### Money Destruction (Weekly)
1. **Wages paid**: ~1,041 credits/week (73,905 / 71 weeks)
2. **Dividends paid**: ~1,311 credits/week (93,075 / 71 weeks)
3. **Total destruction: 2,352 credits/week**

### Money Balance
- **Creation: ~600 credits/week** (sales)
- **Destruction: 2,352 credits/week** (wages + dividends)
- **Net: -1,752 credits/week** ❌

**MASSIVE DEFICIT!**

The economy only survives because:
1. **Immigration injects ~35,000 credits** (175 agents × 200 avg)
2. **Starting credits** for initial agents
3. **Credit inflation** (money supply grows from immigration faster than destruction)

---

## Root Causes of Employment Churn

### 1. Retail Demand Too Low
- **Shops need 9 sales/week to break even**
- **Shops get 0.3 sales/week on average**
- **30x demand shortfall!**

**Why?**
- 120 agents, ~40 shops = 3 agents per shop
- Agents eat 1 provision every ~2 days (hunger accumulation)
- That's 3.5 provisions/week per agent
- 3 agents × 3.5 = **10.5 provisions/week per shop area**
- But agents teleport to random shops, spreading sales thinly
- Result: Most shops get 0-1 sales, a few get 5+

### 2. Wages Too High Relative to Margins
- **Provisions margin: 17 credits**
- **Employee salary: 80 credits/week**
- **Need 4.7 sales just to pay employee** (80/17)
- **Need 9+ sales to also pay owner**

**Alternative calculation:**
- If salary was 40 credits/week:
  - Break-even: (40 + 75) / 17 = **6.8 sales/week**
  - Still too high, but more achievable

### 3. Too Many Shops
- **40 retail shops** for 120 agents
- **3 agents per shop** on average
- Market is oversaturated
- Competition dilutes sales across too many shops

### 4. No Local Economy
- Agents teleport to random shops
- Distance doesn't matter
- No "neighborhood shop" loyalty
- Sales distributed randomly instead of concentrated

### 5. Factories Profitable, Retail Unprofitable
- **Factories**: Always profitable (high volume, guaranteed wholesale demand)
- **Retail**: Structurally unprofitable (low volume, high fixed costs)
- Result: Factory workers get paid reliably, retail workers don't

### 6. Owner Dividend is Fixed
- **75 credits/week** regardless of revenue
- Even tiny businesses pay full dividend
- Creates cash flow crisis when sales are low

---

## Proposed Solutions (Ordered by Impact)

### HIGH IMPACT (Fix Structural Issues)

#### 1. Reduce Number of Retail Shops (Supply Side)
**Problem:** 40 shops for 120 agents = oversaturation

**Solution:**
- Reduce shop spawning at city generation
- Target: 1 shop per 10 agents (12 shops instead of 40)
- Each shop gets 10 agents instead of 3
- Expected sales: 10 × 0.5 (avg 1 purchase per 2 weeks) = **5 sales/week per shop**
- Still not enough, but 16x improvement

#### 2. Increase Agent Demand (Demand Side)
**Problem:** Agents don't buy enough provisions

**Current:**
- Hunger accumulates ~25% per day (4 phases)
- Agent eats when hunger > 50%
- Result: Eats every ~2 days (56 phases)
- **3.5 provisions/week per agent**

**Solution A: Faster hunger accumulation**
- Increase to 35% per day
- Agent eats every ~1.4 days
- **5 provisions/week per agent**
- 120 agents × 5 = 600 provisions/week demand
- 40 shops = **15 sales/week per shop** ✅

**Solution B: Larger meal size**
- Agent eats 2 provisions instead of 1
- Same frequency (every 2 days)
- **7 provisions/week per agent**
- Doubles demand, hits target

#### 3. Lower Wages (Cost Side)
**Problem:** Wages are too high relative to margins

**Solution:**
- Reduce unskilled wages: 70-90 → **50-70**
- Reduce skilled wages: 90-110 → **70-90**
- New break-even for retail shop:
  - Salary: 60 credits (avg)
  - Dividend: 75 credits (fixed)
  - Total: 135 credits
  - Break-even: 135 / 17 = **8 sales/week** (down from 9.1)

**Risk:** Lower wages → agents can't afford provisions
- Provisions cost 20 credits
- Weekly salary: 60 credits
- Can buy 3 provisions/week (if spending 100% on food)
- But need 3.5 provisions/week
- **Still doesn't work unless demand also increases!**

#### 4. Increase Retail Prices
**Problem:** Low margins per sale

**Solution:**
- Increase provisions retail price: 20 → **30**
- New margin: 30 - 3 = 27 credits
- Break-even: 155 / 27 = **5.7 sales/week** (down from 9.1)

**Downside:** Higher prices reduce affordability
- Agents earning 80 credits can buy fewer provisions
- Could worsen starvation

#### 5. Implement Local Economy (Travel Costs)
**Problem:** Random teleportation spreads sales thinly

**Solution:**
- Agents must travel to shops (costs time)
- Prefer nearby shops to minimize travel
- Creates "neighborhood" clusters
- Concentrates sales at local shops

**Expected effect:**
- Shops near dense housing get more sales
- Shops in remote areas get fewer (may close)
- Natural market equilibrium emerges

#### 6. Scale Owner Dividend to Revenue
**Problem:** Fixed 75 credits/week drains cash even when revenue is low

**Solution:**
- Dividend = min(75, revenue × 0.3)
- Small businesses pay less
- Large businesses pay full dividend
- Creates buffer for bad weeks

**Example:**
- Shop with 5 sales/week: 5 × 17 = 85 credits revenue
- Dividend: min(75, 85 × 0.3) = **25.5 credits**
- Remaining: 85 - 25.5 = **59.5 credits** (covers part of salary)

---

## Recommended Tuning Strategy

### Phase 1: Quick Wins (Immediate)
1. **Reduce shop spawning**: 40 → 15 shops (-62% supply)
2. **Increase hunger rate**: 25% → 35% per day (+40% demand)
3. **Lower unskilled wages**: 70-90 → 50-70 (-25% costs)

**Expected outcome:**
- 15 shops × 8 agents each = reasonable concentration
- 35% hunger = 5 provisions/week demand
- 120 agents × 5 = 600 provisions/week
- 15 shops = **40 provisions/week per shop**
- Margin: 17 credits × 40 = 680 credits/week revenue
- Costs: 60 salary + 75 dividend = 135 credits/week
- **Net: +545 credits/week profit** ✅

### Phase 2: Structural Fixes (Short-term)
4. **Scale dividends to revenue** (prevents cash drain)
5. **Add credit lines** (3-week grace period for unpaid wages)
6. **Add local economy** (travel costs for shopping)

### Phase 3: Market Dynamics (Medium-term)
7. **Dynamic pricing** (shops raise prices when demand is high)
8. **Demand-responsive production** (factories scale to order backlog)
9. **Competition mechanics** (shops near each other compete on price)

---

## Testing the Tuning

After implementing Phase 1 changes, run:
```bash
npm run sim:test -- --ticks 2000 --seed 42
```

**Success metrics:**
- Fires per run: < 500 (down from 2000)
- Shop profitability: > 80% profitable
- Starvation rate: < 5% (down from 60%)
- Employment stability: Workers stay > 10 weeks on average

---

## Conclusion

**The employment churn is caused by structural unprofitability of retail businesses.**

- Shops need 9 sales/week to break even
- Shops get 0.3 sales/week on average
- 30x demand shortfall
- Result: Shops run out of money → can't pay wages → workers quit → death spiral

**Fix requires balancing supply and demand:**
1. Fewer shops (reduce supply)
2. Hungrier agents (increase demand)
3. Lower wages (reduce costs)

This creates a sustainable economy where retail businesses can pay their workers consistently.
