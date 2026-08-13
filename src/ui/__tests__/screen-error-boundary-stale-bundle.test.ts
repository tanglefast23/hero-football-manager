import { isStaleBundleError } from '../stale-bundle';

// A web redeploy replaces hashed chunks, so a document loaded before it 404s
// on lazy screens. Those failures must route to "reload", never "back to
// title" — the rejected import stays rejected for the document's lifetime.
test('classifies chunk-load failures as stale bundle', () => {
  const asyncRequire = new Error('Failed to load split bundle');
  asyncRequire.name = 'AsyncRequireError';
  expect(isStaleBundleError(asyncRequire)).toBe(true);
  expect(
    isStaleBundleError(
      new TypeError('Failed to fetch dynamically imported module'),
    ),
  ).toBe(true);
});

test('ordinary view-model throws are not stale bundles', () => {
  expect(
    isStaleBundleError(new Error('power PHANTOM_DASH not in catalog')),
  ).toBe(false);
  expect(isStaleBundleError('anything else')).toBe(false);
});
