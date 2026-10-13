import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Matches text that contains at least one letter, i.e. something a user would read. */
const READABLE_TEXT = /\p{L}/u;

/** JSX attributes that are shown to users and therefore must come from the i18n files. */
const UI_ATTRIBUTES = new Set(['title', 'placeholder', 'alt', 'aria-label', 'label']);

/**
 * Local rules of the Blockwerk repository.
 * `no-ui-literals`: user-facing texts must come from the i18n files, never be hard-coded in JSX.
 */
const blockwerkPlugin = {
  rules: {
    'no-ui-literals': {
      meta: {
        type: 'problem',
        docs: { description: 'Disallow hard-coded user-facing text in JSX.' },
        messages: {
          literal: 'User-facing text must come from the i18n files (use t()), found "{{text}}".',
        },
        schema: [],
      },
      create(context) {
        return {
          JSXText(node) {
            const text = node.value.trim();
            if (READABLE_TEXT.test(text)) {
              context.report({ node, messageId: 'literal', data: { text } });
            }
          },
          JSXAttribute(node) {
            const name = typeof node.name.name === 'string' ? node.name.name : '';
            const value = node.value;
            if (
              UI_ATTRIBUTES.has(name) &&
              value?.type === 'Literal' &&
              typeof value.value === 'string' &&
              READABLE_TEXT.test(value.value)
            ) {
              context.report({ node, messageId: 'literal', data: { text: value.value } });
            }
          },
        };
      },
    },
  },
};

export default defineConfig(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-electron/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      'library/**',
      '**/*.expected.js',
    ],
  },
  js.configs.recommended,
  tseslint.configs.strict,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['apps/editor/src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat['recommended-latest']],
    plugins: { blockwerk: blockwerkPlugin },
    rules: {
      'blockwerk/no-ui-literals': 'error',
    },
  },
  {
    files: ['packages/runtime/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['blockly', 'react', 'react-dom', 'zustand', 'dockview', 'dockview-react'].map(
            (name) => ({
              name,
              message: 'packages/runtime must not depend on the editor, React or Blockly.',
            }),
          ),
          patterns: [
            {
              group: ['blockly/*', 'react/*'],
              message: 'packages/runtime must not depend on the editor, React or Blockly.',
            },
            {
              group: [
                '@blockwerk/editor',
                '@blockwerk/desktop',
                '@blockwerk/compiler',
                '**/apps/**',
              ],
              message: 'packages/runtime must not import from apps or the compiler.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/compiler/src/**/*.ts', 'packages/blocks/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['blockly', 'three', '@blockwerk/runtime'].map((name) => ({
            name,
            message: 'blocks and compiler are pure: no Blockly, three.js or runtime imports.',
          })),
          patterns: [
            {
              group: ['blockly/*', 'three/*'],
              message: 'blocks and compiler are pure: no Blockly, three.js or runtime imports.',
            },
          ],
        },
      ],
    },
  },
);
