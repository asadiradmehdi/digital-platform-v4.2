import { query } from '../core/db';
import { AppError } from '../core/errors';

export type ContentEntity = {
  id: string;
  entityType: string;
  slug: string;
  canonicalPath: string;
  title: string;
  description: string;
  data: Record<string, unknown>;
  indexable: boolean;
  updatedAt: string;
};

export async function upsertContentEntity(input: {
  entityType: string;
  slug: string;
  canonicalPath: string;
  title: string;
  description: string;
  data?: Record<string, unknown>;
  indexable?: boolean;
}): Promise<string> {
  const r = await query<{ id: string }>(
    `INSERT INTO content_entities(entity_type, slug, canonical_path, title, description, data, indexable, updated_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,now())
     ON CONFLICT(entity_type, slug) DO UPDATE SET
       canonical_path=$3, title=$4, description=$5,
       data=EXCLUDED.data, indexable=$7, updated_at=now()
     RETURNING id`,
    [input.entityType, input.slug, input.canonicalPath, input.title, input.description, input.data ?? {}, input.indexable ?? true]
  );
  return r.rows[0]?.id ?? '';
}

export async function getContentEntity(canonicalPath: string): Promise<ContentEntity | null> {
  const r = await query<ContentEntity>(
    `SELECT id, entity_type AS "entityType", slug, canonical_path AS "canonicalPath",
            title, description, data, indexable, updated_at AS "updatedAt"
     FROM content_entities WHERE canonical_path=$1`,
    [canonicalPath]
  );
  return r.rows[0] ?? null;
}

export async function listContentEntities(entityType?: string, limit = 100, offset = 0): Promise<ContentEntity[]> {
  const r = await query<ContentEntity>(
    `SELECT id, entity_type AS "entityType", slug, canonical_path AS "canonicalPath",
            title, description, indexable, updated_at AS "updatedAt"
     FROM content_entities
     ${entityType ? 'WHERE entity_type=$1' : ''}
     ORDER BY updated_at DESC LIMIT $${entityType ? 2 : 1} OFFSET $${entityType ? 3 : 2}`,
    entityType ? [entityType, limit, offset] : [limit, offset]
  );
  return r.rows;
}

export async function getContentRelations(entityId: string): Promise<Array<{ id: string; toEntityId: string; relationKey: string }>> {
  const r = await query(
    `SELECT id, to_entity_id AS "toEntityId", relation_key AS "relationKey"
     FROM content_relations WHERE from_entity_id=$1`,
    [entityId]
  );
  return r.rows as Array<{ id: string; toEntityId: string; relationKey: string }>;
}

export async function auditOrphanContent(): Promise<Array<{ id: string; canonicalPath: string; entityType: string }>> {
  const r = await query<{ id: string; canonicalPath: string; entityType: string }>(
    `SELECT id, canonical_path AS "canonicalPath", entity_type AS "entityType"
     FROM content_entities
     WHERE id NOT IN (SELECT to_entity_id FROM content_relations)
       AND indexable = true
     ORDER BY updated_at ASC LIMIT 100`,
    []
  );
  return r.rows;
}

export async function findStaleContent(staleDays = 90): Promise<Array<{ id: string; canonicalPath: string; updatedAt: string }>> {
  const r = await query<{ id: string; canonicalPath: string; updatedAt: string }>(
    `SELECT id, canonical_path AS "canonicalPath", updated_at AS "updatedAt"
     FROM content_entities
     WHERE updated_at <= now() - ($1 || ' days')::interval AND indexable=true
     ORDER BY updated_at ASC LIMIT 50`,
    [staleDays.toString()]
  );
  return r.rows;
}
