const stylelintConfig = {
    extends: [
        'stylelint-config-standard-scss',
        'stylelint-config-recess-order',
    ],

    customSyntax: 'postcss-scss',

    rules: {
        'color-hex-length': 'short',
        'selector-class-pattern': null,
        'alpha-value-notation': 'number',
        'import-notation': null,

        'scss/dollar-variable-pattern': '^([a-z][a-z0-9-]*)$',
        'scss/at-mixin-pattern': '^([a-z][a-z0-9-]*)$',

        'max-nesting-depth': 4,
    },

    ignoreFiles: ['node_modules/**/*', '.next/**/*'],
};

export default stylelintConfig;
