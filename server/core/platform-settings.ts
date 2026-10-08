// Platform-level settings (not tenant data): provider configuration that the future admin app edits.
// Non-secret configuration is stored as JSON; secrets only as AES-256-GCM ciphertext (secret-box,
// SECRETS_MASTER_KEY). Reads are cached briefly so a sign-in does not hit the table on every request.
import { query } from './db';
import { decryptSecret, encryptSecret } from './secret-box';
import { writeAudit } from './audit';

export type PlatformSetting<V, S> = { value: V | null; secret: S | null; updatedAt: string | null };

const CACHE_MS = 30_000;
const cache = new Map<string, { at: number; row: { value: unknown; secret_ciphertext: string | null; updated_at: string } | null }>();

async function readRow(key: string) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.row;
  const r = await query<{ value: unknown; secret_ciphertext: string | null; updated_at: string }>(
    `SELECT value, secret_ciphertext, updated_at FROM platform_settings WHERE key=$1`, [key],
  );
  const row = r.rows[0] ?? null;
  cache.set(key, { at: Date.now(), row });
  return row;
}

export async function getPlatformSetting<V = Record<string, unknown>, S = Record<string, string>>(key: string): Promise<PlatformSetting<V, S>> {
  let row: Awaited<ReturnType<typeof readRow>>;
  try { row = await readRow(key); } catch { return { value: null, secret: null, updatedAt: null }; }
  if (!row) return { value: null, secret: null, updatedAt: null };
  let secret: S | null = null;
  if (row.secret_ciphertext) {
    try { secret = JSON.parse(decryptSecret(row.secret_ciphertext)) as S; }
    catch { secret = null; } // wrong/rotated master key: treat as unconfigured rather than crash sign-in
  }
  return { value: (row.value ?? null) as V | null, secret, updatedAt: row.updated_at };
}

/**
 * Server-side setter for the admin app (no HTTP endpoint yet). `secret: undefined` keeps the stored secret,
 * `secret: null` clears it. The audit row records which keys changed, never the values.
 */
export async function setPlatformSetting<V, S>(key: string, input: { value: V; secret?: S | null }, actorUserId: string) {
  if (!/^[a-z][a-z0-9_.]{1,63}$/.test(key)) throw new Error('Invalid platform setting key.');
  const ciphertext = input.secret === undefined ? undefined : input.secret === null ? null : encryptSecret(JSON.stringify(input.secret));
  await query(
    `INSERT INTO platform_settings(key, value, secret_ciphertext, updated_at, updated_by)
     VALUES($1,$2,$3,now(),$4)
     ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,
       secret_ciphertext=CASE WHEN $5 THEN EXCLUDED.secret_ciphertext ELSE platform_settings.secret_ciphertext END,
       updated_at=now(), updated_by=EXCLUDED.updated_by`,
    [key, JSON.stringify(input.value ?? {}), ciphertext ?? null, actorUserId, ciphertext !== undefined],
  );
  cache.delete(key);
  await writeAudit({
    actorUserId, action: 'PLATFORM_SETTING_UPDATED', entityType: 'platform_setting', entityId: undefined,
    metadata: { key, secretChanged: ciphertext !== undefined, valueKeys: Object.keys((input.value ?? {}) as object) },
  });
}

export function clearPlatformSettingsCache() { cache.clear(); }
