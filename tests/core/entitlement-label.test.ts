import { describe, expect, it } from 'vitest';
import { entitlementLabel } from '../../packages/api-contracts/src/entitlements';

describe('entitlementLabel', () => {
  it('shows Persian wording instead of internal keys', () => {
    expect(entitlementLabel('orders_per_month', { enabled: true, limit: 5 })).toBe('۵ سفارش در ماه');
    expect(entitlementLabel('orders_per_month', { enabled: true, limit: null })).toBe('سفارش نامحدود');
    expect(entitlementLabel('api_access', { enabled: true })).toBe('دسترسی API');
    for (const key of ['ai_usage', 'automation_runs', 'priority_routing', 'dedicated_provider', 'sla']) {
      expect(entitlementLabel(key, { enabled: true, limit: 10 })).not.toMatch(/_/);
    }
  });

  it('hides unknown internal keys', () => {
    expect(entitlementLabel('internal_flag', {})).toBeNull();
  });
});
