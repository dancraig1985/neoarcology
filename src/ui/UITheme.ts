/**
 * UITheme - Colors, spacing, and font constants for cyberpunk terminal aesthetic
 */

export const COLORS = {
  // Backgrounds
  background: 0x0a0a12,       // Deep dark blue-black
  panel: 0x12121f,            // Panel background
  panelHeader: 0x1a1a2e,      // Panel header background
  hover: 0x1a1a2e,            // Hover state
  selected: 0x252538,         // Selected state

  // Borders and accents
  border: 0x00ff88,           // Neon green (primary)
  borderDim: 0x00aa55,        // Dimmed green
  accent: 0xff0066,           // Neon pink (secondary)
  accentAlt: 0x00ccff,        // Cyan (tertiary)

  // Text
  text: 0x00ff88,             // Green text (primary)
  textSecondary: 0xcccccc,    // Gray text
  textDim: 0x666666,          // Dimmed text
  textWarning: 0xffcc00,      // Yellow warning
  textCritical: 0xff0066,     // Pink/red critical
  textInfo: 0x00ccff,         // Cyan info

  // UI elements
  scrollbar: 0x00ff88,
  scrollbarBg: 0x1a1a2e,
  buttonHover: 0x00aa55,
} as const;

export const SPACING = {
  // Padding/margins
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,

  // Panel dimensions
  headerHeight: 50,
  controlsHeight: 50,
  navWidth: 160,
  logHeight: 180,

  // Component sizes
  rowHeight: 28,
  buttonHeight: 32,
  scrollbarWidth: 12,
  borderWidth: 1,
  cornerSize: 10,
} as const;

export const FONTS = {
  // Font family fallback (monospace for terminal feel)
  family: 'monospace',

  // Font sizes
  small: 12,
  body: 14,
  heading: 18,
  title: 24,
} as const;

// Log level colors
export const LOG_LEVEL_COLORS = {
  info: COLORS.textSecondary,
  warning: COLORS.textWarning,
  critical: COLORS.textCritical,
} as const;

// Category icons for activity log
export const CATEGORY_ICONS: Record<string, string> = {
  spawn: '+',
  death: 'X',
  transaction: '$',
  purchase: '>',
  sale: '<',
  commerce: '$',
  production: '*',
  salary: 'S',
  payroll: 'P',
  business: 'B',
  hire: 'H',
  fire: 'F',
  restock: 'R',
  employment: 'E',
  hunger: '!',
  dissolution: 'D',
  dividend: '%',
  wholesale: 'W',
  travel: '>',
} as const;
