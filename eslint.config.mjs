import { defineConfig } from 'eslint/config';
import globals from 'globals';
import {
  createConfigRootDefaults,
  createUntypedToolingConfig,
  sharedTypedRules,
} from './eslint.shared.mjs';

const toolingFiles = [
  'eslint.config.mjs',
  'eslint.shared.mjs',
  'apps/*/eslint.config.js',
  'apps/*/eslint.config.mjs',
  'apps/*/eslint.config.cjs',
];

const toolingConfig = defineConfig(
  createConfigRootDefaults(import.meta.dirname),
  ...sharedTypedRules,
  {
    files: toolingFiles,
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.node,
      sourceType: 'module',
    },
  },
  createUntypedToolingConfig({
    files: toolingFiles,
    tsconfigRootDir: import.meta.dirname,
  }),
);

export default toolingConfig;
