import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Regression: routes checked wallet.deposit, orders.cancel, subscriptions.create, ai.* … that no
// migration created, so every member got 403 on top-up, cancel, subscribe, AI and automation.
function files(dir: string): string[] {
  return readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}

describe('permission keys', () => {
  it('every key a route checks is created by a migration', () => {
    const used = new Set<string>();
    for (const f of [...files('app'), ...files('server')]) {
      for (const m of readFileSync(f, 'utf8').matchAll(/requireWorkspacePermission\([^)]*'([a-z_.]+)'\)/g)) used.add(m[1]);
    }
    const seeded = new Set<string>();
    for (const f of readdirSync('db/migrations')) {
      for (const m of readFileSync(join('db/migrations', f), 'utf8').matchAll(/\(\s*'([a-z_]+\.[a-z_.]+)'\s*,/g)) seeded.add(m[1]);
    }
    expect(used.size).toBeGreaterThan(10);
    expect([...used].filter(k => !seeded.has(k))).toEqual([]);
  });

  it('signup never grants staff-only permissions', () => {
    // Every signup path (password, phone code, Google) builds the workspace through createPersonalWorkspace.
    const helper = readFileSync('server/identity/signup.ts', 'utf8');
    expect(helper).toMatch(/key NOT IN \('admin\.ops','orders\.refund'\)/);
    for (const f of ['app/api/v1/auth/register/route.ts', 'server/identity/signup.ts']) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).toMatch(/createPersonalWorkspace\(client/);
    }
    // No other file grants role permissions at signup with its own (possibly broader) rule.
    const granting = [...files('app'), ...files('server')].filter(f => /INSERT INTO role_permissions\(role_id,permission_id\) SELECT/.test(readFileSync(f, 'utf8')));
    expect(granting).toEqual(['server/identity/signup.ts']);
  });
});
