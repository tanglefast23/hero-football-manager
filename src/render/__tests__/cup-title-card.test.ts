import { readFileSync } from 'fs';
import { join } from 'path';
import {
  CUP_TITLE_CARD_MS,
  CUP_TITLE_CARD_REDUCED_MOTION_MS,
  CUP_TITLE_CARD_TITLE_KEY,
  cupTitleBallFlight,
  cupTitleCard,
  type CupRoundLabel,
} from '../cup-title-card';
import { CUP_ROUND_NAME_KEYS } from '../../game/pyramid';
import { copyFor } from '../../i18n';

/**
 * A Record over the union, so adding a round to the bracket fails to compile
 * here until the card has been shown to handle it.
 */
const ROUND_DISPLAY: Record<CupRoundLabel, string> = {
  'Play-in': 'PLAY-IN',
  'Round of 32': 'ROUND OF 32',
  'Round of 16': 'ROUND OF 16',
  'Quarter-final': 'QUARTER-FINAL',
  'Semi-final': 'SEMI-FINAL',
  Final: 'FINAL',
};

const ROUND_KEYS = Object.keys(ROUND_DISPLAY) as CupRoundLabel[];

const source = (path: string) =>
  readFileSync(join(process.cwd(), path), 'utf8');

describe('the Hero Cup title card', () => {
  it('opens a cup tie under the competition name and its round', () => {
    const card = cupTitleCard('Quarter-final', false);

    expect(CUP_TITLE_CARD_TITLE_KEY).toBe('matchScreen.cupTitleCardTitle');
    expect(card).not.toBeNull();
    expect(card!.title).toBe('HERO CUP');
    expect(card!.roundLabel).toBe('QUARTER-FINAL');
  });

  it.each(Object.entries(ROUND_DISPLAY))(
    'names round %s on the card',
    (round, display) => {
      expect(cupTitleCard(round as CupRoundLabel, false)!.roundLabel).toBe(
        display,
      );
    },
  );

  it('shows nothing at all for a league fixture', () => {
    // A league matchday reaches the match screen with no round: no card, and so
    // no pause reason and no delayed kickoff either.
    expect(cupTitleCard(undefined, false)).toBeNull();
    expect(cupTitleCard(undefined, true)).toBeNull();
  });

  it('drops the flying ball under Reduce Motion but still holds long enough to read', () => {
    const moving = cupTitleCard('Final', false)!;
    const still = cupTitleCard('Final', true)!;

    expect(moving.showBall).toBe(true);
    expect(still.showBall).toBe(false);
    expect(still.roundLabel).toBe('FINAL');
    expect(moving.durationMs).toBe(CUP_TITLE_CARD_MS);
    expect(still.durationMs).toBe(CUP_TITLE_CARD_REDUCED_MOTION_MS);
    // Two short pixel-font lines take roughly 1.2s to read; a card that blinked
    // past that would be worse than no card.
    expect(still.durationMs).toBeGreaterThanOrEqual(1_500);
  });

  it('speaks the round in its written form, not the shouted one', () => {
    expect(cupTitleCard('Semi-final', false)!.accessibilityLabel).toBe(
      'Hero Cup. Semi-final.',
    );
  });

  /**
   * The card drew `cupRoundLabel.toUpperCase()` — the engine's control value,
   * which is English by design — so a German kickoff opened on "HELDENPOKAL /
   * QUARTER-FINAL". Uppercasing now happens after the lookup, and the spoken
   * form keeps the translated round's own casing.
   */
  it("names the round in the player's language, shouted and spoken", () => {
    const de = copyFor('de');
    const card = cupTitleCard('Quarter-final', false, de)!;

    expect(card.title).toBe('HELDENPOKAL');
    expect(card.roundLabel).toBe('VIERTELFINALE');
    expect(card.accessibilityLabel).toBe('Heldenpokal. Viertelfinale.');
  });

  it.each(ROUND_KEYS)(
    'draws round %s from the shared cup key table',
    (round) => {
      const de = copyFor('de');

      expect(cupTitleCard(round, false, de)!.roundLabel).toBe(
        de(CUP_ROUND_NAME_KEYS[round]).toUpperCase(),
      );
    },
  );

  it('flies the ball in from off one edge and out past the other', () => {
    const start = cupTitleBallFlight(0);
    const apex = cupTitleBallFlight(0.5);
    const end = cupTitleBallFlight(1);

    expect(start.x).toBeLessThan(0);
    expect(end.x).toBeGreaterThan(1);
    // Negative is up on screen: the ball lobs, and sits level at both ends.
    expect(start.y).toBeCloseTo(0);
    expect(end.y).toBeCloseTo(0);
    expect(apex.y).toBeLessThan(-0.5);
    expect(end.spin).toBeGreaterThan(start.spin);
  });

  it('clamps a progress value outside 0..1 rather than flinging the ball', () => {
    expect(cupTitleBallFlight(-3)).toEqual(cupTitleBallFlight(0));
    expect(cupTitleBallFlight(9)).toEqual(cupTitleBallFlight(1));
  });
});

