import _ from '@eslint/js';
import next from 'eslint-config-next';
import tseslint from 'typescript-eslint';

const config = [
  ...tseslint.configs.recommended,
  ...next,
  {
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      // React 18+ JSX Transform doesn't require React import
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
      // Allow unused vars with underscore prefix
      '@typescript-eslint/no-unused-vars': ['error', { 'argsIgnorePattern': '^_', 'varsIgnorePattern': '^_' }],
      // Allow global types
      'no-undef': 'off',
    },
  },
];

export default config;
