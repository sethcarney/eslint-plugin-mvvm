import type { ESLint, Linter } from 'eslint';

import noApiInView from './rules/no-api-in-view';
import noStateInView from './rules/no-state-in-view';
import noJsxInViewModel from './rules/no-jsx-in-viewmodel';
import enforceLayerBoundaries from './rules/enforce-layer-boundaries';

export type { MvvmSettings, MvvmLayer } from './utils';

const meta = {
  name: 'eslint-plugin-mvvm',
  version: '1.0.3',
} as const;

const rules = {
  'no-api-in-view': noApiInView,
  'no-state-in-view': noStateInView,
  'no-jsx-in-viewmodel': noJsxInViewModel,
  'enforce-layer-boundaries': enforceLayerBoundaries,
};

/**
 * `eslint-plugin-mvvm` — enforces MVVM architectural layer boundaries for
 * React codebases. Designed for ESLint 9 flat config.
 *
 * Example flat config:
 *
 *     import mvvm from 'eslint-plugin-mvvm';
 *
 *     export default [
 *       mvvm.configs.recommended,
 *       {
 *         settings: {
 *           mvvm: {
 *             // Optional: override ViewModel naming conventions
 *             viewModelPatterns: ['\\.vm\\.', 'ViewModel\\.'],
 *           },
 *         },
 *       },
 *     ];
 */
const plugin: ESLint.Plugin & {
  configs: {
    recommended: Linter.Config;
    strict: Linter.Config;
  };
} = {
  meta,
  rules,
  configs: {
    /**
     * recommended — pragmatic defaults suitable for most projects and
     *               incremental adoption on existing codebases.
     */
    recommended: {
      name: 'mvvm/recommended',
      plugins: {},
      rules: {
        'mvvm/no-api-in-view': ['error', { requireJsxConfirmation: true }],
        'mvvm/no-state-in-view': ['error', { mode: 'warn-business' }],
        'mvvm/no-jsx-in-viewmodel': 'error',
        'mvvm/enforce-layer-boundaries': [
          'error',
          { allowTypeImportsFromModel: true },
        ],
      },
    },

    /**
     * strict — zero-tolerance. No state at all in Views, no type-import
     *          exceptions. Use for greenfield projects.
     */
    strict: {
      name: 'mvvm/strict',
      plugins: {},
      rules: {
        'mvvm/no-api-in-view': 'error',
        'mvvm/no-state-in-view': ['error', { mode: 'strict' }],
        'mvvm/no-jsx-in-viewmodel': 'error',
        'mvvm/enforce-layer-boundaries': 'error',
      },
    },
  },
};

// `plugins` must reference the plugin itself; this circular wiring has to
// happen after the plugin object exists.
plugin.configs.recommended.plugins = { mvvm: plugin };
plugin.configs.strict.plugins = { mvvm: plugin };

export default plugin;
export { rules };
export const { configs } = plugin;

// CommonJS interop: make `require('eslint-plugin-mvvm')` and an ESM
// `import mvvm from 'eslint-plugin-mvvm'` both resolve to the plugin object
// itself instead of a `{ default: plugin }` namespace. Assigned last so it
// replaces the transpiled `exports` object; the explicit property
// assignments keep `default`/`rules`/`configs` statically analyzable for
// Node's named-export detection (cjs-module-lexer).
module.exports = plugin;
module.exports.default = plugin;
module.exports.rules = rules;
module.exports.configs = plugin.configs;
