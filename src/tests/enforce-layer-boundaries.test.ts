import { describe } from 'bun:test';
import { makeTester } from './helpers';
import rule from '../rules/enforce-layer-boundaries';

const tester = makeTester();

describe('mvvm/enforce-layer-boundaries', () => {
  tester.run('enforce-layer-boundaries', rule, {
    valid: [
      // View → ViewModel: allowed
      {
        filename: '/app/components/UserList.tsx',
        code: `import { useUserList } from '../hooks/useUserList';`,
      },
      // ViewModel → Model: allowed
      {
        filename: '/app/hooks/useUserList.ts',
        code: `import { getUsers } from '../services/userService';`,
      },
      // View importing from another View: allowed (not a cross-layer import)
      {
        filename: '/app/components/UserList.tsx',
        code: `import { Avatar } from '../components/Avatar';`,
      },
      // View `import type` from Model when allowTypeImportsFromModel is true
      {
        filename: '/app/components/UserList.tsx',
        code: `import type { User } from '../models/user';`,
        options: [{ allowTypeImportsFromModel: true }],
      },
      // Unknown layer file importing anywhere: not checked
      {
        filename: '/app/utils/format.ts',
        code: `import { getUsers } from '../services/userService';`,
      },
    ],
    invalid: [
      // Model → ViewModel: disallowed
      {
        filename: '/app/models/user.ts',
        code: `import { useUserList } from '../hooks/useUserList';`,
        errors: [{ messageId: 'modelImportsViewModel' }],
      },
      // Model → View: disallowed
      {
        filename: '/app/models/user.ts',
        code: `import { UserCard } from '../components/UserCard';`,
        errors: [{ messageId: 'modelImportsView' }],
      },
      // ViewModel → View: disallowed
      {
        filename: '/app/hooks/useUserList.ts',
        code: `import { UserCard } from '../components/UserCard';`,
        errors: [{ messageId: 'viewModelImportsView' }],
      },
      // View → Model: disallowed (without option)
      {
        filename: '/app/components/UserList.tsx',
        code: `import { getUsers } from '../services/userService';`,
        errors: [{ messageId: 'viewImportsModel' }],
      },
      // View `import type` from Model — still disallowed when option is false (default)
      {
        filename: '/app/components/UserList.tsx',
        code: `import type { User } from '../models/user';`,
        errors: [{ messageId: 'viewImportsModel' }],
      },
      // Dynamic import: ViewModel → View
      {
        filename: '/app/hooks/usePanel.ts',
        code: `const Panel = import('../components/Panel');`,
        errors: [{ messageId: 'viewModelImportsView' }],
      },
    ],
  });
});
