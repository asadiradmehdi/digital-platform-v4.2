import type { ReactNode } from 'react';
export function SectionHeader({ title, description, action }: { title:string; description?:string; action?:ReactNode }) {
  return <div className="section-header"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>;
}
