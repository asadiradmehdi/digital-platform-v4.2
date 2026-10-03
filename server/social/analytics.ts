import { query } from '../core/db';
import { AppError } from '../core/errors';
import { decryptSecret } from '../core/secret-box';
import { createChannelAdapter } from './adapter-registry';
import type { ChannelType } from './contracts';
import { randomUUID } from 'node:crypto';

export async function ingestChannelAnalytics(channelId: string, workspaceId: string): Promise<Record<string, number>> {
  const r = await query<{ channel_type: string; access_token_ciphertext: string | null }>(
    `SELECT c.channel_type, cc.access_token_ciphertext
     FROM channels c
     LEFT JOIN channel_connections cc ON cc.channel_id = c.id
     WHERE c.id=$1 AND c.workspace_id=$2
     ORDER BY cc.created_at DESC LIMIT 1`,
    [channelId, workspaceId]
  );
  const row = r.rows[0];
  if (!row) throw new AppError('NOT_FOUND', 'Channel not found.');

  const creds: Record<string, string> = {};
  if (row.access_token_ciphertext) creds.access_token = decryptSecret(row.access_token_ciphertext);

  const adapter = createChannelAdapter(row.channel_type as ChannelType, creds);
  if (!adapter.analytics) throw new AppError('UNAVAILABLE', 'This channel does not support analytics.');

  const data = await adapter.analytics({ workspaceId, channelId, correlationId: randomUUID(), idempotencyKey: `analytics:${channelId}:${Date.now()}` });

  await query(
    `INSERT INTO social_analytics_snapshots(channel_id, captured_at, metrics)
     VALUES($1, now(), $2)
     ON CONFLICT(channel_id, captured_at) DO UPDATE SET metrics=$2`,
    [channelId, data]
  );

  return data;
}

export async function getAnalyticsSummary(channelId: string, workspaceId: string, limit = 30) {
  const r = await query(
    `SELECT sa.captured_at, sa.data
     FROM social_analytics_snapshots sa
     JOIN channels c ON c.id = sa.channel_id
     WHERE sa.channel_id=$1 AND c.workspace_id=$2
     ORDER BY sa.captured_at DESC LIMIT $3`,
    [channelId, workspaceId, limit]
  );
  return r.rows.map(row => ({ capturedAt: (row as { captured_at: string }).captured_at, metrics: (row as { metrics: unknown }).metrics }));
}
