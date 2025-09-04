import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import ts from '@typescript-eslint/eslint-plugin';
// import tsParser from '@typescript-eslint/parser';
import solid from 'eslint-plugin-solid';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';

export default defineConfig([
    // default ignores: ['**/node_modules/', '.git/']
    globalIgnores([
        'main.js',
    ]),
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            // ecmaVersion: 'latest', // default
            // sourceType: 'module', // default
            // parser: tsParser, // set by ts/recommended[0]
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
        plugins: {
            js,
            ts,
            solid, // necessary, o/w we get error: Could not find plugin "solid" in configuration.
            '@stylistic': stylistic // using the original name because we're not loading any preset in `extends`
        },
        extends: [
            'js/recommended',
            // 'ts/eslint-recommended', // included in ts/recommended, see https://typescript-eslint.io/users/configs
            'ts/recommended',
            // 'solid/typescript', // can't enable, o/w we get error: Key "plugins": Cannot redefine plugin "solid".
        ],
        rules: {
            'no-prototype-builtins': 'warn',

            '@typescript-eslint/ban-ts-comment': 'warn',
            '@typescript-eslint/no-empty-function': 'warn',
            '@typescript-eslint/no-unused-vars': ['warn', { args: 'none' }], // args: 'all' | 'after-used' | 'none'

            ...solid.configs['flat/typescript'].rules,
            // ...solid.configs.typescript.rules, // same rules but for legacy config, containing `env` etc

            '@stylistic/indent': ['warn', 'tab'],
            '@stylistic/quotes': ['warn', 'single'],
        },
    },
]);
