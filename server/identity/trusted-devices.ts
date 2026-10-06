import { createHash, randomBytes } from 'node:crypto';
import { query } from '../core/db';
import { AppError } from '../core/errors';
import { writeAudit } from '../core/audit';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export interface TrustedDevice {
  id: string;
  deviceKeyHash: string;
  deviceName: string | null;
  platform: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  revoked: boolean;
}

/**
 * Registers a new trusted device for a user.
 * The raw device key is never stored — only its SHA-256 hash.
 * Returns the raw device key (to be stored by the client in secure OS storage).
 */
export async function registerTrustedDevice(
  userId: string,
  deviceName: string | null,
  platform: string | null,
): Promise<{ deviceKey: string; deviceId: string }> {
  const raw = randomBytes(32).toString('base64url');
  const keyHash = sha256(raw);

  const r = await query<{ id: string }>(
    `INSERT INTO trusted_devices(user_id, device_key_hash, device_name, platform, last_seen_at)
     VALUES($1,$2,$3,$4,now())
     ON CONFLICT(device_key_hash) DO NOTHING
     RETURNING id`,
    [userId, keyHash, deviceName ?? null, platform ?? null],
  );
  if (!r.rows[0]) throw new AppError('CONFLICT', 'این دستگاه قبلاً ثبت شده است.');

  await writeAudit({ actorUserId: userId, action: 'TRUSTED_DEVICE_REGISTERED', entityType: 'trusted_device', entityId: r.rows[0].id });
  return { deviceKey: raw, deviceId: r.rows[0].id };
}

/** Lists all non-revoked trusted devices for a user. */
export async function listTrustedDevices(userId: string): Promise<TrustedDevice[]> {
  const r = await query<{
    id: string; deviceKeyHash: string; deviceName: string | null;
    platform: string | null; lastSeenAt: string | null; createdAt: string;
  }>(
    `SELECT id,
            device_key_hash AS "deviceKeyHash",
            device_name AS "deviceName",
            platform,
            last_seen_at AS "lastSeenAt",
            created_at AS "createdAt"
     FROM trusted_devices
     WHERE user_id=$1 AND revoked_at IS NULL
     ORDER BY last_seen_at DESC NULLS LAST, created_at DESC`,
    [userId],
  );
  return r.rows.map(row => ({ ...row, revoked: false }));
}

/** Revokes a trusted device by id, scoped to the owning user. */
export async function revokeTrustedDevice(deviceId: string, userId: string): Promise<void> {
  const r = await query(
    `UPDATE trusted_devices SET revoked_at=now()
     WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL`,
    [deviceId, userId],
  );
  if ((r.rowCount ?? 0) === 0) throw new AppError('NOT_FOUND', 'دستگاه مورد نظر یافت نشد.');
  await writeAudit({ actorUserId: userId, action: 'TRUSTED_DEVICE_REVOKED', entityType: 'trusted_device', entityId: deviceId });
}

/**
 * Verifies that a raw device key belongs to a registered, non-revoked device
 * for the given user. Also updates last_seen_at on a hit.
 */
export async function verifyTrustedDevice(userId: string, rawDeviceKey: string): Promise<boolean> {
  const keyHash = sha256(rawDeviceKey);
  const r = await query<{ id: string }>(
    `UPDATE trusted_devices
     SET last_seen_at=now()
     WHERE user_id=$1 AND device_key_hash=$2 AND revoked_at IS NULL
     RETURNING id`,
    [userId, keyHash],
  );
  return (r.rowCount ?? 0) > 0;
}

/** Revokes ALL trusted devices for a user (used after a security event). */
export async function revokeAllTrustedDevices(userId: string): Promise<number> {
  const r = await query(
    `UPDATE trusted_devices SET revoked_at=now()
     WHERE user_id=$1 AND revoked_at IS NULL`,
    [userId],
  );
  const count = r.rowCount ?? 0;
  if (count > 0) {
    await writeAudit({ actorUserId: userId, action: 'ALL_TRUSTED_DEVICES_REVOKED', entityType: 'trusted_device' });
  }
  return count;
}
