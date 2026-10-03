import type { PoolClient } from 'pg';

export async function setTenantContext(client: PoolClient, workspaceId: string, userId?: string) {
  if (!workspaceId) throw new Error('workspaceId is required');
  await client.query(`SELECT app_set_workspace_context($1::uuid)`, [workspaceId]);
  if (userId) await client.query(`SELECT set_config('app.user_id',$1,true)`, [userId]);
}

export async function assertTenantContext(client: PoolClient) {
  const result = await client.query<{workspaceId:string|null}>(`SELECT current_setting('app.workspace_id', true) AS "workspaceId"`);
  if (!result.rows[0]?.workspaceId) throw new Error('Tenant context is missing.');
}
