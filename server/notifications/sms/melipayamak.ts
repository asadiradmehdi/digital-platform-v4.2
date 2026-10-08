// Melipayamak (ملی پیامک) adapter — pattern ("shared service number") sending through the console REST API:
//   POST https://console.melipayamak.com/api/send/shared/{apiKey}
//   body: {"bodyId": <pattern id>, "to": "09xxxxxxxxx", "args": ["…", "…"]}
//   reply: {"recId": <long>, "status": "<message>"}
// Shape taken from Melipayamak's console API (and its official Node client, node-melipayamak 1.0.9:
// BASE_URL https://console.melipayamak.com/api, SEND.SHARED 'send/shared'). The sandbox this was written in
// cannot reach the panel, so the live call is UNTESTED here; the adapter is covered with a mocked fetch.
import { toLocalIranMobile } from '../../../packages/api-contracts/src/phone';
import { SmsProviderError, type SmsProvider, type SmsSendResult } from './types';

export type MelipayamakConfig = { apiKey: string; otpPatternId: string; baseUrl?: string; timeoutMs?: number };

const DEFAULT_BASE = 'https://console.melipayamak.com/api';

export class MelipayamakSmsProvider implements SmsProvider {
  readonly name = 'melipayamak';
  constructor(private readonly config: MelipayamakConfig, private readonly fetchImpl: typeof fetch = fetch) {}

  async sendPattern(to: string, patternId: string, args: string[]): Promise<SmsSendResult> {
    if (!this.config.apiKey) throw new SmsProviderError('not_configured', 'Melipayamak API key is not configured.');
    const bodyId = Number(patternId);
    if (!Number.isSafeInteger(bodyId) || bodyId <= 0) throw new SmsProviderError('not_configured', 'Melipayamak pattern id is not configured.');
    if (!/^\+989\d{9}$/.test(to)) throw new SmsProviderError('rejected', 'Recipient is not an Iranian mobile number.');
    // The panel joins/escapes nothing for us: a ';' or newline inside an argument would corrupt the pattern.
    const safeArgs = args.map(a => String(a).replace(/[;\r\n]+/g, ' ').trim().slice(0, 120));
    const url = `${this.config.baseUrl ?? DEFAULT_BASE}/send/shared/${encodeURIComponent(this.config.apiKey)}`;
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', 'cache-control': 'no-cache' },
        body: JSON.stringify({ bodyId, to: toLocalIranMobile(to), args: safeArgs }),
        signal: AbortSignal.timeout(this.config.timeoutMs ?? 8_000),
        redirect: 'error',
      });
    } catch (error) {
      const timeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
      throw new SmsProviderError('unavailable', timeout ? 'Melipayamak request timed out.' : 'Melipayamak is unreachable.');
    }
    const text = await response.text().catch(() => '');
    if (response.status >= 500) throw new SmsProviderError('unavailable', `Melipayamak HTTP ${response.status}.`);
    if (!response.ok) throw new SmsProviderError('rejected', `Melipayamak HTTP ${response.status}.`, String(response.status));
    // recId is a 64-bit integer: read it from the raw text so JSON.parse cannot round it.
    const recId = /"recId"\s*:\s*"?(-?\d+)"?/i.exec(text)?.[1];
    const status = (/"status"\s*:\s*"([^"]*)"/i.exec(text)?.[1] ?? '').slice(0, 200);
    // A delivered request returns a long message id; failures return a small code (e.g. -1, 0, 11, 35).
    if (recId && /^\d{5,}$/.test(recId)) return { providerReference: recId };
    throw new SmsProviderError('rejected', `Melipayamak refused the message (${recId ?? 'no recId'}${status ? `: ${status}` : ''}).`, recId);
  }

  sendOtp(to: string, code: string) {
    return this.sendPattern(to, this.config.otpPatternId, [code]);
  }
}
