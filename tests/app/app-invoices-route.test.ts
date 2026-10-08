/** Native-app invoice API: authorization (wallet.read), server-built views and the signed web path. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/identity/rbac', () => ({ requireWorkspacePermission: vi.fn() }));
vi.mock('../../server/payments/invoice', () => ({ listInvoices: vi.fn(), getInvoice: vi.fn() }));

import { requireRequestUser } from '../../server/identity/request-user';
import { requireWorkspacePermission } from '../../server/identity/rbac';
import { getInvoice, listInvoices, type InvoiceRecord } from '../../server/payments/invoice';
import { verifyInvoiceViewToken } from '../../server/payments/invoice-link';
import { GET as listGET } from '../../app/api/v1/app/invoices/route';
import { GET as detailGET } from '../../app/api/v1/app/invoices/[id]/route';
import { AppError } from '../../server/core/errors';

const WS = '4a1c9e00-0000-4000-8000-000000000000';
const INV = '7d0c5f0e-1b2a-4c3d-8e9f-0a1b2c3d4e5f';
const record: InvoiceRecord = {
  id: INV, invoiceNumber: 'INV-2026-000007', type: 'TOPUP_RECEIPT', title: 'شارژ کیف پول', currency: 'IRT',
  subtotalMinor: '500000', discountMinor: '0', totalMinor: '500000', vatMinor: '0', vatRateBps: null, status: 'PAID',
  orderId: null, paymentId: 'p', subscriptionId: null, paymentMethod: 'GATEWAY', paymentReference: 'mock_p',
  buyerName: 'علی', buyerPhone: null, buyerEmail: 'a@b.co', seller: {}, issuedAt: '2026-10-08T10:12:00Z', paidAt: null, metadata: {},
  items: [{ id: 'l', description: 'شارژ کیف پول', quantity: '1', unitPriceMinor: '500000', totalMinor: '500000', currency: 'IRT', metadata: {} }],
};

const req = (path: string) => new NextRequest(`http://localhost${path}`);
const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireRequestUser).mockResolvedValue('u1');
  vi.mocked(requireWorkspacePermission).mockResolvedValue(undefined);
  vi.stubEnv('SECRETS_MASTER_KEY', 'test-master-key');
});
afterEach(() => vi.unstubAllEnvs());

describe('GET /api/v1/app/invoices', () => {
  it('needs a signed-in user', async () => {
    vi.mocked(requireRequestUser).mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Authentication required.'));
    expect((await listGET(req(`/api/v1/app/invoices?workspaceId=${WS}`))).status).toBe(401);
  });

  it('needs wallet.read in the workspace and reads nothing otherwise', async () => {
    vi.mocked(requireWorkspacePermission).mockRejectedValueOnce(new AppError('FORBIDDEN', 'Permission denied.'));
    expect((await listGET(req(`/api/v1/app/invoices?workspaceId=${WS}`))).status).toBe(403);
    expect(requireWorkspacePermission).toHaveBeenCalledWith('u1', WS, 'wallet.read');
    expect(listInvoices).not.toHaveBeenCalled();
  });

  it('returns server-built rows, 10 per page', async () => {
    vi.mocked(listInvoices).mockResolvedValueOnce({ items: [{ id: INV, invoiceNumber: 'INV-2026-000007', type: 'SALE', title: 'اشتراک پایه', currency: 'IRT', totalMinor: '9900000', status: 'PAID', orderId: null, issuedAt: '2026-10-08T10:12:00Z' }], hasMore: true });
    const res = await listGET(req(`/api/v1/app/invoices?workspaceId=${WS}&page=2`));
    expect(res.status).toBe(200);
    expect(listInvoices).toHaveBeenCalledWith(WS, { limit: 10, offset: 20 });
    const body = await res.json();
    expect(body).toMatchObject({ page: 2, hasMore: true, items: [{ id: INV, typeLabel: 'فاکتور', title: 'اشتراک پایه', amountToman: 9_900_000, when: '۱۶ مهر ۱۴۰۵، ۱۳:۴۲' }] });
  });
});

describe('GET /api/v1/app/invoices/:id', () => {
  it('returns the view and a web path with a view token valid for this invoice only', async () => {
    vi.mocked(getInvoice).mockResolvedValueOnce(record);
    const res = await detailGET(req(`/api/v1/app/invoices/${INV}?workspaceId=${WS}`), params(INV));
    expect(res.status).toBe(200);
    const body = await res.json() as { invoice: { typeLabel: string; totals: { totalWords: string } }; webPath: string };
    expect(getInvoice).toHaveBeenCalledWith(WS, INV);
    expect(body.invoice.typeLabel).toBe('رسید شارژ کیف پول');
    expect(body.invoice.totals.totalWords).toBe('پانصد هزار تومان');
    const url = new URL(body.webPath, 'http://x');
    expect(url.pathname).toBe(`/invoices/${INV}`);
    expect(verifyInvoiceViewToken(INV, url.searchParams.get('k'))).toEqual({ workspaceId: WS });
  });

  it('404 for another workspace\'s invoice (RLS read finds nothing) and for a malformed id', async () => {
    vi.mocked(getInvoice).mockRejectedValueOnce(new AppError('NOT_FOUND', 'Invoice not found.'));
    expect((await detailGET(req(`/api/v1/app/invoices/${INV}?workspaceId=${WS}`), params(INV))).status).toBe(404);
    expect((await detailGET(req(`/api/v1/app/invoices/x?workspaceId=${WS}`), params('../etc'))).status).toBe(404);
    expect(getInvoice).toHaveBeenCalledTimes(1);
  });

  it('403 without wallet.read', async () => {
    vi.mocked(requireWorkspacePermission).mockRejectedValueOnce(new AppError('FORBIDDEN', 'Permission denied.'));
    expect((await detailGET(req(`/api/v1/app/invoices/${INV}?workspaceId=${WS}`), params(INV))).status).toBe(403);
    expect(getInvoice).not.toHaveBeenCalled();
  });
});
