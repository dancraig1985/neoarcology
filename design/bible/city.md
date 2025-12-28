# The City

NeoArcology is a 32x32 grid of city blocks. Each block belongs to a zone and can contain multiple locations at different floors.

## City Grid

The city is divided into **1,024 blocks** (32×32). Each block has:
- **Position**: X and Y coordinates (0-31)
- **Zone**: What type of area it is
- **Max Height**: How tall buildings can be (1-120 floors)

Locations exist within blocks at specific floors. A single block can have a street-level shop, mid-rise apartments, and a penthouse bar.

## Zones

The city is divided into distinct zones, each with its own character:

### Downtown
The gleaming heart of corporate power. Tallest buildings (80-120 floors), brightest lights. Megacorps and executive suites. Small but dense.

### Government
Adjacent to downtown. City services, transit hubs, bureaucratic centers. The machinery that keeps the city running (or claims to).

### Commercial
Rings of commerce spreading from downtown. Shops, offices, entertainment. Where money changes hands.

### Industrial
Clustered in corners away from the center. Factories, warehouses, workshops. Where things get made. Avoided by residential areas.

### Residential
Scattered pockets near commercial zones. Middle-class apartments for those who can afford them. Limited supply in a city that doesn't care about comfort.

### Slums
Everything else. The vast majority of the city. Cheap housing, informal markets, forgotten corners. Where most people actually live in this dystopia.

## City Generation

Cities grow organically, not in perfect rings:

1. **Downtown seeds** near (but not exactly at) the center
2. **Government** attaches to downtown's edge
3. **Commercial** spreads outward from downtown and government
4. **Industrial** clusters in random corners, away from the center
5. **Slums** fill the edges, opposite industrial
6. **Residential** grows in small pockets from commercial edges
7. **Remaining gaps** become more slums

Each generation is unique. Downtown might drift north, industrial might claim two corners, slums might dominate the west side.

## Zone Sizes

Zones have target sizes (configurable in `city.json`):

| Zone | Typical Size | Notes |
|------|--------------|-------|
| Downtown | 40-60 blocks | Small, dense core |
| Government | 5-10 blocks | Tiny cluster |
| Commercial | 60-100 blocks | Medium spread |
| Industrial | 80-120 blocks | Corner clusters |
| Residential | 30-60 blocks | Limited pockets |
| Slums | 200-300+ blocks | Fills everything else |

## Location Placement

Locations spawn based on constraints defined in their templates:

### Zone Restrictions
- Factories only in industrial zones
- Luxury apartments only in downtown/commercial
- Shelters only in slums/industrial

### Floor Preferences
- Retail shops prefer ground floor
- Luxury apartments prefer high floors
- Factories stay low (floors 0-5)

### Limits
- Some location types have maximum counts per city
- Minimum distances can separate competing businesses

## Travel

Distance matters in NeoArcology:

### Calculation
Distance is primarily horizontal (grid distance) with a small vertical component (floor differences).

### Travel Time
Using public transit (the default):
- **0 phases**: Up to 15 blocks
- **1 phase**: 16-30 blocks
- **2 phases**: 31+ blocks (edge to edge)

Walking is slower. Future vehicles will be faster.

## Heights

Building heights vary by zone and add visual variety:

| Zone | Height Range | Character |
|------|--------------|-----------|
| Downtown | 80-120 floors | Towering megastructures |
| Commercial | 20-60 floors | Mixed-use towers |
| Industrial | 5-20 floors | Low, sprawling facilities |
| Residential | 10-40 floors | Apartment blocks |
| Slums | 5-30 floors | Cramped, irregular |
| Government | 10-30 floors | Imposing but not tall |

Within zones, heights vary based on noise - some blocks taller, some shorter, creating an organic skyline.

## Initial Population

When a city is generated, it comes pre-populated with agents, organizations, and locations to bootstrap the economy.

### Agents (12-15)

Citizens are created with randomized attributes:
- **Credits**: 50-200 (personal savings)
- **Provisions**: 2-8 (food stockpile)
- **Hunger**: 10-30% (starting hunger level)
- **Stats**: Randomized 20-60 for each of the 6 stats
- **Morale**: 20-80%

### Corporations (2-3)

Large businesses that own factories:
- **Leader**: First few agents become corporate leaders
- **Starting Capital**: 2,000-5,000 credits
- **Assets**: 1 factory each, placed in industrial zones
- Leader is marked as employed by their corporation

### Retail Shops (3-4)

Small businesses owned by micro-orgs:
- **Owner**: Next available agents become shop owners
- **Starting Capital**: 300-600 credits
- **Placement**: Commercial, downtown, or residential zones
- **Starting Inventory**: From template (usually ~20 provisions)

### Restaurants (2-3)

Food service businesses, also micro-orgs:
- **Owner**: Next available agents
- **Starting Capital**: 200-400 credits
- **Placement**: Commercial or downtown zones
- **Starting Inventory**: From template

### Empty Employee Slots

Locations start with **no workers hired**. Employee slots are empty at generation time. The simulation's natural hiring process fills positions as unemployed agents seek jobs (see [Economy - Hiring](economy.md#hiring)).

This means:
- Factories produce nothing on turn 1 (no workers)
- By turn 2-3, agents get hired and production begins
- The economy bootstraps itself organically

### The Result

A typical starting city has:
- ~12-15 agents (some owners, most unemployed and job-seeking)
- ~7-10 organizations (2-3 corps + micro-orgs for shops/restaurants)
- ~7-10 locations (factories, shops, restaurants)
- All employee slots empty, waiting to be filled

The economy doesn't function on turn 1 - it needs a few phases for workers to find jobs. This is intentional: the simulation bootstraps itself rather than starting in an artificial "perfect" state.

## The Map

The Observer UI shows the city map with:
- **Zone colors**: Each zone type has a distinct color
- **Brightness**: Taller areas appear brighter
- **Location markers**: Dots showing where businesses and homes are

The map is read-only - it shows what exists, not what you can change.
