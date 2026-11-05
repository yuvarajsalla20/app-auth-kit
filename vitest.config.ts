import { defineConfig } from 'vitest/config';

const stub = (name: string) => new URL(`./tests/stubs/${name}`, import.meta.url).pathname;

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      'firebase/auth': stub('firebase-auth.ts'),
      'app-core-kit': stub('app-core-kit.ts'),
      'react-native-safe-area-context': stub('safe-area.ts'),
      'react-native': stub('react-native.tsx'),
    },
  },
  test: { include: ['tests/**/*.test.{ts,tsx}'] },
});
