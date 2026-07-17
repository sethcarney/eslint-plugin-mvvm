/**
 * mvvm/no-state-in-view
 *
 * Prevents useState / useReducer from being used in View files.
 *
 * A View is a `.tsx` or `.jsx` file that is not a ViewModel.
 *
 * Modes:
 *   strict        — no useState/useReducer at all in View files
 *   warn-business — only flag when useState AND an API call coexist in the
 *                   same file (catches architectural violations while
 *                   permitting pure UI state like isOpen, isExpanded, etc.)
 */
import type { Rule } from 'eslint';
import type { CallExpression } from 'estree';
import {
  collectImportSources,
  getAxiosCall,
  getCalleeDisplayName,
  getCalleeHookName,
  getFilename,
  getSettings,
  isViewFile,
} from '../utils';

type Mode = 'strict' | 'warn-business';

const STATE_HOOKS = new Set(['useState', 'useReducer']);

const API_HOOK_PATTERNS = [
  /^use(Get|Post|Put|Patch|Delete|Fetch|Load|Query|Mutation|Suspense(Query|Mutation))[A-Z]/,
  /^use(Query|Mutation|InfiniteQuery|SuspenseQuery|SuspenseInfiniteQuery|SWR|LazyQuery)$/,
  /^fetch$/,
];

function isApiCall(
  node: CallExpression,
  importSources: Map<string, string>
): boolean {
  const name = getCalleeHookName(node.callee);
  if (name !== undefined && API_HOOK_PATTERNS.some((p) => p.test(name))) {
    return true;
  }
  return getAxiosCall(node.callee, importSources) !== undefined;
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow state hooks in View files (.tsx / .jsx)',
      recommended: true,
      url: 'https://github.com/sethcarney/eslint-plugin-mvvm/blob/main/docs/rules/no-state-in-view.md',
    },
    schema: [
      {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            enum: ['strict', 'warn-business'],
            description:
              '"strict" bans all useState/useReducer; "warn-business" only flags when an API call also exists in the same file.',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noStateStrict:
        "'{{name}}' should not be used in View files. Move state logic to a ViewModel hook.",
      noStateBusiness:
        "'{{name}}' is used alongside an API call in a View file. Extract this logic into a ViewModel hook.",
    },
  },

  create(context) {
    const settings = getSettings(context);
    const filePath = getFilename(context);
    if (!isViewFile(filePath, settings)) return {};

    const options = (context.options[0] as { mode?: Mode }) ?? {};
    const mode: Mode = options.mode ?? 'warn-business';

    const stateNodes: Array<{ node: Rule.Node; name: string }> = [];
    let hasApiCall = false;

    // Track where each locally-bound identifier was imported from so a
    // namespaced axios call (`import client from 'axios'; client.get(...)`)
    // is recognized when deciding whether business logic coexists with state.
    const importSources = new Map<string, string>();

    return {
      ImportDeclaration(node) {
        collectImportSources(node, importSources);
      },

      CallExpression(node) {
        // Resolve namespaced hook calls (`React.useState`) to their bare name
        // so they are detected exactly like a plain `useState(...)`.
        const hookName = getCalleeHookName(node.callee);
        if (hookName !== undefined && STATE_HOOKS.has(hookName)) {
          const name = getCalleeDisplayName(node.callee) ?? hookName;
          if (mode === 'strict') {
            context.report({
              node,
              messageId: 'noStateStrict',
              data: { name },
            });
          } else {
            stateNodes.push({ node, name });
          }
        }

        if (mode === 'warn-business' && isApiCall(node, importSources)) {
          hasApiCall = true;
        }
      },

      'Program:exit'() {
        if (mode === 'warn-business' && hasApiCall) {
          for (const { node, name } of stateNodes) {
            context.report({
              node,
              messageId: 'noStateBusiness',
              data: { name },
            });
          }
        }
      },
    };
  },
};

export default rule;
