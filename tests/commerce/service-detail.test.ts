import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
}));

import { query } from '../../server/core/db';
import { getService, listServices } from '../../server/commerce/catalog';

const mockQuery = vi.mocked(query);
beforeEach(() => vi.clearAllMocks());

const serviceRow = {
  id: 'svc-uuid-0001',
  name: 'Instagram Followers',
  slug: 'instagram-followers',
  serviceType: 'SOCIAL',
  description: '1000 real Instagram followers',
  active: true,
  productId: 'prod-uuid-0001',
  productName: 'Instagram Growth',
  productSlug: 'instagram-growth',
};

describe('getService', () => {
  it('returns service detail when found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [serviceRow], rowCount: 1 } as never);
    const result = await getService('svc-uuid-0001');
    expect(result.id).toBe('svc-uuid-0001');
    expect(result.name).toBe('Instagram Followers');
    expect(result.serviceType).toBe('SOCIAL');
    expect(result.description).toBe('1000 real Instagram followers');
    expect(result.active).toBe(true);
    expect(result.productId).toBe('prod-uuid-0001');
    expect(result.productName).toBe('Instagram Growth');
  });

  it('throws NOT_FOUND when service does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await expect(getService('nonexistent-id')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('passes service id as query parameter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [serviceRow], rowCount: 1 } as never);
    await getService('my-service-id');
    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(params[0]).toBe('my-service-id');
  });

  it('SQL selects service_type with alias serviceType', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [serviceRow], rowCount: 1 } as never);
    await getService('svc-1');
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('service_type AS "serviceType"');
  });

  it('includes description and active columns', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [serviceRow], rowCount: 1 } as never);
    await getService('svc-1');
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('description');
    expect(sql).toContain('active');
  });

  it('joins products table for productName and productSlug', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [serviceRow], rowCount: 1 } as never);
    await getService('svc-1');
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('JOIN products');
    expect(sql).toContain('"productName"');
    expect(sql).toContain('"productSlug"');
  });
});

describe('listServices', () => {
  it('returns a page of services', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [serviceRow], rowCount: 1 } as never);
    const page = await listServices(10);
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
  });

  it('returns nextCursor when more results are available', async () => {
    const rows = Array.from({ length: 11 }, (_, i) => ({ ...serviceRow, id: `svc-${i}` }));
    mockQuery.mockResolvedValueOnce({ rows, rowCount: 11 } as never);
    const page = await listServices(10);
    expect(page.items).toHaveLength(10);
    expect(page.nextCursor).not.toBeNull();
  });

  it('filters by serviceType when provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await listServices(10, null, 'SOCIAL');
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('service_type=$3');
    expect(params[2]).toBe('SOCIAL');
  });

  it('does not filter by serviceType when not provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await listServices(10);
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).not.toContain('service_type=$3');
  });
});
