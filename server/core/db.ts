import { Pool, type PoolClient, type QueryResultRow } from 'pg';

let pool: Pool | undefined;
export function db() {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.DB_POOL_MAX ?? 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS ?? 15_000),
      query_timeout: Number(process.env.DB_QUERY_TIMEOUT_MS ?? 20_000),
      application_name: process.env.DB_APPLICATION_NAME ?? 'digital-platform',
    });
  }
  return pool;
}
export async function query<T extends QueryResultRow>(text: string, values: unknown[] = []) { return db().query<T>(text, values); }
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>) {
  const client = await db().connect();
  try { await client.query('BEGIN'); const value = await fn(client); await client.query('COMMIT'); return value; }
  catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
export async function withWorkspaceTransaction<T>(workspaceId: string, userId: string | undefined, fn: (client: PoolClient) => Promise<T>) {
  return withTenantTransaction(workspaceId, userId, fn);
}

export async function withTenantTransaction<T>(workspaceId: string, userId: string | undefined, fn: (client: PoolClient) => Promise<T>) {
  if (!workspaceId) throw new Error('workspaceId is required');
  const client = await db().connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT app_set_workspace_context($1::uuid)`, [workspaceId]);
    if (userId) await client.query(`SELECT set_config('app.user_id',$1,true)`, [userId]);
    const value = await fn(client);
    await client.query('COMMIT');
    return value;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
