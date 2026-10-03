import { createHash } from 'node:crypto';
import { createSession, revokeSession } from './sessions';
export type MobilePlatform = 'IOS' | 'ANDROID';
export function hashDeviceId(deviceId: string) { return createHash('sha256').update(deviceId).digest('hex'); }
export async function createMobileSession(input: { userId: string; platform: MobilePlatform; deviceId: string; deviceName?: string; platformVersion?: string; ip?: string; userAgent?: string; ttlSeconds?: number }) {
  const deviceIdHash = hashDeviceId(input.deviceId);
  const token = await createSession(input.userId, input.ttlSeconds, { clientType: input.platform, deviceIdHash, deviceName: input.deviceName, platformVersion: input.platformVersion, lastIp: input.ip, lastUserAgent: input.userAgent });
  return { token, deviceIdHash };
}
export async function revokeMobileSession(token: string) { await revokeSession(token); }
