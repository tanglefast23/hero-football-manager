import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

describe('automatic superpower presentation', () => {
  it('shows only the actual power name when contextual automatic activation fires', () => {
    const source = readFileSync(join(process.cwd(), 'src/render/MatchScreen.tsx'), 'utf8');
    const takeover = readFileSync(join(process.cwd(), 'src/render/PowerTitleTakeover.tsx'), 'utf8');
    const rail = readFileSync(join(process.cwd(), 'src/render/MatchControlRail.tsx'), 'utf8');

    expect(takeover).toContain('{presentation.name}');
    expect(takeover).toContain('{ backgroundColor: teamColor }');
    expect(takeover).toContain("{ending ? 'POWER COMPLETE' : 'SUPER POWER'}");
    expect(source).toContain('<PowerTitleTakeover');
    expect(source).toContain('layout="mobile"');
    expect(rail).toContain('<PowerTitleTakeover {...powerTakeover} layout="desktop" />');
    expect(source).toContain("text: `⚡ ${e.power.replace(/_/g, ' ')} — ${firingPlayer.def.name}`");
    expect(source).not.toContain('SUPER POWER READY');
    expect(source).not.toContain('heroPowerReady');
    expect(source).toContain('if (player.team !== controlledTeam) rivalHeroPlayers.push(index);');
    expect(source).not.toContain('Superpower control');
    expect(source).not.toContain('kind: \'POWER_TAP\', player: index');
    expect(source).not.toContain('>MANUAL</Text>');
  });

  it('keeps both watched sides on the automatic firing policy', () => {
    const source = readFileSync(join(process.cwd(), 'src/render/match-control.ts'), 'utf8');

    expect(source).toContain("homePolicy: 'FIRE_WHEN_READY'");
    expect(source).toContain("awayPolicy: 'FIRE_WHEN_READY'");
    expect(source).not.toContain('SAVE_FOR_TAP');
  });

  it('ships no manual-tap plumbing in the render ring', () => {
    // The manual hero tap was removed for good on 2026-07-25 (see docs/04). The
    // sim keeps POWER_TAP as test instrumentation, but nothing the player can
    // reach may queue one, and the tap-confirm sound must stay gone.
    expect(existsSync(join(process.cwd(), 'src/render/autoPower.ts'))).toBe(false);
    expect(existsSync(join(process.cwd(), 'assets/audio/sfx/tap-fire.wav'))).toBe(false);

    const audio = readFileSync(join(process.cwd(), 'src/render/audio.ts'), 'utf8');
    expect(audio).not.toContain('TAP_STRENGTH');
    expect(audio).not.toContain("'tap-fire'");
    expect(audio).not.toContain('e.strength === 1');
  });
});
