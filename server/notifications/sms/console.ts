// Development SMS provider: prints the message to the server log instead of sending it.
// Refused in production (see allowConsoleSmsProvider) so a misconfiguration can never silently "send"
// real customers' codes to a log file.
import { randomUUID } from 'node:crypto';
import { maskIranMobile } from '../../../packages/api-contracts/src/phone';
import type { SmsProvider } from './types';

/**
 * Allowed outside production. A production build may use it only when explicitly opted in AND the
 * public site URL is a loopback address (local `next start` verification), never on a real host.
 */
export function allowConsoleSmsProvider(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV !== 'production') return true;
  if (env.SMS_CONSOLE_LOCAL_ONLY !== 'true') return false;
  try {
    const host = new URL(env.NEXT_PUBLIC_SITE_URL ?? '').hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  } catch { return false; }
}

export class ConsoleSmsProvider implements SmsProvider {
  readonly name = 'console';
  async sendPattern(to: string, patternId: string, args: string[]) {
    console.info(`[sms:console] to=${maskIranMobile(to)} pattern=${patternId} args=${JSON.stringify(args)}`);
    return { providerReference: `console-${randomUUID()}` };
  }
  sendOtp(to: string, code: string) {
    // The full code is printed on purpose: this provider exists only for local development.
    console.info(`[sms:console] OTP for ${maskIranMobile(to)}: ${code}`);
    return Promise.resolve({ providerReference: `console-${randomUUID()}` });
  }
}
