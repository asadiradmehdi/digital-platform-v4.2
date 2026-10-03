import { query } from '../core/db';
import { AppError } from '../core/errors';
import { decryptSecret } from '../core/secret-box';
import { createChannelAdapter } from './adapter-registry';
import type { ChannelType } from './contracts';
import { randomUUID } from 'node:crypto';

export type PublishInput = {
  channelId: string;
  workspaceId: string;
  text?: string;
  mediaUrls?: string[];
  idempotencyKey: string;
};

export async function publishToChannel(input: PublishInput): Promise<{ externalId: string }> {
  const r = await query<{ channel_type: string; access_token_ciphertext: string | null }>(
    `SELECT c.channel_type, cc.access_token_ciphertext
     FROM channels c
     LEFT JOIN channel_connections cc ON cc.channel_id = c.id
     WHERE c.id=$1 AND c.workspace_id=$2 AND c.status='CONNECTED'
     ORDER BY cc.created_at DESC LIMIT 1`,
    [input.channelId, input.workspaceId]
  );
  const row = r.rows[0];
  if (!row) throw new AppError('NOT_FOUND', 'Channel not found or not connected.');

  const creds: Record<string, string> = {};
  if (row.access_token_ciphertext) creds.access_token = decryptSecret(row.access_token_ciphertext);

  const adapter = createChannelAdapter(row.channel_type as ChannelType, creds);
  if (!adapter.publish) throw new AppError('UNAVAILABLE', 'This channel does not support publishing.');

  const result = await adapter.publish(
    { text: input.text, mediaUrls: input.mediaUrls },
    { workspaceId: input.workspaceId, channelId: input.channelId, correlationId: randomUUID(), idempotencyKey: input.idempotencyKey }
  );
  return result;
}

export async function schedulePost(input: PublishInput & { scheduledAt: Date }): Promise<string> {
  const r = await query<{ id: string }>(
    `INSERT INTO jobs(type, payload, available_at)
     VALUES('social.publish', $1, $2)
     ON CONFLICT(dedupe_key) DO NOTHING
     RETURNING id`,
    [{ channelId: input.channelId, workspaceId: input.workspaceId, text: input.text, mediaUrls: input.mediaUrls, idempotencyKey: input.idempotencyKey }, input.scheduledAt.toISOString()]
  );
  return r.rows[0]?.id ?? '';
}
