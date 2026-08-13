import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const DIST = path.resolve('dist');
// Ratcheted from the measured English title load. Both allowances are 5 KB
// above the accepted artifact, so ordinary feature growth eventually needs a
// deliberate re-ratchet and a one-off leak still trips the gate.
//
// Re-ratcheted 2026-08-13 off PR #158's merge artifact (audit2 + main), CI-
// measured at 5_917_682 raw / 874_253 gzip. Growth since the 2026-08-12 mark
// (5_896_612 raw / 868_302 gzip) is +21_070 raw / +5_951 gzip, spread across
// four merges: win bonus + story rewards (78c35279), the audit2 hardening
// sweep, substitution entry energy (#157), and the audit3 adversarial fixes
// (59175c5b: error-boundary reload path, seven-locale catalog additions).
// Checked before moving the number, same as last time: the QA and Skia marker
// assertions below both stayed clean, so this is distributed feature growth,
// not a renderer or dev-harness leak.
//
// Merge note, same day: #159 independently re-ratcheted main to 5_908_835 /
// 875_599 off a main-only artifact (5_903_715 / 870_479, its own branch adding
// ten raw bytes). The audit2 merge artifact above is the larger superset, so
// its marks win this conflict; #159's growth attribution for main agrees with
// the four-merge account above.
//
// Previous marks: 5_908_835 / 875_599 at b26e1399 (#159), 5_896_612 on the
// stat-tip branch, 5_891_821 at 0128bcc4, 5_861_753 at 0b2fc042.
const RAW_BUDGET = 5_922_802;
const GZIP_BUDGET = 879_373;
const QA_BODY_MARKERS = [
  'DEV HARNESS',
  'Development builds only. Deep link',
  'Show the ceremony case',
];
const SKIA_BODY_MARKERS = ['SkiaViewApi', 'JsiSkCanvas'];

const html = readFileSync(path.join(DIST, 'index.html'), 'utf8');
const browserEntryPaths = [
  ...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g),
].map((match) => match[1]);
if (browserEntryPaths.length === 0) {
  throw new Error('dist/index.html has no JavaScript entry');
}

const indexPath = browserEntryPaths.find((file) =>
  /\/index-[^/]+\.js$/.test(file),
);
if (indexPath === undefined) {
  throw new Error('dist/index.html does not load an index bundle');
}
const indexSource = readFileSync(resolveDistPath(indexPath), 'utf8');
const appMatch = indexSource.match(
  /"(\/_expo\/static\/js\/web\/App-[^"]+\.js)"/,
);

// App can be in the index entry or in an immediate child chunk. Match and QA
// renderers are lazy and are not part of the title's first load.
const firstLoadPaths = [
  ...new Set([
    ...browserEntryPaths,
    ...(appMatch === null ? [] : [appMatch[1]]),
  ]),
];
const files = firstLoadPaths.map((file) => ({
  file,
  source: readFileSync(resolveDistPath(file)),
}));
const rawBytes = files.reduce((total, file) => total + file.source.length, 0);
const gzipBytes = files.reduce(
  (total, file) => total + gzipSync(file.source, { level: 9 }).length,
  0,
);
const combined = Buffer.concat(files.map((file) => file.source)).toString(
  'utf8',
);
const qaMarkers = QA_BODY_MARKERS.filter((marker) => combined.includes(marker));
const skiaMarkers = SKIA_BODY_MARKERS.filter((marker) =>
  combined.includes(marker),
);

console.info(
  JSON.stringify(
    {
      firstLoadFiles: firstLoadPaths,
      rawBytes,
      rawBudget: RAW_BUDGET,
      gzipBytes,
      gzipBudget: GZIP_BUDGET,
      qaBodyMarkers: qaMarkers,
      skiaBodyMarkers: skiaMarkers,
    },
    null,
    2,
  ),
);

if (rawBytes > RAW_BUDGET) {
  throw new Error(
    `first-load JavaScript is ${rawBytes} bytes; budget is ${RAW_BUDGET}`,
  );
}
if (gzipBytes > GZIP_BUDGET) {
  throw new Error(
    `first-load JavaScript gzip is ${gzipBytes} bytes; budget is ${GZIP_BUDGET}`,
  );
}
if (qaMarkers.length > 0) {
  throw new Error(`QA bodies leaked into first load: ${qaMarkers.join(', ')}`);
}
if (skiaMarkers.length > 0) {
  throw new Error(
    `Skia renderer leaked into title first load: ${skiaMarkers.join(', ')}`,
  );
}

function resolveDistPath(urlPath) {
  return path.join(DIST, urlPath.replace(/^\//, ''));
}
