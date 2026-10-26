import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        console: 'readonly',
        require: 'readonly',
        module: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Headers: 'readonly',
        Response: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        AbortController: 'readonly',
        __DEV__: 'readonly',
        NodeJS: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      ...typescript.configs.recommended.rules,
      // Disable some rules that might be too strict for React Native
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-function': 'off',
      'no-console': 'warn',
      // Icons come from src/ui/icons.ts. Importing values from the phosphor root
      // would bundle all ~1,500 icons (Metro can't tree-shake); types are fine.
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            { name: '@expo/vector-icons', message: 'Use <Icon name=…> from src/ui/Icon instead.' },
            { name: 'react-native-vector-icons', message: 'Use <Icon name=…> from src/ui/Icon instead.' },
            {
              name: 'phosphor-react-native',
              message: "Deep-import icons ('phosphor-react-native/src/icons/<Name>') via src/ui/icons.ts.",
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/__tests__/**/*.{ts,tsx}', '**/__mocks__/**/*.{ts,tsx,js}', 'src/setupTests.ts'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
  },
  {
    files: ['**/*.js', '**/*.jsx'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        require: 'readonly',
        module: 'readonly',
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
      },
    },
  },
  {
    // cricbuddy-api (server/): plain Node 20, compiled with its own tsconfig.
    files: ['server/**/*.ts'],
    languageOptions: {
      globals: {
        process: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        require: 'readonly',
        module: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        Response: 'readonly',
        RequestInit: 'readonly',
        Headers: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        NodeJS: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'server/dist/**',
      'server/node_modules/**',
      'build/**',
      '.expo/**',
      'ios/**',
      'android/**',
      '**/*.d.ts',
    ],
  },
];
