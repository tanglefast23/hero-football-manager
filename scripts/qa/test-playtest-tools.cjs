const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { checkCareer } = require('./check-career.cjs');
const { createCareer } = require('../../src/game/career.ts');
const { createLaunchCareerSetup } = require('../../src/application/launch.ts');
const { buildCareerMatchTeams } = require('../../src/game/squad.ts');

async function main() {
  const career = createCareer(createLaunchCareerSetup(20261019));
  const before = JSON.stringify(career);
  const checked = checkCareer({ career });
  assert.equal(checked.ok, true);
  assert.equal(checked.teamsChecked, career.clubs.length);
  assert.equal(JSON.stringify(career), before);
  assert.throws(() => checkCareer({ career: { week: 1 } }));
  assert.equal(
    checkCareer({ career: null, screen: 'welcome' }).code,
    'NO_CAREER',
  );
  assert.equal(
    checkCareer({ career: null, careerSerializationError: 'bad player' }).error,
    'bad player',
  );
  const idle = checkCareer({ career }, true);
  assert.equal(idle.ok, true);
  assert.equal(idle.simulation.status, 'skipped');
  const next = career.fixtures.find(
    (fixture) =>
      fixture.status === 'scheduled' &&
      (fixture.homeClubId === career.userClubId ||
        fixture.awayClubId === career.userClubId),
  );
  const matchday = { ...career, week: next.week, phase: 'matchday' };
  const simulated = checkCareer({ career: matchday }, true);
  assert.equal(simulated.ok, true);
  assert.equal(simulated.simulation.policy.userClubId, career.userClubId);
  assert.equal(simulated.simulation.policy.autoSubs, true);
  assert.equal(simulated.simulation.result.fixtureId, next.id);
  assert.ok(simulated.simulation.ticks > 0);
  const mismatch = checkCareer(
    { career: matchday, engineVersion: 'older-engine' },
    true,
  );
  assert.equal(mismatch.engineVersionMatches, false);
  assert.equal(mismatch.simulation.status, 'skipped');
  const title = checkCareer({ career: matchday, screen: 'welcome' }, true);
  assert.equal(title.simulation.status, 'skipped');
  const poweredPlayerId = career.lineups
    .find((lineup) => lineup.clubId === career.userClubId)
    .playerIds.at(-1);
  const onboarding = {
    ...matchday,
    players: matchday.players.map((player) =>
      player.id === poweredPlayerId
        ? { ...player, power: 'SUPER_SPEED', licensed: true }
        : player,
    ),
    onboarding: {
      stage: 'first-match',
      firstFixtureId: next.id,
      createdPlayerId: career.players.find(
        (player) => player.clubId === career.userClubId,
      ).id,
    },
  };
  assert.ok(
    buildCareerMatchTeams(onboarding, [career.userClubId])[
      career.userClubId
    ].players.some((player) => player.power !== undefined),
  );
  const opening = checkCareer({ career: onboarding }, true);
  assert.equal(opening.simulation.onboardingPowersRemoved, true);
  assert.equal(opening.simulation.userPowersAtKickoff, 0);
  const noFixture = checkCareer(
    { career: { ...career, phase: 'matchday', week: 1 } },
    true,
  );
  assert.equal(noFixture.ok, true);
  assert.equal(noFixture.simulation.status, 'skipped');
  const rival = career.clubs.find((club) => club.id !== career.userClubId);
  const broken = {
    ...career,
    players: career.players.map((player) =>
      player.clubId === rival.id && player.role === 'GK'
        ? { ...player, awayWeeks: 1 }
        : player,
    ),
  };
  const failure = checkCareer({ career: broken });
  assert.equal(failure.ok, false);
  assert.ok(failure.failures.some((row) => row.clubId === rival.id));

  let elements = [],
    clicks = 0;
  const waits = [];
  const state = { screen: 'management', activeTab: 'home', career: null };
  const context = {
    window: { __HFM_QA__: { read: () => structuredClone(state) } },
    HTMLMediaElement: function () {},
    document: {
      querySelectorAll: (selector) =>
        selector === 'audio,video' ? [] : elements,
    },
    getComputedStyle: () => ({ visibility: 'visible' }),
    setTimeout: (resolve, ms) => {
      waits.push(ms);
      resolve();
    },
  };
  context.HTMLMediaElement.prototype.play = function () {};
  vm.runInNewContext(
    fs.readFileSync(require.resolve('./playtest-browser.js'), 'utf8'),
    context,
  );
  const helper = context.window.HFMPlaytest;
  const button = (label, disabled = false) => ({
    disabled,
    getAttribute: (name) => (name === 'aria-label' ? label : null),
    getClientRects: () => [1],
    closest: () => null,
    click: () => {
      clicks += 1;
    },
  });
  elements = [button('Go')];
  await helper.tap('Go');
  assert.equal(clicks, 1);
  assert.ok(waits.every((ms) => ms >= 450));
  elements = [button('Go'), button('Go')];
  await assert.rejects(helper.tap('Go'), /found 2/);
  elements = [button('Go', true)];
  await assert.rejects(helper.tap('Go'), /Disabled/);
  state.error = 'test error';
  await assert.rejects(
    helper.waitFor(() => true, 0),
    /test error/,
  );
  delete state.error;
  await assert.rejects(
    helper.waitFor(() => false, 0),
    /Timed out/,
  );
  assert.equal(clicks, 1);
  assert.ok(helper.log().some((entry) => entry.failure));
  const checkpoint = { large: 'x'.repeat(90000) };
  assert.deepEqual(JSON.parse(helper.chunks(checkpoint).join('')), checkpoint);
  assert.throws(() => helper.chunks(checkpoint, 46000));
  console.log(
    'PASS: checkpoint codec, real match policy, immutable input, lineup failure, guarded browser controls, bounded waits, logs, and export chunks.',
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
