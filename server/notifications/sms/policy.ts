// SMS messaging policy (decided with the owner):
//  - SMS, as Melipayamak patterns on the shared service line, ONLY for: sign-in codes, order registered,
//    order completed, payment receipt (and the reply to an «استعلام وضعیت» text).
//  - Sign-in codes and payment receipts always go out. Order SMS can be switched off by the customer
//    (notification_preferences channel 'sms', category 'orders'; on by default).
//  - Everything else (order started, stopped, ticket answered, …) is in-app only (bell + inbox).
//  - SMS only ever goes to a VERIFIED number.
import { query } from '../../core/db';
import type { SmsTemplate } from './types';

export const ALWAYS_ON_SMS: ReadonlySet<SmsTemplate> = new Set<SmsTemplate>(['otp', 'payment_receipt', 'status_reply']);
export const SMS_TEMPLATE_CATEGORY: Record<SmsTemplate, 'security' | 'orders' | 'payments'> = {
  otp: 'security', order_registered: 'orders', order_completed: 'orders', payment_receipt: 'payments', status_reply: 'orders',
};

export async function smsAllowedFor(userId: string, template: SmsTemplate): Promise<boolean> {
  if (ALWAYS_ON_SMS.has(template)) return true;
  const r = await query<{ enabled: boolean }>(
    `SELECT enabled FROM notification_preferences WHERE user_id=$1 AND channel='sms' AND category=$2`,
    [userId, SMS_TEMPLATE_CATEGORY[template]],
  );
  return r.rows[0]?.enabled ?? true;
}

