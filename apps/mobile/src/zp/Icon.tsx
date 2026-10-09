import { memo } from 'react';
import { SvgXml } from 'react-native-svg';
import { ICONS, type IconName } from '@digital-platform/design-tokens';

export type { IconName };

/**
 * Renders the shared icon strings. react-native-svg has no CSS, so the web glyph classes are turned
 * into attributes: .f solid, .d duotone (fill-opacity), .k/.kf cut-outs in the tile colour.
 */
function toXml(name: IconName, color: string, cut: string, duo: number, stroke: number) {
  const body = ICONS[name]
    .replace(/class="f"/g, `fill="${color}" stroke="none"`)
    .replace(/class="d"/g, `fill="${color}" fill-opacity="${duo}" stroke="none"`)
    .replace(/class="kf"/g, `fill="${cut}" stroke="none"`)
    .replace(/class="k"/g, `stroke="${cut}"`);
  return `<svg viewBox="0 0 24 24"><g fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
}

export const Icon = memo(function Icon({ name, size = 24, color = '#0C1638', cut = '#142257', duo = 0.32, stroke = 2 }: {
  name: IconName; size?: number; color?: string; cut?: string; duo?: number; stroke?: number;
}) {
  return <SvgXml xml={toXml(name, color, cut, duo, stroke)} width={size} height={size} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
});
