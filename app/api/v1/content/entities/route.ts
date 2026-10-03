import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { listContentEntities, upsertContentEntity, auditOrphanContent, findStaleContent } from '../../../../../server/content/entities';
import { query } from '../../../../../server/core/db';

export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('type') ?? undefined;
    const action = searchParams.get('action');
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);

    if (action === 'audit') {
      await requireRequestUser(request);
      const orphans = await auditOrphanContent();
      return json({ orphans }, { correlationId: id });
    }

    if (action === 'stale') {
      await requireRequestUser(request);
      const staleDays = parseInt(searchParams.get('days') ?? '90', 10);
      const stale = await findStaleContent(staleDays);
      return json({ stale }, { correlationId: id });
    }

    const path = searchParams.get('path');
    if (path) {
      const r = await query(
        `SELECT id, entity_type AS "entityType", slug, canonical_path AS "canonicalPath", title, description, data, indexable, updated_at AS "updatedAt"
         FROM content_entities WHERE canonical_path=$1`,
        [path]
      );
      const entity = r.rows[0];
      if (!entity) return json({ error: 'Not found.' }, { status: 404, correlationId: id });
      return json({ entity }, { correlationId: id });
    }

    const entities = await listContentEntities(entityType, limit, offset);
    return json({ items: entities, limit, offset }, { correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}

export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    await requireRequestUser(request);
    const body = await request.json() as {
      entityType: string;
      slug: string;
      canonicalPath: string;
      title: string;
      description: string;
      data?: Record<string, unknown>;
      indexable?: boolean;
    };

    if (!body.entityType || !body.slug || !body.canonicalPath || !body.title || !body.description) {
      return json({ error: 'entityType, slug, canonicalPath, title, and description are required.' }, { status: 400, correlationId: id });
    }

    const entityId = await upsertContentEntity(body);
    return json({ id: entityId }, { status: 201, correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
