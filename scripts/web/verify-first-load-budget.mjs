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
// Re-ratcheted 2026-08-15 off this branch's artifact, measured by this script
// at 5_972_355 raw / 888_727 gzip. The raw figure matches CI's to the byte.
//
// The overrun is not this branch's. `origin/main` at 2388ec6d was measured the
// same way, from its own clean export: 5_972_170 raw / 888_693 gzip — already
// 49_368 raw past the old mark. This branch adds 185 raw and 34 gzip, which is
// the seven-locale `clubHome.managerNameDefault` key and nothing else.
//
// Nobody saw the breach because `format:check` runs first and has been failing
// on main since at least b9c6d7a5, so the budget check has not been reached on
// main for five commits: b9c6d7a5, bf473af5, bf3bbe93, 440a8fdb, 2388ec6d.
// Growth since the #158 mark is +54_488 raw / +14_440 gzip across those five.
// Checked before moving the number, same as last time: the QA and Skia marker
// assertions below both stayed clean, so this is distributed feature growth,
// not a renderer or dev-harness leak.
//
// Re-ratcheted again, same day, after merging main's 24a5d08e and 5e069a30.
// The mark above was measured before those landed, and they brought the new
// career-event stories, the deepened scouting copy and their seven-locale
// catalog keys with them: +21_520 raw locally, 5_972_355 -> 5_993_875.
//
// The number below is set from CI's own figure for the merge commit,
// 5_994_912, which runs about a thousand bytes above a local export of the same
// tree. CI is the measurement that has to pass, so CI is the one ratcheted
// against. Markers clean again — no QA bodies, no Skia in the title load.
//
// Re-ratcheted 2026-08-16 off CI's figure for 6a2c27e2 on
// fix/honest-first-season-market: 6_000_786 raw / 896_680 gzip. Raw ate the old
// 5 KB headroom and 874 bytes past it; gzip is still 2_900 under its old mark.
//
// The growth is English catalog keys, and the first-load set is why. Locale
// bundles ship as their own chunks (de-*.js and friends) and are not in
// `firstLoadFiles`, so only the English strings land in `index-*.js`. This
// branch adds ten: six for the `scout-report-unaffordable` sequence, and four
// for the Coaching Office levels, the scout range note and the storage warning.
// The rest is the branch's game code — match-day form, Coaching Office levels,
// the save reconnect.
//
// Checked before moving the number, same as every time: CI reported
// `qaBodyMarkers: []` and `skiaBodyMarkers: []` on the failing run. That matters
// here because 6a2c27e2 touches the dev-harness reel — the markers prove none of
// it reached the title load.
//
// Nobody saw this breach until now for the usual reason: `format:check` is the
// first gate in the same job and had been failing, so the budget check was never
// reached. Fixing the formatting is what exposed it.
//
// Re-ratcheted 2026-08-16 off CI's figure for 33bbf4b0 on
// feat/hero-license-purchase: 6_007_581 raw / 898_981 gzip. Local export of the
// same tree read 6_006_479, so CI still runs about 1_100 bytes high, and CI is
// what has to pass.
//
// This one IS the branch's, unlike the last several. `origin/main` at 3a93760b
// was exported and measured the same way: 5_999_703 raw / 896_385 gzip, which
// is 6_083 UNDER the old mark. So the +6_776 raw is this branch and nothing
// inherited. It is spread across fourteen English catalog keys for the permit
// office, the glossary's extended Hero License entry plus its new Permit office
// entry, the match-day panel itself, and the club name pools going from fifteen
// words to a hundred.
//
// Gzip is deliberately NOT moved. It reads 898_981 against a 901_680 mark, so
// it never breached; raising a budget nothing has hit is loosening for free.
//
// Markers checked before moving the number, and harder than usual, because this
// branch adds a dev-harness entry. `qaBodyMarkers` and `skiaBodyMarkers` were
// both empty on CI's failing run, and three strings unique to the new entry —
// "Hero License permit office", "Third permit at",
// "hero-license-shop:first-matchday" — return zero hits in both `index-*.js`
// and `__common-*.js`. The entry is lazy and stayed lazy.
//
// Worth knowing for the next person: `"Cup mismatch warning"` DOES appear in
// `index-*.js` on main, and no marker in QA_BODY_MARKERS catches it. The marker
// list proves the absence of the three strings it names, not the absence of the
// harness. Widening it is a separate job from this branch.
//
// Re-ratcheted 2026-08-16 off CI's figure for e052a5c1 on
// claude/coach-motivational-speech-0bbc30: 6_018_860 raw / 902_095 gzip. A
// local export of the same tree read 6_017_823 / 901_868, so CI still runs
// about 1_000 bytes high, and CI is what has to pass.
//
// Split, because this one is BOTH the branch's and inherited. `origin/main` at
// 84a30233 was exported and measured the same way: 6_011_010 raw / 900_102
// gzip — already 3_429 raw past the old mark on its own. The mark was set from
// CI's figure for 33bbf4b0 (#166's branch), and #168 landed after it. So of the
// 10_242 raw this branch reports over the old mark, 3_429 arrived with main and
// 6_813 is this branch: sixteen English catalog keys for the speech button,
// its confirmation sheet and the half-time sheet, Bert's two-page briefing in
// `assistant-guide.json`, the pure `coach-speech.ts` module, and the Staff
// board button with its view model. Gzip splits the same way — main is 1_578
// UNDER its old mark, this branch adds 1_766, so the 415-byte CI breach is the
// branch's and the number moves.
//
// The locale bundles are again not the story: `de-*.js` and friends are their
// own chunks and not in `firstLoadFiles`, so only the English half of the
// seven-language copy lands in `index-*.js`.
//
// Markers checked before moving the number, as every time, and with the same
// care #166 needed, because this branch also touches the dev-harness reel —
// `assistant-beats.tsx` gains the new sequence id, its `SPEECH` chip label and
// a group entry. CI reported `qaBodyMarkers: []` and `skiaBodyMarkers: []` on
// the failing run, and three strings that exist only in that harness entry —
// "Requests, injuries, the loan", "AUTHORED_EXPRESSION_RUNS", "Bert beats" —
// return zero hits in `index-*.js`. The entry is lazy and stayed lazy.
//
// Worth knowing for the next person: do NOT grep the title bundle for the chip
// label `SPEECH` to check that. It hits seven times on a clean build, every one
// of them inside `MOTIVATIONAL_SPEECH`, the sim's own input kind, which belongs
// in the first load. A substring of app code is not a harness marker.
//
// Previous marks: 6_007_581 / 901_680 at 33bbf4b0 (#166), 6_005_786 / 901_680
// at 6a2c27e2, 5_994_912 / 894_580 at the 2026-08-15 merge, 5_977_355 /
// 893_727 earlier that day, 5_922_802 / 879_373 at #158, 5_908_835 / 875_599 at
// b26e1399 (#159), 5_896_612 on the stat-tip branch, 5_891_821 at 0128bcc4,
// 5_861_753 at 0b2fc042.
const RAW_BUDGET = 6_018_860;
const GZIP_BUDGET = 902_095;
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
