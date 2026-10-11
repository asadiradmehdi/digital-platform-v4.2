// Native counterpart of app/zohal.css: font families, RTL helpers and shared surface styles.
// Colours come only from packages/design-tokens so web and app stay in parity.
import { I18nManager, Platform } from 'react-native';
import { tokens } from '@digital-platform/design-tokens';

export const C = tokens.colors;
export const G = tokens.gradients;

/** Custom fonts must be selected per weight on Android (fontWeight does not pick a face). */
export const F = {
  r: 'Vazirmatn_400Regular',
  m: 'Vazirmatn_500Medium',
  sb: 'Vazirmatn_600SemiBold',
  b: 'Vazirmatn_700Bold',
  /** Headings use the same family as the UI (one calm type system, same as the web). */
  d: 'Vazirmatn_700Bold',
  /** Display face (Lalezar): big headings and the loyalty level only, so the body stays calm and readable. */
  dx: 'Lalezar_400Regular',
  /** Logotype face, for the «زُحل پی» wordmark only. Its digits are Arabic-style. */
  brand: 'Kufam_800ExtraBold',
  /** The empty-balance «صفر» keeps the face Ali approved earlier (IBM Plex Sans Arabic bold). */
  zero: 'IBMPlexSansArabic_700Bold',
} as const;

/**
 * The UI is Persian-first. Layout must read right-to-left whether or not the OS put the app in RTL
 * mode (Expo Go, or a device in an LTR language), so rows and edges are resolved from I18nManager.
 */
export const RTL = I18nManager.isRTL;
/** Row whose first child sits on the right. */
export const row = (RTL ? 'row' : 'row-reverse') as 'row' | 'row-reverse';
/** Cross-axis value that means "right edge" in a column. */
export const right = (RTL ? 'flex-start' : 'flex-end') as 'flex-start' | 'flex-end';
/** textAlign value that renders on the right (RN mirrors left/right under RTL). */
export const tRight = (RTL ? 'left' : 'right') as 'left' | 'right';
/** Physical left/right offsets for absolutely positioned decorations. */
export const atRight = (v: number) => (RTL ? { left: v } : { right: v });
export const atLeft = (v: number) => (RTL ? { right: v } : { left: v });
/** Rounded physical-left corners (RN swaps left/right radii under RTL as well). */
export const leftRadii = (r: number) => (RTL ? { borderTopRightRadius: r, borderBottomRightRadius: r } : { borderTopLeftRadius: r, borderBottomLeftRadius: r });
/** Glyphs that point "forward" in RTL (towards the left) and "back" (towards the right). */
export const fwd = 'chevL' as const;
export const back = 'chevR' as const;

export const shadow = (y: number, blur: number, opacity: number, color = '#3c2d0f') =>
  Platform.select({
    ios: { shadowColor: color, shadowOpacity: opacity, shadowRadius: blur / 2, shadowOffset: { width: 0, height: y } },
    default: { elevation: Math.max(1, Math.round(blur / 5)), shadowColor: color },
  });

export const card = {
  backgroundColor: C.surface,
  borderWidth: 1,
  borderColor: C.line,
  ...shadow(3, 14, 0.08),
};

export const faNum = (n: number) => new Intl.NumberFormat('fa-IR').format(n);
