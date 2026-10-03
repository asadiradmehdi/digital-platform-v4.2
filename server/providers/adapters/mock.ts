import type { ProviderAdapter, ProviderContext, ProviderSubmitInput, ProviderSubmitResult } from '../contracts';

export type MockAdapterConfig = {
  submitStatus?: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  failOnSubmit?: boolean;
  balance?: { amountMinor: bigint; currency: string };
};

export class MockProviderAdapter implements ProviderAdapter {
  readonly providerType = 'mock';
  private cfg: MockAdapterConfig;

  constructor(cfg: MockAdapterConfig = {}) {
    this.cfg = cfg;
  }

  async submit(input: ProviderSubmitInput, context: ProviderContext): Promise<ProviderSubmitResult> {
    if (this.cfg.failOnSubmit) throw new Error('Mock provider: simulated submit failure');
    return {
      externalOrderId: `mock-${context.idempotencyKey}`,
      status: this.cfg.submitStatus ?? 'PROCESSING',
      raw: { mock: true, externalServiceId: input.externalServiceId },
    };
  }

  async status(externalOrderId: string, _context: ProviderContext) {
    return { status: 'COMPLETED' as const, raw: { mock: true, externalOrderId } };
  }

  async cancel(_externalOrderId: string, _context: ProviderContext) {
    // no-op
  }

  async balance() {
    return this.cfg.balance ?? { amountMinor: 100_000n, currency: 'USD' };
  }
}
