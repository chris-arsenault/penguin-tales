import react from 'eslint-plugin-react';
import reactPerf from 'eslint-plugin-react-perf';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['**/dist/**', '**/build/**', '**/.turbo/**', '**/coverage/**'] },
  {
    files: [
      'apps/**/webui/**/*.{js,jsx,ts,tsx}',
      'packages/shared-components/**/*.{js,jsx,ts,tsx}',
    ],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { react, 'react-perf': reactPerf },
    settings: { react: { version: 'detect' } },
    rules: {
      'react-perf/jsx-no-new-object-as-prop': 'warn',
      'react-perf/jsx-no-new-array-as-prop': 'warn',
      'react-perf/jsx-no-new-function-as-prop': 'warn',
      'react-perf/jsx-no-jsx-as-prop': 'warn',
      'react/jsx-no-constructed-context-values': 'warn',
    },
  },
];
