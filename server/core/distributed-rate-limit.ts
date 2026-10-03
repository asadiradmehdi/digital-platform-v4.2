import { query } from './db';
import { AppError } from './errors';

export async function consumeDistributedRateLimit(input:{key:string;scope:string;windowSeconds:number;maxRequests:number}) {
  const result = await query<{allowed:boolean;remaining:number;resetAt:Date}>(
    `SELECT allowed, remaining, reset_at AS "resetAt" FROM consume_rate_limit($1,$2,$3,$4)`,
    [input.key,input.scope,input.windowSeconds,input.maxRequests],
  );
  const decision = result.rows[0];
  if (!decision) throw new AppError('INTERNAL_ERROR','Rate limit decision unavailable.');
  if (!decision.allowed) throw new AppError('RATE_LIMITED','Rate limit exceeded.',{resetAt:decision.resetAt});
  return decision;
}
