import fs from 'fs';
import path from 'path';
import type { CallExpression, ImportDeclaration } from 'estree';

export type MvvmLayer = 'view' | 'viewmodel' | 'model' | 'unknown';

/**
 * Shared plugin configuration. Read from the flat config `settings.mvvm`
 * block by every rule so ViewModel naming conventions stay consistent
 * across the codebase:
 *
 *     // eslint.config.js
 *     export default [
 *       {
 *         settings: {
 *           mvvm: {
 *             viewModelPatterns: ['\\.vm\\.', 'ViewModel\\.'],
 *           },
 *         },
 *       },
 *     ];
 */
export interface MvvmSettings {
  /**
   * Regex patterns identifying ViewModel files. Each entry may be a
   * `RegExp` or a string that will be compiled with `new RegExp(...)`.
   * Patterns are tested against the POSIX-normalized absolute file
   * path (backslashes converted to forward slashes).
   *
   * If omitted, the defaults match the most common React conventions:
   *   - `useXxx.ts(x)` / `useXxx.js(x)`  — custom hook
   *   - `*.vm.{ts,tsx,js,jsx}`           — short suffix
   *   - `*.viewmodel.{ts,tsx,js,jsx}`    — long suffix
   *   - `*ViewModel.{ts,tsx,js,jsx}`     — PascalCase class style
   *   - `hooks/`, `viewmodels/`, `view-models/` directories
   */
  viewModelPatterns?: (string | RegExp)[];

  /**
   * Regex patterns identifying View directories (e.g. `components/`,
   * `pages/`). Used only by `enforce-layer-boundaries` to classify
   * import paths that don't carry a file extension. Same semantics as
   * `viewModelPatterns`.
   *
   * Pass an explicit empty array (`[]`) to disable the directory hints
   * entirely — only an omitted (`undefined`) value falls back to the
   * defaults.
   */
  viewDirPatterns?: (string | RegExp)[];

  /**
   * Regex patterns identifying Model files. Same semantics as
   * `viewModelPatterns`.
   */
  modelPatterns?: (string | RegExp)[];

  /**
   * Absolute path used as the base when matching directory-hint patterns
   * (`viewDirPatterns`, `modelPatterns`, and the directory-based
   * `viewModelPatterns`). Paths are made relative to this root before
   * matching, so a pattern like `/ui/` only fires on directories *within*
   * the project rather than an ancestor directory that happens to be named
   * `ui/`.
   *
   * Defaults to the ESLint `context.cwd` when omitted. File-name patterns
   * are anchored to the end of the path and are unaffected by the root.
   */
  root?: string;
}

const VIEW_EXTENSION = /\.(tsx|jsx)$/;
const CODE_EXTENSION = /\.(tsx?|jsx?)$/;

const DEFAULT_VIEWMODEL_PATTERNS: RegExp[] = [
  /(?:^|\/)use[A-Z][a-zA-Z0-9]*(?:\.(tsx?|jsx?))?$/,
  /\.vm(?:\.(tsx?|jsx?))?$/,
  /\.viewmodel(?:\.(tsx?|jsx?))?$/,
  /ViewModel(?:\.(tsx?|jsx?))?$/,
  /\/viewmodels?\//,
  /\/view-models?\//,
  /\/hooks\//,
];

const DEFAULT_VIEW_DIR_PATTERNS: RegExp[] = [
  /\/components?\//,
  /\/pages\//,
  /\/screens\//,
  /\/views\//,
  /\/ui\//,
];

const DEFAULT_MODEL_PATTERNS: RegExp[] = [
  /\/models?\//,
  /\/stores?\//,
  /\/api\//,
  /\/services?\//,
  /\/repositor(?:y|ies)\//,
  /\/domain\//,
  /\.model\.ts$/,
  /\.service\.ts$/,
  /\.store\.ts$/,
];

function compile(
  patterns: (string | RegExp)[] | undefined,
  fallback: RegExp[]
): RegExp[] {
  // `undefined` means "not configured" → use the defaults. An explicit
  // empty array means "no patterns" → opt out of this category entirely.
  if (patterns === undefined) return fallback;
  return patterns.map((p) => (typeof p === 'string' ? new RegExp(p) : p));
}

