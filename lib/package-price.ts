// Package price rule shared by the customer picker, the order server and the admin editor, so all three agree.
// A listed package costs its OWN price when the owner pinned one (service_package_prices), otherwise quantity × unit.
// Money is whole toman (IRT minor units).
export type PackagePrices = Readonly<Record<number, number>>;

export function packagePriceToman(quantity: number, unitToman: number, pinned?: PackagePrices | null): number {
  const own = pinned?.[quantity];
  return own !== undefined && own > 0 ? own : quantity * unitToman;
}

/** True when `quantity` has a price of its own instead of following the unit price. */
export function isPinnedPackage(quantity: number, pinned?: PackagePrices | null): boolean {
  const own = pinned?.[quantity];
  return own !== undefined && own > 0;
}

/** Whole-toman unit price that best represents a package price (display and order_items.unit_price_minor). */
export function impliedUnitToman(totalToman: number, quantity: number): number {
  return quantity > 0 ? Math.max(0, Math.round(totalToman / quantity)) : 0;
}

/** Catalogue rows ({quantity, priceMinor} as strings, IRT) → quantity → toman lookup. Ignores malformed rows. */
export function pinnedPricesFromRows(rows: ReadonlyArray<{ quantity: string; priceMinor: string }> | null | undefined): Record<number, number> {
  const out: Record<number, number> = {};
  for (const r of rows ?? []) {
    const q = Number(r.quantity); const p = Number(r.priceMinor);
    if (Number.isSafeInteger(q) && q > 0 && Number.isSafeInteger(p) && p > 0) out[q] = p;
  }
  return out;
}
