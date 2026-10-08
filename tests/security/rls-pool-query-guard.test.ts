/**
 * Static regression guard for FORCE-RLS tables.
 *
 * In production the app connects as a NOSUPERUSER/NOBYPASSRLS role, so a statement on a tenant table
 * sent through the plain pool `query()` (no app.workspace_id) silently returns 0 rows or is rejected
 * with "new row violates row-level security policy". Local development used a superuser, so dozens of
 * such call sites went unnoticed. This test fails when a pool `query(...)` call whose SQL text names an
 * RLS-protected table reappears in app/, server/, components/ or lib/.
 *
 * Tenant work must use withTenantTransaction / withWorkspaceTransaction / withUserTransaction
 * (client.query inside them is not matched). Cross-tenant system reads must go through the narrow
 * system_* functions of migration 0031. Runtime PostgreSQL tests remain the final authority.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const RLS_TABLES = [
  'agent_runs', 'ai_cost_events', 'ai_requests', 'ai_usage_events', 'api_keys', 'api_usage_events',
  'audit_logs', 'checkout_sessions', 'commissions', 'coupon_redemptions', 'invoices', 'ledger_transactions',
  'notifications', 'operational_events', 'orders', 'payments', 'risk_events', 'security_action_evidence',
  'subscriptions', 'support_tickets', 'usage_counters', 'usage_events', 'wallets', 'workflow_runs',
];
const TABLE_RE = new RegExp(`\\b(${RLS_TABLES.join('|')})\\b`, 'g');

/**
 * Reviewed exceptions: the policy on these rows does not depend on a tenant context.
 * security_action_evidence: step-up evidence is written with workspace_id NULL, which its policy
 * (workspace_id IS NULL OR workspace_id = app_workspace_id()) admits without a workspace context.
 */
const ALLOWED: Record<string, string[]> = {
  'server/identity/step-up.ts': ['security_action_evidence'],
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

/** Returns each top-level pool `query(` call (not `.query(`) with the tables named in its arguments. */
function poolQueryCalls(source: string): Array<{ line: number; tables: string[] }> {
  if (!/import[^;]*\bquery\b[^;]*from/.test(source)) return [];
  const calls: Array<{ line: number; tables: string[] }> = [];
  const re = /(^|[^.\w])query(<[^(]*?>)?\(/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    let i = match.index + match[0].length;
    let depth = 1;
    while (i < source.length && depth > 0) {
      if (source[i] === '(') depth++;
      else if (source[i] === ')') depth--;
      i++;
    }
    const tables = [...new Set(source.slice(match.index, i).match(TABLE_RE) ?? [])];
    if (tables.length) calls.push({ line: source.slice(0, match.index + match[1].length).split('\n').length, tables });
  }
  return calls;
}

describe('RLS boundary: no plain-pool queries on FORCE-RLS tables', () => {
  it('finds no pool query() on a tenant table outside a tenant transaction', () => {
    const offenders: string[] = [];
    for (const dir of ['app', 'server', 'components', 'lib']) {
      let files: string[] = [];
      try { files = walk(join(ROOT, dir)); } catch { continue; }
      for (const file of files) {
        const rel = relative(ROOT, file);
        for (const call of poolQueryCalls(readFileSync(file, 'utf8'))) {
          const unexpected = call.tables.filter(t => !(ALLOWED[rel] ?? []).includes(t));
          if (unexpected.length) offenders.push(`${rel}:${call.line} ${unexpected.join(',')}`);
        }
      }
    }
    expect(offenders, 'Use withTenantTransaction / withUserTransaction, or a system_* function (migration 0031)').toEqual([]);
  });

  it('detects the pattern it guards against', () => {
    const sample = "import { query } from '../core/db';\nawait query(`SELECT * FROM orders WHERE id=$1`, [id]);\nawait client.query(`SELECT * FROM payments`);";
    expect(poolQueryCalls(sample)).toEqual([{ line: 2, tables: ['orders'] }]);
  });

  it('never lets application code switch on the system-read scope', () => {
    // app.rls_system_read is set only inside the migration-0031 functions; setting it from TypeScript
    // would open cross-tenant SELECT on the tables that carry the system_read policy.
    const offenders: string[] = [];
    for (const dir of ['app', 'server', 'components', 'lib']) {
      let files: string[] = [];
      try { files = walk(join(ROOT, dir)); } catch { continue; }
      for (const file of files) {
        if (readFileSync(file, 'utf8').includes('rls_system_read')) offenders.push(relative(ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
