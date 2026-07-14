/**
 * mvvm/no-jsx-in-viewmodel
 *
 * ViewModel files (use*, *.vm, *.viewmodel, *ViewModel, hooks/, viewmodels/)
 * must not return JSX elements. ViewModels are responsible for data and
 * logic, not rendering.
 */
import type { Rule } from 'eslint';
import { getFilename, getSettings, isViewModelFile } from '../utils';

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow JSX in ViewModel files',
      recommended: true,
      url: 'https://github.com/sethcarney/eslint-plugin-mvvm/blob/main/docs/rules/no-jsx-in-viewmodel.md',
    },
    schema: [],
    messages: {
      noJsxInViewModel:
        'JSX must not be used in ViewModel files. Return plain data/state from hooks and render in a View component.',
    },
  },

  create(context) {
    const settings = getSettings(context);
    const filePath = getFilename(context);
    if (!isViewModelFile(filePath, settings)) return {};

    // JSXElement / JSXFragment are not part of estree's base node union,
    // so we cast through `unknown` to the structural shape `context.report`
    // accepts. The ESLint runtime supplies real AST nodes.
    const report = (node: unknown) => {
      context.report({
        node: node as Rule.Node,
        messageId: 'noJsxInViewModel',
      });
    };

    return {
      JSXElement: report,
      JSXFragment: report,
    };
  },
};

export default rule;
