import { defineConfig } from 'eslint/config';
import globals from 'globals';
import {
  createConfigRootDefaults,
  createUntypedToolingConfig,
  sharedTypedRules,
} from '../../eslint.shared.mjs';

export default defineConfig(
  createConfigRootDefaults(import.meta.dirname),
  ...sharedTypedRules,
  {
    basePath: import.meta.dirname,
    files: ['src/**/*.ts'],
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
  createUntypedToolingConfig({
    basePath: import.meta.dirname,
    files: ['eslint.config.mjs'],
    tsconfigRootDir: import.meta.dirname,
  }),
);
