export type AppErrorCode =
  | 'VALIDATION_ERROR' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND'
  | 'CONFLICT' | 'RATE_LIMITED' | 'UNAVAILABLE' | 'INTERNAL_ERROR'
  | 'PAYMENT_REQUIRED' | 'PROVIDER_ERROR' | 'RISK_REVIEW';

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
    public readonly cause?: unknown,
  ) { super(message); this.name = 'AppError'; }
}

export function errorEnvelope(error: unknown, correlationId: string) {
  if (error instanceof AppError) {
    const status = { VALIDATION_ERROR:400, UNAUTHORIZED:401, FORBIDDEN:403, NOT_FOUND:404, CONFLICT:409, RATE_LIMITED:429, PAYMENT_REQUIRED:402, RISK_REVIEW:409, UNAVAILABLE:503, PROVIDER_ERROR:502, INTERNAL_ERROR:500 }[error.code];
    return { status, body: { error: { code: error.code, message: error.message, details: error.details }, correlationId } };
  }
  return { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'خطای داخلی سرور.' }, correlationId } };
}
