// In-app notifications (the bell on web and app). notifications is FORCE-RLS: rows are written inside the
// workspace's tenant transaction and read from the user's own scope (migration 0032).
import type { PoolClient } from 'pg';
import { withTenantTransaction } from '../core/db';

export type InboxCategory = 'orders' | 'payments' | 'security' | 'support' | 'system';
export type InboxMessage = {
  workspaceId: string;
  userId: string;
  type: string;          // e.g. 'order.completed', 'support.answered'
  category: InboxCategory;
  title: string;         // short Persian headline shown in the bell
  body?: string;
  link?: string;         // same-site path, e.g. /orders/<id>
};

const INSERT = `INSERT INTO notifications(workspace_id, user_id, notification_type, payload) VALUES($1,$2,$3,$4::jsonb) RETURNING id`;

/**
 * Hook for any module (support replies, automation, …): pass the tenant client when already inside the
 * workspace transaction so the notification commits with the change it announces.
 */
export async function notifyUser(message: InboxMessage, client?: PoolClient): Promise<string> {
  const link = message.link && message.link.startsWith('/') && !message.link.startsWith('//') ? message.link : undefined;
  const payload = JSON.stringify({ title: message.title.slice(0, 140), body: message.body?.slice(0, 500), link, category: message.category });
  const values = [message.workspaceId, message.userId, message.type, payload];
  const run = (c: PoolClient) => c.query<{ id: string }>(INSERT, values).then(r => r.rows[0].id);
  return client ? run(client) : withTenantTransaction(message.workspaceId, message.userId, run);
}
