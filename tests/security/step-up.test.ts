import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getTransactionSecurityPolicy,
  issueStepUpChallenge,
  verifyStepUpChallenge,
  enforceStepUpPolicy,
} from '../../server/identity/step-up';

vi.mock('../../server/core/db', () => ({ query: vi.fn() }));
vi.mock('../../server/identity/mfa-service', () => ({ verifyTotpCode: vi.fn() }));
vi.mock('../../server/identity/recovery', () => ({ consumeRecoveryCode: vi.fn() }));
vi.mock('../../server/core/audit', () => ({ writeAudit: vi.fn() }));

import { query } from '../../server/core/db';
import { verifyTotpCode } from '../../server/identity/mfa-service';
import { consumeRecoveryCode } from '../../server/identity/recovery';

const qMock = vi.mocked(query);
const totpMock = vi.mocked(verifyTotpCode);
const recoveryMock = vi.mocked(consumeRecoveryCode);

beforeEach(() => { vi.resetAllMocks(); });

describe('getTransactionSecurityPolicy', () => {
  it('returns null when no policy row exists', async () => {
    qMock.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    expect(await getTransactionSecurityPolicy('UNKNOWN_ACTION')).toBeNull();
  });

  it('returns a typed policy with numeric maxAmountMinor', async () => {
    qMock.mockResolvedValueOnce({
      rows: [{
        actionType: 'WALLET_WITHDRAW', requireStepUp: true,
        requireRecentAuthSeconds: 300, maxAmountMinor: '50000000',
        requirePasskey: true, requireMfa: true, active: true,
      }], rowCount: 1,
    } as never);
    const policy = await getTransactionSecurityPolicy('WALLET_WITHDRAW');
    expect(policy).not.toBeNull();
    expect(policy!.maxAmountMinor).toBe(50000000);
    expect(policy!.requireStepUp).toBe(true);
  });

  it('converts null maxAmountMinor correctly', async () => {
    qMock.mockResolvedValueOnce({
      rows: [{
        actionType: 'API_KEY_CREATE', requireStepUp: true,
        requireRecentAuthSeconds: 300, maxAmountMinor: null,
        requirePasskey: false, requireMfa: true, active: true,
      }], rowCount: 1,
    } as never);
    expect((await getTransactionSecurityPolicy('API_KEY_CREATE'))!.maxAmountMinor).toBeNull();
  });
});

describe('issueStepUpChallenge', () => {
  it('inserts a challenge row and returns a raw token', async () => {
    qMock.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    const token = await issueStepUpChallenge('user-1', 'WALLET_WITHDRAW');
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(10);
    expect(qMock).toHaveBeenCalledOnce();
    const params = qMock.mock.calls[0][1] as string[];
    expect(params).toContain('STEP_UP:WALLET_WITHDRAW');
  });
});

