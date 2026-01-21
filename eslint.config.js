import { defineConfig } from "eslint/config";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import eslintConfigPrettier from "eslint-config-prettier";

export default defineConfig([
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  // Base configuration for all files
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
  },
  // TypeScript files - shared rules
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": ["warn", { allow: ["log", "warn", "error", "info"] }],
    },
  },
  // Extension package - Chrome API globals
  {
    files: ["packages/extension/**/*.ts"],
    languageOptions: {
      globals: {
        chrome: "readonly",
      },
    },
  },
  // Playground package - React/Next.js specific
  {
    files: ["packages/playground/**/*.tsx"],
    languageOptions: {
      globals: {
        React: "readonly",
      },
    },
  },
  // Ignore patterns
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "*.config.js",
      "*.config.ts",
      "packages/*/dist/**",
      "packages/*/.next/**",
      "packages/*/node_modules/**",
    ],
  },
]);
