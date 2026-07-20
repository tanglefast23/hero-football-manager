import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const portraits = json('src/render/sprites/portraits.json');
const match = json('src/render/sprites/sprites.json');
const coaches = json('src/render/sprites/management-sprites.json');
const manifest = json('src/render/sprites/player-look-manifest.json');
const coachIdentities = json('src/game/coach-identities.json');

const width = 1392;
const fieldIds = manifest.field;
const goalkeeperIds = manifest.goalkeeper;
const playerIds = [...fieldIds, ...goalkeeperIds];
const playerColumns = 12;
const playerCard = { w: 112, h: 98 };
const playerOrigin = { x: 24, y: 110 };
const playerRows = Math.ceil(playerIds.length / playerColumns);
const coachOriginY = playerOrigin.y + playerRows * playerCard.h + 76;
const coachColumns = 8;
const coachCard = { w: 168, h: 100 };
const coachRows = Math.ceil(coachIdentities.length / coachColumns);
const height = coachOriginY + coachRows * coachCard.h + 72;

const parts = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  '<rect width="100%" height="100%" fill="#f4f1ea"/>',
  '<text x="24" y="38" font-family="monospace" font-size="24" font-weight="bold" fill="#241f2e">HERO FOOTBALL MANAGER · CHARACTER ROSTER</text>',
  `<text x="24" y="70" font-family="monospace" font-size="16" fill="#3f6fb5">96 PLAYER IDENTITIES · 288 EXPRESSIVE PORTRAITS · CORRESPONDING MATCH SPRITES</text>`,
  '<text x="24" y="101" font-family="monospace" font-size="15" font-weight="bold" fill="#241f2e">PLAYERS — PORTRAIT + HOME-KIT RUN SPRITE</text>',
];

playerIds.forEach((id, index) => {
  const column = index % playerColumns;
  const row = Math.floor(index / playerColumns);
  const x = playerOrigin.x + column * playerCard.w;
  const y = playerOrigin.y + row * playerCard.h;
  const goalkeeper = goalkeeperIds.includes(id);
  parts.push(`<rect x="${x}" y="${y}" width="104" height="90" fill="#ffffff" stroke="#241f2e" stroke-width="2"/>`);
  parts.push(`<rect x="${x + 4}" y="${y + 4}" width="96" height="66" fill="${goalkeeper ? '#f7d894' : '#a3c8f0'}"/>`);
  parts.push(sprite(portraits.sprites[`${id}:rest`], portraits.palette, x + 5, y + 7, 2));
  parts.push(sprite(match.sprites[`r:${id}:run0`], match.palette, x + 53, y + 6, 2));
  parts.push(`<text x="${x + 52}" y="${y + 84}" text-anchor="middle" font-family="monospace" font-size="12" font-weight="bold" fill="#241f2e">${id.toUpperCase()} · ${goalkeeper ? 'GK' : 'FIELD'}</text>`);
});

parts.push(`<text x="24" y="${coachOriginY - 42}" font-family="monospace" font-size="15" font-weight="bold" fill="#241f2e">COACHES — 32 UNIQUE STAFF, HIRING AGES 30–60</text>`);
parts.push(`<text x="24" y="${coachOriginY - 18}" font-family="monospace" font-size="13" fill="#3f6fb5">13 TOUCHLINE WARDROBES · AGE-BAND DETAILS · NO PLAYER-PORTRAIT REUSE</text>`);

coachIdentities.forEach((coach, index) => {
  const column = index % coachColumns;
  const row = Math.floor(index / coachColumns);
  const x = 24 + column * coachCard.w;
  const y = coachOriginY + row * coachCard.h;
  parts.push(`<rect x="${x}" y="${y}" width="160" height="92" fill="#ffffff" stroke="#241f2e" stroke-width="2"/>`);
  parts.push(`<rect x="${x + 4}" y="${y + 4}" width="56" height="64" fill="#a3c8f0"/>`);
  parts.push(sprite(coaches.sprites[`coach:${coach.id}:rest`], coaches.palette, x + 8, y + 6, 2));
  parts.push(`<text x="${x + 66}" y="${y + 27}" font-family="monospace" font-size="11" font-weight="bold" fill="#241f2e">${escapeXml(coach.name.toUpperCase())}</text>`);
  parts.push(`<text x="${x + 66}" y="${y + 47}" font-family="monospace" font-size="12" fill="#3f6fb5">AGE ${coach.age}</text>`);
  parts.push(`<text x="${x + 66}" y="${y + 67}" font-family="monospace" font-size="8" fill="#6b6675">${coach.wardrobe.replaceAll('-', ' ').toUpperCase()}</text>`);
});

parts.push(`<text x="24" y="${height - 28}" font-family="monospace" font-size="13" fill="#6b6675">STYLE BIBLE: 24×29 PORTRAITS · 24×30 MATCH SPRITES · HARD PIXELS · UPPER-LEFT LIGHT · SHARED PALETTE</text>`);
parts.push('</svg>');

const output = resolve(root, 'art/roster-diversity-preview.svg');
writeFileSync(output, `${parts.join('\n')}\n`);
console.log(`wrote ${output} (${width}x${height})`);

function json(path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}

function sprite(rows, palette, originX, originY, scale) {
  const rects = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const token = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === token) end += 1;
      const color = palette[token];
      if (color) rects.push(`<rect x="${originX + x * scale}" y="${originY + y * scale}" width="${(end - x) * scale}" height="${scale}" fill="${color}"/>`);
      x = end;
    }
  });
  return rects.join('');
}

function escapeXml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
