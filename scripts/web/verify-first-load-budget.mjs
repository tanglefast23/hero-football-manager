import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const DIST = path.resolve('dist');
// Ratcheted from the measured English title load after Skia moved behind its
// feature boundary. Both allowances are 5 KB above that accepted artifact.
const RAW_BUDGET = 5_868_128;
const GZIP_BUDGET = 863_477;
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
