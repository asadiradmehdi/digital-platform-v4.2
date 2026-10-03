import { StatusBadge } from './StatusBadge';
import { BidiText } from './BidiText';

export function OrderRow({ name, status, amount, code }: { name:string; status:'success'|'warning'; amount:string; code:string }) {
  const statusText = status === 'success' ? 'تکمیل شده' : 'در حال پردازش';
  return <div className="order-row">
    <div className="order-main"><b>{name}</b><small>امروز · <BidiText direction="ltr" className="order-code">{code}</BidiText></small></div>
    <StatusBadge status={status}>{statusText}</StatusBadge>
    <strong className="money-value"><BidiText direction="ltr" className="money-number">{amount}</BidiText> <small>تومان</small></strong>
  </div>;
}
