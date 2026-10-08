// The last step shared by every sign-in method (password, phone code, Google): MFA gate, evidence,
// session creation for the web (HttpOnly cookie) or the app (bearer token for the OS secure store).
import type { NextResponse } from 'next/server';
import { json } from '../core/http';
import { recordSecurityEvent } from '../core/security-events';
import { hasMfaEnabled, issueMfaChallenge } from './mfa-service';
import { createSession, type SessionAuthMethod } from './sessions';
import { createMobileSession, type MobilePlatform } from './mobile-sessions';
import { setSessionCookie } from './session-cookie';
import { recordLoginSuccess } from './account-security';
import { REFERRAL_COOKIE } from '../referrals/service';
import { AppError } from '../core/errors';

/** Only same-site relative paths survive as a post-sign-in destination (no open redirect). */
export function safeNextPath(raw: unknown, fallback = '/dashboard') {
  if (typeof raw !== 'string' || raw.length > 300) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\') || /[\u0000-\u001f]/.test(raw)) return fallback;
  if (raw.startsWith('/auth') || raw.startsWith('/api/')) return fallback;
  return raw;
}

export function describeUserAgent(ua: string | null | undefined) {
  const s = ua ?? '';
  const browser = /Edg\//.test(s) ? 'Edge' : /Firefox\//.test(s) ? 'Firefox' : /Chrome\//.test(s) ? 'Chrome' : /Safari\//.test(s) ? 'Safari' : 'مرورگر';
  const os = /iPhone|iPad/.test(s) ? 'iOS' : /Android/.test(s) ? 'Android' : /Windows/.test(s) ? 'Windows' : /Mac OS X/.test(s) ? 'macOS' : /Linux/.test(s) ? 'Linux' : '';
  return os ? `${browser} — ${os}` : browser;
}

type Common = { userId: string; method: SessionAuthMethod; ip: string; userAgent?: string; correlationId: string; created?: boolean };

/** MFA gate + evidence + web session row. The caller decides how to answer (JSON or redirect page). */
export async function beginWebSession(input: Common): Promise<{ kind: 'mfa'; challengeToken: string } | { kind: 'session'; token: string }> {
  if (await hasMfaEnabled(input.userId)) {
    await recordSecurityEvent({ eventType: 'MFA_CHALLENGE_ISSUED', severity: 'INFO', userId: input.userId, sourceIp: input.ip, userAgent: input.userAgent, correlationId: input.correlationId, metadata: { method: input.method } });
    return { kind: 'mfa', challengeToken: await issueMfaChallenge(input.userId) };
  }
  await recordLoginSuccess(input.userId);
  await recordSecurityEvent({ eventType: 'LOGIN_SUCCESS', severity: 'INFO', userId: input.userId, sourceIp: input.ip, userAgent: input.userAgent, correlationId: input.correlationId, metadata: { method: input.method, created: Boolean(input.created) } });
  const token = await createSession(input.userId, undefined, { clientType: 'WEB', authMethod: input.method, lastIp: input.ip, lastUserAgent: input.userAgent, deviceName: describeUserAgent(input.userAgent) });
  return { kind: 'session', token };
}

export async function completeWebSignIn(input: Common & { next?: string }): Promise<NextResponse> {
  const result = await beginWebSession(input);
  if (result.kind === 'mfa') return json({ ok: true, mfaRequired: true, challengeToken: result.challengeToken }, { correlationId: input.correlationId });
  const response = json({ ok: true, created: Boolean(input.created), next: safeNextPath(input.next) }, { correlationId: input.correlationId });
  setSessionCookie(response, result.token);
  response.cookies.delete(REFERRAL_COOKIE);
  return response;
}

export type MobileDevice = { platform: MobilePlatform; deviceId: string; deviceName?: string; platformVersion?: string };

export function readMobileDevice(body: Record<string, unknown>): MobileDevice {
  const platform = typeof body.platform === 'string' ? body.platform.toUpperCase() : '';
  if (platform !== 'IOS' && platform !== 'ANDROID') throw new AppError('VALIDATION_ERROR', 'Unsupported mobile platform.');
  const deviceId = typeof body.deviceId === 'string' ? body.deviceId : '';
  if (deviceId.length < 16 || deviceId.length > 256) throw new AppError('VALIDATION_ERROR', 'deviceId is invalid.');
  return {
    platform, deviceId,
    deviceName: typeof body.deviceName === 'string' ? body.deviceName.slice(0, 120) : undefined,
    platformVersion: typeof body.platformVersion === 'string' ? body.platformVersion.slice(0, 80) : undefined,
  };
}

export async function completeMobileSignIn(input: Common & { device: MobileDevice }): Promise<NextResponse> {
  if (await hasMfaEnabled(input.userId)) {
    await recordSecurityEvent({ eventType: 'MFA_CHALLENGE_ISSUED', severity: 'INFO', userId: input.userId, sourceIp: input.ip, userAgent: input.userAgent, correlationId: input.correlationId, metadata: { method: input.method, platform: input.device.platform } });
    const challengeToken = await issueMfaChallenge(input.userId);
    return json({ ok: true, mfaRequired: true, challengeToken }, { correlationId: input.correlationId });
  }
  await recordLoginSuccess(input.userId);
  const session = await createMobileSession({ userId: input.userId, ...input.device, ip: input.ip, userAgent: input.userAgent, authMethod: input.method });
  await recordSecurityEvent({ eventType: 'MOBILE_LOGIN_SUCCESS', severity: 'INFO', userId: input.userId, sourceIp: input.ip, userAgent: input.userAgent, correlationId: input.correlationId, metadata: { platform: input.device.platform, method: input.method, created: Boolean(input.created) } });
  return json({ ok: true, accessToken: session.token, tokenType: 'Bearer', created: Boolean(input.created) }, { correlationId: input.correlationId });
}
