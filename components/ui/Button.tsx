import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
};

export function Button({ variant='primary', size='md', icon, className='', children, ...props }: ButtonProps) {
  return <button className={`ui-button ui-button-${variant} ui-button-${size} ${className}`.trim()} {...props}>
    {icon}<span>{children}</span>
  </button>;
}
