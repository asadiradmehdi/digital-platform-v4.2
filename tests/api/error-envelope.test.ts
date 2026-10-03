/**
 * Regression tests for error envelope consistency.
 * All AppErrors must produce { error: { code, message }, correlationId } shape.
 */
import { describe, it, expect } from 'vitest';
import { AppError, errorEnvelope } from '../../server/core/errors';

describe('errorEnvelope', () => {
  it('maps VALIDATION_ERROR to 400', () => {
    const result = errorEnvelope(new AppError('VALIDATION_ERROR', 'bad input'), 'cid-1');
    expect(result.status).toBe(400);
    expect(result.body.error).toMatchObject({ code: 'VALIDATION_ERROR', message: 'bad input' });
    expect(result.body.correlationId).toBe('cid-1');
  });

  it('maps NOT_FOUND to 404', () => {
    const result = errorEnvelope(new AppError('NOT_FOUND', 'resource missing'), 'cid-2');
    expect(result.status).toBe(404);
    expect(result.body.error.code).toBe('NOT_FOUND');
  });

  it('maps UNAUTHORIZED to 401', () => {
    const result = errorEnvelope(new AppError('UNAUTHORIZED', 'login required'), 'cid-3');
    expect(result.status).toBe(401);
  });

  it('maps FORBIDDEN to 403', () => {
    const result = errorEnvelope(new AppError('FORBIDDEN', 'no access'), 'cid-4');
    expect(result.status).toBe(403);
  });

  it('maps CONFLICT to 409', () => {
    const result = errorEnvelope(new AppError('CONFLICT', 'duplicate'), 'cid-5');
    expect(result.status).toBe(409);
  });

  it('maps RATE_LIMITED to 429', () => {
    const result = errorEnvelope(new AppError('RATE_LIMITED', 'slow down'), 'cid-6');
    expect(result.status).toBe(429);
  });

  it('maps PAYMENT_REQUIRED to 402', () => {
    const result = errorEnvelope(new AppError('PAYMENT_REQUIRED', 'top up wallet'), 'cid-7');
    expect(result.status).toBe(402);
  });

  it('maps UNAVAILABLE to 503', () => {
    const result = errorEnvelope(new AppError('UNAVAILABLE', 'service down'), 'cid-8');
    expect(result.status).toBe(503);
  });

  it('maps unknown errors to 500 with INTERNAL_ERROR code', () => {
    const result = errorEnvelope(new Error('unexpected'), 'cid-9');
    expect(result.status).toBe(500);
    expect(result.body.error.code).toBe('INTERNAL_ERROR');
  });

  it('error object never contains flat string — always has code+message', () => {
    const result = errorEnvelope(new AppError('NOT_FOUND', 'not found'), 'cid-10');
    // Must have structured error, not flat string
    expect(typeof result.body.error).toBe('object');
    expect(typeof result.body.error.code).toBe('string');
    expect(typeof result.body.error.message).toBe('string');
  });

  it('includes details when provided', () => {
    const result = errorEnvelope(
      new AppError('VALIDATION_ERROR', 'invalid field', { field: 'email' }),
      'cid-11',
    );
    expect(result.body.error.details).toMatchObject({ field: 'email' });
  });
});
