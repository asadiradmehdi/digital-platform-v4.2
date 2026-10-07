import { assertProductionConfig } from './server/core/config';

export async function register() {
  assertProductionConfig();
}
