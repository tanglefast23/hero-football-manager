import { readFileSync } from 'fs';
import { join } from 'path';
import { PITCH_H, PITCH_W } from '../../sim/geometry';
import {
  layoutModeForWidth,
  TWO_COLUMN_MIN_WIDTH,
} from '../../ui/layout/layout-mode';
import {
  heatFraction,
  MATCH_RAIL_GUTTER,
  MATCH_RAIL_TOP_INSET,
  MATCH_RAIL_WIDTH,
  mostTiredFirst,
  RAIL_HERO_TILE_CAP,
  RAIL_TIRED_ROWS,
  railHeroStatus,
} from '../match-rail';
import { mentalityLabel } from '../match-mentality-ui';
import { ENABLED_LOCALES, loadCatalog } from '../../i18n';

const railSource = () =>
  readFileSync(join(process.cwd(), 'src/render/MatchControlRail.tsx'), 'utf8');
const matchSource = () =>
  readFileSync(join(process.cwd(), 'src/render/MatchScreen.tsx'), 'utf8');
const styleSource = () =>
  readFileSync(
    join(process.cwd(), 'src/render/match-screen-styles.ts'),
    'utf8',
  );

/** Where the pitch's left edge lands once rail + pitch are centred as one group. */
function pitchLeftEdge(width: number, pitchWidth: number): number {
  return (
    MATCH_RAIL_GUTTER * 2 +
    MATCH_RAIL_WIDTH +
    Math.max(
      0,
      (width - MATCH_RAIL_GUTTER * 3 - MATCH_RAIL_WIDTH - pitchWidth) / 2,
    )
  );
}

