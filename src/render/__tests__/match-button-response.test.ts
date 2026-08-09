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

    expect(pressable).toContainSource('immediatePress?: boolean;');
    expect(pressable).toContainSource('immediatePress = false');
    expect(pressable).toContainSource(
      "immediatePress && Platform.OS === 'web'",
    );
    expect(pressable).toContainSource('{ delayPressIn: 0 }');
    expect(pressable).not.toContainSource('unstable_pressDelay');
    expect(pressable).toContainSource(
      "else if (pressSfx === 'match-control') playMatchControlSfx();",
    );
    expect(pressable.match(/playMatchControlSfx\(\)/g) ?? []).toHaveLength(1);
  });

  it('gives every phone match control immediate shared feedback with one cue owner', () => {
    const match = source('src/render/MatchScreen.tsx');

    expect(match).toContainSource(
      "import { SfxPressable as Pressable } from '../ui/components/SfxPressable';",
    );
    // Six match controls opt in below. The performance notice and two graphics
    // recovery actions are ordinary release-driven Pressables.
    expect(openings(match, 'Pressable')).toHaveLength(9);
    expect(match.match(/\n {10,20}immediatePress\n/g) ?? []).toHaveLength(6);
    expect(match.match(/pressSfx="match-control"/g) ?? []).toHaveLength(4);
    for (const handler of [
      'selectFormation(',
      'selectMentality(nextMentality',
      'openSwap();',
      'selectEnergyUse(mode);',
    ]) {
      expect(openingFor(match, 'Pressable', handler)).toContainSource(
        'pressSfx="match-control"',
      );
    }
    expect(
      openingFor(match, 'Pressable', 'toggleUserPause();'),
    ).not.toContainSource('pressSfx="match-control"');
    expect(
      openingFor(match, 'Pressable', 'applySpeed(nextMatchSpeed'),
    ).not.toContainSource('pressSfx="match-control"');
    // The only direct cue left belongs to the skippable power takeover, which
    // is not one of these Pressables. Each match control delegates its cue to
    // SfxPressable and leaves its gameplay action on release.
    expect(match.match(/playUiClickSfx\(\);/g) ?? []).toHaveLength(1);
    expect(match).not.toContainSource('onPressIn=');
    expect(match).toContainSource(
      'onPress={() => {\n            toggleUserPause();',
    );
    expect(match).toContainSource(
      'onPress={() => {\n                applySpeed(',
    );
    expect(match).toContainSource(
      'onPress={() => {\n                selectFormation(',
    );
    expect(match).toContainSource(
      'onPress={() => {\n                selectMentality(',
    );
    expect(match).toContainSource(
      'onPress={() => {\n                openSwap();',
    );
    expect(match).toContainSource(
      'onPress={() => {\n                      selectEnergyUse(mode);',
    );
    expect(match).toContainSource(
      'pressed ? { opacity: 0.7, transform: [{ translateY: 1 }] } : null',
    );
    expect(match).toContainSource('disabled={coachingDisabled}');
    expect(match).toContainSource('disabled={swapDisabled}');
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
      expect(openingFor(rail, 'SfxPressable', handler)).toContainSource(
        'pressSfx="match-control"',
      );
    }
    expect(
      openingFor(rail, 'SfxPressable', 'onSelectSpeed(option)'),
    ).not.toContainSource('pressSfx="match-control"');
    expect(
      openingFor(rail, 'SfxPressable', 'onPress={onTogglePause}'),
    ).not.toContainSource('pressSfx="match-control"');
    expect(settings).toContainSource('immediatePress={match}');
    expect(settings).not.toContainSource('pressSfx="match-control"');
  });

  it('keeps substitution actions on release, disabled buttons inert, and cancel single-cued', () => {
    const board = source('src/render/SubstitutionBoard.tsx');

    expect(openings(board, 'SfxPressable')).toHaveLength(3);
    // The two visible control sites opt in. The full-screen scrim does not:
    // scaling that invisible dismissal surface would move the whole overlay.
    expect(board.match(/\bimmediatePress\b/g) ?? []).toHaveLength(2);
    expect(board).not.toContainSource('pressSfx="match-control"');
    expect(board).toContainSource('disabled={disabled}');
    expect(board).toContainSource('onPress={onPress}');
    expect(board).toMatchSource(
      /label=\{t\('substitutionBoard\.cancel'\)\}[\s\S]*?onPressIn=\{\(\) => \{\s*onCancel\(\);\s*\}\}[\s\S]*?onPress=\{onCancel\}/,
    );
  });
});
