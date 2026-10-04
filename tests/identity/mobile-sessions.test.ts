/**
 * Unit tests for server/identity/mobile-sessions.ts
 * hashDeviceId, createMobileSession, revokeMobileSession
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/identity/sessions', () => ({
  createSession: vi.fn(),
  revokeSession: vi.fn(),
}));

import { createSession, revokeSession } from '../../server/identity/sessions';
import { hashDeviceId, createMobileSession, revokeMobileSession } from '../../server/identity/mobile-sessions';

const mockCreateSession = vi.mocked(createSession);
const mockRevokeSession = vi.mocked(revokeSession);
beforeEach(() => vi.clearAllMocks());

// ─── hashDeviceId ─────────────────────────────────────────────────────────────

describe('hashDeviceId', () => {
  it('returns a 64-character hex string (SHA-256)', () => {
    const hash = hashDeviceId('my-device-id');
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });

  it('is deterministic — same input produces same hash', () => {
    const h1 = hashDeviceId('device-abc');
    const h2 = hashDeviceId('device-abc');
    expect(h1).toBe(h2);
  });

  it('produces different hashes for different device IDs', () => {
    const h1 = hashDeviceId('device-1');
    const h2 = hashDeviceId('device-2');
    expect(h1).not.toBe(h2);
  });
});

// ─── createMobileSession ──────────────────────────────────────────────────────

describe('createMobileSession', () => {
  it('calls createSession and returns token + deviceIdHash', async () => {
    mockCreateSession.mockResolvedValueOnce('raw-token-xyz' as never);
    const result = await createMobileSession({
      userId: 'user-1',
      platform: 'IOS',
      deviceId: 'device-abc',
    });
    expect(result.token).toBe('raw-token-xyz');
    expect(result.deviceIdHash).toHaveLength(64);
  });

  it('passes platform as clientType to createSession', async () => {
    mockCreateSession.mockResolvedValueOnce('tok' as never);
    await createMobileSession({ userId: 'user-2', platform: 'ANDROID', deviceId: 'dev-1' });
    const [,, metadata] = mockCreateSession.mock.calls[0] as [string, unknown, Record<string, unknown>];
    expect(metadata.clientType).toBe('ANDROID');
  });

  it('passes hashed deviceId (not raw) to createSession metadata', async () => {
    mockCreateSession.mockResolvedValueOnce('tok' as never);
    const rawDeviceId = 'raw-device-id-123';
    await createMobileSession({ userId: 'user-3', platform: 'IOS', deviceId: rawDeviceId });
    const [,, metadata] = mockCreateSession.mock.calls[0] as [string, unknown, Record<string, unknown>];
    expect(metadata.deviceIdHash).not.toBe(rawDeviceId);
    expect(typeof metadata.deviceIdHash).toBe('string');
    expect((metadata.deviceIdHash as string)).toHaveLength(64);
  });

  it('passes optional fields (deviceName, platformVersion, ip, userAgent) when provided', async () => {
    mockCreateSession.mockResolvedValueOnce('tok' as never);
    await createMobileSession({
      userId: 'user-4',
      platform: 'IOS',
      deviceId: 'dev',
      deviceName: 'iPhone 15',
      platformVersion: '17.0',
      ip: '1.2.3.4',
      userAgent: 'Mozilla/5.0',
    });
    const [,, metadata] = mockCreateSession.mock.calls[0] as [string, unknown, Record<string, unknown>];
    expect(metadata.deviceName).toBe('iPhone 15');
    expect(metadata.platformVersion).toBe('17.0');
    expect(metadata.lastIp).toBe('1.2.3.4');
    expect(metadata.lastUserAgent).toBe('Mozilla/5.0');
  });

  it('passes ttlSeconds through to createSession', async () => {
    mockCreateSession.mockResolvedValueOnce('tok' as never);
    await createMobileSession({ userId: 'user-5', platform: 'ANDROID', deviceId: 'dev', ttlSeconds: 7200 });
    const [, ttl] = mockCreateSession.mock.calls[0] as [string, number, unknown];
    expect(ttl).toBe(7200);
  });

  it('deviceIdHash in return value matches hash of input deviceId', async () => {
    mockCreateSession.mockResolvedValueOnce('tok' as never);
    const rawDeviceId = 'test-device';
    const result = await createMobileSession({ userId: 'user-6', platform: 'IOS', deviceId: rawDeviceId });
    expect(result.deviceIdHash).toBe(hashDeviceId(rawDeviceId));
  });
});

// ─── revokeMobileSession ─────────────────────────────────────────────────────

describe('revokeMobileSession', () => {
  it('delegates to revokeSession with the provided token', async () => {
    mockRevokeSession.mockResolvedValueOnce(undefined as never);
    await revokeMobileSession('raw-session-token');
    expect(mockRevokeSession).toHaveBeenCalledOnce();
    expect(mockRevokeSession).toHaveBeenCalledWith('raw-session-token');
  });
});
