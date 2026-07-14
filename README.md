# eslint-plugin-mvvm

[![CI](https://github.com/sethcarney/eslint-plugin-mvvm/actions/workflows/ci.yml/badge.svg)](https://github.com/sethcarney/eslint-plugin-mvvm/actions/workflows/ci.yml)
[![Release](https://github.com/sethcarney/eslint-plugin-mvvm/actions/workflows/release.yml/badge.svg)](https://github.com/sethcarney/eslint-plugin-mvvm/actions/workflows/release.yml)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/sethcarney/eslint-plugin-mvvm/badge)](https://scorecard.dev/viewer/?uri=github.com/sethcarney/eslint-plugin-mvvm)
[![npm](https://img.shields.io/npm/v/eslint-plugin-mvvm.svg)](https://www.npmjs.com/package/eslint-plugin-mvvm)
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
| `mvvm/no-api-in-view` | Disallows API calls (`fetch`, `axios.*`, TanStack Query, RTK Query, SWR, Apollo hooks) in View files. Data fetching belongs in ViewModel hooks. |
| `mvvm/no-state-in-view` | Disallows `useState` / `useReducer` in View files. `strict` mode bans all state; `warn-business` mode only flags state that coexists with an API call in the same file (pure UI state like `isOpen` stays legal). |
| `mvvm/no-jsx-in-viewmodel` | ViewModel files must return data, not JSX. |
| `mvvm/enforce-layer-boundaries` | Enforces import direction: Views import ViewModels, ViewModels import Models — never the reverse, and Views never import Models directly (optionally relaxed for `import type`). |

### What counts as a View / ViewModel / Model?

- **View** — any `.tsx` / `.jsx` file that isn't classified as a ViewModel.
- **ViewModel** — `useXxx.ts(x)` hooks, `*.vm.*`, `*.viewmodel.*`, `*ViewModel.*`,
  or anything under `hooks/`, `viewmodels/`, `view-models/`.
- **Model** — files under `models/`, `stores/`, `api/`, `services/`,
  `repositories/`, `domain/`, or `*.model.ts` / `*.service.ts` / `*.store.ts`.

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
      },
    },
  },
];
```

## Configs

- **`recommended`** — pragmatic defaults for incremental adoption. API calls and
  business state in Views are errors; `no-state-in-view` runs in `warn-business`
  mode so pure UI state is still allowed.
- **`strict`** — zero tolerance. No state at all in Views, no `import type`
  exceptions from Model.

## Development

```sh
npm ci
npm run lint   # eslint
npm test       # vitest
npm run build  # tsc → dist/
```

Releases are automated: merging a `package.json` version bump to `master` tags,
signs, and publishes the package with npm provenance (see
`.github/workflows/release.yml`).

## License

[MIT](./LICENSE)
