import { describe, it, expect, beforeEach } from 'vitest';
import { increment, resetMetrics } from '../../server/observability/metrics';
import { evaluateAlertRules, type AlertRule } from '../../server/observability/alerts';

beforeEach(() => resetMetrics());

describe('evaluateAlertRules', () => {
  const rules: AlertRule[] = [
    { name: 'high_errors', metricName: 'span.errors_total', threshold: 5, operator: 'gt', severity: 'HIGH' },
    { name: 'low_availability', metricName: 'service.available', threshold: 1, operator: 'lt', severity: 'CRITICAL' },
  ];

  it('returns no firings when metrics are below threshold', () => {
    increment('span.errors_total', {}, 3);
    increment('service.available', {}, 2);
    const firings = evaluateAlertRules(rules);
    expect(firings).toHaveLength(0);
  });

  it('fires alert when metric exceeds threshold', () => {
    increment('span.errors_total', {}, 10);
    const firings = evaluateAlertRules(rules);
    expect(firings).toHaveLength(1);
    expect(firings[0].rule).toBe('high_errors');
    expect(firings[0].severity).toBe('HIGH');
    expect(firings[0].value).toBe(10);
  });

  it('fires CRITICAL alert for lt operator when below threshold', () => {
    increment('service.available', {}, 0);
    const firings = evaluateAlertRules(rules);
    expect(firings.some(f => f.rule === 'low_availability')).toBe(true);
    expect(firings.find(f => f.rule === 'low_availability')?.severity).toBe('CRITICAL');
  });

  it('filters by labelFilter when specified', () => {
    const labeledRules: AlertRule[] = [
      { name: 'payment_errors', metricName: 'span.errors_total', threshold: 2, operator: 'gt', severity: 'CRITICAL', labelFilter: { span: 'payment' } },
    ];
    increment('span.errors_total', { span: 'payment' }, 5);
    increment('span.errors_total', { span: 'other' }, 10);
    const firings = evaluateAlertRules(labeledRules);
    expect(firings).toHaveLength(1);
    expect(firings[0].rule).toBe('payment_errors');
  });

  it('returns no firings when no metrics recorded', () => {
    const firings = evaluateAlertRules(rules);
    expect(firings).toHaveLength(0);
  });
});
