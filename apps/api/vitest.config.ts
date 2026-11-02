import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    setupFiles: ["test/setup.ts"],
    include: ["test/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
  esbuild: {
    tsconfigRaw: { compilerOptions: { experimentalDecorators: true } },
  },
});
