/** ZOHALPAY Design Tokens — single source of truth for Web + Mobile */

export const tokens = {
  colors: {
    /** Page canvas — illuminated-manuscript paper */
    bg: '#F7F3EA',
    bgElevated: '#FFFDF8',

    /** Surface hierarchy — 4 levels of depth */
    surface: '#FFFDF8',
    surface2: '#F1EBDD',
    surface3: '#E9E1CF',
    surface4: '#DED4BE',

    /** Typography — lapis-black */
    ink: '#0C1638',
    ink2: '#38405F',
    muted: '#6C6757',
    subtle: '#958F7E',

    /** Borders */
    line: '#E6DCCB',
    lineStrong: '#D6C9B2',

    /** ZOHALPAY brand — lapis enamel (لاجورد) */
    accent: '#16348A',
    accentStrong: '#0B1B52',
    accentHover: '#1C3F9E',
    accentSoft: 'rgba(22,52,138,0.07)',
    accentGlow: 'rgba(22,52,138,0.16)',
    lapis1: '#2148A6',
    lapis2: '#16348A',
    lapis3: '#0B1B52',

    /** Illumination gold ramp (طلای تذهیب) — gold0 lightest … gold4 bronze */
    gold0: '#FDF1D2',
    gold1: '#F2D390',
    gold2: '#D6A54C',
    gold3: '#A8762A',
    gold4: '#7A5218',
    goldText: '#8F6118',
    onGold: '#1D1404',
    rim: 'rgba(242,211,144,0.42)',

    /** Turquoise (فیروزه) and vermilion (شنگرف) */
    turquoise: '#12A39A',
    turquoiseInk: '#0B7A73',
    turquoiseSoft: '#DCF2EE',
    vermilion: '#C0392B',

    /** Semantic */
    success: '#0B7A73',
    successSoft: '#DCF2EE',
    warning: '#8A5F17',
    warningSoft: '#F6EBD2',
    danger: '#C0392B',
    dangerSoft: 'rgba(192,57,43,0.08)',
    info: '#2148A6',
    infoSoft: 'rgba(33,72,166,0.08)',
  },

  /** Gradient stops (web: linear-gradient; native: expo-linear-gradient or layered views) */
  gradients: {
    enamel: ['#2148A6', '#16348A', '#0B1B52'],
    metal: ['#FDF0CF', '#EFCD86', '#CF9B44', '#E8C478', '#F8E6B6'],
    goldLight: ['#FBEFD2', '#F1D699', '#DCAE5B'],
    turquoiseLapis: ['#14858A', '#0F4F78', '#0B1B52'],
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
