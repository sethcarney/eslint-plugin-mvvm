/**
 * mvvm/no-state-in-view
 *
 * Prevents useState / useReducer from being used in View files.
 *
 * Modes:
 *   strict        — no useState/useReducer at all in View files
 *   warn-business — only flag when useState AND an API call coexist in the
 *                   same file (catches architectural violations while
 *                   permitting pure UI state like isOpen, isExpanded, etc.)
 */
import type { Rule } from 'eslint';
import { isViewFile } from '../utils';

type Mode = 'strict' | 'warn-business';

const STATE_HOOKS = new Set(['useState', 'useReducer']);

const API_HOOK_PATTERNS = [
  /^use(Get|Post|Put|Patch|Delete|Fetch|Load|Query|Mutation|Suspense(Query|Mutation))[A-Z]/,
  /^use(Query|Mutation|InfiniteQuery|SuspenseQuery|SuspenseInfiniteQuery|SWR|LazyQuery)$/,
  /^fetch$/,
];

const AXIOS_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'request', 'head']);

function isApiCall(node: Rule.Node): boolean {
  if (node.type !== 'CallExpression') return false;
  const callee = node.callee;
  if (
    callee.type === 'Identifier' &&
    API_HOOK_PATTERNS.some((p) => p.test(callee.name))
  ) {
    return true;
  }
  if (
    callee.type === 'MemberExpression' &&
    callee.object.type === 'Identifier' &&
    callee.object.name === 'axios' &&
    callee.property.type === 'Identifier' &&
    AXIOS_METHODS.has(callee.property.name)
  ) {
    return true;
  }
  return false;
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow state hooks in View files',
      category: 'MVVM',
      recommended: true,
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
    const filePath = context.getFilename();
    if (!isViewFile(filePath)) return {};

    const options = (context.options[0] as { mode?: Mode }) ?? {};
    const mode: Mode = options.mode ?? 'warn-business';

    const stateNodes: Array<{ node: Rule.Node; name: string }> = [];
    let hasApiCall = false;

    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type === 'Identifier' && STATE_HOOKS.has(callee.name)) {
          if (mode === 'strict') {
            context.report({
              node,
              messageId: 'noStateStrict',
              data: { name: callee.name },
            });
          } else {
            stateNodes.push({ node, name: callee.name });
          }
        }

        if (mode === 'warn-business' && isApiCall(node)) {
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
