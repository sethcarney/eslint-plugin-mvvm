import path from 'path';

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
   */
  viewDirPatterns?: (string | RegExp)[];

  /**
   * Regex patterns identifying Model files. Same semantics as
   * `viewModelPatterns`.
   */
  modelPatterns?: (string | RegExp)[];
}

const VIEW_EXTENSION = /\.(tsx|jsx)$/;

const DEFAULT_VIEWMODEL_PATTERNS: RegExp[] = [
  /(?:^|\/)use[A-Z][a-zA-Z0-9]*\.(tsx?|jsx?)$/,
  /\.vm\.(tsx?|jsx?)$/,
  /\.viewmodel\.(tsx?|jsx?)$/,
  /ViewModel\.(tsx?|jsx?)$/,
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
  if (!patterns || patterns.length === 0) return fallback;
  return patterns.map((p) => (typeof p === 'string' ? new RegExp(p) : p));
}

/**
 * Broad layer detection used by `enforce-layer-boundaries`. Accepts both
 * extension-bearing file paths (e.g. `/app/components/UserCard.tsx`) and
 * extension-less import specifiers (e.g. `../components/UserCard`) — so
 * View matching falls back to directory hints when no extension exists.
 */
export function getLayer(
  filePath: string,
  settings: MvvmSettings = {}
): MvvmLayer {
  const normalized = filePath.replace(/\\/g, '/');

  const viewmodelPatterns = compile(
    settings.viewModelPatterns,
    DEFAULT_VIEWMODEL_PATTERNS
  );
  if (viewmodelPatterns.some((p) => p.test(normalized))) return 'viewmodel';

  if (VIEW_EXTENSION.test(normalized)) return 'view';

  const viewDirPatterns = compile(
    settings.viewDirPatterns,
    DEFAULT_VIEW_DIR_PATTERNS
  );
  if (viewDirPatterns.some((p) => p.test(normalized))) return 'view';

  const modelPatterns = compile(
    settings.modelPatterns,
    DEFAULT_MODEL_PATTERNS
  );
  if (modelPatterns.some((p) => p.test(normalized))) return 'model';

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
    return getLayer(resolved, settings);
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
  settings?: { mvvm?: MvvmSettings };
}

export function getFilename(context: MvvmContextLike): string {
  if (typeof context.filename === 'string') return context.filename;
  if (typeof context.getFilename === 'function') return context.getFilename();
  return '<input>';
}

export function getSettings(context: MvvmContextLike): MvvmSettings {
  return context.settings?.mvvm ?? {};
}
