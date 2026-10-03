import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn() }));

import { query } from '../../server/core/db';
import { ingestDocument, searchKnowledge, createKnowledgeBase } from '../../server/ai/rag';

const mockQuery = vi.mocked(query);
beforeEach(() => vi.clearAllMocks());

describe('ingestDocument', () => {
  it('returns existing document id if already indexed with same hash', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'doc-1', status: 'INDEXED' }], rowCount: 1 } as never);
    const id = await ingestDocument({ knowledgeBaseId: 'kb-1', title: 'Test', content: 'hello world', sourceType: 'text' });
    expect(id).toBe('doc-1');
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('creates a new document and chunks when not previously indexed', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never); // no existing
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'doc-2' }], rowCount: 1 } as never); // insert doc
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never); // delete old chunks
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never); // insert chunk
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never); // update status

    const id = await ingestDocument({ knowledgeBaseId: 'kb-1', title: 'New Doc', content: 'This is test content.', sourceType: 'text' });
    expect(id).toBe('doc-2');
  });
});

describe('searchKnowledge', () => {
  it('returns empty array for very short query', async () => {
    const results = await searchKnowledge({ knowledgeBaseId: 'kb-1', query: 'it' });
    expect(results).toEqual([]);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('returns matched chunks with scores', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [
      { document_id: 'doc-1', chunk_index: 0, content: 'AI models and machine learning concepts', match_count: '2' },
    ], rowCount: 1 } as never);
    const results = await searchKnowledge({ knowledgeBaseId: 'kb-1', query: 'machine learning models', limit: 3 });
    expect(results).toHaveLength(1);
    expect(results[0].documentId).toBe('doc-1');
    expect(results[0].score).toBeGreaterThan(0);
  });
});

describe('createKnowledgeBase', () => {
  it('inserts and returns knowledge base id', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'kb-123' }], rowCount: 1 } as never);
    const id = await createKnowledgeBase({ workspaceId: 'ws-1', name: 'My KB', description: 'Test KB' });
    expect(id).toBe('kb-123');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO knowledge_bases'),
      ['ws-1', 'My KB', 'Test KB']
    );
  });
});
