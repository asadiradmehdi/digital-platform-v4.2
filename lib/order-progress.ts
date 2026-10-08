// Customer-facing order stage: a four-step track (paid → queued → sent → done) derived from the
// real order status. It never invents a percentage the provider has not reported.
export type OrderStage = { label: string; steps: number; tone: 'live' | 'ok' | 'bad' };

const STAGES: Record<string, OrderStage> = {
  CREATED: { label: 'در انتظار پرداخت', steps: 0, tone: 'live' },
  PAYMENT_PENDING: { label: 'در انتظار پرداخت', steps: 0, tone: 'live' },
  PAID: { label: 'پرداخت شد', steps: 1, tone: 'live' },
  QUEUED: { label: 'در صف انجام', steps: 1, tone: 'live' },
  PROCESSING: { label: 'در حال ارسال', steps: 2, tone: 'live' },
  PROVIDER_SUBMITTED: { label: 'ارسال شد', steps: 2, tone: 'live' },
  IN_PROGRESS: { label: 'در حال انجام', steps: 3, tone: 'live' },
  COMPLETED: { label: 'تکمیل شد', steps: 4, tone: 'ok' },
  FAILED: { label: 'ناموفق', steps: 4, tone: 'bad' },
  CANCELLED: { label: 'لغو شد', steps: 4, tone: 'bad' },
  REFUND_PENDING: { label: 'در حال بازگشت وجه', steps: 4, tone: 'bad' },
  REFUNDED: { label: 'وجه بازگشت داده شد', steps: 4, tone: 'bad' },
};

/** Team-fulfilled services (design, automation, AI content, AI plans) are worked on by people, not a provider. */
const TEAM_STAGES: Record<string, OrderStage> = {
  PAID: { label: 'پرداخت شد', steps: 1, tone: 'live' },
  QUEUED: { label: 'در حال انجام توسط تیم', steps: 2, tone: 'live' },
  IN_PROGRESS: { label: 'در حال انجام توسط تیم', steps: 3, tone: 'live' },
  COMPLETED: { label: 'تحویل شد', steps: 4, tone: 'ok' },
};

export function orderStage(status: string, team = false): OrderStage {
  return (team ? TEAM_STAGES[status] : undefined) ?? STAGES[status] ?? { label: status, steps: 0, tone: 'live' };
}
