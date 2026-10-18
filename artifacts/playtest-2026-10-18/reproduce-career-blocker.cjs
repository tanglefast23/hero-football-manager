// Run from the repository root:
// HFM_SOURCE_ROOT=/path/to/source node artifacts/playtest-2026-10-18/reproduce-career-blocker.cjs
// Reads the captured save. Never writes the browser, source, or save.
// Exit 1 means the captured career still cannot build its rival teams.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(process.env.HFM_SOURCE_ROOT || path.join(__dirname, '../..'));
const ts = require(path.join(root, 'node_modules/typescript'));
require.extensions['.ts'] = (module, file) => module._compile(
  ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText, file,
);
const { buildCareerMatchTeams, buildCareerTeamDef } = require(path.join(root, 'src/game/squad.ts'));
const evidence = JSON.parse(fs.readFileSync(path.join(__dirname, 'evidence-segment-2.json'), 'utf8'));
const career = evidence.crashCareer;
const original = JSON.stringify(career);
assert.equal(career.season, 3);
assert.equal(career.week, 5);
assert.equal(career.phase, 'matchday');
const sold = career.players.find(player => player.id === 'bramble-rovers-p15');
assert.equal(sold.name, 'Sol Reed');
assert.equal(sold.clubId, 'd4-club-01');
assert.equal(sold.power, 'GUST');
assert.equal(sold.licensed, false);
assert.ok(!career.lineups.find(lineup => lineup.clubId === sold.clubId).playerIds.includes(sold.id));

// Isolate the cause using an ordinary existing eligibility rule on a copy.
// Keeping Sol away from selection makes the same AI team build successfully.
// This is a diagnostic only, not a save repair or a recommended fix.
const excluded = {
  ...career,
  players: career.players.map(player => player.id === sold.id ? { ...player, awayWeeks: 1 } : player),
};
assert.doesNotThrow(() => buildCareerTeamDef(excluded, sold.clubId));
assert.equal(JSON.stringify(career), original, 'diagnostics must not mutate the captured save');
console.log('CAUSE_CHECK_OK: excluding the unlicensed sold hero allows the AI team to build.');

const fixture = career.fixtures.find(row => row.week === career.week &&
  (row.homeClubId === career.userClubId || row.awayClubId === career.userClubId));
const rivals = career.fixtures.filter(row => row.week === career.week && row.id !== fixture.id);
const rivalClubIds = [...new Set(rivals.flatMap(row => [row.homeClubId, row.awayClubId]))];
try {
  buildCareerMatchTeams(career, rivalClubIds);
  assert.equal(JSON.stringify(career), original);
  console.log('CAREER_BLOCKER_CHECK_PASSED: the captured rival teams now build.');
} catch (error) {
  assert.equal(JSON.stringify(career), original);
  console.error('CAREER_BLOCKER_REPRODUCED:', error.message);
  process.exitCode = 1;
}
