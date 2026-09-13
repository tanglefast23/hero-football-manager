import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const appSource = process.argv[2];
assert(appSource?.endsWith('.app'), 'Pass the unsigned Release simulator .app');
const directory = await mkdtemp(join(tmpdir(), 'hfm-hermes-golden-'));
const app = join(directory, 'HeroFootballManager.app');
const route = `/${randomUUID()}`;
const report = Promise.withResolvers();
const server = createServer((request, response) => {
  if (request.method !== 'POST' || request.url !== route) {
    response.writeHead(404).end();
    return;
  }
  let body = '';
  request.on('data', (chunk) => {
    body += chunk;
    if (body.length > 4096) request.destroy();
  });
  request.on('end', () => {
    response.end('received');
    try {
      report.resolve(JSON.parse(body));
    } catch (error) {
      report.reject(error);
    }
  });
});
let device;
let timeout;
async function run(command, args, options = {}) {
  return (
    await exec(command, args, { maxBuffer: 16 * 1024 * 1024, ...options })
  ).stdout.trim();
}
const started = Date.now();
function log(message) {
  const seconds = ((Date.now() - started) / 1000).toFixed(0).padStart(4);
  console.log(`[hermes-golden +${seconds}s] ${message}`);
}
/**
 * Runs only after a failure, before the simulator is deleted. The three
 * facts that separate "crashed", "never reached the server", and "still
 * loading": is the process alive, what did it log, and did it leave a crash
 * report. Each probe is best-effort; a probe failing must not mask the
 * original error.
 */
async function diagnose() {
  if (!device) return;
  const probe = async (label, command, args) => {
    const output = await run(command, args).catch((error) => String(error));
    console.log(
      `--- ${label} ---\n${output.split('\n').slice(-40).join('\n')}`,
    );
  };
  await probe('app process', 'bash', [
    '-c',
    `xcrun simctl spawn ${device} launchctl list | grep -i herofootball || echo 'not running'`,
  ]);
  await probe('app log (last 3 min)', 'xcrun', [
    'simctl',
    'spawn',
    device,
    'log',
    'show',
    '--last',
    '3m',
    '--style',
    'compact',
    '--predicate',
    'process == "HeroFootballManager" OR (eventMessage CONTAINS "HeroFootballManager" AND messageType == error)',
  ]);
  await probe('crash reports', 'bash', [
    '-c',
    "ls -t ~/Library/Logs/DiagnosticReports/HeroFootballManager*.ips 2>/dev/null | head -1 | xargs -I{} sh -c 'echo {}; head -c 3000 {}' || echo none",
  ]);
}
try {
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const endpoint = `http://localhost:${server.address().port}${route}`;
  await run('ditto', [resolve(appSource), app]);
  log('copied app');
  await run(
    'npx',
    [
      'expo',
      'export:embed',
      '--platform',
      'ios',
      '--dev',
      'false',
      '--entry-file',
      'scripts/qa/hermes-golden.ts',
      '--bundle-output',
      join(app, 'main.jsbundle'),
      '--reset-cache',
    ],
    {
      env: { ...process.env, EXPO_PUBLIC_GOLDEN_RESULT_URL: endpoint },
    },
  );
  log('bundled hermes-golden entry');
  await run('codesign', ['--force', '--sign', '-', app]);
  const { runtimes } = JSON.parse(
    await run('xcrun', ['simctl', 'list', 'runtimes', '--json']),
  );
  const runtime = runtimes
    .filter((item) => item.isAvailable && item.name.startsWith('iOS'))
    .at(-1);
  assert(runtime, 'An available iOS simulator runtime is required');
  const type = runtime.supportedDeviceTypes.find(
    (item) => item.productFamily === 'iPhone',
  );
  assert(type, 'The iOS runtime must support an iPhone simulator');
  device = await run('xcrun', [
    'simctl',
    'create',
    'HFM Hermes Golden',
    type.identifier,
    runtime.identifier,
  ]);
  log(`created simulator ${device} (${type.name}, ${runtime.name})`);
  await run('xcrun', ['simctl', 'boot', device]);
  await run('xcrun', ['simctl', 'bootstatus', device, '-b']);
  log('booted');
  await run('xcrun', ['simctl', 'install', device, app]);
  log('installed');
  await run('xcrun', [
    'simctl',
    'launch',
    device,
    'com.tanglefast.herofootballmanager',
  ]);
  log('launched; waiting for the report');
  // A warm Mac reports in about 2 s. A cold GitHub macOS runner spends
  // minutes on every phase before this one, and a first launch in a fresh
  // simulator pays install, dyld, and container costs on top. The cap is a
  // safety net against a hung app, not an expectation; the log line above
  // records the real time-to-report so it can be tightened with data.
  const REPORT_TIMEOUT_MS = 5 * 60 * 1000;
  timeout = setTimeout(
    () =>
      report.reject(
        new Error(
          `Hermes did not report within ${REPORT_TIMEOUT_MS / 1000} seconds`,
        ),
      ),
    REPORT_TIMEOUT_MS,
  );
  const result = await report.promise;
  log('report received');
  assert.equal(result.hermes, true, 'The replay ran outside Hermes');
  assert.equal(result.ok, true, result.error ?? 'Golden replay failed');
  assert.match(result.fingerprints, /^[0-9a-f]{8} [0-9a-f]{8}$/);
  console.log(`HERMES_GOLDEN_OK ${result.fingerprints}`);
} catch (error) {
  log(`FAILED: ${error.message}`);
  await diagnose();
  throw error;
} finally {
  clearTimeout(timeout);
  server.closeAllConnections();
  server.close();
  if (device) {
    await run('xcrun', ['simctl', 'shutdown', device]).catch(() => {});
    await run('xcrun', ['simctl', 'delete', device]);
  }
  await rm(directory, { recursive: true, force: true });
}