/**
 * Returns `normalized` re-based on `root` so directory-hint patterns match
 * against a project-relative path rather than the absolute one. This keeps a
 * pattern like `/ui/` from firing on an ancestor directory that happens to be
 * named `ui/`. The leading slash is preserved so slash-anchored patterns
 * (e.g. `/\/pages\//`) still match. Paths outside `root` are returned
 * unchanged.
 */
function relativeToRoot(normalized: string, root?: string): string {
  if (!root) return normalized;
  // Trim trailing slashes with a linear scan rather than an end-anchored
  // regex (`/\/+$/`), which backtracks quadratically on paths with many
  // trailing slashes (ReDoS-safe).
  const slashed = root.replace(/\\/g, '/');
  let end = slashed.length;
  while (end > 0 && slashed[end - 1] === '/') end--;
  const normRoot = slashed.slice(0, end);
  if (!normRoot) return normalized;
  if (normalized === normRoot) return '';
  if (normalized.startsWith(normRoot + '/')) {
    return normalized.slice(normRoot.length);
  }
  return normalized;
}

const RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'] as const;

function isFile(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

/**
 * Attempts to find the concrete file an extension-less import specifier
 * points at, trying the usual TypeScript/JavaScript extensions and an
 * `index.*` barrel. Returns `undefined` when nothing exists on disk (e.g.
 * path aliases, virtual files under RuleTester) so callers can fall back to
 * the directory-hint heuristics.
 */
function resolveOnDisk(resolvedPath: string): string | undefined {
  if (isFile(resolvedPath)) return resolvedPath;
  for (const ext of RESOLVE_EXTENSIONS) {
    const candidate = resolvedPath + ext;
    if (isFile(candidate)) return candidate;
  }
  for (const ext of RESOLVE_EXTENSIONS) {
    const candidate = path.join(resolvedPath, `index${ext}`);
    if (isFile(candidate)) return candidate;
  }
  return undefined;
}

/**
 * Broad layer detection used by `enforce-layer-boundaries`. Accepts both
 * extension-bearing file paths (e.g. `/app/components/UserCard.tsx`) and
 * extension-less import specifiers (e.g. `../components/UserCard`).
 *
 * Directory hints (`viewDirPatterns`) only classify a path as a View when it
 * carries no concrete code extension — a resolved `.ts`/`.js` module is not a
 * View component even if it lives under a View directory, so it falls through
 * to the Model patterns instead.
 */
export function getLayer(
  filePath: string,
  settings: MvvmSettings = {}
): MvvmLayer {
  const normalized = filePath.replace(/\\/g, '/');
  const relative = relativeToRoot(normalized, settings.root);

  const viewmodelPatterns = compile(
    settings.viewModelPatterns,
    DEFAULT_VIEWMODEL_PATTERNS
  );
  if (viewmodelPatterns.some((p) => p.test(relative))) return 'viewmodel';

  if (VIEW_EXTENSION.test(relative)) return 'view';

  if (!CODE_EXTENSION.test(relative)) {
    const viewDirPatterns = compile(
      settings.viewDirPatterns,
      DEFAULT_VIEW_DIR_PATTERNS
    );
    if (viewDirPatterns.some((p) => p.test(relative))) return 'view';
  }

  const modelPatterns = compile(
    settings.modelPatterns,
    DEFAULT_MODEL_PATTERNS
  );
  if (modelPatterns.some((p) => p.test(relative))) return 'model';

  return 'unknown';
}

export function resolveImportLayer(
  importSource: string,
  currentFilePath: string,
  settings: MvvmSettings = {}
): MvvmLayer {
  if (importSource.startsWith('.')) {
    const dir = path.dirname(currentFilePath);
    const resolved = path.resolve(dir, importSource);
    // Prefer the real file on disk so its actual extension drives
    // classification; fall back to the extension-less path (directory hints)
    // when it can't be resolved.
    const onDisk = resolveOnDisk(resolved);
    return getLayer(onDisk ?? resolved, settings);
  }
  return getLayer(importSource, settings);
}

/**
 * Strict View check used by `no-api-in-view` and `no-state-in-view`:
 * a View is a `.tsx` / `.jsx` file that is not classified as a ViewModel
 * by `settings.mvvm.viewModelPatterns`.
 *
 * Directory hints like `/components/` are intentionally ignored here —
 * the user's intent is "no API or state inside .tsx/.jsx files."
 */
export function isViewFile(
  filePath: string,
  settings: MvvmSettings = {}
): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  if (!VIEW_EXTENSION.test(normalized)) return false;

  const viewmodelPatterns = compile(
    settings.viewModelPatterns,
    DEFAULT_VIEWMODEL_PATTERNS
  );
  return !viewmodelPatterns.some((p) => p.test(normalized));
}

