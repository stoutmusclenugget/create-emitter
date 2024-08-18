import dts from 'vite-plugin-dts';
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// https://vitejs.dev/config/

export default defineConfig({
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'lib/main.ts'),
      fileName: 'main',
      formats: ['es'],
      name: 'createEmitter',
    },
  },
  resolve: {
    alias: {
      src: resolve('lib/'),
    },
  },
  plugins: [
    dts({
      include: ['lib'],
      exclude: ['**/*.test.*'],
    }),
  ],
});
