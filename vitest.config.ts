import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'firebase/auth': new URL('./tests/stubs/firebase-auth.ts', import.meta.url).pathname,
      'app-core-kit': new URL('./tests/stubs/app-core-kit.ts', import.meta.url).pathname,
    },
  },
  test: { include: ['tests/**/*.test.ts'] },
});
