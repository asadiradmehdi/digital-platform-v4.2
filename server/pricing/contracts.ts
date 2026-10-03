export const DISPLAY_CURRENCY = 'IRT' as const;
export type DisplayCurrency = typeof DISPLAY_CURRENCY;
export type PricingTargetType = 'PLAN' | 'SERVICE';
export type MarginMode = 'MARKUP' | 'MARGIN';
export type StaleRatePolicy = 'USE_LAST_KNOWN_GOOD' | 'FREEZE_PRICE' | 'BLOCK_PURCHASE';

export type FxRate = Readonly<{
  id: string;
  baseCurrency: string;
  quoteCurrency: string;
  numerator: string;
  denominator: string;
  source: string;
  fetchedAt: Date;
  verified: boolean;
}>;

export type PriceQuote = Readonly<{
  targetType: PricingTargetType;
  targetId: string;
  amountMinor: bigint;
  currency: typeof DISPLAY_CURRENCY;
  pricingRuleId: string;
  fxRateId: string;
  priceVersion: bigint;
  providerCostMinor?: bigint;
  providerCostCurrency?: string;
  generatedAt: Date;
}>;
