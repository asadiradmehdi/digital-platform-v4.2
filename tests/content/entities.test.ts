import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
  withWorkspaceTransaction: vi.fn(),
}));

import { query } from '../../server/core/db';
import {
  upsertContentEntity,
  getContentEntity,
  listContentEntities,
  getContentRelations,
  auditOrphanContent,
  findStaleContent,
} from '../../server/content/entities';

const mockQuery = vi.mocked(query);
beforeEach(() => vi.clearAllMocks());

describe('upsertContentEntity', () => {
  it('inserts with ON CONFLICT DO UPDATE and returns id', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'entity-1' }], rowCount: 1 } as never);
    const id = await upsertContentEntity({
      entityType: 'service',
      slug: 'instagram-followers',
      canonicalPath: '/services/instagram-followers',
      title: 'Instagram Followers',
      description: 'Buy followers',
    });
    expect(id).toBe('entity-1');
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('ON CONFLICT(entity_type, slug) DO UPDATE');
    expect(params).toContain('service');
    expect(params).toContain('instagram-followers');
  });

  it('defaults data to {} and indexable to true when not provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'e1' }], rowCount: 1 } as never);
    await upsertContentEntity({
      entityType: 'service',
      slug: 'slug',
      canonicalPath: '/p',
      title: 'T',
      description: 'D',
    });
    const [_sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(params[5]).toEqual({});
    expect(params[6]).toBe(true);
  });

  it('accepts custom data and indexable=false', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'e2' }], rowCount: 1 } as never);
    await upsertContentEntity({
      entityType: 'page',
      slug: 'about',
      canonicalPath: '/about',
      title: 'About',
      description: 'Desc',
      data: { author: 'admin' },
      indexable: false,
    });
    const [_sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(params[5]).toEqual({ author: 'admin' });
    expect(params[6]).toBe(false);
  });

  it('sets updated_at=now() in SQL', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'e3' }], rowCount: 1 } as never);
    await upsertContentEntity({ entityType: 'x', slug: 'y', canonicalPath: '/z', title: 'T', description: 'D' });
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('updated_at=now()');
  });
});

describe('getContentEntity', () => {
  it('queries by canonical_path and returns entity', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'e1', entityType: 'service', slug: 'ig', canonicalPath: '/services/ig', title: 'IG', description: 'D', data: {}, indexable: true, updatedAt: '2025-01-01' }],
      rowCount: 1,
    } as never);
    const entity = await getContentEntity('/services/ig');
    expect(entity).toMatchObject({ id: 'e1', entityType: 'service' });
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('canonical_path=$1');
    expect(params).toEqual(['/services/ig']);
  });

  it('returns null for missing path', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const entity = await getContentEntity('/not-found');
    expect(entity).toBeNull();
  });
});

describe('listContentEntities', () => {
  it('lists without entityType filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'e1' }, { id: 'e2' }], rowCount: 2 } as never);
    const result = await listContentEntities();
    expect(result).toHaveLength(2);
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).not.toContain('WHERE entity_type=');
    expect(params).toContain(100); // default limit
  });

  it('filters by entityType when provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await listContentEntities('service', 20, 0);
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('entity_type=$1');
    expect(params[0]).toBe('service');
    expect(params[1]).toBe(20);
  });
});

describe('getContentRelations', () => {
  it('queries from_entity_id and returns relations', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'rel-1', toEntityId: 'e2', relationKey: 'related' }],
      rowCount: 1,
    } as never);
    const relations = await getContentRelations('e1');
    expect(relations).toHaveLength(1);
    expect(relations[0]).toMatchObject({ id: 'rel-1', toEntityId: 'e2' });
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('from_entity_id=$1');
    expect(params).toEqual(['e1']);
  });
});

describe('auditOrphanContent', () => {
  it('finds indexable entities not referenced in content_relations', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'orphan-1', canonicalPath: '/orphan', entityType: 'service' }],
      rowCount: 1,
    } as never);
    const orphans = await auditOrphanContent();
    expect(orphans).toHaveLength(1);
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('NOT IN (SELECT to_entity_id FROM content_relations)');
    expect(sql).toContain('indexable = true');
  });
});

describe('findStaleContent', () => {
  it('finds indexable content older than default 90 days', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 's1', canonicalPath: '/old', updatedAt: '2024-01-01' }], rowCount: 1 } as never);
    const stale = await findStaleContent();
    expect(stale).toHaveLength(1);
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('days');
    expect(params).toContain('90');
  });

  it('accepts custom staleDays', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await findStaleContent(30);
    const [_sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(params).toContain('30');
  });
});