export function isViewModelFile(
  filePath: string,
  settings: MvvmSettings = {}
): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  const viewmodelPatterns = compile(
    settings.viewModelPatterns,
    DEFAULT_VIEWMODEL_PATTERNS
  );
  return viewmodelPatterns.some((p) => p.test(normalized));
}

interface MvvmContextLike {
  filename?: string;
  getFilename?: () => string;
  cwd?: string;
  getCwd?: () => string;
  settings?: { mvvm?: MvvmSettings };
}

export function getFilename(context: MvvmContextLike): string {
  if (typeof context.filename === 'string') return context.filename;
  if (typeof context.getFilename === 'function') return context.getFilename();
  return '<input>';
}

/** axios instance methods: axios.get(), client.post(), etc. */
const AXIOS_METHODS = new Set([
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'request',
  'head',
]);

type Callee = CallExpression['callee'];

/**
 * Resolves a call expression's callee to the bare name used for hook-pattern
 * matching. A plain `Identifier` callee yields its name; a non-computed
 * `MemberExpression` such as `React.useState` yields the property name
 * (`useState`) so namespaced hook calls are detected exactly like bare ones.
 * Returns `undefined` for computed or otherwise un-nameable callees.
 */
export function getCalleeHookName(callee: Callee): string | undefined {
  if (callee.type === 'Identifier') return callee.name;
  if (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.property.type === 'Identifier'
  ) {
    return callee.property.name;
  }
  return undefined;
}

/**
 * Human-readable rendering of a callee for diagnostics: `React.useState` for a
 * namespaced call, or the bare identifier name. Falls back to the resolved
 * hook name for deeper member shapes.
 */
export function getCalleeDisplayName(callee: Callee): string | undefined {
  if (callee.type === 'Identifier') return callee.name;
  if (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.object.type === 'Identifier' &&
    callee.property.type === 'Identifier'
  ) {
    return `${callee.object.name}.${callee.property.name}`;
  }
  return getCalleeHookName(callee);
}

/**
 * Records an import declaration's default/namespace/named bindings into
 * `sources` (local name → module specifier), so a callee's base identifier can
 * later be traced back to the module it came from.
 */
export function collectImportSources(
  node: ImportDeclaration,
  sources: Map<string, string>
): void {
  const source = node.source.value;
  if (typeof source !== 'string') return;
  for (const spec of node.specifiers) {
    sources.set(spec.local.name, source);
  }
}

/**
 * If `callee` is an axios method call whose base identifier resolves to an
 * `axios` import — the conventional `axios.get(...)` or an aliased client
 * (`import client from 'axios'; client.get(...)`) — returns a display string
 * like `axios.get`. Returns `undefined` otherwise.
 */
export function getAxiosCall(
  callee: Callee,
  importSources: Map<string, string>
): string | undefined {
  if (callee.type !== 'MemberExpression' || callee.computed) return undefined;
  if (callee.object.type !== 'Identifier') return undefined;
  if (callee.property.type !== 'Identifier') return undefined;
  if (!AXIOS_METHODS.has(callee.property.name)) return undefined;
  if (importSources.get(callee.object.name) !== 'axios') return undefined;
  return `${callee.object.name}.${callee.property.name}`;
}

export function getSettings(context: MvvmContextLike): MvvmSettings {
  const mvvm = context.settings?.mvvm ?? {};
  if (mvvm.root !== undefined) return mvvm;

  // Default the directory-hint root to the ESLint working directory so hints
  // like `/ui/` are scoped to the project, not to an ancestor path.
  const cwd =
    typeof context.cwd === 'string'
      ? context.cwd
      : typeof context.getCwd === 'function'
        ? context.getCwd()
        : undefined;
  if (cwd === undefined) return mvvm;
  return { ...mvvm, root: cwd };
}
