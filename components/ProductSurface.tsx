import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowUpLeft, Bot, CheckCircle2, ChevronLeft, Clock3, Layers3, LockKeyhole, Sparkles, WalletCards, Workflow, Zap } from 'lucide-react';

export function SurfaceHero({ eyebrow, title, description, primaryHref, primaryLabel, secondaryHref, secondaryLabel }: { eyebrow:string; title:string; description:string; primaryHref?:string; primaryLabel?:string; secondaryHref?:string; secondaryLabel?:string }) {
  return <section className="surface-hero"><div className="surface-hero-orbit"/><div className="surface-hero-copy"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p><div className="surface-hero-actions">{primaryHref&&primaryLabel?<Link className="button primary" href={primaryHref}>{primaryLabel}<ArrowUpLeft size={15}/></Link>:null}{secondaryHref&&secondaryLabel?<Link className="button secondary" href={secondaryHref}>{secondaryLabel}</Link>:null}</div></div><div className="surface-hero-visual"><div className="hero-orb-core"><Sparkles size={22}/></div><div className="hero-float hero-float-a"><Bot size={16}/><span>درگاه هوش مصنوعی</span><b>آماده</b></div><div className="hero-float hero-float-b"><Zap size={16}/><span>اتوماسیون</span><b>فعال</b></div></div></section>
}

export function ProductCard({ icon:Icon, title, description, meta, href }: { icon: typeof Sparkles; title:string; description:string; meta:string; href?:string }) {
  const body=<><div className="product-card-icon"><Icon size={18}/></div><div className="product-card-copy"><div className="product-card-title"><h2>{title}</h2><ArrowUpLeft size={15}/></div><p>{description}</p><span>{meta}</span></div></>;
  return href?<Link className="product-card" href={href}>{body}</Link>:<article className="product-card">{body}</article>;
}

export function InsightPanel({ title, kicker, children }: {title:string;kicker:string;children:ReactNode}) { return <article className="surface-panel insight-panel"><div className="panel-head"><div><span className="panel-kicker">{kicker}</span><h2>{title}</h2></div></div>{children}</article> }


export const productIcons = { ai:Bot, services:Layers3, automation:Workflow, wallet:WalletCards, security:LockKeyhole, success:CheckCircle2, activity:Clock3 };
