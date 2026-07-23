import { readFileSync } from 'fs';
import { join } from 'path';

describe('automatic superpower presentation', () => {
  it('shows only the actual power name when contextual automatic activation fires', () => {
    const source = readFileSync(join(process.cwd(), 'src/render/MatchScreen.tsx'), 'utf8');

    expect(source).toContain('style={[styles.powerActivationName, { color: presentation.color }]}');
    expect(source).toContain('{presentation.name}');
    expect(source).toContain("text: `⚡ ${e.power.replace(/_/g, ' ')} — ${firingPlayer.def.name}`");
    expect(source).not.toContain('SUPER POWER READY');
    expect(source).not.toContain('heroPowerReady');
    expect(source).toContain('if (player.team !== controlledTeam) rivalHeroPlayers.push(index);');
    expect(source).not.toContain('Superpower control');
    expect(source).not.toContain('kind: \'POWER_TAP\', player: index');
    expect(source).not.toContain('>MANUAL</Text>');
  });
});
