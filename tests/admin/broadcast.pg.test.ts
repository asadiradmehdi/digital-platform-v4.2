/** Broadcast access check on a real PostgreSQL: only people holding notifications.manage can send (runs when ADMIN_IT_DATABASE_URL is set). */
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

const URL = process.env.ADMIN_IT_DATABASE_URL;
if (URL) process.env.DATABASE_URL = URL;

describe.runIf(Boolean(URL))('broadcast permission', () => {
  it('refuses a user without admin rights', async () => {
    const { sendBroadcast } = await import('../../server/admin/broadcast');
    await expect(sendBroadcast(randomUUID(), { title: 'سلام همه', body: '', link: '' })).rejects.toThrow();
  });
});
