import { describe, it } from 'vitest';
import { makeTester } from './helpers';
import rule from '../rules/no-jsx-in-viewmodel';

const tester = makeTester();

describe('mvvm/no-jsx-in-viewmodel', () => {
  it('valid cases', () => {
    tester.run('no-jsx-in-viewmodel', rule, {
      valid: [
        // JSX in a component — not a viewmodel file
        {
          filename: '/app/components/UserCard.tsx',
          code: `export function UserCard() { return <div>Hello</div>; }`,
        },
        // ViewModel hook with no JSX
        {
          filename: '/app/hooks/useUserList.ts',
          code: `import { useState } from 'react'; export function useUserList() { const [users, setUsers] = useState([]); return { users }; }`,
        },
        // .vm.ts file without JSX
        {
          filename: '/app/user.vm.ts',
          code: `export function useUserViewModel() { return { name: 'Alice' }; }`,
        },
      ],
      invalid: [
        // Hook file (.tsx) returning a JSX element
        {
          filename: '/app/hooks/useUserCard.tsx',
          code: `export function useUserCard() { return <div>Hello</div>; }`,
          errors: [{ messageId: 'noJsxInViewModel' }],
        },
        // .vm.tsx file with JSX
        {
          filename: '/app/user.vm.tsx',
          code: `export function useUser() { return <span>User</span>; }`,
          errors: [{ messageId: 'noJsxInViewModel' }],
        },
        // Hook file with multiple JSX elements (nested)
        {
          filename: '/app/hooks/usePanel.tsx',
          code: `export function usePanel() { return <div><span>Content</span></div>; }`,
          errors: [{ messageId: 'noJsxInViewModel' }, { messageId: 'noJsxInViewModel' }],
        },
        // Hook file with JSX fragment
        {
          filename: '/app/hooks/useLayout.tsx',
          code: `export function useLayout() { return <><div/><div/></>; }`,
          errors: [
            { messageId: 'noJsxInViewModel' },
            { messageId: 'noJsxInViewModel' },
            { messageId: 'noJsxInViewModel' },
          ],
        },
        // .jsx hook returning JSX
        {
          filename: '/src/useGreeting.jsx',
          code: `export function useGreeting() { return <span>hi</span>; }`,
          errors: [{ messageId: 'noJsxInViewModel' }],
        },
        // PascalCase ViewModel suffix with .tsx
        {
          filename: '/src/UserViewModel.tsx',
          code: `export function UserViewModel() { return <div/>; }`,
          errors: [{ messageId: 'noJsxInViewModel' }],
        },
      ],
    });
  });

  it('respects custom viewModelPatterns from settings.mvvm', () => {
    tester.run('no-jsx-in-viewmodel', rule, {
      valid: [
        // Default convention `useFoo.tsx` no longer counts as VM under
        // restricted custom settings → rule doesn't apply.
        {
          filename: '/app/useFoo.tsx',
          code: `export function useFoo() { return <div/>; }`,
          settings: {
            mvvm: {
              viewModelPatterns: ['\\.vm\\.(tsx?|jsx?)$'],
            },
          },
        },
      ],
      invalid: [
        // Custom suffix `.model.tsx` is treated as a VM
        {
          filename: '/app/user.model.tsx',
          code: `export function useUser() { return <div/>; }`,
          settings: {
            mvvm: {
              viewModelPatterns: ['\\.model\\.(tsx?|jsx?)$'],
            },
          },
          errors: [{ messageId: 'noJsxInViewModel' }],
        },
      ],
    });
  });
});
