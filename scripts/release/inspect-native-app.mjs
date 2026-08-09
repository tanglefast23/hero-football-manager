import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const input = process.argv[2];
if (input === undefined) {
  throw new Error(
    'usage: node scripts/release/inspect-native-app.mjs <.app or .xcarchive>',
  );
}

const target = resolve(input);
if (!existsSync(target))
  throw new Error(`native Release target does not exist: ${target}`);
const app =
  extname(target) === '.xcarchive' ? appInsideArchive(target) : target;
if (extname(app) !== '.app')
  throw new Error(`expected an .app or .xcarchive, got: ${target}`);
const expectedLicense = readFileSync(
  resolve(process.cwd(), 'assets/fonts/OFL.txt'),
);

const files = walk(app);
const infoPlist = join(app, 'Info.plist');
if (!files.includes(infoPlist))
  throw new Error('Release app has no Info.plist');

const encryption = plistValue(infoPlist, 'ITSAppUsesNonExemptEncryption');
if (encryption !== 'false') {
  throw new Error(
    `ITSAppUsesNonExemptEncryption must be false, got ${encryption}`,
  );
}

const fonts = files
  .filter((file) =>
    /HFMSilkscreen_(400Regular|700Bold)\.ttf$/.test(basename(file)),
  )
  .map((file) => basename(file))
  .sort();
if (fonts.length !== 2) {
  throw new Error(
    `Release app must contain both HFM Silkscreen TTFs; found ${fonts.join(', ') || 'none'}`,
  );
}

const license = files.find((file) => {
  const size = statSync(file).size;
  if (size !== expectedLicense.length) return false;
  try {
    return readFileSync(file).equals(expectedLicense);
  } catch {
    return false;
  }
});
if (license === undefined) {
  throw new Error(
    'Release app does not contain the full Silkscreen OFL 1.1 notice',
  );
}

console.info(
  JSON.stringify(
    { app, encryption, fonts, license: license.slice(app.length + 1) },
    null,
    2,
  ),
);

function appInsideArchive(archive) {
  const applications = join(archive, 'Products', 'Applications');
  const apps = readdirSync(applications)
    .filter((name) => extname(name) === '.app')
    .map((name) => join(applications, name));
  if (apps.length !== 1) {
    throw new Error(`expected one app in archive, found ${apps.length}`);
  }
  return apps[0];
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    if (entry.isSymbolicLink()) return [];
    return entry.isDirectory() ? walk(file) : [file];
  });
}

function plistValue(plist, key) {
  const result = spawnSync(
    '/usr/bin/plutil',
    ['-extract', key, 'raw', '-o', '-', plist],
    {
      encoding: 'utf8',
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `could not read ${key} from Info.plist: ${result.stderr.trim()}`,
    );
  }
  return result.stdout.trim();
}
