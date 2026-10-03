import { logger } from './logger';
import { snapshotMetrics } from './metrics';
import { recordOperationalEvent } from './operational-events';

export type AlertSeverity = 'WARNING' | 'HIGH' | 'CRITICAL';

export type AlertRule = {
  name: string;
  metricName: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'gte' | 'lte';
  severity: AlertSeverity;
  labelFilter?: Record<string, string>;
};

export type AlertFiring = {
  rule: string;
  metricName: string;
  value: number;
  threshold: number;
  severity: AlertSeverity;
  firedAt: string;
};

export const DEFAULT_ALERT_RULES: AlertRule[] = [
  { name: 'high_span_error_rate', metricName: 'span.errors_total', threshold: 100, operator: 'gt', severity: 'HIGH' },
  { name: 'slow_p95_latency', metricName: 'span.duration_ms.max', threshold: 5000, operator: 'gt', severity: 'WARNING', labelFilter: { span: 'api.request' } },
  { name: 'payment_errors', metricName: 'span.errors_total', threshold: 10, operator: 'gt', severity: 'CRITICAL', labelFilter: { span: 'payment.process' } },
];

export function evaluateAlertRules(rules: AlertRule[] = DEFAULT_ALERT_RULES): AlertFiring[] {
  const metrics = snapshotMetrics();
  const firings: AlertFiring[] = [];

  for (const rule of rules) {
    const matching = metrics.filter(m => {
      if (m.name !== rule.metricName) return false;
      if (rule.labelFilter) {
        for (const [k, v] of Object.entries(rule.labelFilter)) {
          if (String(m.labels[k]) !== v) return false;
        }
      }
      return true;
    });

    for (const metric of matching) {
      let triggered = false;
      switch (rule.operator) {
        case 'gt': triggered = metric.value > rule.threshold; break;
        case 'lt': triggered = metric.value < rule.threshold; break;
        case 'gte': triggered = metric.value >= rule.threshold; break;
        case 'lte': triggered = metric.value <= rule.threshold; break;
      }
      if (triggered) {
        firings.push({ rule: rule.name, metricName: rule.metricName, value: metric.value, threshold: rule.threshold, severity: rule.severity, firedAt: new Date().toISOString() });
      }
    }
  }

  return firings;
}

export async function runAlertScan(workspaceId?: string): Promise<AlertFiring[]> {
  const firings = evaluateAlertRules();
  for (const firing of firings) {
    logger.warn('alert.fired', { workspaceId }, { rule: firing.rule, severity: firing.severity, value: firing.value, threshold: firing.threshold });
    await recordOperationalEvent({
      workspaceId,
      eventType: 'alert.fired',
      severity: firing.severity,
      metadata: firing,
    }).catch(() => undefined);
  }
  return firings;
}
