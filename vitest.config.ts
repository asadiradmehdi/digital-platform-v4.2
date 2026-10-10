import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Unit tests assert absolute URLs against the dev origin whatever the shell or CI sets for the site URL.
    env: { NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' },
    exclude: [
      '**/node_modules/**',
      '**/e2e/**',
      '**/tests/visual/**',
    ],
    hookTimeout: 60000,
    testTimeout: 60000,
  },
});
