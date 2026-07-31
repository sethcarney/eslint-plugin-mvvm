# eslint-plugin-mvvm

[![CI](https://github.com/sethcarney/eslint-plugin-mvvm/actions/workflows/ci.yml/badge.svg)](https://github.com/sethcarney/eslint-plugin-mvvm/actions/workflows/ci.yml)
[![Release](https://github.com/sethcarney/eslint-plugin-mvvm/actions/workflows/release.yml/badge.svg)](https://github.com/sethcarney/eslint-plugin-mvvm/actions/workflows/release.yml)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/sethcarney/eslint-plugin-mvvm/badge)](https://scorecard.dev/viewer/?uri=github.com/sethcarney/eslint-plugin-mvvm)
[![npm](https://img.shields.io/npm/v/eslint-plugin-mvvm.svg)](https://www.npmjs.com/package/eslint-plugin-mvvm)
[![npm downloads](https://img.shields.io/npm/dm/eslint-plugin-mvvm.svg)](https://www.npmjs.com/package/eslint-plugin-mvvm)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

ESLint plugin that enforces MVVM architectural layer boundaries in React codebases.
Data flows one way — `Model → ViewModel → View` — and these rules keep it that way:
state usage and API calls in Views are flagged as ESLint errors and pushed into
ViewModel hooks where they belong.

## Installation

```sh
npm install --save-dev eslint-plugin-mvvm
```

Requires Node.js >= 18 and ESLint >= 8 (flat config, ESLint 9 recommended).

## Usage

```js
// eslint.config.js
import mvvm from 'eslint-plugin-mvvm';

export default [
  mvvm.configs.recommended, // or mvvm.configs.strict
];
```

Or configure rules individually:

```js
import mvvm from 'eslint-plugin-mvvm';

export default [
  {
    plugins: { mvvm },
    rules: {
      'mvvm/no-api-in-view': 'error',
      'mvvm/no-state-in-view': ['error', { mode: 'strict' }],
      'mvvm/no-jsx-in-viewmodel': 'error',
      'mvvm/enforce-layer-boundaries': 'error',
    },
  },
];
```

## Rules

| Rule | Description |
| --- | --- |
| `mvvm/no-api-in-view` | Disallows API calls (`fetch`, `axios.*`, TanStack Query, RTK Query, SWR, Apollo hooks) in View files. Data fetching belongs in ViewModel hooks. A callee that resolves to the ViewModel layer or is named like a ViewModel (e.g. `useEditDialogViewModel`) is never flagged; use the `ignorePattern` option as an extra escape hatch. |
| `mvvm/no-state-in-view` | Disallows `useState` / `useReducer` in View files. `strict` mode bans all state; `warn-business` mode only flags state that coexists with an API call in the same file (pure UI state like `isOpen` stays legal). |
| `mvvm/no-jsx-in-viewmodel` | ViewModel files must return data, not JSX. |
| `mvvm/enforce-layer-boundaries` | Enforces import direction: Views import ViewModels, ViewModels import Models — never the reverse, and Views never import Models directly (optionally relaxed for `import type`). |

### What counts as a View / ViewModel / Model?

- **View** — any `.tsx` / `.jsx` file that isn't classified as a ViewModel.
- **ViewModel** — `useXxx.ts(x)` hooks, `*.vm.*`, `*.viewmodel.*`, `*ViewModel.*`,
  or anything under `hooks/`, `viewmodels/`, `view-models/`.
- **Model** — files under `models/`, `stores/`, `api/`, `services/`,
  `repositories/`, `domain/`, or `*.model.ts` / `*.service.ts` / `*.store.ts`.

`enforce-layer-boundaries` resolves relative imports to their file on disk so
the real extension drives classification. The **directory hints**
(`viewDirPatterns`) only apply to a path that can't be resolved to a concrete
`.ts`/`.tsx`/`.js`/`.jsx` file, and are matched relative to the project `root`
(see below) — so an extension-less `../useThing` that points at a ViewModel
hook is treated as a ViewModel, not misclassified as a View.

Conventions are overridable via shared settings:

```js
export default [
  mvvm.configs.recommended,
  {
    settings: {
      mvvm: {
        viewModelPatterns: ['\\.vm\\.', 'ViewModel\\.'],
        viewDirPatterns: ['/components/', '/pages/'],
        modelPatterns: ['/api/', '\\.service\\.ts$'],
        // Base path for directory-hint matching. Defaults to the ESLint
        // working directory, so a hint like `/ui/` only fires on directories
        // *inside* the project, not an ancestor path that is named `ui/`.
        root: import.meta.dirname,
      },
    },
  },
];
```

Pass an explicit empty array to opt out of a category entirely — for example
`viewDirPatterns: []` disables the View directory hints (an omitted value falls
back to the defaults above).

## Configs

- **`recommended`** — pragmatic defaults for incremental adoption. API calls and
  business state in Views are errors; `no-state-in-view` runs in `warn-business`
  mode so pure UI state is still allowed.
- **`strict`** — zero tolerance. No state at all in Views, no `import type`
  exceptions from Model.

## Development

```sh
bun install
bun run lint   # eslint
bun test       # bun's test runner
bun run build  # tsc → dist/
```

### Dev container

`.devcontainer/` defines the full toolchain (Node 22, Bun, project dependencies)
so nothing has to be installed on the host. In VS Code or Cursor with the
[Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
extension, open the repository and choose **Reopen in Container**; `bun install`
runs automatically on first start.

Claude Code is installed in the container and its login persists across
rebuilds. That takes three settings naming the same directory — the `~/.claude`
volume mount, `containerEnv.CLAUDE_CONFIG_DIR`, and `remoteUser`'s home — because
the OAuth session lives in `~/.claude.json`, *beside* the `~/.claude` directory
rather than inside it. Mounting a volume on `~/.claude` alone persists
everything except the login. The mismatch fails silently, so
`.devcontainer/check-devcontainer-auth.py` asserts all three agree and runs in
CI. The volume is scoped per repository, so you sign in once for this project.

Releases are automated: merging a `package.json` version bump to `master` tags,
signs, and publishes the package with npm provenance (see
`.github/workflows/release.yml`).

## License

[MIT](./LICENSE)
