import { describe, expect, it } from 'vitest';
import { isExcludedPath, isMetadataOnly, MAX_FILE_SIZE_BYTES } from './exclusions.js';

describe('isExcludedPath', () => {
  it.each([
    '.git/config',
    'nested/.local/private.md',
    'node_modules/package/index.js',
    'dist/index.js',
    'nested/__pycache__/module.pyc',
    'nested/.DS_Store',
    '.env',
    '.env.local',
    'config/server.pem',
    'config/server.KEY',
    'certs/client.p12',
    'certs/client.pfx',
    'keys/id_rsa',
    'keys/id_rsa.pub',
    'backups/archive.kdbx',
    '../outside.md',
    'nested//guide.md',
  ])('excludes %s', (path) => {
    expect(isExcludedPath(path)).toBe(true);
  });

  it('keeps ordinary project documents available', () => {
    expect(isExcludedPath('docs/guide.md')).toBe(false);
    expect(isExcludedPath('assets/diagram.svg')).toBe(false);
  });
});

describe('isMetadataOnly', () => {
  it('allows content up to and including the 10 MB cap', () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024);
    expect(isMetadataOnly(MAX_FILE_SIZE_BYTES)).toBe(false);
  });

  it('limits content above 10 MB and fails closed for invalid sizes', () => {
    expect(isMetadataOnly(MAX_FILE_SIZE_BYTES + 1)).toBe(true);
    expect(isMetadataOnly(-1)).toBe(true);
    expect(isMetadataOnly(Number.NaN)).toBe(true);
    expect(isMetadataOnly(Number.POSITIVE_INFINITY)).toBe(true);
  });
});
