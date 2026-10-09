import { describe, expect, it } from 'vitest';
import { ALL_CATEGORIES, CATEGORIES, HIDDEN_CATEGORIES, isHiddenCategory } from '../../lib/catalog-ui';

describe('sections hidden from customers', () => {
  it('keeps AI content, automation and design out of the customer catalogue but defined', () => {
    expect([...HIDDEN_CATEGORIES].sort()).toEqual(['ai', 'automation', 'design']);
    for (const k of HIDDEN_CATEGORIES) {
      expect(CATEGORIES.some(c => c.key === k)).toBe(false);
      expect(ALL_CATEGORIES.some(c => c.key === k)).toBe(true);
      expect(isHiddenCategory(k)).toBe(true);
    }
  });

  it('orders the visible categories by priority with a one-line hint each', () => {
    expect(CATEGORIES.slice(0, 5).map(c => c.key)).toEqual(['ai-subscriptions', 'instagram', 'telegram', 'youtube', 'tiktok']);
    for (const c of CATEGORIES) expect(c.hint.length).toBeGreaterThan(0);
  });
});
