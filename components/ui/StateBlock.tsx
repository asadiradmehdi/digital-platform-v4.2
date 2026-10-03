import { AlertCircle, CheckCircle2, Inbox, LoaderCircle, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
export function StateBlock({ mode, title, description, action }: { mode:'loading'|'empty'|'error'|'success'; title:string; description?:string; action?:ReactNode }) {
 const Icon = mode==='loading'?LoaderCircle:mode==='empty'?Inbox:mode==='error'?AlertCircle:CheckCircle2;
 return <div className={`state-block state-${mode}`} role={mode==='error'?'alert':undefined}><Icon size={22} className={mode==='loading'?'spin':''}/><h3>{title}</h3>{description?<p>{description}</p>:null}{action ?? null}</div>;
}
export function RetryAction({ onClick }: { onClick?:()=>void }) { return <button className="button secondary" onClick={onClick}><RefreshCw size={14}/>تلاش دوباره</button>; }
