import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Card } from './Card';
import { BidiText } from './BidiText';

export function StatCard({ title, value, suffix, action, icon, valueDir='auto' }: { title: string; value: string; suffix?: string; action?: string; icon?: ReactNode; valueDir?: 'rtl'|'ltr'|'auto' }) {
  return <Card className="stat-card">
    <div className="stat-top"><span>{title}</span><span className="stat-icon">{icon}</span></div>
    <div className="stat-value">
      <BidiText direction={valueDir === 'auto' ? 'ltr' : valueDir} className="stat-value-token">{value}</BidiText>
      {suffix && <span className="stat-suffix">{suffix}</span>}
    </div>
    {action && <button type="button" className="text-action">{action}<ArrowLeft size={14}/></button>}
  </Card>;
}
