import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const DIST = path.resolve('dist');
// Ratcheted from the measured English title load. Both allowances are 5 KB
// above the accepted artifact, so ordinary feature growth eventually needs a
// deliberate re-ratchet and a one-off leak still trips the gate.
//
// Re-ratcheted 2026-08-12 off the club-crests merge at 64e23d44, which took the
// artifact to 5_895_627 raw / 867_978 gzip and put main over the previous raw
// mark on its own — the crests ship as inline data across every team-name
// surface. The previous mark was set at 0128bcc4 (5_886_821 / 865_222), and
// before that at 0b2fc042 (5_861_753 / 858_160). Checked before moving the
// number: the QA and Skia marker assertions below both stayed clean, so this is
// deliberate content growth, not a renderer or dev-harness leak.
const RAW_BUDGET = 5_900_627;
const GZIP_BUDGET = 872_978;
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
