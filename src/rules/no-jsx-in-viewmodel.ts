/**
 * mvvm/no-jsx-in-viewmodel
 *
 * ViewModel files (use*.ts, *.vm.ts, hooks/) must not return JSX elements.
 * ViewModels are responsible for data and logic, not rendering.
 */
import type { Rule } from 'eslint';
import { isViewModelFile } from '../utils';

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow JSX in ViewModel files',
      category: 'MVVM',
      recommended: true,
    },
    schema: [],
    messages: {
      noJsxInViewModel:
        'JSX must not be used in ViewModel files. Return plain data/state from hooks and render in a View component.',
    },
  },

  create(context) {
    const filePath = context.getFilename();
    if (!isViewModelFile(filePath)) return {};

    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      JSXElement(node: any) {
        context.report({ node, messageId: 'noJsxInViewModel' });
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      JSXFragment(node: any) {
        context.report({ node, messageId: 'noJsxInViewModel' });
      },
    };
  },
};

export default rule;
