import { describe, expect, it } from 'vitest';
import { evaluateRisk, riskSignalsForCommerce, type RiskSignal } from '../../server/core/risk-engine';

describe('evaluateRisk', () => {
  it('returns NORMAL when score is below review threshold', () => {
    const result = evaluateRisk([{ key: 'x', score: 10, reason: 'low risk' }]);
    expect(result.state).toBe('NORMAL');
    expect(result.score).toBe(10);
  });

  it('returns REVIEW exactly at review threshold (40)', () => {
    const result = evaluateRisk([{ key: 'x', score: 40, reason: 'review boundary' }]);
    expect(result.state).toBe('REVIEW');
    expect(result.score).toBe(40);
  });

  it('returns RESTRICTED exactly at restricted threshold (80)', () => {
    const result = evaluateRisk([{ key: 'x', score: 80, reason: 'restricted boundary' }]);
    expect(result.state).toBe('RESTRICTED');
    expect(result.score).toBe(80);
  });

  it('hard block overrides low score — always RESTRICTED', () => {
    const result = evaluateRisk([{ key: 'x', score: 1, reason: 'hard block', hardBlock: true }]);
    expect(result.state).toBe('RESTRICTED');
  });

  it('hard block with zero score still restricts', () => {
    const result = evaluateRisk([{ key: 'zero', score: 0, reason: 'hard', hardBlock: true }]);
    expect(result.state).toBe('RESTRICTED');
  });

  it('sums multiple signal scores', () => {
    const signals: RiskSignal[] = [
      { key: 'a', score: 20, reason: 'signal a' },
      { key: 'b', score: 25, reason: 'signal b' },
    ];
    const result = evaluateRisk(signals);
    expect(result.score).toBe(45);
    expect(result.state).toBe('REVIEW');
  });

  it('ignores negative signal scores (clamped to 0)', () => {
    const result = evaluateRisk([{ key: 'neg', score: -50, reason: 'negative' }]);
    expect(result.score).toBe(0);
    expect(result.state).toBe('NORMAL');
  });

  it('preserves all signals in the decision', () => {
    const signals: RiskSignal[] = [
      { key: 'a', score: 5, reason: 'first' },
      { key: 'b', score: 5, reason: 'second' },
    ];
    const result = evaluateRisk(signals);
    expect(result.signals).toHaveLength(2);
    expect(result.signals[0].key).toBe('a');
  });

  it('returns NORMAL for empty signals array', () => {
    const result = evaluateRisk([]);
    expect(result.state).toBe('NORMAL');
    expect(result.score).toBe(0);
  });

  it('respects custom thresholds', () => {
    const result = evaluateRisk(
      [{ key: 'x', score: 20, reason: 'custom threshold' }],
      { review: 10, restricted: 50 },
    );
    expect(result.state).toBe('REVIEW');
  });

  it('custom threshold — restricted', () => {
    const result = evaluateRisk(
      [{ key: 'x', score: 55, reason: 'over restricted custom threshold' }],
      { review: 10, restricted: 50 },
    );
    expect(result.state).toBe('RESTRICTED');
  });
});

describe('riskSignalsForCommerce', () => {
  const base = { paymentFailures: 0, refunds30d: 0, couponAttempts: 0, ordersPerMinute: 0, aiUsageRatio: 0 };

  it('returns empty signals for clean input', () => {
    expect(riskSignalsForCommerce(base)).toHaveLength(0);
  });

  it('adds payment_velocity signal at 5+ failures', () => {
    const signals = riskSignalsForCommerce({ ...base, paymentFailures: 5 });
    expect(signals.some(s => s.key === 'payment_velocity')).toBe(true);
  });

  it('does not add payment_velocity signal below threshold (4 failures)', () => {
    const signals = riskSignalsForCommerce({ ...base, paymentFailures: 4 });
    expect(signals.some(s => s.key === 'payment_velocity')).toBe(false);
  });

  it('adds refund_velocity signal at 5+ refunds', () => {
    const signals = riskSignalsForCommerce({ ...base, refunds30d: 5 });
    expect(signals.some(s => s.key === 'refund_velocity')).toBe(true);
  });

  it('adds coupon_abuse signal at 20+ coupon attempts', () => {
    const signals = riskSignalsForCommerce({ ...base, couponAttempts: 20 });
    expect(signals.some(s => s.key === 'coupon_abuse')).toBe(true);
  });

  it('does not add coupon_abuse below threshold (19 attempts)', () => {
    const signals = riskSignalsForCommerce({ ...base, couponAttempts: 19 });
    expect(signals.some(s => s.key === 'coupon_abuse')).toBe(false);
  });

  it('adds order_velocity signal at 30+ orders/min', () => {
    const signals = riskSignalsForCommerce({ ...base, ordersPerMinute: 30 });
    expect(signals.some(s => s.key === 'order_velocity')).toBe(true);
  });

  it('adds ai_usage_anomaly signal at ratio >= 5', () => {
    const signals = riskSignalsForCommerce({ ...base, aiUsageRatio: 5 });
    expect(signals.some(s => s.key === 'ai_usage_anomaly')).toBe(true);
  });

  it('adds multiple signals when multiple thresholds are exceeded', () => {
    const signals = riskSignalsForCommerce({
      paymentFailures: 5,
      refunds30d: 5,
      couponAttempts: 20,
      ordersPerMinute: 30,
      aiUsageRatio: 5,
    });
    expect(signals.length).toBe(5);
  });

  it('combined commerce signals reach RESTRICTED state', () => {
    const signals = riskSignalsForCommerce({
      paymentFailures: 5,
      refunds30d: 5,
      couponAttempts: 20,
      ordersPerMinute: 30,
      aiUsageRatio: 5,
    });
    const decision = evaluateRisk(signals);
    expect(decision.state).toBe('RESTRICTED');
  });
});
