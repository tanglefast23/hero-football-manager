/**
 * iPad / PWA audit of a built web export.
 *
 * Checks the things only the shipped `dist/` can answer: the HTML shell's
 * tablet and home-screen metadata, the CSS gesture rules, and the assets the
 * installed app needs. Source-level invariants live in the jest suite
 * (`src/ui/__tests__/ipad-pwa-guards.test.ts`) instead, so they run without a build.
 *
 *   node scripts/qa/ipad-pwa-audit.mjs [--dist <dir>] [--url <origin>]
 *
 * Exits 1 on any FAIL. MANUAL lines never fail the run — they are the checks no
 * machine here can make, and they are listed again at the end for the owner.
 * Nothing PASSes on absence of evidence: a missing build is an error, not a pass.
 *
 * Spec: docs/superpowers/plans/2026-08-06-ipad-pwa-audit-spec.md
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const distDir = path.resolve(readFlag('--dist') ?? 'dist');
const probeUrl = readFlag('--url');

function readFlag(name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

const results = [];
function record(status, severity, id, what, detail) {
  results.push({ status, severity, id, what, detail });
}
const pass = (severity, id, what, detail) =>
  record('PASS', severity, id, what, detail);
const fail = (severity, id, what, detail) =>
  record('FAIL', severity, id, what, detail);
const manual = (severity, id, what, detail) =>
  record('MANUAL', severity, id, what, detail);
const accepted = (severity, id, what, detail) =>
  record('ACCEPTED', severity, id, what, detail);

/** Asserts a rule is in the built CSS, which is where the game's real styling ends up. */
function cssCheck(css, severity, id, needle, what) {
  if (css.includes(needle)) pass(severity, id, what);
  else fail(severity, id, what, `\`${needle}\` is not in the built CSS`);
}

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function readBuiltCss() {
  const cssDir = path.join(distDir, '_expo', 'static', 'css');
  if (!(await exists(cssDir))) return '';
  const files = await readdir(cssDir);
  const sheets = await Promise.all(
    files
      .filter((name) => name.endsWith('.css'))
      .map((name) => readFile(path.join(cssDir, name), 'utf8')),
  );
  return sheets.join('\n');
}

async function main() {
  if (!(await exists(path.join(distDir, 'index.html')))) {
    console.error(
      `No web export at ${distDir}/index.html.\n` +
        'Run `npm run export:web` first — an audit with nothing to read is not a pass.',
    );
    process.exit(2);
  }

  const html = await readFile(path.join(distDir, 'index.html'), 'utf8');
  const css = await readBuiltCss();
  if (css === '') {
    console.error(
      `No built CSS under ${distDir}/_expo/static/css — is this a complete export?`,
    );
    process.exit(2);
  }

  // ---- S2/S6: gestures the browser would otherwise steal --------------------
  cssCheck(
    css,
    'P1',
    'R2.1',
    'touch-action:pan-x pan-y',
    'page zoom cannot fire during rapid game taps',
  );
  cssCheck(
    css,
    'P1',
    'R2.2',
    '-webkit-touch-callout:none',
    "the iPadOS text callout cannot race InfoTip's hold",
  );
  cssCheck(
    css,
    'P3',
    'R6.3',
    'overscroll-behavior:none',
    'a rubber-banded list cannot expose the dark body',
  );

  // ---- S3: the installed web app shell -------------------------------------
  htmlCheck(
    'P2',
    'R3.3',
    'viewport-fit=cover',
    'safe-area insets report real numbers',
  );
  htmlCheck(
    'P2',
    'R3.4',
    'name="apple-mobile-web-app-capable"',
    'iOS launches it as a web app',
  );
  htmlCheck(
    'P2',
    'R3.4',
    'name="mobile-web-app-capable"',
    'the standard capability meta is present',
  );
  htmlCheck(
    'P2',
    'R3.4',
    'name="apple-mobile-web-app-status-bar-style"',
    'the status bar is styled for a dark shell',
  );
  htmlCheck(
    'P2',
    'R3.4',
    'name="theme-color"',
    'the browser chrome matches the game',
  );
  htmlCheck(
    'P2',
    'R3.1',
    'rel="apple-touch-icon"',
    'the home screen shows the icon, not a screenshot',
  );
  htmlCheck('P2', 'R3.2', 'rel="manifest"', 'the manifest is linked');
  htmlCheck(
    'P2',
    'R3.5',
    'background: #241f2e',
    'the shell paints dark before the stylesheet lands',
  );

  for (const [id, file] of [
    ['R3.1', 'apple-touch-icon.png'],
    ['R3.2', 'icon-192.png'],
    ['R3.2', 'icon-512.png'],
  ]) {
    if (await exists(path.join(distDir, file)))
      pass('P2', id, `${file} shipped`);
    else fail('P2', id, `${file} shipped`, 'linked but not in the export');
  }

  const manifestPath = path.join(distDir, 'manifest.json');
  if (!(await exists(manifestPath))) {
    fail(
      'P2',
      'R3.2',
      'manifest.json shipped',
      'the link has nothing to resolve to',
    );
  } else {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifestCheck(
      manifest,
      'display',
      'standalone',
      'R3.2',
      'it launches without browser chrome',
    );
    // Native locks portrait; the tablet plays in landscape, so web must not inherit that.
    manifestCheck(
      manifest,
      'orientation',
      'any',
      'R6.4',
      'both tablet orientations stay allowed',
    );
    manifestCheck(
      manifest,
      'theme_color',
      '#241f2e',
      'R3.4',
      'the manifest colour matches the shell',
    );
    manifestCheck(
      manifest,
      'background_color',
      '#241f2e',
      'R3.5',
      'the launch background is dark',
    );
    if (Array.isArray(manifest.icons) && manifest.icons.length > 0) {
      pass('P2', 'R3.2', 'the manifest declares icons');
    } else {
      fail('P2', 'R3.2', 'the manifest declares icons', 'icons array is empty');
    }
  }

  // ---- S9: the match canvas ------------------------------------------------
  if (await exists(path.join(distDir, 'canvaskit.wasm'))) {
    pass(
      'P1',
      'R9.1',
      'canvaskit.wasm is in the export, so match day can draw',
    );
  } else {
    fail(
      'P1',
      'R9.1',
      'canvaskit.wasm is in the export',
      'match day would not draw',
    );
  }

  // ---- S8: delivery --------------------------------------------------------
  const hasServiceWorker = (await readdir(distDir)).some((name) =>
    /^(sw|service-worker)\.js$/.test(name),
  );
  accepted(
    'P3',
    'R8.1',
    'no service worker, so an offline launch fails',
    hasServiceWorker
      ? 'a service worker appeared — update the spec, this was an accepted limitation'
      : 'accepted: a hand-rolled cache risks serving a stale bundle, which is worse than needing a network',
  );

  if (probeUrl === undefined) {
    manual(
      'P3',
      'R8.2',
      'the deployment must not cache index.html',
      're-run with --url https://<origin> to probe it',
    );
  } else {
    await probeCacheHeaders(probeUrl);
  }

  // ---- Device-only --------------------------------------------------------
  manual('P0', 'R1.6', 'a career survives force-quitting the installed app');
  manual(
    'P2',
    'R3.6',
    'the home screen launch is full-screen, and the in-Safari path still works',
  );
  manual(
    'P1',
    'R2.5',
    'no control is trapped in an iPadOS system gesture edge (all four edges)',
  );
  manual(
    'P2',
    'R6.2',
    'rotating across the 1100pt two-column breakpoint keeps state and reflows cleanly',
  );
  manual(
    'P2',
    'R7.2',
    'the software keyboard does not cover the name or search field',
  );
  manual(
    'P1',
    'R9.2',
    'a match returned to after a long background still draws (not a blank pitch)',
  );
  manual(
    'P1',
    'R9.4',
    'every match-day control over the canvas responds to touch',
  );

  report();

  function htmlCheck(severity, id, needle, what) {
    if (html.includes(needle)) pass(severity, id, what);
    else
      fail(
        severity,
        id,
        what,
        `\`${needle}\` is missing from the exported index.html`,
      );
  }

  function manifestCheck(manifest, key, expected, id, what) {
    if (manifest[key] === expected) pass('P2', id, what);
    else
      fail(
        'P2',
        id,
        what,
        `manifest ${key} is ${JSON.stringify(manifest[key])}, expected ${JSON.stringify(expected)}`,
      );
  }
}

