import eslint from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const nextFiles = ['apps/web/**/*.{js,mjs,cjs,ts,tsx}', 'apps/admin/**/*.{js,mjs,cjs,ts,tsx}'];

export default defineConfig([
  globalIgnores([
    '**/.next/**',
    '**/coverage/**',
    '**/dist/**',
    '**/node_modules/**',
    'data/source/snapshots/**',
    'data/processed/**',
    'data/canonical/**',
    'data/audits/**',
  ]),
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...nextVitals.map((config) => ({ ...config, files: nextFiles })),
  ...nextTypeScript.map((config) => ({ ...config, files: nextFiles })),
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
    settings: {
      next: {
        rootDir: ['apps/web', 'apps/admin'],
      },
    },
  },
  {
    files: ['scripts/**/*.mjs', 'packages/db/scripts/**/*.mjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['packages/ingestion/src/encoding.ts'],
    rules: {
      'no-control-regex': 'off',
    },
  },
]);
