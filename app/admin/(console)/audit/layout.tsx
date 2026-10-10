import type { ReactNode } from 'react';
import { Guarded } from '../guard';

export default function SectionLayout({ children }: { children: ReactNode }) {
  return <Guarded any={['audit.view']}>{children}</Guarded>;
}
