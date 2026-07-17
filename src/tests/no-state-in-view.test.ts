import { describe } from 'bun:test';
import { makeTester } from './helpers';
import rule from '../rules/no-state-in-view';

const tester = makeTester();

describe('mvvm/no-state-in-view', () => {
  tester.run('no-state-in-view', rule, {
    valid: [
      // useState in a ViewModel — fine
      {
        filename: '/app/hooks/useCounter.ts',
        code: `import { useState } from 'react'; export function useCounter() { const [count, setCount] = useState(0); return { count, setCount }; }`,
      },
      // View with useState but NO api calls (warn-business mode) — fine
      {
        filename: '/app/components/Dropdown.tsx',
        code: `import { useState } from 'react'; export function Dropdown() { const [isOpen, setIsOpen] = useState(false); return <div onClick={() => setIsOpen(true)}/>; }`,
        options: [{ mode: 'warn-business' }],
      },
      // View file that is not actually a view by path
      {
        filename: '/app/utils/helper.ts',
        code: `import { useState } from 'react'; export function helper() { const [x, setX] = useState(0); return x; }`,
        options: [{ mode: 'strict' }],
      },
    ],
    invalid: [
      // strict: useState in a .tsx file
      {
        filename: '/app/components/UserList.tsx',
        code: `import { useState } from 'react'; export function UserList() { const [users, setUsers] = useState([]); return <div/>; }`,
        options: [{ mode: 'strict' }],
        errors: [{ messageId: 'noStateStrict' }],
      },
      // strict: useReducer in a page
      {
        filename: '/app/pages/Dashboard.tsx',
        code: `import { useReducer } from 'react'; export function Dashboard() { const [state, dispatch] = useReducer((s: number, a: number) => s + a, 0); return <div/>; }`,
        options: [{ mode: 'strict' }],
        errors: [{ messageId: 'noStateStrict' }],
      },
      // warn-business: useState + fetch in a component → violation
      {
        filename: '/app/components/UserList.tsx',
        code: `import { useState } from 'react'; export function UserList() { const [users, setUsers] = useState([]); fetch('/api/users').then(r => r.json()).then(setUsers); return <div/>; }`,
        options: [{ mode: 'warn-business' }],
        errors: [{ messageId: 'noStateBusiness' }],
      },
      // warn-business default mode: useState + useQuery → violation
      {
        filename: '/app/components/UserList.tsx',
        code: `import { useState } from 'react'; import { useQuery } from '@tanstack/react-query'; export function UserList() { const [filter, setFilter] = useState(''); const { data } = useQuery({ queryKey: ['users', filter], queryFn: () => fetch('/api/users') }); return <div/>; }`,
        errors: [{ messageId: 'noStateBusiness' }],
      },
      // strict: useState in a .jsx file (no folder hint)
      {
        filename: '/app/UserList.jsx',
        code: `import { useState } from 'react'; export function UserList() { const [users, setUsers] = useState([]); return <div/>; }`,
        options: [{ mode: 'strict' }],
        errors: [{ messageId: 'noStateStrict' }],
      },
      // Issue #23 strict: namespaced React.useState is detected
      {
        filename: '/app/components/Example.tsx',
        code: `import * as React from 'react'; export const Example = () => { const [open, setOpen] = React.useState(false); return <button onClick={() => setOpen(!open)}/>; };`,
        options: [{ mode: 'strict' }],
        errors: [{ messageId: 'noStateStrict' }],
      },
      // Issue #23 strict: namespaced React.useReducer is detected
      {
        filename: '/app/pages/Dashboard.tsx',
        code: `import * as React from 'react'; export function Dashboard() { const [state, dispatch] = React.useReducer((s: number, a: number) => s + a, 0); return <div/>; }`,
        options: [{ mode: 'strict' }],
        errors: [{ messageId: 'noStateStrict' }],
      },
      // Issue #23 warn-business: namespaced React.useState + namespaced
      // axios call (aliased client) coexist → violation
      {
        filename: '/app/components/UserList.tsx',
        code: `import * as React from 'react'; import client from 'axios'; export function UserList() { const [users, setUsers] = React.useState([]); client.get('/api/users').then((r) => setUsers(r.data)); return <div/>; }`,
        options: [{ mode: 'warn-business' }],
        errors: [{ messageId: 'noStateBusiness' }],
      },
    ],
  });

  // respects custom viewModelPatterns from settings.mvvm
  tester.run('no-state-in-view (custom viewModelPatterns)', rule, {
    valid: [
      // `.vm.tsx` file matched by custom VM pattern: useState allowed
      {
        filename: '/app/user.vm.tsx',
        code: `import { useState } from 'react'; export function useUserVM() { const [u, setU] = useState(null); return { u, setU }; }`,
        options: [{ mode: 'strict' }],
        settings: {
          mvvm: {
            viewModelPatterns: ['\\.vm\\.(tsx?|jsx?)$'],
          },
        },
      },
    ],
    invalid: [],
  });
});