describe('verifyStepUpChallenge', () => {
  it('throws UNAUTHORIZED when challenge not found', async () => {
    qMock.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await expect(
      verifyStepUpChallenge('user-1', 'bad-token', '123456', 'totp', 'corr-1')
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('throws UNAUTHORIZED when purpose does not start with STEP_UP:', async () => {
    qMock.mockResolvedValueOnce({
      rows: [{ id: 'ch-1', purpose: 'MFA_LOGIN' }], rowCount: 1,
    } as never);
    await expect(
      verifyStepUpChallenge('user-1', 'token', '123456', 'totp', 'corr-1')
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('throws UNAUTHORIZED when TOTP code is wrong', async () => {
    qMock.mockResolvedValueOnce({ rows: [{ id: 'ch-1', purpose: 'STEP_UP:WALLET_WITHDRAW' }], rowCount: 1 } as never);
    totpMock.mockResolvedValueOnce(false);
    await expect(
      verifyStepUpChallenge('user-1', 'token', 'wrong', 'totp', 'corr-1')
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('verifies successfully with TOTP and returns an evidence id', async () => {
    qMock.mockResolvedValueOnce({ rows: [{ id: 'ch-1', purpose: 'STEP_UP:WALLET_WITHDRAW' }], rowCount: 1 } as never);
    totpMock.mockResolvedValueOnce(true);
    qMock.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never); // consume challenge
    qMock.mockResolvedValueOnce({ rows: [{ id: 'ev-1' }], rowCount: 1 } as never); // insert evidence

    const evidenceId = await verifyStepUpChallenge('user-1', 'token', '123456', 'totp', 'corr-1');
    expect(evidenceId).toBe('ev-1');
  });

  it('uses recovery code path when codeType=recovery', async () => {
    qMock.mockResolvedValueOnce({ rows: [{ id: 'ch-1', purpose: 'STEP_UP:API_KEY_CREATE' }], rowCount: 1 } as never);
    recoveryMock.mockResolvedValueOnce(true);
    qMock.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    qMock.mockResolvedValueOnce({ rows: [{ id: 'ev-2' }], rowCount: 1 } as never);

    const evidenceId = await verifyStepUpChallenge('user-1', 'token', 'rec-code', 'recovery', 'corr-2');
    expect(evidenceId).toBe('ev-2');
    expect(recoveryMock).toHaveBeenCalledOnce();
    expect(totpMock).not.toHaveBeenCalled();
  });
});

describe('enforceStepUpPolicy', () => {
  it('passes when no policy exists', async () => {
    qMock.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await expect(enforceStepUpPolicy('user-1', 'NO_POLICY')).resolves.toBeUndefined();
  });

  it('passes when policy is inactive', async () => {
    qMock.mockResolvedValueOnce({
      rows: [{ actionType: 'API_KEY_CREATE', requireStepUp: true, requireRecentAuthSeconds: 300, maxAmountMinor: null, requirePasskey: false, requireMfa: true, active: false }],
      rowCount: 1,
    } as never);
    await expect(enforceStepUpPolicy('user-1', 'API_KEY_CREATE')).resolves.toBeUndefined();
  });

  it('throws FORBIDDEN when amount exceeds maxAmountMinor', async () => {
    qMock.mockResolvedValueOnce({
      rows: [{ actionType: 'WALLET_WITHDRAW', requireStepUp: true, requireRecentAuthSeconds: 300, maxAmountMinor: '10000000', requirePasskey: true, requireMfa: true, active: true }],
      rowCount: 1,
    } as never);
    await expect(
      enforceStepUpPolicy('user-1', 'WALLET_WITHDRAW', undefined, 20000000)
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('throws FORBIDDEN when evidenceId is missing for step-up required action', async () => {
    qMock.mockResolvedValueOnce({
      rows: [{ actionType: 'WALLET_WITHDRAW', requireStepUp: true, requireRecentAuthSeconds: 300, maxAmountMinor: null, requirePasskey: true, requireMfa: true, active: true }],
      rowCount: 1,
    } as never);
    await expect(enforceStepUpPolicy('user-1', 'WALLET_WITHDRAW')).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('throws FORBIDDEN when evidence is expired or not found', async () => {
    qMock.mockResolvedValueOnce({
      rows: [{ actionType: 'WALLET_WITHDRAW', requireStepUp: true, requireRecentAuthSeconds: 300, maxAmountMinor: null, requirePasskey: true, requireMfa: true, active: true }],
      rowCount: 1,
    } as never);
    qMock.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never); // no recent evidence
    await expect(
      enforceStepUpPolicy('user-1', 'WALLET_WITHDRAW', 'ev-old')
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('passes when evidence is fresh', async () => {
    qMock.mockResolvedValueOnce({
      rows: [{ actionType: 'WALLET_WITHDRAW', requireStepUp: true, requireRecentAuthSeconds: 300, maxAmountMinor: null, requirePasskey: true, requireMfa: true, active: true }],
      rowCount: 1,
    } as never);
    qMock.mockResolvedValueOnce({ rows: [{ id: 'ev-1' }], rowCount: 1 } as never);
    await expect(enforceStepUpPolicy('user-1', 'WALLET_WITHDRAW', 'ev-1')).resolves.toBeUndefined();
  });
});
