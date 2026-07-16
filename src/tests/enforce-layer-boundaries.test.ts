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

  // Issue #20: extension-less relative imports of ViewModels must classify as
  // ViewModel (not fall through to the View directory hints).
  tester.run('enforce-layer-boundaries (extension-less viewmodel imports)', rule, {
    valid: [
      // Co-located ViewModel importing a sibling ViewModel hook and a sibling
      // *ViewModel module under a /pages/ (View) directory. Previously both
      // were misreported as ViewModel → View.
      {
        filename: '/app/pages/Detail/EditViewModel.ts',
        code: `import { useEditForm } from '../useEditForm';`,
      },
      {
        filename: '/app/pages/Detail/EditViewModel.ts',
        code: `import { DetailViewModel } from '../DetailViewModel';`,
      },
    ],
    invalid: [
      // A real extension-less View import is still caught.
      {
        filename: '/app/pages/Detail/EditViewModel.ts',
        code: `import { UserCard } from '../../components/UserCard';`,
        errors: [{ messageId: 'viewModelImportsView' }],
      },
    ],
  });

  // Issue #19: directory hints must be scoped/disable-able.
  tester.run('enforce-layer-boundaries (directory hints)', rule, {
    valid: [
      // viewDirPatterns: [] opts out of the View directory hints entirely,
      // so an extension-less import under /components/ is no longer a View.
      {
        filename: '/app/hooks/useUserList.ts',
        code: `import { getUsers } from '../components/data';`,
        settings: { mvvm: { viewDirPatterns: [] } },
      },
    ],
    invalid: [
      // A `.ts` Model file whose absolute path contains an ancestor `/ui/`
      // segment is a Model (via /api/), not a View — so importing a
      // ViewModel is a real Model → ViewModel violation.
      {
        filename: '/proj/ui/src/api/dataApi.ts',
        code: `import { useThing } from '../hooks/useThing';`,
        errors: [{ messageId: 'modelImportsViewModel' }],
      },
    ],
  });
});
