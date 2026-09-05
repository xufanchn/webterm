// Global design tokens - single source of truth for UI colors, spacing,
// radii, shadows and font sizes. Adjust values here (or in App.css :root)
// to restyle the whole app. Palette: Tokyo Night.

export const colors = {
  accent: '#7aa2f7',
  accent60: '#7aa2f799',
  accent80: '#7aa2f7cc',
  accentDim: '#7aa2f720',
  accentFaint: '#7aa2f733',
  accentMid: '#7aa2f766',
  accentSoft: '#7aa2f740',
  bg: '#1a1b26',
  bgBar: '#16161e',
  bgDeep: '#16161e',
  bgError: '#2d1b1b',
  bgHeader: '#1f2335',
  bgHover: '#292e42',
  bgInput: '#1f2335',
  bgInputAlt: '#2a2e42',
  bgOverlay: 'rgba(26,27,38,0.88)',
  bgRaised: '#1f2335',
  border: '#3b4261',
  borderSoft: '#292e42',
  danger: '#f44747',
  dangerBg: '#d32f2f',
  dangerBright: '#f7768e',
  dangerSoft: '#f7768e15',
  gray: '#808080',
  info: '#007acc',
  purple: '#bb9af7',
  success: '#4caf50',
  successText: '#6a9955',
  text: '#c0caf5',
  textDim: '#888',
  textFaint: '#666',
  textGray: '#999',
  textLight: '#ccc',
  textMuted: '#565f89',
  textMuted2: '#787e99',
  warning: '#e0af68',
  warningText: '#cca700',
  white: '#fff',
} as const;

export const font = {
  lg: 'var(--f-lg)',
  md: 'var(--f-md)',
  sm: 'var(--f-sm)',
  xl: 'var(--f-xl)',
  xl2: 'var(--f-xl2)',
  xl3: 'var(--f-xl3)',
  xl4: 'var(--f-xl4)',
  xl5: 'var(--f-xl5)',
  xs: 'var(--f-xs)',
  xxs: 'var(--f-xxs)',
} as const;

// Spacing scale — use instead of ad-hoc px values where practical.
export const space = {
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
} as const;

// Corner radii. sm is the default for controls/menus, xl for modals.
export const radius = {
  xs: 3,
  sm: 4,
  md: 6,
  lg: 10,
  xl: 12,
  round: 999,
} as const;

// Elevation. All shadows are on-dark, subtle; menu/overlay add a hairline ring.
export const shadow = {
  sm: '0 2px 8px rgba(0,0,0,0.35)',
  md: '0 4px 16px rgba(0,0,0,0.45)',
  lg: '0 8px 32px rgba(0,0,0,0.5)',
  menu: '0 4px 16px rgba(0,0,0,0.5), 0 0 0 1px var(--c-border)',
  overlay: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px var(--c-border)',
} as const;

export const transition = {
  fast: '0.1s ease',
  normal: '0.15s ease',
} as const;
