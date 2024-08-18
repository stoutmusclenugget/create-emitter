import eslintConfigPrettier, { rules } from 'eslint-config-prettier';
import globals from 'globals';
import pluginjs from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    ignores: ['coverage', 'public', 'dist', 'pnpm-lock.yaml'],
    rules: {
      'no-empty': 'off',
      'no-explicit-any': 'off',
    },
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  pluginjs.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
];
