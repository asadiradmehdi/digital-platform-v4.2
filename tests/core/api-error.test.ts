import { describe, expect, it } from 'vitest';
import { apiErrorMessage } from '../../lib/api-error';

const res = (status: number, message?: string) => new Response(JSON.stringify(message ? { error: { message } } : {}), { status });

describe('apiErrorMessage', () => {
  it('keeps Persian server messages', async () => {
    expect(await apiErrorMessage(res(402, 'موجودی کافی نیست. لطفاً کیف پول خود را شارژ کنید.'), 'x')).toContain('موجودی کافی نیست');
  });
  it('never shows English developer messages', async () => {
    expect(await apiErrorMessage(res(403, 'Permission denied.'), 'x')).toBe('اجازه‌ی انجام این کار را ندارید.');
    expect(await apiErrorMessage(res(400, 'serviceId must be a UUID.'), 'x')).not.toMatch(/[A-Za-z]/);
  });
  it('falls back for unknown statuses', async () => {
    expect(await apiErrorMessage(res(503), 'خطای موقت')).toBe('خطای موقت');
  });
});
