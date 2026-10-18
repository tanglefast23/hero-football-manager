// Read-only checkpoint validation. The optional match is the production engine.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const child = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
      },
    }).outputText,
    file,
  );
const {
  parseStoredGameState,
  serializeGameState,
} = require('../../src/persistence/game-state-codec.ts');
const { activeCareerMatchday } = require('../../src/game/career.ts');
const { buildCareerMatchTeams } = require('../../src/game/squad.ts');
const { quickMatchForFixture } = require('../../src/game/matchday.ts');
const {
  isFirstOnboardingFixture,
  withoutPowers,
} = require('../../src/game/onboarding/story-onboarding.ts');
const { ENGINE_VERSION } = require('../../src/sim/match.ts');

function checkCareer(payload, simulate = false) {
  const checkpoint = payload?.snapshot ?? payload;
  const has = (value, key) =>
    value !== null &&
    typeof value === 'object' &&
    Object.prototype.hasOwnProperty.call(value, key);
  const extracted = has(payload, 'crashCareer')
    ? payload.crashCareer
    : has(checkpoint, 'career')
      ? checkpoint.career
      : checkpoint;
  const checkpointEngineVersion = checkpoint?.engineVersion ?? null;
  const engineVersionMatches =
    checkpointEngineVersion === null
      ? null
      : checkpointEngineVersion === ENGINE_VERSION;
  if (extracted === null || extracted === undefined)
    return {
      ok: false,
      code: 'NO_CAREER',
      engineVersion: ENGINE_VERSION,
      checkpointEngineVersion,
      engineVersionMatches,
      error:
        checkpoint?.careerSerializationError ??
        'This checkpoint has no career. Open a career and export it again.',
    };
  const candidate =
    typeof extracted === 'string' ? JSON.parse(extracted) : extracted;
  const original = JSON.stringify(payload);
  const career = parseStoredGameState(JSON.stringify(candidate));
  const encoded = serializeGameState(career);
  const matchday = activeCareerMatchday(career);
  const clubIds = [
    ...new Set([
      ...career.clubs.map((club) => club.id),
      ...(matchday?.fixtures.flatMap((fixture) => [
        fixture.homeClubId,
        fixture.awayClubId,
      ]) ?? []),
    ]),
  ];
  const failures = [];
  const teams = {};
  for (const clubId of clubIds) {
    try {
      Object.assign(
        teams,
        buildCareerMatchTeams(career, [clubId], matchday?.cupRoundLabel),
      );
    } catch (error) {
      failures.push({ clubId, error: error.message });
    }
  }
  const result = {
    ok: failures.length === 0,
    engineVersion: ENGINE_VERSION,
    checkpointEngineVersion,
    engineVersionMatches,
    seed: career.careerSeed,
    season: career.season,
    week: career.week,
    phase: career.phase,
    normalizedByCodec: JSON.stringify(candidate) !== JSON.stringify(career),
    teamsChecked: clubIds.length,
    failures,
    matchday:
      matchday === undefined
        ? null
        : {
            kind: matchday.kind,
            fixtureId: matchday.fixture.id,
            seed: matchday.fixture.matchSeed,
          },
  };
  if (simulate && result.ok) {
    const skipReason =
      engineVersionMatches === false
        ? 'Checkpoint engine differs from the running engine.'
        : career.phase !== 'matchday'
          ? 'Career is not in matchday phase.'
          : checkpoint?.screen !== undefined && checkpoint.screen !== 'matchday'
            ? 'Checkpoint is not on the matchday screen.'
            : matchday === undefined
              ? 'There is no active user fixture.'
              : null;
    if (skipReason !== null) {
      result.simulation = { status: 'skipped', reason: skipReason };
      return result;
    }
    const onboarding = isFirstOnboardingFixture(career, matchday.fixture.id);
    if (onboarding)
      teams[career.userClubId] = withoutPowers(teams[career.userClubId]);
    const formation =
      career.lineups.find((lineup) => lineup.clubId === career.userClubId)
        ?.formation ?? '4-4-2';
    const policy = {
      userClubId: career.userClubId,
      initialFormation: formation,
      autoSubs: true,
    };
    const played = quickMatchForFixture(matchday.fixture, teams, policy);
    result.simulation = {
      status: 'completed',
      policy,
      onboardingPowersRemoved: onboarding,
      userPowersAtKickoff: teams[career.userClubId].players.filter(
        (player) => player.power !== undefined,
      ).length,
      result: played.result,
      ticks: played.match.tick,
      evidence: 'Supplemental simulation only; the career was not advanced.',
    };
  }
  if (
    serializeGameState(career) !== encoded ||
    JSON.stringify(payload) !== original
  )
    throw Error('Checkpoint validation mutated its input.');
  return result;
}

function main(args) {
  if (args.includes('--help')) {
    console.log(
      'Usage: npm run qa:career -- checkpoint.json [--simulate]\nReads a raw save, bridge checkpoint, or crashCareer capture. Never writes the save.',
    );
    return;
  }
  const positional = args.filter((argument) => !argument.startsWith('--'));
  if (
    positional.length !== 1 ||
    args.some(
      (argument) => argument.startsWith('--') && argument !== '--simulate',
    )
  )
    throw Error('Use --help for usage.');
  const file = path.resolve(positional[0]);
  const bytes = fs.readFileSync(file);
  const result = checkCareer(
    JSON.parse(bytes.toString('utf8')),
    args.includes('--simulate'),
  );
  const source = child
    .execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' })
    .trim();
  const files = child
    .execFileSync(
      'git',
      [
        'ls-files',
        '--cached',
        '--others',
        '--exclude-standard',
        '--',
        'App.tsx',
        'src',
        'content',
        'package.json',
        'package-lock.json',
      ],
      { cwd: root, encoding: 'utf8' },
    )
    .trim()
    .split('\n')
    .sort();
  const hash = crypto.createHash('sha256');
  for (const file of files) {
    hash.update(file + '\0');
    hash.update(
      fs.existsSync(path.join(root, file))
        ? fs.readFileSync(path.join(root, file))
        : '<deleted>',
    );
    hash.update('\0');
  }
  console.log(
    JSON.stringify(
      {
        ...result,
        source: {
          commit: source,
          files: files.length,
          sha256: hash.digest('hex'),
        },
        input: {
          file,
          sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
        },
      },
      null,
      2,
    ),
  );
  if (!result.ok) process.exitCode = 1;
}
module.exports = { checkCareer };
if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error.message }));
    process.exitCode = 1;
  }
}
