import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config([
  // Ignore patterns
  {
    ignores: ['dist/**', 'build/**', '*.d.ts', 'node_modules/**'],
  },
  // Base config for all files
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // TypeScript specific settings
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  // JavaScript specific settings for CommonJS files
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'commonjs',
      globals: {
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-undef': 'off',
    },
  },
]);
