import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import eslintConfigPrettier from 'eslint-config-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unusedImports from 'eslint-plugin-unused-imports';

const eslintConfig = defineConfig([
    ...nextVitals,
    ...nextTs,

    {
        plugins: {
            'unused-imports': unusedImports,
            'simple-import-sort': simpleImportSort,
        },
        rules: {
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            'unused-imports/no-unused-imports': 'error',
            'unused-imports/no-unused-vars': [
                'warn',
                {
                    vars: 'all',
                    varsIgnorePattern: '^_',
                    args: 'after-used',
                    argsIgnorePattern: '^_',
                },
            ],

            'simple-import-sort/imports': [
                'error',
                {
                    groups: [
                        ['^react$', '^next(/.*)?$'],
                        ['^@tanstack/', '^@mui/'],
                        ['^@?\\w'],
                        [
                            '^@/app/',
                            '^@/pages/',
                            '^@/widgets/',
                            '^@/features/',
                            '^@/entities/',
                            '^@/shared/',
                        ],
                        ['^.+\\.(scss|css)$'],
                        ['^\\.'],
                    ],
                },
            ],
            'simple-import-sort/exports': 'error',
        },
    },

    eslintConfigPrettier,

    globalIgnores([
        '.husky/**',
        '.next/**',
        'node_modules/**',

        'next-env.d.ts',
        'package-lock.json',
    ]),
]);

export default eslintConfig;
