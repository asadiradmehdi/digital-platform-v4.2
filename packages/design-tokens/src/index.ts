export const tokens = {
  colors: {
    bg: '#07080d',
    bgElevated: '#0b0d14',
    surface: '#10131b',
    surface2: '#151924',
    surface3: '#1b202c',
    ink: '#f6f7fb',
    muted: '#969baa',
    subtle: '#686e7e',
    line: '#252a37',
    lineStrong: '#343b4b',
    accent: '#a18aff',
    accentStrong: '#c0b4ff',
    accentSoft: 'rgba(161,138,255,0.12)',
    accentGlow: 'rgba(161,138,255,0.20)',
    success: '#41d39a',
    warning: '#f4bd61',
    danger: '#ff7187',
    info: '#75b8ff',
  },
  radius: { xs: 8, sm: 10, md: 14, lg: 18, xl: 24, pill: 999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  typography: {
    fa: 'Vazirmatn',
    latin: 'Inter',
    displayWeight: 800,
    bodyWeight: 400,
  },
  motion: { fast: 140, normal: 200, slow: 320 },
  elevation: {
    card: '0 12px 32px rgba(0,0,0,0.18)',
    floating: '0 24px 64px rgba(0,0,0,0.28)',
  },
} as const;

export type DesignTokens = typeof tokens;
