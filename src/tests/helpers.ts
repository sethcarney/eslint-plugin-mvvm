import { RuleTester } from 'eslint';
import * as tsParser from '@typescript-eslint/parser';

/**
 * Returns a RuleTester configured with @typescript-eslint/parser so we can
 * test against TypeScript + JSX syntax (ESLint 9 flat config API).
 */
export function makeTester(): RuleTester {
  return new RuleTester({
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
  });
}
