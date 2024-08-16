import { defineConfig } from "vite";
import { resolve } from "node:path";

// https://vitejs.dev/config/

export default defineConfig({
  build: {
    lib: {
      entry: resolve(import.meta.dirname, "src/main.ts"),
      formats: ["es"],
    },
  },
  resolve: {
    alias: {
      src: resolve("src/"),
    },
  },
});
