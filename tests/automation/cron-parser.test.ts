import { describe, it, expect } from 'vitest';
import { nextCronDate } from '../../server/automation/trigger';

// Fixed reference: 2026-01-05 (Monday) 10:30:00 UTC
const base = new Date('2026-01-05T10:30:00.000Z');

describe('nextCronDate', () => {
  it('* * * * * — returns next minute from base', () => {
    const result = nextCronDate('* * * * *', base);
    expect(result.getTime()).toBe(base.getTime() + 60_000);
  });

  it('0 * * * * — advances to next hour boundary', () => {
    const result = nextCronDate('0 * * * *', base);
    // base is 10:30 UTC; next minute=0 in any hour is 11:00
    expect(result.getUTCHours()).toBe(11);
    expect(result.getUTCMinutes()).toBe(0);
  });

  it('30 * * * * — next :30 is 11:30 when base is 10:30', () => {
    const result = nextCronDate('30 * * * *', base);
    expect(result.getUTCHours()).toBe(11);
    expect(result.getUTCMinutes()).toBe(30);
  });

  it('*/5 * * * * — returns next minute divisible by 5', () => {
    // base is 10:30, next minute is 10:31; next divisible-by-5 after 10:30 is 10:35
    const result = nextCronDate('*/5 * * * *', base);
    expect(result.getUTCMinutes()).toBe(35);
    expect(result.getUTCHours()).toBe(10);
  });

  it('0 */2 * * * — every 2 hours at :00', () => {
    // base 10:30 → next is 12:00
    const result = nextCronDate('0 */2 * * *', base);
    expect(result.getUTCHours()).toBe(12);
    expect(result.getUTCMinutes()).toBe(0);
  });

  it('0 0 * * * — midnight daily', () => {
    const result = nextCronDate('0 0 * * *', base);
    expect(result.getUTCHours()).toBe(0);
    expect(result.getUTCMinutes()).toBe(0);
    expect(result.getUTCDate()).toBe(6); // next day
  });

  it('0 0 * * 1 — weekly on Monday', () => {
    // base is Monday 2026-01-05; next Monday midnight is 2026-01-12
    const result = nextCronDate('0 0 * * 1', base);
    expect(result.getUTCDay()).toBe(1); // Monday
    expect(result.getUTCDate()).toBe(12);
  });

  it('0 0 1 * * — first of every month', () => {
    // base is 2026-01-05; next first is 2026-02-01
    const result = nextCronDate('0 0 1 * *', base);
    expect(result.getUTCDate()).toBe(1);
    expect(result.getUTCMonth()).toBe(1); // February
  });

  it('15,45 * * * * — comma-list: both 15 and 45 match', () => {
    // base 10:30 → next matching minute is 10:45
    const result = nextCronDate('15,45 * * * *', base);
    expect(result.getUTCMinutes()).toBe(45);
    expect(result.getUTCHours()).toBe(10);
  });

  it('0-5 * * * * — range: matches minutes 0-5', () => {
    // base 10:30 → next matching is 11:00
    const result = nextCronDate('0-5 * * * *', base);
    expect(result.getUTCMinutes()).toBe(0);
    expect(result.getUTCHours()).toBe(11);
  });

  it('returns base+1hour for unsupported expression (wrong field count)', () => {
    const result = nextCronDate('* * *', base);
    expect(result.getTime()).toBe(base.getTime() + 3_600_000);
  });

  it('result is always strictly after base', () => {
    const result = nextCronDate('* * * * *', base);
    expect(result.getTime()).toBeGreaterThan(base.getTime());
  });
});
