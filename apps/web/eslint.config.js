import { defineConfig } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import {
  createConfigRootDefaults,
  createUntypedToolingConfig,
  sharedTypeScriptStyleRules,
  sharedTypedRules,
} from '../../eslint.shared.mjs';

export default defineConfig(
  createConfigRootDefaults(import.meta.dirname),
  ...sharedTypedRules,
  {
    basePath: import.meta.dirname,
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  createUntypedToolingConfig({
    basePath: import.meta.dirname,
    files: ['eslint.config.js'],
    tsconfigRootDir: import.meta.dirname,
  }),
  {
    basePath: import.meta.dirname,
    files: ['vite.config.ts', 'vitest.config.ts'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      sourceType: 'module',
    },
  },
  {
    basePath: import.meta.dirname,
    files: ['src/**/*.{ts,tsx}', 'vite.config.ts', 'vitest.config.ts'],
    rules: {
      ...sharedTypeScriptStyleRules,
    },
  },
  reactHooks.configs.flat.recommended,
  reactRefresh.configs.vite,
);
