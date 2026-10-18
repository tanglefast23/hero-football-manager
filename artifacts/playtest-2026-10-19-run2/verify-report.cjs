// Read-only evidence checks. No fixture simulation and no career writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { checkCareer } = require('../../scripts/qa/check-career.cjs');
const dir = __dirname;
const digest = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'provenance.json')));
const savedHashes = JSON.parse(fs.readFileSync(path.join(dir, 'evidence/checkpoint-hashes.json')));
for (const entry of savedHashes) {
  const packed = fs.readFileSync(path.join(dir, 'checkpoints', entry.file));
  assert.equal(digest(packed), entry.gzipSha256, entry.file);
  assert.equal(digest(zlib.gunzipSync(packed)), entry.rawSha256, entry.file);
}
const fixtures = [];
const seasons = [];
const validations = [];
let last;
let previousDrills = 0;
for (const file of manifest.snapshots) {
  const packed = fs.readFileSync(path.join(dir, file.file));
  const bytes = zlib.gunzipSync(packed);
  assert.equal(digest(packed), file.gzipSha256, file.file);
  assert.equal(digest(bytes), file.rawSha256, file.file);
  const data = JSON.parse(bytes);
  const snapshot = data.snapshot;
  const c = snapshot.career;
  assert.equal(c.careerSeed, manifest.careerSeed);
  assert.equal(snapshot.engineVersion, manifest.engineVersion);
  assert.equal(c.season, file.season);
  assert.equal(c.week, 30);
  assert.equal(c.phase, 'season-end');
  assert.equal(snapshot.careerIsPersisted, true);
  const validation = checkCareer(data); // The default path only builds teams.
  assert.equal(validation.ok, true, JSON.stringify(validation));
  assert.equal(validation.teamsChecked, 10);
  assert.equal(validation.engineVersionMatches, true);
  validations.push(validation);
  const u = c.userClubId;
  const division = c.m2.pyramid.divisions.find((d) => d.clubs.some((t) => t.id === u)).level;
  const clubs = new Map(c.m2.pyramid.divisions.flatMap((d) => d.clubs.map((t) => [t.id, t])));
  const league = c.fixtures.filter((f) => f.season === c.season && f.status === 'played' && (f.homeClubId === u || f.awayClubId === u));
  const record = { won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 };
  for (const f of league) {
    const home = f.homeClubId === u;
    const gf = home ? f.score.homeGoals : f.score.awayGoals;
    const ga = home ? f.score.awayGoals : f.score.homeGoals;
    record.goalsFor += gf;
    record.goalsAgainst += ga;
    record[gf > ga ? 'won' : gf < ga ? 'lost' : 'drawn']++;
    fixtures.push({ ...f, kind: 'league', userHome: home });
  }
  assert.equal(league.length, 18);
  const recap = c.seasonRecaps.find((r) => r.season === c.season);
  assert.equal(recap.division, division);
  for (const [key, value] of Object.entries(record)) assert.equal(recap[key], value, `${c.season}: ${key}`);
  const cup = c.m2.nationalCups.find((x) => x.season === c.season);
  const cupFixtures = cup.rounds.flatMap((r) => r.fixtures.filter((f) => f.status === 'played' && (f.homeClubId === u || f.awayClubId === u)).map((f) => ({ ...f, kind: 'cup', cupRound: r.label, userHome: f.homeClubId === u, opponentDivision: cup.seedDivisionByClubId[f.homeClubId === u ? f.awayClubId : f.homeClubId] })));
  fixtures.push(...cupFixtures);
  const own = c.clubs.find((x) => x.id === u);
  const ledgerTotals = {};
  for (const l of c.ledgers.filter((l) => l.season === c.season)) for (const line of l.lines) ledgerTotals[line.kind] = (ledgerTotals[line.kind] ?? 0) + line.amount;
  seasons.push({ season: c.season, division, position: recap.finalPosition, ...record, points: record.won * 3 + record.drawn, leaguePlayed: league.length, cupPlayed: cupFixtures.length, cupResult: recap.cupResult, cash: own.cash, tp: c.trainingPoints, fans: own.fans, cumulativeDrills: c.totalInstantDrills, drillsThisSeason: c.totalInstantDrills - previousDrills, capturedCumulativeActions: data.actions?.length ?? null, ledgerTotals });
  previousDrills = c.totalInstantDrills;
  for (const f of fixtures.filter((f) => f.season === c.season)) {
    f.homeName = clubs.get(f.homeClubId)?.name ?? f.homeClubId;
    f.awayName = clubs.get(f.awayClubId)?.name ?? f.awayClubId;
  }
  if (data.fixtures) {
    const current = data.fixtures.filter((f) => f.season === c.season);
    assert.equal(current.length, league.length + cupFixtures.length);
    for (const f of current) assert.deepEqual(f.score, fixtures.find((x) => x.id === f.id).score);
  }
  last = c;
}
assert.equal(new Set(fixtures.map((f) => f.id)).size, fixtures.length);
assert.equal(fixtures.length, 124);
assert.equal(last.eventFlags.includes('career:true-ending-seen'), true);
assert.equal(last.hallOfFame.season, 6);
assert.deepEqual(last.hallOfFame.cupWinSeasons, [5]);
assert.equal(last.hallOfFame.divisionTitles.some((t) => t.division === 1 && t.season === 6), true);
const totals = { league: 108, cup: fixtures.filter((f) => f.kind === 'cup').length, all: fixtures.length, drills: last.totalInstantDrills };
for (const k of ['won', 'drawn', 'lost', 'goalsFor', 'goalsAgainst']) {
  totals[k] = seasons.reduce((sum, s) => sum + s[k], 0);
  assert.equal(last.hallOfFame[k], totals[k]);
}
const own = last.clubs.find((x) => x.id === last.userClubId);
const facts = { formatVersion: 1, careerSeed: last.careerSeed, difficulty: last.difficulty, engineVersion: manifest.engineVersion, totals, seasons, fixtures, hallOfFame: last.hallOfFame, final: { cash: own.cash, tp: last.trainingPoints, fans: own.fans, formation: last.lineups.find((l) => l.clubId === last.userClubId).formation, roster: last.players.filter((p) => p.clubId === last.userClubId), facilities: last.facilities.grid.buildings, ownedTrainingTiers: last.ownedTrainingTiers, coaches: [last.market.headCoach, last.market.assistantCoach] } };
const factsFile = path.join(dir, 'facts.json');
if (process.argv.includes('--write')) fs.writeFileSync(factsFile, JSON.stringify(facts, null, 2) + '\n');
else assert.deepEqual(JSON.parse(fs.readFileSync(factsFile)), facts);
if (!process.argv.includes('--write')) {
  const markdown = fs.readFileSync(path.join(dir, 'report.md'), 'utf8');
  const rows = markdown.split('\n').filter((line) => /^\| [1-6] \|/.test(line));
  assert.equal(rows.length, seasons.length);
  for (const [index, s] of seasons.entries()) {
    const cells = rows[index].split('|').slice(1, -1).map((cell) => cell.trim());
    assert.deepEqual(cells, [String(s.season), 'D' + s.division, String(s.position),
      s.won + '–' + s.drawn + '–' + s.lost, s.goalsFor + '–' + s.goalsAgainst,
      String(s.points), s.cupResult === 'Winners' ? 'Winner' : s.cupResult,
      '$' + s.cash.toLocaleString('en-US'), String(s.drillsThisSeason)]);
  }
}
console.log(JSON.stringify({ ok: true, simulationRun: false, totals, finalCash: own.cash, trueEndingSaved: true, validations }, null, 2));
