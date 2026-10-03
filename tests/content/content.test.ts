import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn() }));

import { query } from '../../server/core/db';
import { upsertContentEntity, auditOrphanContent, findStaleContent } from '../../server/content/entities';
import { validateStructuredData, validateEntityStructuredData } from '../../server/content/schema-validator';

const mockQuery = vi.mocked(query);
beforeEach(() => vi.clearAllMocks());

describe('content entities', () => {
  it('upsertContentEntity returns id', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'ent-1' }], rowCount: 1 } as never);
    const id = await upsertContentEntity({ entityType: 'service', slug: 'test-service', canonicalPath: '/services/test', title: 'Test Service', description: 'A test service' });
    expect(id).toBe('ent-1');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT(entity_type, slug)'),
      expect.arrayContaining(['service', 'test-service', '/services/test'])
    );
  });

  it('auditOrphanContent queries for entities with no inbound relations', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'ent-2', canonicalPath: '/orphan', entityType: 'page' }], rowCount: 1 } as never);
    const orphans = await auditOrphanContent();
    expect(orphans).toHaveLength(1);
    expect(orphans[0].canonicalPath).toBe('/orphan');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('NOT IN (SELECT to_entity_id'),
      []
    );
  });

  it('findStaleContent queries with interval', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const stale = await findStaleContent(30);
    expect(stale).toHaveLength(0);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('days'),
      ['30']
    );
  });
});

describe('schema-validator', () => {
  it('validates a correct Organization schema', () => {
    const result = validateStructuredData({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Acme Corp',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when @context is missing', () => {
    const result = validateStructuredData({ '@type': 'Organization', name: 'Test' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('@context'))).toBe(true);
  });

  it('fails when required field is missing for Article', () => {
    const result = validateStructuredData({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'My Article',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('author'))).toBe(true);
  });

  it('validateEntityStructuredData returns error when jsonLd is missing', () => {
    const result = validateEntityStructuredData({ title: 'No JSON-LD' });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('jsonLd');
  });

  it('validateEntityStructuredData validates embedded jsonLd', () => {
    const result = validateEntityStructuredData({
      jsonLd: { '@context': 'https://schema.org', '@type': 'WebSite', url: 'https://example.com' },
    });
    expect(result.valid).toBe(true);
  });
});
