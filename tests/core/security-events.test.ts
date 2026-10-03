import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn() }));

import { query } from '../../server/core/db';
import { recordSecurityEvent } from '../../server/core/security-events';

const mockQuery = vi.mocked(query);
beforeEach(() => vi.clearAllMocks());

describe('recordSecurityEvent', () => {
  it('inserts a security event with all provided fields', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await recordSecurityEvent({
      eventType: 'LOGIN_SUCCESS',
      severity: 'INFO',
      userId: 'user-1',
      workspaceId: 'ws-1',
      correlationId: 'corr-1',
      sourceIp: '1.2.3.4',
      userAgent: 'Mozilla/5.0',
      metadata: { action: 'login' },
    });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO security_events'),
      expect.arrayContaining(['LOGIN_SUCCESS', 'INFO', 'user-1', 'ws-1', 'corr-1', '1.2.3.4'])
    );
  });

  it('uses null for optional fields when not provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await recordSecurityEvent({ eventType: 'PASSWORD_RESET', severity: 'HIGH' });
    const callArgs = mockQuery.mock.calls[0][1] as unknown[];
    // userId, workspaceId, correlationId, sourceIp, userAgent should all be null
    expect(callArgs[2]).toBeNull(); // userId
    expect(callArgs[3]).toBeNull(); // workspaceId
    expect(callArgs[4]).toBeNull(); // correlationId
    expect(callArgs[5]).toBeNull(); // sourceIp
    expect(callArgs[6]).toBeNull(); // userAgent
  });

  it('truncates user agent to 500 characters', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    const longAgent = 'A'.repeat(600);
    await recordSecurityEvent({ eventType: 'TEST', severity: 'INFO', userAgent: longAgent });
    const callArgs = mockQuery.mock.calls[0][1] as unknown[];
    expect((callArgs[6] as string).length).toBe(500);
  });

  it('serializes metadata as JSON string', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await recordSecurityEvent({
      eventType: 'SUSPICIOUS_ACTIVITY',
      severity: 'WARNING',
      metadata: { ip: '192.168.0.1', attempts: 5 },
    });
    const callArgs = mockQuery.mock.calls[0][1] as unknown[];
    const metadataArg = callArgs[7] as string;
    const parsed = JSON.parse(metadataArg) as Record<string, unknown>;
    expect(parsed.ip).toBe('192.168.0.1');
    expect(parsed.attempts).toBe(5);
  });

  it('uses empty object for metadata when not provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await recordSecurityEvent({ eventType: 'LOGOUT', severity: 'INFO' });
    const callArgs = mockQuery.mock.calls[0][1] as unknown[];
    expect(callArgs[7]).toBe('{}');
  });

  it('propagates DB errors', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB connection failed'));
    await expect(
      recordSecurityEvent({ eventType: 'TEST', severity: 'CRITICAL' })
    ).rejects.toThrow('DB connection failed');
  });
});
