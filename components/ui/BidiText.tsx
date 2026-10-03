import type { HTMLAttributes, ReactNode } from 'react';

type BidiTextProps = Omit<HTMLAttributes<HTMLSpanElement>, 'dir'> & {
  children: ReactNode;
  direction?: 'rtl' | 'ltr';
  language?: 'fa' | 'en';
};

/**
 * Explicitly isolates mixed-direction content so Persian UI text cannot reorder
 * IDs, model names, URLs, currency tokens, or Latin product names.
 */
export function BidiText({ children, direction = 'rtl', language, className = '', ...props }: BidiTextProps) {
  const classes = [direction === 'ltr' ? 'text-ltr' : 'text-rtl', className].filter(Boolean).join(' ');
  return <span className={classes} dir={direction} lang={language} {...props}>{children}</span>;
}

export function NumericText({ children, className = '', ...props }: Omit<BidiTextProps, 'direction'>) {
  return <BidiText direction="ltr" className={`numeric-text ${className}`.trim()} {...props}>{children}</BidiText>;
}
