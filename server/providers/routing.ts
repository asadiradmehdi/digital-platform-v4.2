import { AppError } from '../core/errors';

export type ProviderCandidate = {
  providerId:string; providerType:string; successRate:number; refundRate:number; latencyMs:number; qualityScore:number;
  costMinor:number; balanceHealthy:boolean; available:boolean;
};
export type RoutingWeights = { quality:number; reliability:number; latency:number; cost:number; refund:number };

export function scoreProvider(c:ProviderCandidate,w:RoutingWeights={quality:.25,reliability:.3,latency:.15,cost:.2,refund:.1}) {
  if (!c.available || !c.balanceHealthy) return Number.NEGATIVE_INFINITY;
  const latencyScore = 1 / Math.max(1,c.latencyMs);
  const costScore = 1 / Math.max(1,c.costMinor);
  return c.qualityScore*w.quality + c.successRate*w.reliability + latencyScore*w.latency + costScore*w.cost + (1-c.refundRate)*w.refund;
}

export function chooseProvider(candidates:ProviderCandidate[], weights?:RoutingWeights) {
  if (!candidates.length) throw new AppError('UNAVAILABLE','No provider candidates are available.');
  return [...candidates].sort((a,b)=>scoreProvider(b,weights)-scoreProvider(a,weights))[0];
}
