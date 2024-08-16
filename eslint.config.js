import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import pluginjs from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
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
