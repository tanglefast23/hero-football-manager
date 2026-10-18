const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { MessageChannel } = require('node:worker_threads');
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
    MessageChannel,
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
  const pendingTap = helper.tap('Go');
  assert.equal(waits.length, 0, 'the guard timer starts in a later task');
  assert.equal(clicks, 0, 'a tap must wait for its guard');
  await pendingTap;
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

  const workerWaits = [],
    openUrls = new Map(),
    fallbackTimers = [];
  let terminatedWorkers = 0,
    workerMode = 'success',
    nextUrl = 0,
    holdFallback = false;
  class ClockWorker {
    constructor(url) {
      if (workerMode === 'blocked') throw Error('worker blocked');
      this.blob = openUrls.get(url);
      assert.ok(this.blob);
    }
    postMessage(ms) {
      workerWaits.push(ms);
      if (workerMode === 'error') {
        setImmediate(() => this.onerror?.({ message: 'clock failed' }));
        return;
      }
      this.blob
        .text()
        .then((source) => {
          let scheduled = false;
          const self = {
            postMessage: (data) => this.onmessage?.({ data }),
          };
          vm.runInNewContext(source, {
            self,
            setTimeout: (callback, delay) => {
              assert.equal(delay, ms, 'the worker must use the posted delay');
              scheduled = true;
              setImmediate(callback);
            },
          });
          self.onmessage({ data: ms });
          assert.ok(
            scheduled,
            'the blob must schedule its reply through a timer',
          );
        })
        .catch((error) => {
          console.error(error);
          process.exitCode = 1;
          this.onerror?.(error);
        });
    }
    terminate() {
      terminatedWorkers += 1;
    }
  }
  const workerContext = {
    ...context,
    window: { __HFM_QA__: context.window.__HFM_QA__ },
    Worker: ClockWorker,
    Blob,
    setTimeout: (resolve, ms) => {
      waits.push(ms);
      if (holdFallback) fallbackTimers.push(resolve);
      else resolve();
    },
    URL: {
      createObjectURL: (blob) => {
        const url = `blob:qa-${nextUrl++}`;
        openUrls.set(url, blob);
        return url;
      },
      revokeObjectURL: (url) => assert.ok(openUrls.delete(url)),
    },
  };
  vm.runInNewContext(
    fs.readFileSync(require.resolve('./playtest-browser.js'), 'utf8'),
    workerContext,
  );
  const workerHelper = workerContext.window.HFMPlaytest;
  elements = [button('Go')];
  const fallbackWaitCount = waits.length;
  const workerTap = workerHelper.tap('Go');
  assert.equal(clicks, 1, 'worker-backed taps also wait for their guard');
  await workerTap;
  assert.equal(clicks, 2);
  assert.deepEqual(workerWaits, [450, 450]);
  assert.equal(
    waits.length,
    fallbackWaitCount,
    'worker path uses no page timers',
  );
  assert.equal(terminatedWorkers, 2);
  assert.equal(openUrls.size, 0);
  await workerHelper.pause(1000);
  assert.deepEqual(workerWaits, [450, 450, 1000]);
  assert.equal(terminatedWorkers, 3);
  assert.equal(openUrls.size, 0);
  workerMode = 'error';
  holdFallback = true;
  let fallbackTapFinished = false;
  const fallbackTap = workerHelper.tap('Go').then(() => {
    fallbackTapFinished = true;
  });
  const waitForFallbackTimer = async () => {
    for (let attempt = 0; attempt < 100 && !fallbackTimers.length; attempt += 1)
      await new Promise(setImmediate);
    assert.equal(fallbackTimers.length, 1, 'a fallback guard must be queued');
  };
  await waitForFallbackTimer();
  assert.equal(clicks, 2, 'fallback must wait before clicking');
  fallbackTimers.shift()();
  await waitForFallbackTimer();
  assert.equal(clicks, 3, 'worker errors fall back to guarded page timers');
  assert.equal(
    fallbackTapFinished,
    false,
    'the post-click guard must also wait',
  );
  fallbackTimers.shift()();
  await fallbackTap;
  assert.equal(terminatedWorkers, 5);
  assert.equal(openUrls.size, 0);
  holdFallback = false;
  workerMode = 'blocked';
  await workerHelper.tap('Go');
  assert.equal(clicks, 4, 'blocked worker construction keeps controls usable');
  assert.equal(openUrls.size, 0);
  assert.ok(waits.slice(fallbackWaitCount).every((ms) => ms >= 450));
  assert.throws(() => workerHelper.pause(-1), /Delay must/);
  assert.throws(() => workerHelper.pause(30001), /Delay must/);
  assert.throws(() => workerHelper.pause(NaN), /Delay must/);
  console.log(
    'PASS: checkpoint codec, real match policy, immutable input, lineup failure, guarded browser controls, worker cleanup and fallback, bounded waits, logs, and export chunks.',
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
