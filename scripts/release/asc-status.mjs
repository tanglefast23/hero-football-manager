#!/usr/bin/env node
// Prints the live App Store Connect state for Hero Football Manager.
// Usage: set -a && source ~/.claude/secrets.env && set +a && node scripts/release/asc-status.mjs
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const {
  ASC_KEY_ID: kid,
  ASC_ISSUER_ID: iss,
  ASC_PRIVATE_KEY_PATH: keyPath,
} = process.env;
if (!kid || !iss || !keyPath) {
  console.error(
    'Missing ASC_KEY_ID / ASC_ISSUER_ID / ASC_PRIVATE_KEY_PATH. Source ~/.claude/secrets.env first.',
  );
  process.exit(1);
}
const key = fs.readFileSync(keyPath.replace(/^~/, process.env.HOME), 'utf8');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const h = b64({ alg: 'ES256', kid, typ: 'JWT' });
const p = b64({ iss, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' });
const sig = crypto
  .sign('sha256', Buffer.from(`${h}.${p}`), { key, dsaEncoding: 'ieee-p1363' })
  .toString('base64url');
const jwt = `${h}.${p}.${sig}`;

// node fetch cannot reach Apple from this machine (connect timeout); curl can.
const get = (path) =>
  JSON.parse(
    execFileSync(
      'curl',
      [
        '-s',
        '-g',
        '--http1.1',
        '--retry',
        '2',
        '--max-time',
        '30',
        '-H',
        `Authorization: Bearer ${jwt}`,
        `https://api.appstoreconnect.apple.com${path}`,
      ],
      {
        encoding: 'utf8',
        maxBuffer: 1 << 26,
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    ),
  );

const APP = '6799600157';
const versions = get(
  `/v1/apps/${APP}/appStoreVersions?limit=3&fields[appStoreVersions]=versionString,appStoreState,createdDate`,
);
for (const v of versions.data ?? []) {
  console.log(
    `version ${v.attributes.versionString}  ${v.attributes.appStoreState}`,
  );
}
const subs = get(
  `/v1/reviewSubmissions?filter[app]=${APP}&limit=3&fields[reviewSubmissions]=state,submittedDate`,
);
for (const s of subs.data ?? []) {
  console.log(
    `submission ${s.id}  ${s.attributes.state}  submitted ${s.attributes.submittedDate}`,
  );
  for (const i of get(`/v1/reviewSubmissions/${s.id}/items?limit=10`).data ??
    []) {
    console.log(`  item ${i.attributes.state}`);
  }
}
