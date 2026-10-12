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
  },
});
