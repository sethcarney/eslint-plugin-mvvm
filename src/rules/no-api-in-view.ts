/**
 * mvvm/no-api-in-view
 *
 * Prevents API calls (fetch, axios, RTK Query hooks, TanStack Query,
 * SWR, Apollo) from being made directly inside View files.
 *
 * A View is a `.tsx` or `.jsx` file that is not a ViewModel. ViewModel
 * naming conventions are read from `settings.mvvm.viewModelPatterns`,
 * defaulting to common React hook conventions — see ../utils.ts.
 */
import type { Rule } from 'eslint';
import {
  getFilename,
  getSettings,
  isViewFile,
  resolveImportLayer,
} from '../utils';

/** Identifiers that are always an API call regardless of context */
const BARE_API_CALLS = new Set(['fetch', 'useSWR', 'useLazyQuery']);

/** Regex for hook-convention API hooks (RTK Query, TanStack, etc.) */
const HOOK_PATTERNS = [
  /^use(Get|Post|Put|Patch|Delete|Fetch|Load|Query|Mutation|Suspense(Query|Mutation))[A-Z]/,
  /^use(Query|Mutation|InfiniteQuery|SuspenseQuery|SuspenseInfiniteQuery)$/,
];

/**
 * ViewModel hooks are frequently named after the operation they wrap
 * (`useDeleteDialogViewModel`, `useGetItemViewModel`), which collides
 * with the CRUD-verb prefixes above. A callee whose name follows the
 * ViewModel convention is the pattern this plugin *recommends*, not an API
 * call, so it is never reported.
 */
const VIEWMODEL_NAME = /(?:ViewModel|VM)s?$/;

/** axios method calls: axios.get(), axios.post(), etc. */
const AXIOS_METHODS = new Set([
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'request',
  'head',
]);

function isApiHook(name: string): boolean {
  if (BARE_API_CALLS.has(name)) return true;
  return HOOK_PATTERNS.some((p) => p.test(name));
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow API calls in View files (.tsx / .jsx)',
      recommended: true,
      url: 'https://github.com/sethcarney/eslint-plugin-mvvm/blob/main/docs/rules/no-api-in-view.md',
    },
    schema: [
      {
        type: 'object',
        properties: {
          requireJsxConfirmation: {
            type: 'boolean',
            description:
              'Only report if the file also contains JSX. Prevents false positives on .tsx/.jsx files that are pure utility modules.',
          },
          ignorePattern: {
            type: 'string',
            description:
              'Regex (as a string) matched against the callee name. Matching calls are never reported — an escape hatch for hook names that collide with the API-hook conventions.',
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
    const settings = getSettings(context);
    const filePath = getFilename(context);
    if (!isViewFile(filePath, settings)) return {};

    const options =
      (context.options[0] as {
        requireJsxConfirmation?: boolean;
        ignorePattern?: string;
      }) ?? {};
    const requireJsx = options.requireJsxConfirmation ?? false;
    const ignoreRegex = options.ignorePattern
      ? new RegExp(options.ignorePattern)
      : undefined;

    let fileHasJsx = false;
    const violations: Array<{ node: Rule.Node; name: string }> = [];

    // Track where each locally-bound identifier was imported from, so a
    // callee that resolves to the ViewModel layer can be skipped — the data
    // fetching is already extracted into a ViewModel, which is correct.
    const importSources = new Map<string, string>();

    function isViewModelHook(name: string): boolean {
      if (VIEWMODEL_NAME.test(name)) return true;
      const source = importSources.get(name);
      return (
        source !== undefined &&
        resolveImportLayer(source, filePath, settings) === 'viewmodel'
      );
    }

    function reportOrDefer(node: Rule.Node, name: string) {
      if (requireJsx) {
        violations.push({ node, name });
      } else {
        context.report({ node, messageId: 'noApiInView', data: { name } });
      }
    }

    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (typeof source !== 'string') return;
        for (const spec of node.specifiers) {
          importSources.set(spec.local.name, source);
        }
      },

      JSXElement() {
        fileHasJsx = true;
      },
      JSXFragment() {
        fileHasJsx = true;
      },

      CallExpression(node) {
        const callee = node.callee;

        if (callee.type === 'Identifier' && isApiHook(callee.name)) {
          if (ignoreRegex?.test(callee.name)) return;
          if (isViewModelHook(callee.name)) return;
          reportOrDefer(node, callee.name);
          return;
        }

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