async function probeCacheHeaders(origin) {
  const base = origin.replace(/\/$/, '');
  try {
    const response = await fetch(`${base}/index.html`, {
      method: 'HEAD',
      redirect: 'follow',
    });
    const cacheControl = response.headers.get('cache-control') ?? '';
    const revalidates = /no-store|no-cache|max-age=0|must-revalidate/.test(
      cacheControl,
    );
    if (revalidates) {
      pass(
        'P3',
        'R8.2',
        'the deployment revalidates index.html, so a relaunch gets the new build',
        cacheControl,
      );
    } else {
      fail(
        'P3',
        'R8.2',
        'the deployment revalidates index.html',
        `cache-control: ${cacheControl || '(none)'} — a stale shell would pin an old build`,
      );
    }
  } catch (error) {
    manual(
      'P3',
      'R8.2',
      'the deployment revalidates index.html',
      `probe failed (${error instanceof Error ? error.message : String(error)}) — check by hand`,
    );
  }
}

function report() {
  const width = Math.max(...results.map((result) => result.id.length));
  for (const { status, severity, id, what, detail } of results) {
    const line = `${status.padEnd(8)} ${severity}  ${id.padEnd(width)}  ${what}`;
    console.log(
      detail === undefined ? line : `${line}\n${' '.repeat(11)}↳ ${detail}`,
    );
  }

  const failures = results.filter((result) => result.status === 'FAIL');
  const manuals = results.filter((result) => result.status === 'MANUAL');
  console.log(
    `\n${results.length} checks: ` +
      `${results.filter((r) => r.status === 'PASS').length} pass, ` +
      `${failures.length} fail, ` +
      `${manuals.length} manual, ` +
      `${results.filter((r) => r.status === 'ACCEPTED').length} accepted`,
  );

  if (manuals.length > 0) {
    console.log('\nOn the iPad, by hand:');
    for (const { severity, id, what, detail } of manuals) {
      console.log(
        `  ${severity} ${id}  ${what}${detail === undefined ? '' : ` (${detail})`}`,
      );
    }
  }

  if (failures.length > 0) {
    console.log(`\n${failures.length} check(s) failed.`);
    process.exit(1);
  }
}

await main();
