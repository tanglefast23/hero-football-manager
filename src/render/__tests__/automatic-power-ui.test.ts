import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { matchPoliciesForControlledTeam } from '../match-control';
import { controlledMatchOptions } from '../../game/match-policy';

describe('automatic superpower presentation', () => {
  it('shows only the actual power name when contextual automatic activation fires', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/render/MatchScreen.tsx'),
      'utf8',
    );
    const takeover = readFileSync(
      join(process.cwd(), 'src/render/PowerTitleTakeover.tsx'),
      'utf8',
    );
    const rail = readFileSync(
      join(process.cwd(), 'src/render/MatchControlRail.tsx'),
      'utf8',
    );

    expect(takeover).toContain('{presentation.name}');
    expect(takeover).toContain('{ backgroundColor: teamColor }');
    expect(takeover).toContain("'matchScreen.powerComplete'");
    expect(takeover).toContain("'matchScreen.superPower'");
    expect(takeover).not.toContain("'POWER COMPLETE'");
    expect(takeover).not.toContain("'SUPER POWER'");
    expect(source).toContain('<PowerTitleTakeover');
    expect(source).toContain('layout="mobile"');
    expect(rail).toContain(
      '<PowerTitleTakeover {...powerTakeover} layout="desktop" />',
    );
    expect(source).toContain('powerCutInPresentation(e.power, t).name');
    expect(source).not.toContain("e.power.replace(/_/g, ' ')");
    expect(source).not.toContain('SUPER POWER READY');
    expect(source).not.toContain('heroPowerReady');
    expect(source).toContain(
      'if (player.team !== controlledTeam) rivalHeroPlayers.push(index);',
    );
    expect(source).not.toContain('Superpower control');
    // Still no hardcoded mode word: MANUAL/AUTO is catalog copy in all seven
    // languages, on the match-day row and nowhere else.
    expect(source).not.toContain('>MANUAL</Text>');
  });

  it('defaults both watched sides to the automatic firing policy', () => {
    // AUTO is what an omitted setting means, everywhere. Only an explicit
    // 'manual' may move a side off it.
    expect(matchPoliciesForControlledTeam(0, '3-5-2')).toEqual({
      homePolicy: 'FIRE_WHEN_READY',
      awayPolicy: 'FIRE_WHEN_READY',
      controlledTeam: 0,
      homeFormation: '3-5-2',
    });
    expect(controlledMatchOptions(1, '3-5-2')).toEqual({
      homePolicy: 'FIRE_WHEN_READY',
      awayPolicy: 'FIRE_WHEN_READY',
      controlledTeam: 1,
      awayFormation: '3-5-2',
    });
  });

  it('turns only the manager’s own side manual, never the opposition', () => {
    // There is nobody to tap for the opposition, so a manual away policy would
    // simply delete their powers for the match.
    expect(matchPoliciesForControlledTeam(0, '3-5-2', 'manual')).toEqual({
      homePolicy: 'SAVE_FOR_TAP',
      awayPolicy: 'FIRE_WHEN_READY',
      controlledTeam: 0,
      homeFormation: '3-5-2',
    });
    expect(matchPoliciesForControlledTeam(1, '3-5-2', 'manual')).toEqual({
      homePolicy: 'FIRE_WHEN_READY',
      awayPolicy: 'SAVE_FOR_TAP',
      controlledTeam: 1,
      awayFormation: '3-5-2',
    });
  });

  it('never lets Quick Result run manual, which would fire nothing at all', () => {
    // Nobody is watching a Quick Result. A SAVE_FOR_TAP hero would hold their
    // Zone to the whistle, so the club would field its heroes for no effect —
    // silently. matchday.ts must never pass 'manual'.
    const matchday = readFileSync(
      join(process.cwd(), 'src/game/matchday.ts'),
      'utf8',
    );
    expect(matchday).not.toContain("'manual'");
    expect(matchday).toContain('controlledMatchOptions(controlledTeam');
    // The two paths still share one options builder, so they cannot drift.
    const renderPolicy = readFileSync(
      join(process.cwd(), 'src/render/match-control.ts'),
      'utf8',
    );
    expect(renderPolicy).toContain('return controlledMatchOptions(');
  });

  it('routes the reinstated tap through the dock, and keeps the retired bits retired', () => {
    // The manual tap was removed on 2026-07-25 and reinstated on 2026-08-20 as
    // an opt-in setting (see docs/04). What came back is the dock and nothing
    // else: the old always-on control module and its bespoke confirm sound stay
    // gone, and the tap keeps the shared coaching-input path so an engine
    // refusal cannot take the match screen down.
    const dock = readFileSync(
      join(process.cwd(), 'src/render/HeroPowerDock.tsx'),
      'utf8',
    );
    const screen = readFileSync(
      join(process.cwd(), 'src/render/MatchScreen.tsx'),
      'utf8',
    );
    expect(screen).toContain("kind: 'POWER_TAP',");
    expect(screen).toContain('heroPowerTapBlocked(match, slot)');
    expect(screen).toContain('recordCoachingInput({');
    expect(screen).toContain('<HeroPowerDock');
    // The dock is the only thing that may queue a tap, and it refuses one on
    // any cell that is not a live Zone.
    expect(dock).toContain('heroPowerPressable(cell.state)');
    expect(dock).toContain('disabled={!pressable}');
    expect(existsSync(join(process.cwd(), 'src/render/autoPower.ts'))).toBe(
      false,
    );
    expect(
      existsSync(join(process.cwd(), 'assets/audio/sfx/tap-fire.wav')),
    ).toBe(false);

    const audio = readFileSync(
      join(process.cwd(), 'src/render/audio.ts'),
      'utf8',
    );
    expect(audio).not.toContain('TAP_STRENGTH');
    expect(audio).not.toContain("'tap-fire'");
    expect(audio).not.toContain('e.strength === 1');
  });
});
