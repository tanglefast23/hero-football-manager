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
try {
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const endpoint = `http://localhost:${server.address().port}${route}`;
  await run('ditto', [resolve(appSource), app]);
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
  await run('xcrun', ['simctl', 'boot', device]);
  await run('xcrun', ['simctl', 'bootstatus', device, '-b']);
  await run('xcrun', ['simctl', 'install', device, app]);
  timeout = setTimeout(
    () => report.reject(new Error('Hermes did not report within 90 seconds')),
    90000,
  );
  await run('xcrun', [
    'simctl',
    'launch',
    device,
    'com.tanglefast.herofootballmanager',
  ]);
  const result = await report.promise;
  assert.equal(result.hermes, true, 'The replay ran outside Hermes');
  assert.equal(result.ok, true, result.error ?? 'Golden replay failed');
  assert.match(result.fingerprints, /^[0-9a-f]{8} [0-9a-f]{8}$/);
  console.log(`HERMES_GOLDEN_OK ${result.fingerprints}`);
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