/**
 * Source assertions: MatchScreen is unimportable under the test runner (Skia,
 * Reanimated and Expo audio), which is why the render ring pins its wiring this
 * way — see match-render-hot-path.test.ts.
 */
describe('the card is wired into the live match without skipping any of it', () => {
  it('holds kickoff from the first render, not from an effect', () => {
    const screen = source('src/render/MatchScreen.tsx');

    expect(screen).toContainSource(
      'const [titleCard] = useState(() => cupTitleCard(cupRoundLabel, reduceMotion, t));',
    );
    expect(screen).toContainSource(
      'const [paused, setPaused] = useState(titleCard !== null);',
    );
    expect(screen).toContainSource(
      'const pausedRef = useRef(titleCard !== null);',
    );
    expect(screen).toContainSource(
      "if (titleCard !== null) automaticPauseReasonsRef.current.add('title-card');",
    );
    // Releasing it goes through the one pause path, so a settings overlay or a
    // backgrounded app opened over the card still wins.
    expect(screen).toContainSource(
      "automaticPauseReasonsRef.current.delete('title-card');",
    );
    expect(screen).toContainSource(
      '<CupTitleCard card={titleCard} onDone={dismissTitleCard} />',
    );
  });

  it('pauses the clock rather than dropping the time into the accumulator', () => {
    const screen = source('src/render/MatchScreen.tsx');
    const pauseBranch = screen.slice(
      screen.indexOf('if (pausedRef.current) {'),
      screen.indexOf('// Ledger item 7 — capped catch-up'),
    );

    expect(pauseBranch).toContainSource('last = now;');
    // 'title-card' has to be a real automatic reason or shouldPauseMatch would
    // never see it.
    expect(source('src/render/match-pause.ts')).toContainSource(
      "| 'title-card'",
    );
  });

  it('saves the kickoff whistle until the card clears', () => {
    const screen = source('src/render/MatchScreen.tsx');

    expect(screen).toContainSource(
      'if (titleCardShowing || openingEventsPlayedRef.current) return;',
    );
    expect(screen).toContainSource(
      'for (const e of match.events) playForEvent(e);',
    );
  });

  it('carries the round from the cup bracket to the screen', () => {
    const store = source('src/application/store.ts');
    const app = source('App.tsx');

    expect(store).toContainSource('cupRoundLabel?: NationalCupRoundLabel;');
    expect(store).toContainSource('cupRoundLabel: matchday.cupRoundLabel');
    expect(store).toContainSource(
      '...(cupRoundLabel === undefined ? {} : { cupRoundLabel }),',
    );
    expect(app).toContainSource(
      'cupRoundLabel={store.watchedMatch.cupRoundLabel}',
    );
  });

  it('dresses the card in the pixel bible, not a fresh look', () => {
    const card = source('src/render/CupTitleCard.tsx');

    // The display voice (Silkscreen bold, or the locale's equivalent — the face
    // is resolved per language now, since Silkscreen cannot draw Vietnamese),
    // uppercase; ink canvas, ink-soft face, hero gold accent.
    expect(card).toContainSource('fontFamily: faces.display');
    expect(card).toContainSource("backgroundColor: 'rgba(36, 31, 46, 0.95)'");
    expect(card).toContainSource("backgroundColor: '#3a3350'");
    expect(card).toContainSource("color: '#edb54a'");
    // Chunky ink outline with the heavier bottom lip.
    expect(card).toContainSource('borderWidth: 4');
    expect(card).toContainSource("borderColor: '#241f2e'");
    expect(card).toContainSource('borderBottomWidth: 8');
    expect(card).toContainSource('{card.title}');
    // The ball only mounts when the card asked for it.
    expect(card).toContainSource('{card.showBall ? (');
  });
});
