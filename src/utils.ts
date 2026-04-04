import path from 'path';

export type MvvmLayer = 'view' | 'viewmodel' | 'model' | 'unknown';

const VIEW_PATTERNS = [
  /\.tsx$/,
  /[/\\]components[/\\]/,
  /[/\\]pages[/\\]/,
  /[/\\]screens[/\\]/,
  /[/\\]views[/\\]/,
  /[/\\]ui[/\\]/,
];

const VIEWMODEL_PATTERNS = [
  /use[A-Z][a-zA-Z]+\.tsx?$/,
  /\.vm\.tsx?$/,
  /ViewModel\.tsx?$/,
  /[/\\]viewmodels?[/\\]/,
  /[/\\]hooks[/\\]/,
];

const MODEL_PATTERNS = [
  /[/\\]models?[/\\]/,
  /[/\\]store[/\\]/,
  /[/\\]stores[/\\]/,
  /[/\\]api[/\\]/,
  /[/\\]services?[/\\]/,
  /[/\\]repositories?[/\\]/,
  /[/\\]domain[/\\]/,
  /\.model\.ts$/,
  /\.service\.ts$/,
  /\.store\.ts$/,
];

export function getLayer(filePath: string): MvvmLayer {
  const normalized = filePath.replace(/\\/g, '/');

  if (VIEWMODEL_PATTERNS.some((p) => p.test(normalized))) return 'viewmodel';
  if (VIEW_PATTERNS.some((p) => p.test(normalized))) return 'view';
  if (MODEL_PATTERNS.some((p) => p.test(normalized))) return 'model';
  return 'unknown';
}

export function resolveImportLayer(
  importSource: string,
  currentFilePath: string
): MvvmLayer {
  if (importSource.startsWith('.')) {
    const dir = path.dirname(currentFilePath);
    const resolved = path.resolve(dir, importSource);
    return getLayer(resolved);
  }
  // bare / alias imports: try to infer from the import path string itself
  return getLayer(importSource);
}

export function isViewFile(filePath: string): boolean {
  return getLayer(filePath) === 'view';
}

export function isViewModelFile(filePath: string): boolean {
  return getLayer(filePath) === 'viewmodel';
}
