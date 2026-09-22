// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        // tsconfig.test.json extends tsconfig.json but includes __tests__ dirs,
        // which tsconfig.json excludes to keep the compile output clean.
        project: ["./tsconfig.test.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // Enforce consistent use of type imports
      "@typescript-eslint/consistent-type-imports": "error",
      // No floating promises — all async calls must be awaited or void-cast
      "@typescript-eslint/no-floating-promises": "error",
      // No explicit any without justification
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    // Don't lint compiled output
    ignores: ["dist/**", "node_modules/**"],
  }
);
