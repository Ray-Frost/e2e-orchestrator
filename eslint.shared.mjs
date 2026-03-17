import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export const baseIgnores = ['**/dist/**', '**/node_modules/**', '**/*.d.ts'];

export const sharedTypedRules = [
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintConfigPrettier,
];

export const sharedTypeScriptStyleRules = {
  'no-use-before-define': 'off',
  '@typescript-eslint/no-use-before-define': [
    'error',
    {
      functions: true,
      classes: true,
      variables: true,
      typedefs: false,
      ignoreTypeReferences: true,
    },
  ],
  '@typescript-eslint/naming-convention': [
    'error',
    {
      selector: ['variable', 'parameter'],
      types: ['boolean'],
      format: ['StrictPascalCase'],
      prefix: ['is', 'has', 'can', 'should'],
    },
  ],
};

export function createConfigRootDefaults(tsconfigRootDir) {
  return {
    ignores: baseIgnores,
    languageOptions: {
      parserOptions: {
        tsconfigRootDir,
      },
    },
  };
}

export function createUntypedToolingConfig({
  files,
  tsconfigRootDir,
  basePath,
}) {
  return {
    ...(basePath ? { basePath } : {}),
    files,
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      parserOptions: {
        ...tseslint.configs.disableTypeChecked.languageOptions.parserOptions,
        tsconfigRootDir,
      },
      ecmaVersion: 2023,
      globals: globals.node,
      sourceType: 'module',
    },
  };
}
