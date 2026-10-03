# Pricing configuration example

One-time configuration per AI subscription:

```ts
await upsertPricingRule({
  targetType: 'PLAN',
  targetId: '<plan-id>',
  baseAmountMinor: 1000n, // example: $10.00 represented in the chosen source minor unit
  baseCurrency: 'USD',
  marginPercent: 10,
  roundingIncrementMinor: 1000n,
});
```

After this, the scheduled FX refresh owns the generated selling price. The owner should not edit `plans.price_minor` manually for dynamically priced plans.
