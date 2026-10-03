export type RetryDecision={retry:boolean;delayMs:number;reason:string};
export function providerRetryDecision(input:{attempt:number;maxAttempts:number;transportFailed:boolean;externalOrderCreatedUnknown:boolean}) : RetryDecision {
  if(input.externalOrderCreatedUnknown)return {retry:false,delayMs:0,reason:'external-order-state-unknown'};
  if(!input.transportFailed||input.attempt>=input.maxAttempts)return {retry:false,delayMs:0,reason:'not-retryable'};
  const delayMs=Math.min(30_000,500*Math.pow(2,input.attempt));
  return {retry:true,delayMs,reason:'transient-transport-failure'};
}
