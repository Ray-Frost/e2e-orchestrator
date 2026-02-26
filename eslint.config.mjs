import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const baseIgnores = ['**/dist/**', '**/node_modules/**', '**/*.d.ts'];

const sharedTypedRules = [
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintConfigPrettier,
];

const toolingFiles = [
  'eslint.config.mjs',
  'apps/*/eslint.config.js',
  'apps/*/eslint.config.mjs',
  'apps/*/eslint.config.cjs',
];

export const webConfig = defineConfig(
  {
    ignores: baseIgnores,
  },
  ...sharedTypedRules,
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  reactHooks.configs.flat.recommended,
  reactRefresh.configs.vite,
);

export const serverConfig = defineConfig(
  {
    ignores: baseIgnores,
  },
  ...sharedTypedRules,
  {
    files: ['apps/server/src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);

export const toolingConfig = defineConfig(
  {
    ignores: baseIgnores,
  },
  ...sharedTypedRules,
  {
    files: toolingFiles,
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.node,
      parserOptions: {
        projectService: {
          allowDefaultProject: toolingFiles,
          defaultProject: 'tsconfig.tools.json',
        },
        tsconfigRootDir: import.meta.dirname,
      },
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/no-deprecated': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
);

export default toolingConfig;
