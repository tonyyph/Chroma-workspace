const path = require('node:path');
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

const platformImportSettings =
  expoConfig.find((config) => config.settings?.['import/extensions']?.includes('.native.tsx'))
    ?.settings ?? {};
const resolverExtensions = platformImportSettings['import/resolver']?.node?.extensions;
const mobileTsconfig = path.join(__dirname, 'tsconfig.json');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*'],
    settings: {
      'import/resolver': {
        node: {
          extensions: resolverExtensions,
        },
        typescript: {
          project: mobileTsconfig,
        },
      },
    },
    rules: {
      'import/order': [
        'warn',
        {
          alphabetize: { order: 'asc', caseInsensitive: true },
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'never',
        },
      ],
    },
  },
]);
