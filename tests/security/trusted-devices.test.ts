import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  registerTrustedDevice,
  listTrustedDevices,
  revokeTrustedDevice,
  verifyTrustedDevice,
  revokeAllTrustedDevices,
} from '../../server/identity/trusted-devices';

vi.mock('../../server/core/db', () => ({ query: vi.fn() }));
vi.mock('../../server/core/audit', () => ({ writeAudit: vi.fn() }));

import { query } from '../../server/core/db';

const qMock = vi.mocked(query);

beforeEach(() => { vi.resetAllMocks(); });

describe('registerTrustedDevice', () => {
  it('returns a raw device key and device id on success', async () => {
    qMock.mockResolvedValueOnce({ rows: [{ id: 'dev-1' }], rowCount: 1 } as never);
    const result = await registerTrustedDevice('user-1', 'iPhone 15', 'iOS');
    expect(result.deviceId).toBe('dev-1');
    expect(typeof result.deviceKey).toBe('string');
    expect(result.deviceKey.length).toBeGreaterThan(10);
  });

  it('throws CONFLICT when the same device key is already registered', async () => {
    qMock.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await expect(registerTrustedDevice('user-1', 'Device', null)).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('persists device name and platform', async () => {
    qMock.mockResolvedValueOnce({ rows: [{ id: 'dev-2' }], rowCount: 1 } as never);
    await registerTrustedDevice('user-1', 'Android Phone', 'Android');
    const params = qMock.mock.calls[0][1] as unknown[];
    expect(params).toContain('Android Phone');
    expect(params).toContain('Android');
  });

  it('stores hash not raw key in the database', async () => {
    qMock.mockResolvedValueOnce({ rows: [{ id: 'dev-3' }], rowCount: 1 } as never);
    const { deviceKey } = await registerTrustedDevice('user-1', 'PC', null);
    const params = qMock.mock.calls[0][1] as string[];
    expect(params).not.toContain(deviceKey);
    const hash = params.find(p => typeof p === 'string' && /^[0-9a-f]{64}$/.test(p));
    expect(hash).toBeTruthy();
  });
});

describe('listTrustedDevices', () => {
  it('returns mapped device list with revoked=false', async () => {
    qMock.mockResolvedValueOnce({
      rows: [{ id: 'dev-1', deviceKeyHash: 'abc', deviceName: 'iPhone', platform: 'iOS', lastSeenAt: '2026-10-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z' }],
      rowCount: 1,
    } as never);
    const items = await listTrustedDevices('user-1');
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('dev-1');
    expect(items[0].revoked).toBe(false);
  });

  it('returns empty array when user has no active devices', async () => {
    qMock.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    expect(await listTrustedDevices('user-1')).toEqual([]);
  });
});

describe('revokeTrustedDevice', () => {
  it('revokes a device owned by the user', async () => {
    qMock.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await expect(revokeTrustedDevice('dev-1', 'user-1')).resolves.toBeUndefined();
  });

  it('throws NOT_FOUND when device does not belong to user', async () => {
    qMock.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await expect(revokeTrustedDevice('dev-other', 'user-1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('verifyTrustedDevice', () => {
  it('returns true and updates last_seen_at when device key is valid', async () => {
    qMock.mockResolvedValueOnce({ rows: [{ id: 'dev-1' }], rowCount: 1 } as never);
    expect(await verifyTrustedDevice('user-1', 'raw-key')).toBe(true);
  });

  it('returns false when device key does not match any active device', async () => {
    qMock.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    expect(await verifyTrustedDevice('user-1', 'wrong-key')).toBe(false);
  });
});

describe('revokeAllTrustedDevices', () => {
  it('revokes all active devices and returns the count', async () => {
    qMock.mockResolvedValueOnce({ rows: [], rowCount: 3 } as never);
    expect(await revokeAllTrustedDevices('user-1')).toBe(3);
  });

  it('returns 0 and skips audit when no active devices exist', async () => {
    qMock.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    expect(await revokeAllTrustedDevices('user-1')).toBe(0);
    expect(qMock).toHaveBeenCalledTimes(1);
  });
});
