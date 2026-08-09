import {
  isBrowserDatabaseLockError,
  reloadBrowserDocument,
} from '../web-database-recovery';

describe('web database recovery', () => {
  it.each([
    "NoModificationAllowedError: Failed to execute 'createSyncAccessHandle'",
    'Access Handles cannot be created while the file is in use',
    new Error('Invalid VFS state'),
  ])('recognizes a temporary browser database lock: %s', error => {
    expect(isBrowserDatabaseLockError(error)).toBe(true);
  });

  it('does not call a damaged database a temporary tab lock', () => {
    expect(isBrowserDatabaseLockError('database disk image is malformed')).toBe(false);
  });

  it('reloads a supplied browser document and fails soft without one', () => {
    let reloads = 0;
    expect(reloadBrowserDocument({ reload: () => { reloads += 1; } })).toBe(true);
    expect(reloads).toBe(1);
    expect(reloadBrowserDocument(null)).toBe(false);
  });
});
