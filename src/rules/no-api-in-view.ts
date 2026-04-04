/**
 * mvvm/no-api-in-view
 *
 * Prevents API calls (fetch, axios, RTK Query hooks, TanStack Query,
 * SWR, Apollo) from being made directly inside View files.
 */
import type { Rule } from 'eslint';
import { isViewFile } from '../utils';

// ─── Patterns ────────────────────────────────────────────────────────────────

/** Identifiers that are always an API call regardless of context */
const BARE_API_CALLS = new Set(['fetch', 'useSWR', 'useLazyQuery']);

/** Regex for hook-convention API hooks (RTK Query, TanStack, etc.) */
const HOOK_PATTERNS = [
  /^use(Get|Post|Put|Patch|Delete|Fetch|Load|Query|Mutation|Suspense(Query|Mutation))[A-Z]/,
  /^use(Query|Mutation|InfiniteQuery|SuspenseQuery|SuspenseInfiniteQuery)$/,
];

/** axios method calls: axios.get(), axios.post(), etc. */
const AXIOS_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'request', 'head']);

function isApiHook(name: string): boolean {
  if (BARE_API_CALLS.has(name)) return true;
  return HOOK_PATTERNS.some((p) => p.test(name));
}

// ─── Rule ─────────────────────────────────────────────────────────────────────

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow API calls in View files',
      category: 'MVVM',
      recommended: true,
    },
    schema: [
      {
        type: 'object',
        properties: {
          requireJsxConfirmation: {
            type: 'boolean',
            description:
              'Only report if the file also contains JSX. Prevents false positives on non-View files that match view path patterns.',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noApiInView:
        "'{{name}}' is an API call. Move data fetching into a ViewModel hook.",
    },
  },

  create(context) {
    const filePath = context.getFilename();
    if (!isViewFile(filePath)) return {};

    const options = (context.options[0] as { requireJsxConfirmation?: boolean }) ?? {};
    const requireJsx = options.requireJsxConfirmation ?? false;

    let fileHasJsx = false;
    const violations: Array<{ node: Rule.Node; name: string }> = [];

    function reportOrDefer(node: Rule.Node, name: string) {
      if (requireJsx) {
        violations.push({ node, name });
      } else {
        context.report({ node, messageId: 'noApiInView', data: { name } });
      }
    }

    return {
      // Catch JSX presence
      JSXElement() {
        fileHasJsx = true;
      },
      JSXFragment() {
        fileHasJsx = true;
      },

      // fetch(), useSWR(), useQuery(), useGetUsers(), etc.
      CallExpression(node) {
        const callee = node.callee;

        // Direct call: fetch(...), useQuery(...), useSWR(...)
        if (callee.type === 'Identifier' && isApiHook(callee.name)) {
          reportOrDefer(node, callee.name);
          return;
        }

        // axios.get(...), axios.post(...), etc.
        if (
          callee.type === 'MemberExpression' &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'axios' &&
          callee.property.type === 'Identifier' &&
          AXIOS_METHODS.has(callee.property.name)
        ) {
          reportOrDefer(node, `axios.${callee.property.name}`);
        }
      },

      // Flush deferred violations after the whole file is parsed
      'Program:exit'() {
        if (!requireJsx || fileHasJsx) {
          for (const { node, name } of violations) {
            context.report({ node, messageId: 'noApiInView', data: { name } });
          }
        }
      },
    };
  },
};

export default rule;
