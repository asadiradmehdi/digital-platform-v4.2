// SMS provider adapter contract. Every outbound SMS goes through an SmsProvider; nothing else in the
// codebase talks to an SMS panel directly.

/** Transactional messages sent as pre-approved patterns (Melipayamak «ارسال با خط خدماتی اشتراکی»). */
export type SmsTemplate = 'otp' | 'order_registered' | 'order_completed' | 'payment_receipt' | 'status_reply';

export type SmsSendResult = { providerReference: string };

export type SmsErrorKind =
  | 'not_configured' // credentials/pattern missing: do not retry until configured
  | 'rejected'       // provider refused the request (bad key, pattern, number, credit): do not retry blindly
  | 'unavailable'    // network/5xx/timeout: retry later
  ;

export class SmsProviderError extends Error {
  constructor(public readonly kind: SmsErrorKind, message: string, public readonly providerCode?: string) {
    super(message);
    this.name = 'SmsProviderError';
  }
  get retryable() { return this.kind === 'unavailable'; }
}

export interface SmsProvider {
  readonly name: string;
  /** `to` is E.164 (+989…). `patternId` is the provider's pattern/body id; args fill {0}, {1}, … */
  sendPattern(to: string, patternId: string, args: string[]): Promise<SmsSendResult>;
  /** Sends a one-time code with the configured OTP pattern. */
  sendOtp(to: string, code: string): Promise<SmsSendResult>;
}

/** Customer-facing Persian sentence for a failed OTP delivery (never leaks provider details). */
export function smsErrorMessage(error: unknown): string {
  if (error instanceof SmsProviderError && error.kind === 'not_configured') return 'ورود با پیامک موقتاً در دسترس نیست. از روش دیگری وارد شوید.';
  if (error instanceof SmsProviderError && error.kind === 'rejected') return 'ارسال پیامک به این شماره انجام نشد. شماره را بررسی کنید یا کمی بعد دوباره تلاش کنید.';
  return 'ارسال پیامک با تأخیر روبه‌رو شد. چند لحظه بعد دوباره تلاش کنید.';
}
