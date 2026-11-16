import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/target/**',
      'packages/schema/json-schema/**',
      'apps/desktop/src-tauri/gen/**',
    ],
  },
  js.configs.recommended,
  {
    // Plain Node scripts (they run inside GitHub Actions).
    files: ['**/*.mjs'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly', setTimeout: 'readonly' },
    },
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Pillars 3 and 4: the core is headless and deterministic.
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use the seeded RNG (createRng). Math.random breaks determinism.',
        },
        {
          object: 'Date',
          property: 'now',
          message: 'The core must not depend on the wall clock.',
        },
      ],
      'no-restricted-globals': [
        'error',
        ...['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'fetch'].map(
          (name) => ({ name, message: 'packages/core is headless: no browser/DOM APIs.' }),
        ),
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'react/*', 'react-dom/*', 'vite', 'vite/*', 'node:*'],
              message: 'packages/core is headless: no UI, bundler or Node-only imports.',
            },
          ],
        },
      ],
    },
  },
);
