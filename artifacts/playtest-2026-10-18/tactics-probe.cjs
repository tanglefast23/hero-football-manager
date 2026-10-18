// Run: node artifacts/playtest-2026-10-18/tactics-probe.cjs
// Uses captured browser teams and fresh seeds. Never writes the career save.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const ts = require(path.join(root, 'node_modules/typescript'));
require.extensions['.ts'] = (module, file) => module._compile(
  ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText, file,
);
const { createMatch, queueInput, tick } = require(path.join(root, 'src/sim/match.ts'));
const { controlledMatchOptions, queueControlledAutoSubstitution } = require(path.join(root, 'src/game/match-policy.ts'));
const captured = JSON.parse(fs.readFileSync(path.join(__dirname, 'tactics-teams.json'), 'utf8'));
const original = JSON.stringify(captured);
assert.equal(captured.meta.formation, '3-4-3');
const home = captured.teams['bramble-rovers'];
assert.equal(home.players.length, 11);
const policies = Object.keys(captured.formations).flatMap(formation =>
  ['BALANCED', 'ATTACK'].flatMap(mentality =>
    ['SAVE_ENERGY', 'BALANCED', 'ALL_OUT'].map(energyUse => ({ formation, mentality, energyUse }))));
const rows = [];
function run(clubId, policy, seed) {
  const selectedTeams = captured.formations[policy.formation];
  const match = createMatch(seed, selectedTeams['bramble-rovers'], selectedTeams[clubId], controlledMatchOptions(0, policy.formation));
  queueInput(match, { tick: 1, kind: 'SET_ENERGY_USE', energyUse: policy.energyUse });
  queueInput(match, { tick: 1, kind: 'SET_MENTALITY', mentality: policy.mentality });
  let guard = 0;
  while (match.phase !== 'fulltime') {
    assert.ok(++guard < 20_000, 'match must finish');
    tick(match);
    queueControlledAutoSubstitution(match, true);
  }
  return { score: match.score, condition: match.players.slice(0, 11).reduce((n, p) => n + p.condition, 0) / 11 };
}
for (const club of captured.clubs) for (const policy of policies) {
  const row = { opponent: club.name, ...policy, matches: 12, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, meanFinalCondition: 0 };
  for (let seedIndex = 0; seedIndex < row.matches; seedIndex++) {
    const result = run(club.id, policy, 2026101800 + seedIndex);
    const [ours, theirs] = result.score;
    row[ours > theirs ? 'wins' : ours === theirs ? 'draws' : 'losses']++;
    row.goalsFor += ours;
    row.goalsAgainst += theirs;
    row.meanFinalCondition += result.condition / row.matches;
  }
  assert.equal(row.wins + row.draws + row.losses, row.matches);
  row.pointsPerGame = Number(((row.wins * 3 + row.draws) / row.matches).toFixed(2));
  row.meanFinalCondition = Number(row.meanFinalCondition.toFixed(1));
  rows.push(row);
}
assert.equal(JSON.stringify(captured), original, 'probe must leave input teams unchanged');
assert.deepEqual(run(captured.clubs[0].id, policies[0], 2026101800), run(captured.clubs[0].id, policies[0], 2026101800), 'same inputs must repeat');
const result = { source: captured.meta, seeds: '2026101800 through 2026101811', matches: rows.reduce((n, r) => n + r.matches, 0), limitation: 'One fixed Season 2 squad, three opponents, home matches only. Supplemental simulation; not browser career results.', rows };
fs.writeFileSync(path.join(__dirname, 'tactics-results.json'), JSON.stringify(result, null, 2) + '\n');
console.table(rows);
console.log('TACTICS_PROBE_OK', result.matches, 'matches; immutable inputs and deterministic repeat passed');
