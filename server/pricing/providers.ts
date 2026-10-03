import { AppError } from '../core/errors';

export type FxProvider = {
  name: string;
  getRate(baseCurrency: string, quoteCurrency: string, signal?: AbortSignal): Promise<{ numerator: bigint; denominator: bigint; metadata?: Record<string, unknown> }>;
};

/**
 * HTTP provider contract. The actual vendor endpoint/API key is configured outside
 * domain code so switching FX vendors never requires changing pricing logic.
 */
export class HttpFxProvider implements FxProvider {
  constructor(
    public readonly name: string,
    private readonly url: string,
    private readonly parser: (payload: unknown, base: string, quote: string) => { numerator: bigint; denominator: bigint; metadata?: Record<string, unknown> },
    private readonly headers: Record<string, string> = {},
  ) {}

  async getRate(baseCurrency: string, quoteCurrency: string, signal?: AbortSignal) {
    const response = await fetch(`${this.url}?base=${encodeURIComponent(baseCurrency)}&quote=${encodeURIComponent(quoteCurrency)}`, {
      headers: this.headers,
      signal,
      cache: 'no-store',
    });
    if (!response.ok) throw new AppError('PROVIDER_ERROR', `FX provider returned HTTP ${response.status}.`);
    return this.parser(await response.json(), baseCurrency, quoteCurrency);
  }
}
