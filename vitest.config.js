import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.js"],
    include: ["tests/**/*.test.js"],
    // Dummy, syntactically-valid Supabase config so sync.js's `syncAvailable`
    // is true under test and createClient() succeeds. Tests never make a
    // real network call — supabase.from is monkeypatched per test.
    env: {
      VITE_SUPABASE_URL: "https://test-project.supabase.co",
      VITE_SUPABASE_ANON_KEY: "test-anon-key",
    },
  },
});
