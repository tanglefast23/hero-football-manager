import { readFileSync } from 'fs';
import { join } from 'path';
import { DEFAULT_FORMATION_PRESETS, MENTALITIES } from '../../sim/tactics';

const source = (path: string) =>
  readFileSync(join(process.cwd(), path), 'utf8');
const openings = (text: string, component: string) =>
  text.match(new RegExp(`<${component}\\b`, 'g')) ?? [];
const openingFor = (text: string, component: string, handler: string) => {
  const handlerAt = text.lastIndexOf(handler);
  const openingAt = text.lastIndexOf(`<${component}`, handlerAt);
  return text.slice(openingAt, text.indexOf('>', openingAt) + 1);
};

describe('match button response contract', () => {
  it('offers a match-only web delay override without changing native timing', () => {
    const pressable = source('src/ui/components/SfxPressable.tsx');

    expect(pressable).toContain('immediatePress?: boolean;');
    expect(pressable).toContain('immediatePress = false');
    expect(pressable).toContain("immediatePress && Platform.OS === 'web'");
    expect(pressable).toContain('{ delayPressIn: 0 }');
    expect(pressable).not.toContain('unstable_pressDelay');
    expect(pressable).toContain(
      "else if (pressSfx === 'match-control') playMatchControlSfx();",
    );
    expect(pressable.match(/playMatchControlSfx\(\)/g) ?? []).toHaveLength(1);
  });

  it('gives every phone match control immediate shared feedback with one cue owner', () => {
    const match = source('src/render/MatchScreen.tsx');

    expect(match).toContain(
      "import { SfxPressable as Pressable } from '../ui/components/SfxPressable';",
    );
    expect(openings(match, 'Pressable')).toHaveLength(6);
    expect(match.match(/\n {10,20}immediatePress\n/g) ?? []).toHaveLength(6);
    expect(match.match(/pressSfx="match-control"/g) ?? []).toHaveLength(4);
    for (const handler of [
      'selectFormation(nextFormation',
      'selectMentality(nextMentality',
      'openSwap();',
      'selectEnergyUse(mode);',
    ]) {
      expect(openingFor(match, 'Pressable', handler)).toContain(
        'pressSfx="match-control"',
      );
    }
    expect(openingFor(match, 'Pressable', 'toggleUserPause();')).not.toContain(
      'pressSfx="match-control"',
    );
    expect(
      openingFor(match, 'Pressable', 'applySpeed(nextMatchSpeed'),
    ).not.toContain('pressSfx="match-control"');
    // The only direct cue left belongs to the skippable power takeover, which
    // is not one of these Pressables. Each match control delegates its cue to
    // SfxPressable and leaves its gameplay action on release.
    expect(match.match(/playUiClickSfx\(\);/g) ?? []).toHaveLength(1);
    expect(match).not.toContain('onPressIn=');
    expect(match).toContain('onPress={() => {\n            toggleUserPause();');
    expect(match).toContain('onPress={() => {\n                applySpeed(');
    expect(match).toContain(
      'onPress={() => {\n                selectFormation(',
    );
    expect(match).toContain(
      'onPress={() => {\n                selectMentality(',
    );
    expect(match).toContain('onPress={() => {\n                openSwap();');
    expect(match).toContain(
      'onPress={() => {\n                      selectEnergyUse(mode);',
    );
    expect(match).toContain(
      'pressed ? { opacity: 0.7, transform: [{ translateY: 1 }] } : null',
    );
    expect(match).toContain('disabled={coachingDisabled}');
    expect(match).toContain('disabled={swapDisabled}');
  });

  it('opts every desktop rail control and only the match settings trigger in', () => {
    const rail = source('src/render/MatchControlRail.tsx');
    const settings = source('src/ui/SettingsOverlay.tsx');

    // The screenshot's two rows contain three Formation and three Playstyle
    // buttons. Their cue sits inside each map below, so every generated button
    // inherits the same layered sound rather than only the currently selected one.
    expect(DEFAULT_FORMATION_PRESETS).toHaveLength(3);
    expect(MENTALITIES).toHaveLength(3);
    expect(openings(rail, 'SfxPressable')).toHaveLength(6);
    expect(rail.match(/\n {14,20}immediatePress\n/g) ?? []).toHaveLength(6);
    expect(rail.match(/pressSfx="match-control"/g) ?? []).toHaveLength(4);
    for (const handler of [
      'onSelectFormation(option)',
      'onSelectMentality(option)',
      'onPress={onSwap}',
      'onSelectEnergyUse(mode)',
    ]) {
      expect(openingFor(rail, 'SfxPressable', handler)).toContain(
        'pressSfx="match-control"',
      );
    }
    expect(
      openingFor(rail, 'SfxPressable', 'onSelectSpeed(option)'),
    ).not.toContain('pressSfx="match-control"');
    expect(
      openingFor(rail, 'SfxPressable', 'onPress={onTogglePause}'),
    ).not.toContain('pressSfx="match-control"');
    expect(settings).toContain('immediatePress={match}');
    expect(settings).not.toContain('pressSfx="match-control"');
  });

  it('keeps substitution actions on release, disabled buttons inert, and cancel single-cued', () => {
    const board = source('src/render/SubstitutionBoard.tsx');

    expect(openings(board, 'SfxPressable')).toHaveLength(3);
    // The two visible control sites opt in. The full-screen scrim does not:
    // scaling that invisible dismissal surface would move the whole overlay.
    expect(board.match(/\bimmediatePress\b/g) ?? []).toHaveLength(2);
    expect(board).not.toContain('pressSfx="match-control"');
    expect(board).toContain('disabled={disabled}');
    expect(board).toContain('onPress={onPress}');
    expect(board).toMatch(
      /label=\{t\('substitutionBoard\.cancel'\)\}[\s\S]*?onPressIn=\{\(\) => \{\s*onCancel\(\);\s*\}\}[\s\S]*?onPress=\{onCancel\}/,
    );
  });
});
