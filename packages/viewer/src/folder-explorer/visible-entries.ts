import type { Entry } from '@context-atlas/core';

const TECHNICAL_DIRECTORIES = new Set([
  '.agents',
  '.idea',
  '.vscode',
  '__fixtures__',
  '__mocks__',
  '__tests__',
  'coverage',
  'fixtures',
  'runs',
  'scripts',
  'test',
  'tests',
]);

const TECHNICAL_FILES = new Set([
  'agents.md',
  'atlas.json',
  'claude.md',
  'gemini.md',
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lock',
  'cargo.lock',
  'composer.lock',
  'go.sum',
  'poetry.lock',
]);

function isTechnicalEntry(entry: Entry): boolean {
  const name = entry.name.toLowerCase();
  if (entry.kind === 'dir') return TECHNICAL_DIRECTORIES.has(name);
  return (
    TECHNICAL_FILES.has(name) ||
    /\.(?:[cm]?[jt]sx?|py|java|go|sh|map)$/.test(name) ||
    /^(?:tsconfig|vite\.config|vitest\.config|playwright\.config|eslint\.config)(?:\.|$)/.test(name)
  );
}

/** Filter navigation only; this does not change source permissions, search or direct links. */
export function visibleFolderEntries(entries: readonly Entry[]): readonly Entry[] {
  return entries.filter(
    (entry) => !entry.name.toLowerCase().startsWith('.git') && !isTechnicalEntry(entry),
  );
}

/** Put common orientation documents before supporting folders, preserving all other order. */
export function prioritizeRootEntries(entries: readonly Entry[]): readonly Entry[] {
  const priority = (entry: Entry): number => {
    const name = entry.name.toLowerCase();
    if (entry.kind === 'file' && /^readme(?:\.|$)/.test(name)) return 0;
    if (entry.kind === 'dir' && (name === 'guide' || name === 'guides')) return 1;
    if (entry.kind === 'dir' && (name === 'docs' || name === 'documentation')) return 2;
    return 3;
  };
  return [...entries].sort((left, right) => priority(left) - priority(right));
}
