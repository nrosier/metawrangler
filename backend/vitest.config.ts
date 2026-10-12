import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    // auth.ts reads AUTHENTIK_ADMIN_GROUP at module load time and throws via
    // assertAdminGroupConfigured() if it's unset — give tests a value so
    // importing the module doesn't require every test file to stub it.
    env: {
      AUTHENTIK_ADMIN_GROUP: "admins",
    },
    // Coverage configuration — measure branch, function, line, statement coverage
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/__tests__/**",
        "**/node_modules/**",
        "dist/**",
      ],
      // Set thresholds for critical security/job/path-handling code
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70,
      },
      // Skip coverage for type-only files and generated code
      skipFull: false,
    },
  },
});
