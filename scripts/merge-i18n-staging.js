#!/usr/bin/env node
/**
 * Merges per-agent staging files into a locale catalog.
 *
 * The copy sweep runs many extraction agents at once, and they cannot all edit
 * `content/i18n/en.json` — the last writer would silently win and the others'
 * keys would vanish with no error anywhere. So each agent writes only its own
 * `/tmp/i18n-staging/<slug>.json`, and this merges them centrally.
 *
 *   node scripts/merge-i18n-staging.js            # merge English, dry run
 *   node scripts/merge-i18n-staging.js --write    # actually write
 *   node scripts/merge-i18n-staging.js --locale es --write
 *
 * For a translation pass the staging files are `<slug>.<locale>.json`.
 *
 * Collisions are fatal, not last-wins: two agents choosing the same key for
 * different English is exactly the bug this script exists to prevent, and it is
 * invisible once merged.
 */
const fs = require('fs');
const path = require('path');

const STAGING = '/tmp/i18n-staging';
const args = process.argv.slice(2);
const write = args.includes('--write');
const localeAt = args.indexOf('--locale');
const locale = localeAt === -1 ? 'en' : args[localeAt + 1];

const catalogPath = path.join(__dirname, '..', 'content', 'i18n', `${locale}.json`);

/**
 * Locales the CI gates actually check, mirrored from `src/i18n/locales.ts`.
 *
 * Writing a catalog that is NOT enabled is a blind spot, not a convenience:
 * gates 5, 5b and 8 iterate `ENABLED_LOCALES`, so a `vi.json` written while
 * Vietnamese is withdrawn would go unglyph-checked and unmeasured until the day
 * it is re-enabled — which is the worst possible time to discover it.
 */
const GATED_LOCALES = ['en', 'es', 'pt-BR', 'fr', 'id', 'de', 'vi'];
if (!GATED_LOCALES.includes(locale)) {
  console.error(`REFUSING to write "${locale}": it is not in ENABLED_LOCALES, so no gate would`);
  console.error('check the result. Re-enable it in src/i18n/locales.ts first, or pass --force.');
  if (!args.includes('--force')) process.exit(1);
  console.error('--force given; continuing unchecked.\n');
}

/**
 * English SNAPSHOTS handed to translators, not staging output.
 *
 * A translation batch needs its source in one file, so the orchestrator writes
 * `final-wave.json` etc. by copying the current English out of the catalog. To
 * this script they look exactly like an extraction agent's staging file — and
 * because they are a snapshot, they hold whatever English was current when they
 * were written. When an agent later revises that same key, the snapshot and the
 * real staging file disagree and the merge dies on a collision that is not one.
 *
 * They are skipped for `en` and consumed for every other locale, which is
 * exactly their job: source in English, output per language.
 */
const ENGLISH_SNAPSHOTS = /^(final-wave|final-wave-vi|vi-part-[ab]|delta|ui-tail-src)$/;

/** Staging files belonging to this locale, and no other. */
function stagingFiles() {
  if (!fs.existsSync(STAGING)) return [];
  return fs.readdirSync(STAGING)
    .filter(name => name.endsWith('.json'))
    .filter(name => !(locale === 'en' && ENGLISH_SNAPSHOTS.test(name.replace(/\.json$/, ''))))
    .filter(name => {
      const parts = name.replace(/\.json$/, '').split('.');
      // `<slug>.json` is English; `<slug>.<locale>.json` is a translation.
      return locale === 'en' ? parts.length === 1 : parts[parts.length - 1] === locale;
    })
    .map(name => path.join(STAGING, name));
}

const files = stagingFiles();
if (files.length === 0) {
  console.log(`no staging files for locale "${locale}" in ${STAGING}`);
  process.exit(0);
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const existing = catalog.strings;

const incoming = new Map();
const collisions = [];
const alreadyPresent = [];

for (const file of files) {
  const staged = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const [key, value] of Object.entries(staged)) {
    if (typeof value !== 'string') {
      console.error(`FATAL ${path.basename(file)}: "${key}" is not a string`);
      process.exit(1);
    }
    const prior = incoming.get(key);
    if (prior !== undefined && prior.value !== value) {
      collisions.push({ key, a: prior.file, b: path.basename(file) });
    } else if (existing[key] !== undefined && existing[key] !== value) {
      collisions.push({ key, a: `${locale}.json (existing)`, b: path.basename(file) });
    } else if (existing[key] !== undefined) {
      alreadyPresent.push(key);
    }
    incoming.set(key, { value, file: path.basename(file) });
  }
}

/**
 * `--accept-staging` resolves catalog-vs-staging collisions in the staging
 * file's favour.
 *
 * The legitimate case, seen three times in this sweep: a locale is merged while
 * its agent is still working, the agent then revises a string it had already
 * written, and the next merge sees the catalog and the staging file disagree.
 * The revision is the newer and better text, so taking it is right — but only
 * for THAT class. A collision between two staging FILES is still fatal, because
 * that is two agents disagreeing and no rule can pick a winner.
 */
const acceptStaging = args.includes('--accept-staging');
const betweenStagingFiles = collisions.filter(c => !c.a.includes('(existing)'));
const fatal = acceptStaging ? betweenStagingFiles : collisions;

if (fatal.length > 0) {
  console.error(`FATAL: ${fatal.length} key collision(s) — nothing written.\n`);
  for (const c of fatal.slice(0, 20)) {
    console.error(`  ${c.key}\n    ${c.a}\n    ${c.b}`);
  }
  if (!acceptStaging && betweenStagingFiles.length < collisions.length) {
    console.error('\nSome collisions are catalog-vs-staging (an agent revised after a');
    console.error('partial merge). Re-run with --accept-staging to take the revisions.');
  }
  process.exit(1);
}
if (acceptStaging && collisions.length > 0) {
  console.log(`accepting ${collisions.length} staged revision(s) over the catalog`);
}

const added = [...incoming.keys()].filter(key => existing[key] === undefined);

console.log(`locale       ${locale}`);
console.log(`staging      ${files.length} file(s): ${files.map(f => path.basename(f)).join(', ')}`);
console.log(`staged keys  ${incoming.size}`);
console.log(`new          ${added.length}`);
console.log(`already set  ${alreadyPresent.length} (identical, no-op)`);

if (!write) {
  console.log('\ndry run — pass --write to apply');
  process.exit(0);
}

for (const [key, { value }] of incoming) existing[key] = value;

// Sorted so the diff of a 2k-key file stays reviewable.
catalog.strings = Object.fromEntries(
  Object.entries(existing).sort(([a], [b]) => a.localeCompare(b)),
);

fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`\nwrote ${catalogPath} — ${Object.keys(catalog.strings).length} keys total`);
