/** Native-app read API: server-side view models and authorization. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/identity/rbac', () => ({ requireWorkspacePermission: vi.fn() }));
vi.mock('../../server/account/overview', () => ({
  getViewer: vi.fn(), getWalletSummary: vi.fn(), listOrderCards: vi.fn(), getAccountStats: vi.fn(),
  hasEnabledMfa: vi.fn(), listCatalogWithPrices: vi.fn(),
}));

import { requireRequestUser } from '../../server/identity/request-user';
import { requireWorkspacePermission } from '../../server/identity/rbac';
import * as overview from '../../server/account/overview';
import { GET as overviewGET } from '../../app/api/v1/app/overview/route';
import { GET as catalogGET } from '../../app/api/v1/app/catalog/route';
import { catalogView } from '../../server/account/app-views';
import { AppError } from '../../server/core/errors';

const WS = '4a1c9e00-0000-4000-8000-000000000000';
beforeEach(() => vi.clearAllMocks());

describe('catalogView', () => {
  it('only lists priced services and derives presets on the server', () => {
    const v = catalogView([
      { id: 's1', slug: 'ig-followers', name: 'فالوور اینستاگرام', description: null, productSlug: 'instagram', unitPriceMinor: '1200', currency: 'IRT', minQuantity: '500', maxQuantity: '5000' },
      { id: 's2', slug: 'tg-views', name: 'ویو', description: null, productSlug: 'telegram', unitPriceMinor: null, currency: null, minQuantity: null, maxQuantity: null },
    ]);
    expect(v.services).toHaveLength(1);
    expect(v.services[0]).toMatchObject({ unitPriceToman: 1200, unit: 'فالوور', group: 'فالوور', quantities: [500, 1000, 2000, 3000, 5000] });
    expect(v.categories.find(c => c.key === 'instagram')).toMatchObject({ live: true, count: 1 });
    expect(v.categories.find(c => c.key === 'telegram')?.live).toBe(false);
    expect(v.categories).toHaveLength(9);
  });
});

describe('GET /api/v1/app/overview', () => {
  it('requires wallet and order read permission on the viewer workspace', async () => {
    vi.mocked(requireRequestUser).mockResolvedValue('u1');
    vi.mocked(overview.getViewer).mockResolvedValue({ userId: 'u1', displayName: 'علی', email: 'a@b.co', phone: null, workspaceId: WS, workspaceName: 'x' });
    vi.mocked(requireWorkspacePermission).mockRejectedValueOnce(new AppError('FORBIDDEN', 'Permission denied.'));
    const res = await overviewGET(new NextRequest('http://localhost/api/v1/app/overview'));
    expect(res.status).toBe(403);
    expect(overview.getWalletSummary).not.toHaveBeenCalled();
  });
  it('returns toman balances, tier and order cards', async () => {
    vi.mocked(requireRequestUser).mockResolvedValue('u1');
    vi.mocked(overview.getViewer).mockResolvedValue({ userId: 'u1', displayName: 'علی', email: 'a@b.co', phone: null, workspaceId: WS, workspaceName: 'x' });
    vi.mocked(overview.getWalletSummary).mockResolvedValue({ walletId: 'w1', currency: 'IRR', balanceMinor: '30480000', entries: [
      { id: 'e1', direction: 'CREDIT', amountMinor: '5000000', currency: 'IRR', referenceType: 'TOPUP', label: null, createdAt: '2026-10-08T05:34:00Z' },
    ] });
    vi.mocked(overview.listOrderCards).mockResolvedValue({ items: [
      { id: WS, status: 'IN_PROGRESS', currency: 'IRT', totalMinor: '900000', createdAt: '2026-10-08T05:34:00Z', serviceName: 'ویو Reel اینستاگرام', serviceSlug: 'ig-views', productSlug: 'instagram', quantity: '5000' },
    ], hasMore: false });
    vi.mocked(overview.getAccountStats).mockResolvedValue({ totalOrders: 3, activeOrders: 1, spentToman: 4_800_000 });
    vi.mocked(overview.hasEnabledMfa).mockResolvedValue(false);
    const res = await overviewGET(new NextRequest('http://localhost/api/v1/app/overview'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.wallet).toMatchObject({ balanceToman: 3_048_000, currency: 'IRR' });
    expect(body.wallet.entries[0]).toMatchObject({ title: 'شارژ کیف پول', amountToman: 500_000, credit: true });
    expect(body.activeOrders[0]).toMatchObject({ title: '۵ هزار ویو Reel اینستاگرام', amountToman: 900_000, stage: { steps: 3, tone: 'live' } });
    expect(body.tier).toMatchObject({ name: 'تتیس', level: 2, next: 'ریچی' });
  });
});

describe('GET /api/v1/app/catalog', () => {
  it('is public and returns the catalogue view', async () => {
    vi.mocked(overview.listCatalogWithPrices).mockResolvedValue([]);
    const res = await catalogGET(new NextRequest('http://localhost/api/v1/app/catalog'));
    expect(res.status).toBe(200);
    expect((await res.json()).categories).toHaveLength(9);
    expect(requireRequestUser).not.toHaveBeenCalled();
  });
});
