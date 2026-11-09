import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  folderMessages,
  formatFolderMessage,
  loadFolderLocale,
  resolveFolderLocale,
  saveFolderLocale,
} from './locale.js';

afterEach(() => vi.unstubAllGlobals());

describe('folder explorer locale', () => {
  it('provides the same complete message keys for each supported language', () => {
    expect(Object.keys(folderMessages.id).sort()).toEqual(Object.keys(folderMessages.en).sort());
    for (const locale of ['en', 'id'] as const) {
      for (const value of Object.values(folderMessages[locale])) {
        expect(typeof value).toBe('string');
        expect(value.trim()).not.toBe('');
      }
    }
  });

  it('uses English for unsupported language codes and accepts the supported codes', () => {
    expect(resolveFolderLocale('en')).toBe('en');
    expect(resolveFolderLocale('id')).toBe('id');
    expect(resolveFolderLocale('unexpected')).toBe('en');
    expect(resolveFolderLocale(null)).toBe('en');
  });

  it('provides a distinct translation without altering the default English messages', () => {
    expect(folderMessages.en.files).toBe('Files');
    expect(folderMessages.id.files).not.toBe(folderMessages.en.files);
  });

  it('remembers a language choice without requiring browser storage to be available', () => {
    const getItem = vi.fn(() => 'id');
    const setItem = vi.fn();
    vi.stubGlobal('window', { localStorage: { getItem, setItem } });
    expect(loadFolderLocale()).toBe('id');
    saveFolderLocale('en');
    expect(setItem).toHaveBeenCalledWith('context-atlas.folder.interface-locale', 'en');

    vi.stubGlobal('window', {
      get localStorage() {
        throw new Error('Storage is unavailable');
      },
    });
    expect(loadFolderLocale()).toBe('en');
    expect(() => saveFolderLocale('id')).not.toThrow();
  });

  it('preserves the same interpolation fields in both languages', () => {
    for (const key of Object.keys(folderMessages.en) as Array<keyof typeof folderMessages.en>) {
      const fields = (value: string) => (value.match(/\{[a-z]+\}/gi) ?? []).sort();
      expect(fields(folderMessages.id[key]), key).toEqual(fields(folderMessages.en[key]));
    }
    expect(formatFolderMessage('Open {name} at {path}', { name: 'item', path: 'docs/a.md' })).toBe(
      'Open item at docs/a.md',
    );
    expect(formatFolderMessage('{unknown}', {})).toBe('{unknown}');
  });
});
