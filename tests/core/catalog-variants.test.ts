import { describe, expect, it } from 'vitest';
import { baseSlug, orderForm, serviceKind, serviceMeta, sortServices, variantOf } from '../../lib/catalog-ui';
import { catalogView } from '../../server/account/app-views';

describe('service variants', () => {
  it('derives base slug and variant from `<base>--<variant>`', () => {
    expect(baseSlug('ig-followers--iranian')).toBe('ig-followers');
    expect(variantOf('ig-followers--iranian')).toMatchObject({ key: 'iranian', label: 'ایرانی' });
    expect(variantOf('ig-followers')).toMatchObject({ key: 'standard', label: 'استاندارد' });
    expect(variantOf('ig-followers--unknown').key).toBe('standard');
  });
  it('variants inherit kind, presets and target form from the base service', () => {
    expect(serviceKind('tg-members--foreign')).toBe('members');
    expect(serviceMeta('ig-likes--economy')).toEqual(serviceMeta('ig-likes'));
    expect(orderForm('instagram', 'ig-followers--iranian').target).toEqual(orderForm('instagram', 'ig-followers').target);
  });
  it('sorts the standard variant first, then iranian, foreign, economy, right after its base position', () => {
    const slugs = ['ig-likes', 'ig-followers--economy', 'ig-followers--foreign', 'ig-followers', 'ig-followers--iranian'].map(slug => ({ slug }));
    expect(sortServices(slugs).map(s => s.slug)).toEqual(['ig-followers', 'ig-followers--iranian', 'ig-followers--foreign', 'ig-followers--economy', 'ig-likes']);
  });
  it('catalog view exposes base and variant, and hides services without an approved price', () => {
    const item = (slug: string, price: string | null) => ({ id: slug, slug, name: slug, description: null, productSlug: 'instagram', unitPriceMinor: price, currency: 'IRT', minQuantity: null, maxQuantity: null });
    const v = catalogView([item('ig-followers', '100'), item('ig-followers--iranian', '160'), item('ig-followers--foreign', null)]);
    expect(v.services.map(s => [s.slug, s.base, s.variant.key])).toEqual([['ig-followers', 'ig-followers', 'standard'], ['ig-followers--iranian', 'ig-followers', 'iranian']]);
  });
});
