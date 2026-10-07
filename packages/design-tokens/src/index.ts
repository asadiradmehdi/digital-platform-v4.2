/** ZOHALPAY Design Tokens — single source of truth for Web + Mobile */

export const tokens = {
  colors: {
    /** Page canvas — creates depth behind surfaces */
    bg: '#F4F5F9',
    bgElevated: '#FFFFFF',

    /** Surface hierarchy — 4 levels of depth */
    surface: '#FFFFFF',
    surface2: '#EFF0F5',
    surface3: '#E6E8EF',
    surface4: '#DDE0E9',

    /** Typography — near-black with blue undertone */
    ink: '#0C1224',
    ink2: '#28304A',
    muted: '#566079',
    subtle: '#8B95AD',

    /** Borders */
    line: 'rgba(0,0,0,0.07)',
    lineStrong: 'rgba(0,0,0,0.12)',

    /** ZOHALPAY brand — distinctive sovereign blue */
    accent: '#1640D6',
    accentStrong: '#1230B8',
    accentHover: '#153CC8',
    accentSoft: 'rgba(22,64,214,0.07)',
    accentGlow: 'rgba(22,64,214,0.16)',

    /** Semantic */
    success: '#059669',
    successSoft: 'rgba(5,150,105,0.08)',
    warning: '#D97706',
    warningSoft: 'rgba(217,119,6,0.08)',
    danger: '#DC2626',
    dangerSoft: 'rgba(220,38,38,0.08)',
    info: '#0284C7',
    infoSoft: 'rgba(2,132,199,0.08)',
  },

  radius: {
    xs: 6,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 22,
    xxl: 32,
    pill: 999,
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 48,
    page: 40,
  },

  typography: {
    fa: '"Vazirmatn","IRANSansX","IRANSans","Segoe UI",Tahoma,Arial,sans-serif',
    latin: '"Inter","Segoe UI",Arial,sans-serif',
    displaySize: 64,
    heroSize: 52,
    h1Size: 36,
    h2Size: 24,
    h3Size: 18,
    bodySize: 14,
    smallSize: 12,
    captionSize: 11,
    displayWeight: 800,
    headingWeight: 700,
    bodyWeight: 400,
    labelWeight: 600,
  },

  motion: {
    fast: 120,
    normal: 180,
    slow: 300,
  },

  elevation: {
    xs: '0 1px 2px rgba(0,0,0,0.04)',
    sm: '0 1px 3px rgba(0,0,0,0.04),0 4px 10px rgba(0,0,0,0.05)',
    md: '0 2px 4px rgba(0,0,0,0.04),0 8px 24px rgba(0,0,0,0.07)',
    lg: '0 4px 8px rgba(0,0,0,0.05),0 20px 48px rgba(0,0,0,0.10)',
    brand: '0 4px 16px rgba(22,64,214,0.25)',
    /** Legacy aliases */
    card: '0 2px 4px rgba(0,0,0,0.04),0 8px 24px rgba(0,0,0,0.07)',
    floating: '0 1px 3px rgba(0,0,0,0.04),0 4px 10px rgba(0,0,0,0.05)',
  },
} as const;

export type DesignTokens = typeof tokens;
