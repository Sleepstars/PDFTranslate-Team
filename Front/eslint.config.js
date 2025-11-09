import js from '@eslint/js';
import next from 'eslint-config-next';

export default [
  js.configs.recommended,
  ...next,
  {
    rules: {
      // Add any custom rules here if needed
    },
  },
];
