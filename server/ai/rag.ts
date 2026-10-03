import { query } from '../core/db';
import { AppError } from '../core/errors';
import { createHash } from 'node:crypto';

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

function splitIntoChunks(text: string): string[] {
  const chunks: string[] = [];
  const words = text.split(/\s+/);
  let i = 0;
  while (i < words.length) {
    const chunkWords = words.slice(i, i + CHUNK_SIZE);
    chunks.push(chunkWords.join(' '));
    if (i + CHUNK_SIZE >= words.length) break;
    i += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks.filter(c => c.trim().length > 0);
}

export async function ingestDocument(input: {
  knowledgeBaseId: string;
  title: string;
  content: string;
  sourceType: string;
  sourceUri?: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const contentHash = createHash('sha256').update(input.content).digest('hex');

  const existing = await query<{ id: string; status: string }>(
    `SELECT id, status FROM knowledge_documents WHERE knowledge_base_id=$1 AND content_hash=$2`,
    [input.knowledgeBaseId, contentHash]
  );
  if (existing.rows[0]?.status === 'INDEXED') {
    return existing.rows[0].id;
  }

  const docRow = await query<{ id: string }>(
    `INSERT INTO knowledge_documents(knowledge_base_id, source_type, source_uri, title, content_hash, status, metadata)
     VALUES($1,$2,$3,$4,$5,'PENDING',$6)
     ON CONFLICT(knowledge_base_id, content_hash) DO UPDATE SET status='PENDING', title=$4
     RETURNING id`,
    [input.knowledgeBaseId, input.sourceType, input.sourceUri ?? null, input.title, contentHash, input.metadata ?? {}]
  );
  const documentId = docRow.rows[0]?.id;
  if (!documentId) throw new AppError('INTERNAL_ERROR', 'Failed to create knowledge document.');

  await query(`DELETE FROM knowledge_chunks WHERE document_id=$1`, [documentId]);

  const chunks = splitIntoChunks(input.content);
  for (let i = 0; i < chunks.length; i++) {
    await query(
      `INSERT INTO knowledge_chunks(document_id, chunk_index, content, token_count)
       VALUES($1,$2,$3,$4)
       ON CONFLICT(document_id, chunk_index) DO UPDATE SET content=$3, token_count=$4`,
      [documentId, i, chunks[i], Math.ceil(chunks[i].length / 4)]
    );
  }

  await query(
    `UPDATE knowledge_documents SET status='INDEXED' WHERE id=$1`,
    [documentId]
  );

  return documentId;
}

export async function searchKnowledge(input: {
  knowledgeBaseId: string;
  query: string;
  limit?: number;
}): Promise<Array<{ documentId: string; chunkIndex: number; content: string; score: number }>> {
  const limit = input.limit ?? 5;
  const terms = input.query.toLowerCase().split(/\s+/).filter(t => t.length > 2).slice(0, 10);

  if (!terms.length) return [];

  const likeConditions = terms.map((_, i) => `LOWER(kc.content) LIKE $${i + 2}`).join(' OR ');
  const params: unknown[] = [input.knowledgeBaseId, ...terms.map(t => `%${t}%`)];

  const r = await query<{ document_id: string; chunk_index: number; content: string; match_count: string }>(
    `SELECT kc.document_id, kc.chunk_index, kc.content,
            (${terms.map((_, i) => `(LOWER(kc.content) LIKE $${i + 2})::int`).join(' + ')}) AS match_count
     FROM knowledge_chunks kc
     JOIN knowledge_documents kd ON kd.id = kc.document_id
     WHERE kd.knowledge_base_id=$1 AND kd.status='INDEXED'
       AND (${likeConditions})
     ORDER BY match_count DESC, kc.chunk_index ASC
     LIMIT $${params.length + 1}`,
    [...params, limit]
  );

  return r.rows.map(row => ({
    documentId: row.document_id,
    chunkIndex: row.chunk_index,
    content: row.content,
    score: parseInt(row.match_count, 10) / terms.length,
  }));
}

export async function getKnowledgeBases(workspaceId: string) {
  const r = await query(
    `SELECT id, name, description, embedding_model, created_at FROM knowledge_bases WHERE workspace_id=$1 ORDER BY created_at DESC`,
    [workspaceId]
  );
  return r.rows;
}

export async function createKnowledgeBase(input: { workspaceId: string; name: string; description?: string }): Promise<string> {
  const r = await query<{ id: string }>(
    `INSERT INTO knowledge_bases(workspace_id, name, description) VALUES($1,$2,$3) RETURNING id`,
    [input.workspaceId, input.name, input.description ?? null]
  );
  return r.rows[0]?.id ?? '';
}
