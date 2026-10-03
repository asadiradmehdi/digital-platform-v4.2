import { AppError } from './errors';

type Bucket={count:number;resetAt:number};
const memory=new Map<string,Bucket>();
export type RateLimitDecision={allowed:boolean;remaining:number;resetAt:number};
export function memoryRateLimit(key:string,limit:number,windowMs:number):RateLimitDecision{const now=Date.now();const current=memory.get(key);if(!current||current.resetAt<=now){const bucket={count:1,resetAt:now+windowMs};memory.set(key,bucket);return {allowed:true,remaining:limit-1,resetAt:bucket.resetAt};}if(current.count>=limit)return {allowed:false,remaining:0,resetAt:current.resetAt};current.count+=1;return {allowed:true,remaining:limit-current.count,resetAt:current.resetAt};}
export function assertRateLimit(decision:RateLimitDecision){if(!decision.allowed)throw new AppError('RATE_LIMITED','Rate limit exceeded.',{resetAt:decision.resetAt});}
