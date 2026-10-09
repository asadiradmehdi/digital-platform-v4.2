/** ZOHALPAY Design Tokens — single source of truth for Web + Mobile */

export const tokens = {
  colors: {
    /** Page canvas — illuminated-manuscript paper */
    bg: '#F5F0E6',
    bgElevated: '#FFFCF6',

    /** Surface hierarchy — 4 levels of depth */
    surface: '#FFFCF6',
    surface2: '#EFE9DC',
    surface3: '#E6DECD',
    surface4: '#DACFB9',

    /** Typography — lapis-black */
    ink: '#0B1233',
    ink2: '#3A3F5C',
    muted: '#5F6378',
    subtle: '#8D90A0',

    /** Borders */
    line: '#E3DACA',
    lineStrong: '#D3C7B1',

    /** ZOHALPAY brand — lapis enamel (لاجورد) */
    accent: '#142257',
    accentStrong: '#0A1238',
    accentHover: '#1B2D6E',
    accentSoft: 'rgba(20,34,87,0.07)',
    accentGlow: 'rgba(20,34,87,0.16)',
    lapis1: '#22397F',
    lapis2: '#142257',
    lapis3: '#0A1238',

    /** Illumination gold ramp (طلای تذهیب) — gold0 lightest … gold4 bronze */
    gold0: '#FDF1D2',
    gold1: '#F2D390',
    gold2: '#D4A24C',
    gold3: '#A8762A',
    gold4: '#7A5218',
    goldText: '#8F6118',
    onGold: '#1D1404',
    rim: 'rgba(242,211,144,0.42)',

    /** Turquoise (فیروزه): the fourth and last brand colour, for success/done states only. */
    turquoise: '#169A8C',
    turquoiseInk: '#0E7569',
    turquoiseSoft: '#DDF1EC',
    /** Unread/attention dots use gold now; kept as an alias so old call sites stay on-palette. */
    vermilion: '#D4A24C',

    /** Semantic */
    success: '#0E7569',
    successSoft: '#DDF1EC',
    warning: '#8A5F17',
    warningSoft: '#F6EBD2',
    danger: '#C0392B',
    dangerSoft: 'rgba(192,57,43,0.08)',
    info: '#142257',
    infoSoft: 'rgba(20,34,87,0.07)',
  },

  /** Gradient stops (web: linear-gradient; native: expo-linear-gradient or layered views) */
  gradients: {
    enamel: ['#22397F', '#142257', '#0A1238'],
    metal: ['#FDF0CF', '#EFCD86', '#CF9B44', '#E8C478', '#F8E6B6'],
    goldLight: ['#FBEFD2', '#F1D699', '#DCAE5B'],
    turquoiseLapis: ['#1B6F78', '#14315F', '#0A1238'],
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
    /** UI + Persian numerals. Native apps load the same Fontsource files. */
    fa: '"IBM Plex Sans Arabic","Vazirmatn",Tahoma,"Segoe UI",Arial,sans-serif',
    /** Display / wordmark only — Kufam renders Arabic-style digits, never use it for numbers. */
    display: '"Kufam","IBM Plex Sans Arabic",sans-serif',
    latin: '"IBM Plex Sans Arabic","Inter","Segoe UI",Arial,sans-serif',
    /** Brand wordmark: two words, zamme on ز */
    wordmark: 'زُحل پی',
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
    xs: '0 1px 2px rgba(60,45,15,0.04)',
    sm: '0 1px 3px rgba(60,45,15,0.05),0 4px 10px rgba(60,45,15,0.06)',
    md: '0 2px 4px rgba(60,45,15,0.04),0 8px 24px rgba(60,45,15,0.07)',
    lg: '0 4px 8px rgba(60,45,15,0.05),0 20px 48px rgba(60,45,15,0.10)',
    brand: '0 10px 18px -9px rgba(11,27,82,0.42)',
    gold: '0 8px 16px -8px rgba(122,82,24,0.6)',
    /** Legacy aliases */
    card: '0 2px 4px rgba(60,45,15,0.04),0 8px 24px rgba(60,45,15,0.07)',
    floating: '0 1px 3px rgba(60,45,15,0.05),0 4px 10px rgba(60,45,15,0.06)',
  },
} as const;

export type DesignTokens = typeof tokens;

export { ICONS, type IconName } from './icons';
export { BRAND_LOGOS, BRAND_INK, type BrandLogo } from './brand-logos';
