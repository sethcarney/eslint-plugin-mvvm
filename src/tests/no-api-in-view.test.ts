import { describe } from 'bun:test';
import { makeTester } from './helpers';
import rule from '../rules/no-api-in-view';

const tester = makeTester();

describe('mvvm/no-api-in-view', () => {
  tester.run('no-api-in-view', rule, {
    valid: [
      // fetch in a service file — not a view
      {
        filename: '/app/services/userService.ts',
        code: `export async function getUsers() { return fetch('/api/users'); }`,
      },
      // fetch in a model file
      {
        filename: '/app/models/user.ts',
        code: `export async function getUser(id: string) { return fetch('/api/users/' + id); }`,
      },
      // RTK Query hook in a viewmodel hook file
      {
        filename: '/app/hooks/useUserList.ts',
        code: `import { useGetUsersQuery } from '../api/usersApi'; export function useUserList() { return useGetUsersQuery(); }`,
      },
      // View file but no API calls
      {
        filename: '/app/components/UserCard.tsx',
        code: `export function UserCard({ name }: { name: string }) { return <div>{name}</div>; }`,
      },
      // requireJsxConfirmation: true — view file path but no JSX → skip
      {
        filename: '/app/components/utils.tsx',
        code: `export function loadData() { return fetch('/api/data'); }`,
        options: [{ requireJsxConfirmation: true }],
      },
    ],
    invalid: [
      // fetch in a .tsx file
      {
        filename: '/app/components/UserList.tsx',
        code: `export function UserList() { fetch('/api/users'); return <div/>; }`,
        errors: [{ messageId: 'noApiInView' }],
      },
      // axios in a page
      {
        filename: '/app/pages/Dashboard.tsx',
        code: `import axios from 'axios'; export function Dashboard() { axios.get('/api/data'); return <div/>; }`,
        errors: [{ messageId: 'noApiInView' }],
      },
      // RTK Query hook in a component
      {
        filename: '/app/components/UserList.tsx',
        code: `import { useGetUsersQuery } from '../api/usersApi'; export function UserList() { const data = useGetUsersQuery(); return <div/>; }`,
        errors: [{ messageId: 'noApiInView' }],
      },
      // TanStack useQuery in a component (queryFn contains fetch → 2 violations)
      {
        filename: '/app/components/UserList.tsx',
        code: `import { useQuery } from '@tanstack/react-query'; export function UserList() { const data = useQuery({ queryKey: ['users'], queryFn: () => fetch('/api/users') }); return <div/>; }`,
        errors: [{ messageId: 'noApiInView' }, { messageId: 'noApiInView' }],
      },
      // useMutation in a page (also contains fetch inside mutationFn callback → 2 violations)
      {
        filename: '/app/pages/CreateUser.tsx',
        code: `import { useMutation } from '@tanstack/react-query'; export function CreateUser() { const mutation = useMutation({ mutationFn: (data) => fetch('/api/users', { method: 'POST', body: JSON.stringify(data) }) }); return <div/>; }`,
        errors: [{ messageId: 'noApiInView' }, { messageId: 'noApiInView' }],
      },
      // useSWR in a component
      {
        filename: '/app/components/UserList.tsx',
        code: `import useSWR from 'swr'; export function UserList() { const { data } = useSWR('/api/users', fetch); return <div/>; }`,
        errors: [{ messageId: 'noApiInView' }],
      },
      // requireJsxConfirmation: true — file has JSX → should still report
      {
        filename: '/app/components/UserList.tsx',
        code: `export function UserList() { fetch('/api/users'); return <div/>; }`,
        options: [{ requireJsxConfirmation: true }],
        errors: [{ messageId: 'noApiInView' }],
      },
      // .jsx file outside of a "components" directory → still a View
      {
        filename: '/app/UserList.jsx',
        code: `export function UserList() { fetch('/api/users'); return <div/>; }`,
        errors: [{ messageId: 'noApiInView' }],
      },
      // .jsx file in a flat structure
      {
        filename: '/Dashboard.jsx',
        code: `import axios from 'axios'; export function Dashboard() { axios.get('/api/data'); return <div/>; }`,
        errors: [{ messageId: 'noApiInView' }],
      },
    ],
  });

  // respects custom viewModelPatterns from settings.mvvm
  tester.run('no-api-in-view (custom viewModelPatterns)', rule, {
    valid: [
      // .tsx file matching a custom VM convention → treated as VM, not view
      {
        filename: '/app/userScreen.vm.tsx',
        code: `export function useUser() { return fetch('/api/users'); }`,
        settings: {
          mvvm: {
            viewModelPatterns: ['\\.vm\\.(tsx?|jsx?)$'],
          },
        },
      },
      // .tsx file matching custom PascalCase VM suffix
      {
        filename: '/app/UserPageModel.tsx',
        code: `export function useUserPageModel() { return fetch('/api/users'); }`,
        settings: {
          mvvm: {
            viewModelPatterns: ['PageModel\\.(tsx?|jsx?)$'],
          },
        },
      },
    ],
    invalid: [
      // .jsx hook is normally a VM, but with custom settings only `.vm.*`
      // counts → so a default `useUsers.jsx` becomes a View and is flagged
      {
        filename: '/app/useUsers.jsx',
        code: `export function useUsers() { fetch('/api/users'); return <div/>; }`,
        settings: {
          mvvm: {
            viewModelPatterns: ['\\.vm\\.(tsx?|jsx?)$'],
          },
        },
        errors: [{ messageId: 'noApiInView' }],
      },
    ],
  });
});
