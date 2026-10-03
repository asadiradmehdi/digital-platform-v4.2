import type { ReactNode } from 'react';

type Status = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export function StatusBadge({ status, children }: { status: Status; children: ReactNode }) {
  return <span className={`status-badge status-${status}`}>{children}</span>;
}
