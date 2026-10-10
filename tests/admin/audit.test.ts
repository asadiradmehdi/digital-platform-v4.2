import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../../server/admin/access', () => ({ requirePermission: vi.fn(async () => ({})) }));
vi.mock('../../server/core/db', () => ({ query: vi.fn(async () => ({ rows: [] })) }));
import { query } from '../../server/core/db';
import { requirePermission } from '../../server/admin/access';
import { listAudit, redact } from '../../server/admin/audit';

beforeEach(() => vi.clearAllMocks());
describe('audit viewer', () => {
  it('redacts anything credential-like in metadata, recursively', () => {
    expect(redact({ reason: 'ok', apiKey: 'abc', nested: { merchantId: 'm', token: 't', list: [{ password: 'p', fine: 1 }] } }))
      .toEqual({ reason: 'ok', apiKey: '••••', nested: { merchantId: '••••', token: '••••', list: [{ password: '••••', fine: 1 }] } });
  });
  it('requires audit.view and validates filters before SQL', async () => {
    await listAudit('u', { action: "x'; drop", entityType: 'BAD TYPE', actor: 'nope', entity: 'nope', from: '2026-13', page: 2 });
    expect(requirePermission).toHaveBeenCalledWith('u', 'audit.view');
    const a = vi.mocked(query).mock.calls[0][1] as unknown[];
    expect(a.slice(0, 6)).toEqual([null, null, null, null, null, null]); expect(a[7]).toBe(50);
  });
  it('passes valid filters (Tehran day boundaries)', async () => {
    await listAudit('u', { action: 'admin.order', from: '2026-10-01', to: '2026-10-02' });
    const a = vi.mocked(query).mock.calls[0][1] as unknown[];
    expect(a[0]).toBe('admin.order'); expect(a[4]).toBe('2026-10-01T00:00:00+03:30'); expect(String(a[5])).toContain('2026-10-0');
  });
  it('a user without the permission gets nothing', async () => {
    vi.mocked(requirePermission).mockRejectedValueOnce(new Error('FORBIDDEN'));
    await expect(listAudit('u', {})).rejects.toThrow('FORBIDDEN');
    expect(query).not.toHaveBeenCalled();
  });
});
