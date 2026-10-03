import { query } from '../core/db';
import { decryptSecret } from '../core/secret-box';
import { createChannelAdapter } from './adapter-registry';
import type { ChannelType } from './contracts';
import { randomUUID } from 'node:crypto';

async function getChannelCredentials(channelId: string): Promise<Record<string, string>> {
  const r = await query<{ access_token_ciphertext: string | null; refresh_token_ciphertext: string | null }>(
    `SELECT access_token_ciphertext, refresh_token_ciphertext FROM channel_connections WHERE channel_id=$1 ORDER BY created_at DESC LIMIT 1`,
    [channelId]
  );
  const row = r.rows[0];
  if (!row) return {};
  const creds: Record<string, string> = {};
  if (row.access_token_ciphertext) creds.access_token = decryptSecret(row.access_token_ciphertext);
  if (row.refresh_token_ciphertext) creds.refresh_token = decryptSecret(row.refresh_token_ciphertext);
  return creds;
}

export async function discoverChannelCapabilities(channelId: string, workspaceId: string): Promise<Record<string, boolean>> {
  const r = await query<{ channel_type: string }>(
    `SELECT channel_type FROM channels WHERE id=$1 AND workspace_id=$2`,
    [channelId, workspaceId]
  );
  const channelType = r.rows[0]?.channel_type as ChannelType | undefined;
  if (!channelType) return {};

  const credentials = await getChannelCredentials(channelId);
  const adapter = createChannelAdapter(channelType, credentials);
  const capabilities = await adapter.getCapabilities({ workspaceId, channelId, correlationId: randomUUID(), idempotencyKey: `cap:${channelId}` });

  for (const [key, supported] of Object.entries(capabilities)) {
    await query(
      `INSERT INTO channel_capabilities(channel_type, capability_key, supported)
       VALUES($1,$2,$3)
       ON CONFLICT(channel_type, capability_key) DO UPDATE SET supported=$3`,
      [channelType, key, supported]
    );
  }
  return capabilities;
}

export async function getStoredCapabilities(channelType: ChannelType): Promise<Record<string, boolean>> {
  const r = await query<{ capability_key: string; supported: boolean }>(
    `SELECT capability_key, supported FROM channel_capabilities WHERE channel_type=$1`,
    [channelType]
  );
  return Object.fromEntries(r.rows.map(row => [row.capability_key, row.supported]));
}