describe('desktop match control rail', () => {
  it('lists the three most tired players, condition ascending', () => {
    const field = [
      { id: 'gk', condition: 88 },
      { id: 'lb', condition: 34 },
      { id: 'cm', condition: 61 },
      { id: 'st', condition: 12 },
      { id: 'rb', condition: 40 },
    ];

    expect(mostTiredFirst(field).map((player) => player.id)).toEqual([
      'st',
      'lb',
    ]);
    expect(RAIL_TIRED_ROWS).toBe(2);
  });

  it('keeps equally tired players in their field order', () => {
    const field = [
      { id: 'a', condition: 50 },
      { id: 'b', condition: 50 },
      { id: 'c', condition: 50 },
      { id: 'd', condition: 50 },
    ];

    expect(mostTiredFirst(field).map((player) => player.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('reads heat as a clamped share of the Zone threshold', () => {
    expect(heatFraction(0, 'MID')).toBe(0);
    expect(heatFraction(30, 'MID')).toBe(0.5);
    expect(heatFraction(60, 'MID')).toBe(1);
    expect(heatFraction(120, 'MID')).toBe(1);
    expect(heatFraction(-5, 'MID')).toBe(0);
  });

  it('separates LOADING, ARMED, and a power playing out', () => {
    // The player-facing words, which are the ones the rail tile prints in
    // brackets after the name. The engine keeps its own state names; this is
    // the only place the two vocabularies are allowed to meet.
    expect(railHeroStatus({ kind: 'idle' })).toBe('loading');
    expect(railHeroStatus({ kind: 'zone', remainingTicks: 70 })).toBe('armed');
    expect(
      railHeroStatus({
        kind: 'armed',
        remainingTicks: 20,
        windowTicks: 20,
        strength: 0.9,
        sawShotOnTarget: false,
      }),
    ).toBe('armed');
    expect(
      railHeroStatus({ kind: 'winding', untilTick: 40, strength: 1 }),
    ).toBe('firing');
    expect(railHeroStatus({ kind: 'active', untilTick: 90, strength: 1 })).toBe(
      'firing',
    );
  });

  it('ships no Zone-countdown plumbing — a Zone holds until its context arrives', () => {
    // m1.27 removed the Zone countdown: sim `remainingTicks` never decrements
    // while zoned, so any seconds-remaining field the rail carried would render
    // a frozen fake '7s' timer. The plumbing (zoneSecondsRemaining /
    // zoneSecondsLeft) was deleted end to end — pin it out like the manual-tap
    // removal in automatic-power-ui.test.ts.
    const rail = readFileSync(
      join(process.cwd(), 'src/render/match-rail.ts'),
      'utf8',
    );
    expect(rail).not.toContainSource('zoneSecondsRemaining');
    expect(railSource()).not.toContainSource('zoneSecondsLeft');
    expect(matchSource()).not.toContainSource('zoneSecondsRemaining');
  });

  it('names the playstyle chips without renaming the engine mentalities', () => {
    // The rail shares the phone's words. It used to carry "PRESS"/"PARK BUS"
    // while the banner a chip fires said "PLAYSTYLE · ATTACK" — one tactic
    // under two names, both on screen at once on a wide layout.
    expect(mentalityLabel('BALANCED')).toBe('BALANCED');
    expect(mentalityLabel('ATTACK')).toBe('ATTACK');
    expect(mentalityLabel('PROTECT')).toBe('PROTECT');
    // Nothing may draw the raw enum again: the rail is desktop's most-used
    // control and it read English in all seven languages.
    expect(railSource()).not.toContainSource('MENTALITY_CHIP_LABELS');
    expect(railSource()).toContainSource('mentalityLabel(option, t)');
  });

  it('caps the rail at the Hero License field cap of four tiles', () => {
    expect(RAIL_HERO_TILE_CAP).toBe(4);
  });

  it('adds the active division rival after the controlled hero cap', () => {
    const match = matchSource();
    const rail = railSource();

    expect(match).toContainSource('isRivalHeroIntroHeroId(player.def.id)');
    expect(match).toContainSource('...controlledRailHeroTiles');
    expect(match).toContainSource('...rivalRailHeroTiles');
    expect(match).toContainSource('rival: true');
    expect(rail).toContainSource("t('rivalHeroIntro.divisionRival')");
    expect(rail).toContainSource('styles.heatFillRival');
  });

  it('leaves the pitch aspect-correct and full-height beside a 440pt rail', () => {
    const width = 1280;
    const height = 800;
    expect(layoutModeForWidth(width)).toBe('twoColumn');

    const availableHeight = height - MATCH_RAIL_TOP_INSET - MATCH_RAIL_GUTTER;
    const availableWidth = width - MATCH_RAIL_WIDTH - MATCH_RAIL_GUTTER * 3;
    const pitchWidth = Math.min(
      availableWidth,
      (availableHeight * PITCH_W) / PITCH_H,
    );
    const pitchHeight = PITCH_H * (pitchWidth / PITCH_W);

    expect(MATCH_RAIL_WIDTH).toBe(440);
    // Height-limited, so the pitch fills the pane vertically...
    expect(Math.round(pitchHeight)).toBe(availableHeight);
    // ...and stays wider than the phone pitch it replaces.
    expect(pitchWidth).toBeGreaterThan(430);
    expect(pitchWidth).toBeLessThanOrEqual(availableWidth);
  });

  it('keeps the rail one gutter from the touchline instead of stranding it left', () => {
    // A wide, short window is the worst case: the pitch is height-limited, so a
    // flexed pane used to centre it in ~1,000pt of leftover width.
    const width = 1920;
    const pitchWidth = 800;

    expect(styleSource()).toContainSource("justifyContent: 'center'");
    expect(styleSource()).not.toContainSource('desktopPitchPane: { flex: 1');
    // The event ticker no longer needs a desktop offset at all: it is an
    // absolute child of the pitch frame, beside the carrier card, so it
    // inherits the pitch's box on every layout. It used to be a child of the
    // root that had to be re-pointed at the pitch's left edge and width, and
    // when only `left` moved it ran off across the whole desktop window.
    const source = matchSource();
    const pitchFrame = source.indexOf('<View style={pitchFrameStyle}>');
    const tickerStack = source.indexOf('styles.bannerStack');
    const carrierCard = source.indexOf('styles.carrierCard');
    expect(pitchFrame).toBeGreaterThan(-1);
    expect(tickerStack).toBeGreaterThan(pitchFrame);
    expect(tickerStack).toBeLessThan(carrierCard);
    expect(source).not.toContainSource('desktopPitchLeft');

    const railRight = pitchLeftEdge(width, pitchWidth) - MATCH_RAIL_GUTTER;
    const railLeft = railRight - MATCH_RAIL_WIDTH;
    // The gap between controls and pitch is the gutter, nothing more...
    expect(pitchLeftEdge(width, pitchWidth) - railRight).toBe(
      MATCH_RAIL_GUTTER,
    );
    // ...and the leftover width is split evenly either side of the pair.
    expect(Math.round(railLeft)).toBe(
      Math.round(width - (pitchLeftEdge(width, pitchWidth) + pitchWidth)),
    );
  });

  it('lets a full scorer name cross the pitch without shrinking', () => {
    const source = styleSource();
    expect(source).toContainSource(
      "tickerGlyphs: { alignSelf: 'flex-start', flexDirection: 'row' }",
    );
    expect(source).toMatchSource(/banner: \{[\s\S]{0,260}flexShrink: 0/);
  });

  it('reserves no bottom-dock height on desktop and none of the rail on phones', () => {
    const source = matchSource();

    expect(layoutModeForWidth(TWO_COLUMN_MIN_WIDTH - 1)).toBe('single');
    expect(source).toContainSource(
      "const railLayout = !presentationOnly && layoutModeForWidth(width) === 'twoColumn';",
    );
    expect(source).toContainSource(
      '? MATCH_RAIL_TOP_INSET + MATCH_RAIL_GUTTER',
    );
    expect(source).toContainSource('const availablePitchWidth = railLayout');
    expect(source).toContainSource(
      'width - MATCH_RAIL_WIDTH - MATCH_RAIL_GUTTER * 3',
    );
    // `scale` now comes from matchPitchLayout, which also snaps sprite
    // magnification to whole device pixels. What this test guards is that the
    // rail's reserved width is what gets measured, not the raw viewport.
    expect(source).toContainSource('matchPitchLayout(availablePitchWidth');
    // The phone scorebar and coaching dock render only in single mode.
    expect(source).toContainSource(
      '{railLayout || presentationOnly ? null : (',
    );
    expect(source).toContainSource('{railLayout ? (');
  });

  it('drives every rail control from an already-recorded coaching input', () => {
    const source = matchSource();

    expect(source).toContainSource("kind: 'SET_FORMATION', formation }");
    expect(source).toContainSource("kind: 'SET_MENTALITY', mentality }");
    expect(source).toContainSource("kind: 'SET_ENERGY_USE', energyUse: mode }");
    // The hero tile's A/M badge is read-only until on-pitch tap-to-fire exists,
    // so the rail must NOT queue the team-wide auto-powers policy flip.
    expect(source).not.toContainSource("kind: 'SET_AUTO_POWERS',");
    // No new input kinds, and no engine-version-affecting sim edit.
    expect(source).not.toContainSource('ENGINE_VERSION');
  });

  it('never hands a Pressable a function style', () => {
    expect(railSource()).not.toMatchSource(/style=\{\(\{\s*pressed/);
  });

  it('keeps the signed-off rail copy', () => {
    const source = railSource();

    // The sentences themselves now live in `content/i18n/en.json`; the rail owns
    // which key goes where, and the catalog owns the words. Asserting the key
    // and its English separately is what keeps both halves signed off.
    const strings = loadCatalog('en').strings;
    expect(source).toContainSource(
      "t('matchRail.substitutionsLeft', { count: substitutionsRemaining })",
    );
    expect(strings['matchRail.substitutionsLeft']).toBe(
      'SUBSTITUTIONS · {count} LEFT',
    );
    expect(source).toContainSource("t('matchRail.mostTiredOnThePitch')");
    expect(strings['matchRail.mostTiredOnThePitch']).toBe(
      'MOST TIRED ON THE PITCH',
    );
    expect(source).toContainSource("t('matchRail.swapOpensTheBench')");
    expect(strings['matchRail.swapOpensTheBench']).toBe(
      'SWAP OPENS THE BENCH · FRESH LEGS ENTER AT 100%',
    );
    expect(source).toContainSource(
      "t('matchRail.teamEnergyTitle', { mode: energyUseLabel(energyUse, t) })",
    );
    expect(strings['matchRail.teamEnergyTitle']).toBe('TEAM ENERGY ({mode})');
    expect(source).toContainSource("t('matchRail.energyCaption', {");
    expect(strings['matchRail.energyCaption']).toBe(
      '{percent}% AVERAGE · {tired} TIRED (UP TO {threshold}%)',
    );
    // `≤` has no glyph in the face, so it is not drawn at all — an earlier
    // version appended it at the call site and it rendered through the system
    // fallback. The param carries the NUMBER, so each language writes its own
    // wording around it rather than inheriting an English phrase mid-sentence.
    expect(source).toContainSource('threshold: TIRED_ENERGY_THRESHOLD,');
    // Comments may name the character; nothing may DRAW it. Strip comments
    // before asserting, or this test fails on the line explaining itself.
    const drawn = source
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    expect(drawn).not.toContainSource('≤');
    for (const locale of ENABLED_LOCALES) {
      expect({
        locale,
        caption: loadCatalog(locale).strings['matchRail.energyCaption'],
      }).toEqual({ locale, caption: expect.not.stringContaining('≤') });
    }
    // The formation's shape note rides in its heading, the way TEAM ENERGY
    // already carries its mode — the rail has to fit more hero tiles as the
    // licence cap grows, and a spare caption row is the cheapest thing to give up.
    // The blurb now comes from the copy catalog rather than a map in the sim
    // ring — it is display text, and a pure ring must not hold copy that
    // changes with the player's language.
    expect(source).toContainSource(
      'blurb: t(`formation.${formation}.blurb`).toUpperCase(),',
    );
    expect(strings['matchRail.formationTitle']).toBe('FORMATION ({blurb})');
    expect(source).not.toContainSource(
      'ONE POWER TILE PER FIELDED HERO — THE RAIL GROWS TO 4 TILES WITH THE HERO LICENSE CAP.',
    );
    // The A/M badge went with it: powers always fire on their own cue, so the
    // badge could only ever read 'A'.
    expect(source).not.toContainSource('policyToggle');
    expect(source).not.toContainSource('autoPowers');
    // Status tiles only: firing is a tap on the glowing hero, not a rail button.
    expect(source).not.toContainSource('>FIRE<');
  });
});
