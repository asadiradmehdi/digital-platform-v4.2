import { query } from '../core/db';
import type { Job, JobQueue } from './contracts';

export class DbJobQueue implements JobQueue {
  async enqueue<T>(type: string, payload: T, options?: { delayMs?: number; dedupeKey?: string }): Promise<string> {
    const availableAt = options?.delayMs
      ? new Date(Date.now() + options.delayMs).toISOString()
      : new Date().toISOString();
    const r = await query<{ id: string }>(
      `INSERT INTO jobs(type, payload, dedupe_key, available_at)
       VALUES($1,$2,$3,$4)
       ON CONFLICT(dedupe_key) DO NOTHING
       RETURNING id`,
      [type, payload, options?.dedupeKey ?? null, availableAt]
    );
    return r.rows[0]?.id ?? '';
  }

  async dequeue<T>(types?: string[]): Promise<Job<T> | null> {
    const typeFilter = types?.length
      ? `AND type = ANY($2::text[])`
      : '';
    const params = types?.length ? [1, types] : [1];
    const r = await query<{ id: string; type: string; payload: T; attempt: number; available_at: string }>(
      `UPDATE jobs SET status='PROCESSING', started_at=now(), attempt=attempt+1, updated_at=now()
       WHERE id = (
         SELECT id FROM jobs
         WHERE status IN ('PENDING','FAILED') AND available_at <= now() ${typeFilter}
         ORDER BY available_at
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, type, payload, attempt, available_at`,
      params
    );
    if (!r.rows[0]) return null;
    return {
      id: r.rows[0].id,
      type: r.rows[0].type,
      payload: r.rows[0].payload,
      attempt: r.rows[0].attempt,
      availableAt: r.rows[0].available_at,
    };
  }

  async ack(jobId: string): Promise<void> {
    await query(
      `UPDATE jobs SET status='DONE', completed_at=now(), updated_at=now() WHERE id=$1`,
      [jobId]
    );
  }

  async fail(jobId: string, error: string, retryAt?: string): Promise<void> {
    await query(
      `UPDATE jobs SET
         status = CASE WHEN attempt >= max_attempts THEN 'FAILED' ELSE 'PENDING' END,
         last_error = $2,
         available_at = COALESCE($3::timestamptz, now() + interval '60 seconds'),
         updated_at = now()
       WHERE id = $1`,
      [jobId, error.slice(0, 2000), retryAt ?? null]
    );
  }
}

export const jobQueue = new DbJobQueue();
