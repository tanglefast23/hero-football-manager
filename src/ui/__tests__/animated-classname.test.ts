import * as fs from 'node:fs';
import { scannedFiles } from '../../i18n/hardcoded-prose';

// NativeWind v4 does not process className on Animated wrappers in this app:
// the classes are silently dropped, so the component renders unstyled with no
// error (the boot-loader ball shipped invisible exactly this way). Keep
// Animated components style-only and put the classes on a plain child View.
test('no className on an Animated component — NativeWind drops it silently', () => {
  const offenders = scannedFiles().filter((file) =>
    /<Animated\.\w+[^>]*?className=/s.test(fs.readFileSync(file, 'utf8')),
  );
  expect(offenders).toEqual([]);
});
