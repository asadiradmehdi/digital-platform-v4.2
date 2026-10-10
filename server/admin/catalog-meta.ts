// Catalogue presentation: per-service title/description/hint/position and the category on/off switch.
// Prices live in packages.ts / catalog.ts. Every change is audited with before and after values.
import { withUserTransaction } from '../core/db';
import { writeAudit } from '../core/audit';
import { AppError } from '../core/errors';
import { requirePlatformAdmin } from '../identity/platform-admin';
import { wholeNumber } from './price-core';

const oneLine = (v: unknown, label: string, max: number, required = false): string | null => {
  if (v === undefined || v === null) { if (required) throw new AppError('VALIDATION_ERROR', `${label} را وارد کنید.`); return null; }
  if (typeof v !== 'string') throw new AppError('VALIDATION_ERROR', `${label} معتبر نیست.`);
  const t = v.replace(/[\u0000-\u0008\u000B-\u001F\u007F‪-‮⁦-⁩]/g, '').replace(/\s+/g, ' ').trim();
  if (!t) { if (required) throw new AppError('VALIDATION_ERROR', `${label} را وارد کنید.`); return null; }
  if (Array.from(t).length > max) throw new AppError('VALIDATION_ERROR', `${label} حداکثر ${max} حرف است.`);
  return t;
};

export type ServiceDetailsInput = { actorUserId: string; serviceId: string; name?: unknown; description?: unknown; hint?: unknown; sortOrder?: unknown };

/** Edits what customers read about one service. Only provided fields change; an empty hint/description clears it. */
export async function updateServiceDetails(input: ServiceDetailsInput) {
  await requirePlatformAdmin(input.actorUserId);
  const patch: Record<string, string | number | null> = {};
  if (input.name !== undefined) patch.name = oneLine(input.name, 'نام خدمت', 80, true);
  if (input.description !== undefined) patch.description = oneLine(input.description, 'توضیح', 400);
  if (input.hint !== undefined) patch.hint = oneLine(input.hint, 'متن کوتاه زیر نام', 120);
  if (input.sortOrder !== undefined) patch.sort_order = wholeNumber(input.sortOrder, 'ترتیب نمایش', { min: 0, max: 100000, optional: true });
  const cols = Object.keys(patch);
  if (cols.length === 0) throw new AppError('VALIDATION_ERROR', 'تغییری ارسال نشده است.');
  return withUserTransaction(input.actorUserId, async client => {
    const cur = (await client.query<Record<string, string | number | null>>(`SELECT name, description, hint, sort_order FROM services WHERE id=$1 FOR UPDATE`, [input.serviceId])).rows[0];
    if (!cur) throw new AppError('NOT_FOUND', 'خدمت پیدا نشد.');
    const changed = cols.filter(c => (cur[c] ?? null) !== patch[c]);
    if (changed.length === 0) return { changed: [] as string[] };
    await client.query(`UPDATE services SET ${changed.map((c, i) => `${c}=$${i + 2}`).join(', ')}, updated_at=now() WHERE id=$1`, [input.serviceId, ...changed.map(c => patch[c])]);
    await writeAudit({ actorUserId: input.actorUserId, action: 'admin.service.details', entityType: 'service', entityId: input.serviceId,
      metadata: { from: Object.fromEntries(changed.map(c => [c, cur[c] ?? null])), to: Object.fromEntries(changed.map(c => [c, patch[c]])) } }, client);
    return { changed };
  });
}

/** Shows or hides a whole category for customers (products.active). Sections hidden in code stay hidden either way. */
export async function setCategoryActive(input: { actorUserId: string; productSlug: string; active: boolean }) {
  await requirePlatformAdmin(input.actorUserId);
  if (typeof input.active !== 'boolean' || !/^[a-z0-9-]{1,40}$/.test(String(input.productSlug))) throw new AppError('VALIDATION_ERROR', 'درخواست نامعتبر است.');
  return withUserTransaction(input.actorUserId, async client => {
    const r = await client.query<{ id: string; was: boolean }>(`SELECT id, active AS was FROM products WHERE slug=$1 AND workspace_id IS NULL FOR UPDATE`, [input.productSlug]);
    const row = r.rows[0];
    if (!row) throw new AppError('NOT_FOUND', 'دسته پیدا نشد.');
    if (row.was !== input.active) {
      await client.query(`UPDATE products SET active=$2, updated_at=now() WHERE id=$1`, [row.id, input.active]);
      await writeAudit({ actorUserId: input.actorUserId, action: input.active ? 'admin.category.enable' : 'admin.category.disable', entityType: 'product', entityId: row.id, metadata: { slug: input.productSlug, from: row.was, to: input.active } }, client);
    }
    return { active: input.active };
  });
}
