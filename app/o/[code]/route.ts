import { NextRequest, NextResponse } from 'next/server';
import { query, withTenantTransaction } from '../../../server/core/db';
import { requireCurrentUser } from '../../../server/identity/request-user';
import { siteUrl } from '../../../server/identity/google/config';

/**
 * Short order link used in SMS: /o/4A1C9E (or /o/ZP-4A1C9E). Signed-in customers land on the order when it
 * is in one of their workspaces; everyone else signs in first and returns here. Nothing is revealed to
 * anyone else (an unknown code just opens the order list).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const base = siteUrl() ?? request.nextUrl.origin;
  const raw = (await params).code.toUpperCase().replace(/^ZP-?/, '');
  if (!/^[0-9A-F]{6}$/.test(raw)) return NextResponse.redirect(new URL('/orders', base));
  let userId: string;
  try { userId = await requireCurrentUser(); }
  catch {
    const auth = new URL('/auth', base);
    auth.searchParams.set('next', `/o/${raw}`);
    return NextResponse.redirect(auth);
  }
  const workspaces = await query<{ workspace_id: string }>(
    `SELECT workspace_id FROM workspace_members WHERE user_id=$1 AND status='ACTIVE'`, [userId],
  );
  for (const { workspace_id } of workspaces.rows) {
    const hit = await withTenantTransaction(workspace_id, userId, client => client.query<{ id: string }>(
      `SELECT id FROM orders WHERE workspace_id=$1 AND replace(id::text,'-','') LIKE $2 ORDER BY created_at DESC LIMIT 1`,
      [workspace_id, `${raw.toLowerCase()}%`],
    ));
    if (hit.rows[0]) return NextResponse.redirect(new URL(`/orders/${hit.rows[0].id}`, base));
  }
  return NextResponse.redirect(new URL('/orders', base));
}
