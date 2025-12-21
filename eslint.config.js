// eslint.config.js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import sonarjs from 'eslint-plugin-sonarjs'
import importPlugin from 'eslint-plugin-import';
import promisePlugin from 'eslint-plugin-promise';
import unicornPlugin from 'eslint-plugin-unicorn';
import securityPlugin from 'eslint-plugin-security';
import commentsPlugin from 'eslint-plugin-eslint-comments';
import perfectionistPlugin from 'eslint-plugin-perfectionist';

export default [
    // ignore build artifacts
    { ignores: ['**/dist/**', '**/build/**', '**/.turbo/**', '**/coverage/**'] },

    // base JS rules
    js.configs.recommended,

    // base TS rules plus type-aware overlays
    ...tseslint.configs.recommended,
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                // works well in monorepos with multiple tsconfigs
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        plugins: { '@typescript-eslint': tseslint.plugin,
            sonarjs,
            importPlugin,
            promisePlugin,
            unicornPlugin,
            securityPlugin,
            commentsPlugin,
            perfectionistPlugin
        },
        rules: {
            /* Complexity and structure */
            complexity: ['error', { max: 15 }],
            'max-depth': ['warn', 6],
            'max-lines': ['error', 1000],
            'max-lines-per-function': ['error', 100],
            'max-params': ['warn', 4],
            // Cognitive complexity per function (Sonar methodology)
            'sonarjs/cognitive-complexity': ['error', 15],
            // Optional hardening to catch path explosion
            'max-nested-callbacks': ['warn', 3],
        },
    },

    // React-only block: applies only in the React app folder
    {
        files: ['apps/client/**/*.{js,jsx,ts,tsx}'],
        plugins: {
            react,
            'react-hooks': reactHooks,
            'jsx-a11y': jsxA11y,
        },
        settings: { react: { version: 'detect' } },
        // use the plugins' flat presets and then tweak
        rules: {
            ...react.configs.flat.recommended.rules,
            ...react.configs.flat['jsx-runtime'].rules,
            ...reactHooks.configs.recommended.rules,
            ...jsxA11y.configs.recommended.rules,
            'react/react-in-jsx-scope': 'off',
            'react/jsx-uses-react': 'off',
            // The client surface intentionally keeps large composite components and Zustand stores
            // together for ease of editing, so relax the structural rules for that workspace.
            complexity: 'off',
            'sonarjs/cognitive-complexity': 'off',
            'max-lines': 'off',
            'max-lines-per-function': 'off',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/strict-boolean-expressions': 'off',
            '@typescript-eslint/no-unnecessary-type-assertion': 'off',
            'securityPlugin/detect-object-injection': 'off',
            'unicornPlugin/no-array-reduce': 'off',
            'jsx-a11y/no-noninteractive-tabindex': 'off',
        },
    },

    // 5) Config files anywhere: allow default export
    {
        files: ["**/*config.{ts,js,mts,cjs,cts}"],
        languageOptions: {
            parserOptions: {
                // config files usually don't need type-checking
                project: null, // turn off type-aware lint for these files
            },
        },
        rules: {
            "import/no-default-export": "off",
            // if your rule name was namespaced differently, disable that too:
            "importPlugin/no-default-export": "off",
        },
    }
];
