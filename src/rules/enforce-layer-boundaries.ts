/**
 * mvvm/enforce-layer-boundaries
 *
 * Enforces correct import direction in an MVVM architecture:
 *
 *   Model  <──  ViewModel  <──  View
 *
 * Violations:
 *   Model   → ViewModel  ❌
 *   Model   → View       ❌
 *   ViewModel → View     ❌
 *   View   → Model       ❌  (use allowTypeImportsFromModel to relax for `import type`)
 *
 * Allowed:
 *   View      → ViewModel  ✅
 *   ViewModel → Model      ✅
 */
import type { Rule } from 'eslint';
import { getLayer, resolveImportLayer, MvvmLayer } from '../utils';

type Violation = {
  from: MvvmLayer;
  to: MvvmLayer;
  messageId: string;
};

const VIOLATIONS: Violation[] = [
  { from: 'model', to: 'viewmodel', messageId: 'modelImportsViewModel' },
  { from: 'model', to: 'view', messageId: 'modelImportsView' },
  { from: 'viewmodel', to: 'view', messageId: 'viewModelImportsView' },
  { from: 'view', to: 'model', messageId: 'viewImportsModel' },
];

function findViolation(from: MvvmLayer, to: MvvmLayer): Violation | undefined {
  return VIOLATIONS.find((v) => v.from === from && v.to === to);
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce MVVM layer import boundaries',
      category: 'MVVM',
      recommended: true,
    },
    schema: [
      {
        type: 'object',
        properties: {
          allowTypeImportsFromModel: {
            type: 'boolean',
            description:
              'Allow `import type` from Model in View files. Useful for sharing interfaces without coupling layers.',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      modelImportsViewModel:
        'Model layer must not import from ViewModel layer. Data flows Model → ViewModel → View.',
      modelImportsView:
        'Model layer must not import from View layer. Data flows Model → ViewModel → View.',
      viewModelImportsView:
        'ViewModel layer must not import from View layer. Data flows Model → ViewModel → View.',
      viewImportsModel:
        'View layer must not import directly from Model layer. Import through a ViewModel hook instead.',
    },
  },

  create(context) {
    const filePath = context.getFilename();
    const currentLayer = getLayer(filePath);
    if (currentLayer === 'unknown') return {};

    const options =
      (context.options[0] as { allowTypeImportsFromModel?: boolean }) ?? {};
    const allowTypeFromModel = options.allowTypeImportsFromModel ?? false;

    function checkImport(node: Rule.Node, source: string, isTypeImport: boolean) {
      const importedLayer = resolveImportLayer(source, filePath);
      if (importedLayer === 'unknown') return;

      // Relaxed: View can do `import type` from Model when option is enabled
      if (
        allowTypeFromModel &&
        isTypeImport &&
        currentLayer === 'view' &&
        importedLayer === 'model'
      ) {
        return;
      }

      const violation = findViolation(currentLayer, importedLayer);
      if (violation) {
        context.report({ node, messageId: violation.messageId });
      }
    }

    return {
      ImportDeclaration(node) {
        const source = node.source.value as string;
        // @typescript-eslint/parser adds importKind; cast to access it safely
        const isTypeImport = (node as unknown as { importKind?: string }).importKind === 'type';
        checkImport(node, source, isTypeImport);
      },

      // Dynamic import(): import('./api/users')
      ImportExpression(node) {
        if (node.source.type === 'Literal') {
          const source = node.source.value as string;
          checkImport(node, source, false);
        }
      },

      // require('./api/users')
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type === 'Identifier' &&
          callee.name === 'require' &&
          node.arguments.length > 0 &&
          node.arguments[0].type === 'Literal'
        ) {
          const source = node.arguments[0].value as string;
          checkImport(node, source, false);
        }
      },
    };
  },
};

export default rule;
