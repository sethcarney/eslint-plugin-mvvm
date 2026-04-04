import noApiInView from './rules/no-api-in-view';
import noStateInView from './rules/no-state-in-view';
import noJsxInViewModel from './rules/no-jsx-in-viewmodel';
import enforceLayerBoundaries from './rules/enforce-layer-boundaries';

const plugin = {
  meta: {
    name: 'eslint-plugin-mvvm',
    version: '1.0.0',
  },

  rules: {
    'no-api-in-view': noApiInView,
    'no-state-in-view': noStateInView,
    'no-jsx-in-viewmodel': noJsxInViewModel,
    'enforce-layer-boundaries': enforceLayerBoundaries,
  },

  configs: {} as Record<string, unknown>,
};

/**
 * recommended — pragmatic defaults suitable for most projects and
 *               incremental adoption on existing codebases.
 *
 *   no-api-in-view         error  (requireJsxConfirmation: true)
 *   no-state-in-view       warn   (mode: warn-business)
 *   no-jsx-in-viewmodel    error
 *   enforce-layer-bounds   error  (allowTypeImportsFromModel: true)
 */
plugin.configs.recommended = {
  plugins: { mvvm: plugin },
  rules: {
    'mvvm/no-api-in-view': ['error', { requireJsxConfirmation: true }],
    'mvvm/no-state-in-view': ['warn', { mode: 'warn-business' }],
    'mvvm/no-jsx-in-viewmodel': 'error',
    'mvvm/enforce-layer-boundaries': [
      'error',
      { allowTypeImportsFromModel: true },
    ],
  },
};

/**
 * strict — zero-tolerance mode. No state at all in Views, no type-import
 *          exceptions. Use when starting a greenfield project or enforcing
 *          full layer purity.
 */
plugin.configs.strict = {
  plugins: { mvvm: plugin },
  rules: {
    'mvvm/no-api-in-view': 'error',
    'mvvm/no-state-in-view': ['error', { mode: 'strict' }],
    'mvvm/no-jsx-in-viewmodel': 'error',
    'mvvm/enforce-layer-boundaries': 'error',
  },
};

export default plugin;
export const { rules, configs } = plugin;
