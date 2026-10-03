import type { RiskState } from './risk';

export type RiskSignal = { key:string; score:number; reason:string; hardBlock?:boolean };
export type RiskDecision = { state:RiskState; score:number; signals:RiskSignal[] };

export function evaluateRisk(signals:RiskSignal[], thresholds={review:40,restricted:80}):RiskDecision {
  const score = Math.max(0, signals.reduce((sum,s)=>sum + Math.max(0,s.score),0));
  if (signals.some(s=>s.hardBlock)) return {state:'RESTRICTED',score,signals};
  if (score >= thresholds.restricted) return {state:'RESTRICTED',score,signals};
  if (score >= thresholds.review) return {state:'REVIEW',score,signals};
  return {state:'NORMAL',score,signals};
}

export function riskSignalsForCommerce(input:{paymentFailures:number; refunds30d:number; couponAttempts:number; ordersPerMinute:number; aiUsageRatio:number}):RiskSignal[] {
  const signals:RiskSignal[]=[];
  if(input.paymentFailures>=5) signals.push({key:'payment_velocity',score:20,reason:'Repeated payment failures'});
  if(input.refunds30d>=5) signals.push({key:'refund_velocity',score:20,reason:'High refund frequency'});
  if(input.couponAttempts>=20) signals.push({key:'coupon_abuse',score:35,reason:'Unusual coupon activity'});
  if(input.ordersPerMinute>=30) signals.push({key:'order_velocity',score:45,reason:'Unusual order velocity'});
  if(input.aiUsageRatio>=5) signals.push({key:'ai_usage_anomaly',score:30,reason:'AI usage materially exceeds entitlement baseline'});
  return signals;
}
