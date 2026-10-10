// Pure package-price rules of the admin console (no I/O): shared by the editor in the browser and the server, so a
// preview and a save always agree. Money is whole toman.

export const MAX_UNIT_PRICE = 100_000_000;
export const MAX_PACKAGE_PRICE = 2_000_000_000;

/** The price state of one service: unit price + pinned package totals keyed by quantity. */
export type PriceState = { unit: number | null; packages: Record<string, number> };

const eff = (q: number, unit: number, pinned: Record<string, number>) => pinned[String(q)] ?? q * unit;

// ── pure planning (unit-tested) ─────────────────────────────────────────────────────────────────

export type PackageEdit = { quantity: number; priceToman: number | null };
export type PackageChange = { quantity: number; from: number; to: number };
export type PackagePlan = {
  target: { unit: number; packages: Record<string, number> };
  changes: PackageChange[];
  unitFrom: number; unitTo: number;
  /** Packages that were pinned at their current price only because the base unit price moves. */
  pinnedBecauseBaseMoved: number[];
  changed: boolean;
};

/**
 * Turns the owner's edits into the full target state.
 *  - `priceToman: number` pins that package to exactly this total; `null` makes it follow quantity × unit again.
 *  - Editing the base pack (quantity === per, e.g. 1 month or 1,000 followers) moves the unit price to
 *    round(price / per); all other packages keep the price customers see now (pinned) unless edited too.
 */
export function planPackageEdit(input: { unit: number; pinned: Record<string, number>; listed: number[]; per: number; edits: PackageEdit[] }): PackagePlan {
  const { unit, pinned, listed, per } = input;
  const edit = new Map(input.edits.map(e => [e.quantity, e.priceToman]));
  const baseEdit = edit.get(per);
  const newUnit = typeof baseEdit === 'number' ? Math.min(MAX_UNIT_PRICE, Math.max(1, Math.round(baseEdit / per))) : unit;
  const target: Record<string, number> = { ...pinned };
  const changes: PackageChange[] = [];
  const pinnedBecauseBaseMoved: number[] = [];
  for (const q of listed) {
    const before = eff(q, unit, pinned);
    let want: number;
    if (edit.has(q)) {
      const v = edit.get(q);
      want = v === null || v === undefined ? q * newUnit : v;
    } else {
      want = before;
      if (newUnit !== unit && pinned[String(q)] === undefined) pinnedBecauseBaseMoved.push(q);
    }
    if (want === q * newUnit) delete target[String(q)]; else target[String(q)] = want;
    if (want !== before) changes.push({ quantity: q, from: before, to: want });
  }
  const samePinned = Object.keys(target).length === Object.keys(pinned).length && Object.keys(target).every(k => pinned[k] === target[k]);
  return { target: { unit: newUnit, packages: target }, changes, unitFrom: unit, unitTo: newUnit, pinnedBecauseBaseMoved, changed: newUnit !== unit || !samePinned };
}

/** Effective price changes between two states, over the listed quantities. */
export function diffStates(before: PriceState, after: PriceState, listed: number[]): { unit: { from: number | null; to: number | null } | null; changes: PackageChange[] } {
  const u0 = before.unit; const u1 = after.unit;
  const changes: PackageChange[] = [];
  if (u0 !== null && u1 !== null) {
    for (const q of listed) {
      const a = eff(q, u0, before.packages); const b = eff(q, u1, after.packages);
      if (a !== b) changes.push({ quantity: q, from: a, to: b });
    }
  }
  return { unit: u0 !== u1 ? { from: u0, to: u1 } : null, changes };
}

export function marginPct(priceToman: number, quantity: number, unitCostToman: number | null): number | null {
  if (unitCostToman === null || priceToman <= 0) return null;
  return Math.round(((priceToman - quantity * unitCostToman) / priceToman) * 1000) / 10;
}

/** «پیشنهاد از قیمت ۱ ماه»: price for `quantity` from the base pack price with an optional % discount. Only pre-fills inputs. */
export function suggestPackagePrice(basePackToman: number, per: number, quantity: number, discountPercent: number, roundTo = 0): number {
  const raw = (basePackToman / per) * quantity * (1 - discountPercent / 100);
  const r = roundTo > 1 ? Math.round(raw / roundTo) * roundTo : Math.round(raw);
  return Math.max(1, r);
}

