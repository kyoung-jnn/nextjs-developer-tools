import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import eslintConfigPrettier from "eslint-config-prettier";

/** @type {import('eslint').Linter.Config[]} */
export default [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2021,
        chrome: "readonly",
      },
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
  },
  {
    files: ["**/*.ts"],
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
  {
    ignores: ["dist/**", "node_modules/**", "*.config.js", "*.config.ts"],
  },
];
