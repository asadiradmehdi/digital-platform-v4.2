// Web renderer for the shared ZOHALPAY icon set (packages/design-tokens/src/icons.ts).
import { ICONS, type IconName } from '../../packages/design-tokens/src/icons';

export { ICONS, type IconName };

export function ZIcon({ name, className, size }: { name: IconName; className?: string; size?: number }) {
  return (
    <svg
      className={`zp-ico${className ? ` ${className}` : ''}`}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  );
}
