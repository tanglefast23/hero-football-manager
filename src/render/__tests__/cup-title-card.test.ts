import { readFileSync } from 'fs';
import { join } from 'path';
import {
  CUP_TITLE_CARD_MS,
  CUP_TITLE_CARD_REDUCED_MOTION_MS,
  CUP_TITLE_CARD_TITLE,
  cupTitleBallFlight,
  cupTitleCard,
  type CupRoundLabel,
} from '../cup-title-card';

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

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('the Global Cup title card', () => {
  it('opens a cup tie under the competition name and its round', () => {
    const card = cupTitleCard('Quarter-final', false);

    expect(CUP_TITLE_CARD_TITLE).toBe('GLOBAL CUP');
    expect(card).not.toBeNull();
    expect(card!.title).toBe('GLOBAL CUP');
    expect(card!.roundLabel).toBe('QUARTER-FINAL');
  });

  it.each(Object.entries(ROUND_DISPLAY))('names round %s on the card', (round, display) => {
    expect(cupTitleCard(round as CupRoundLabel, false)!.roundLabel).toBe(display);
  });

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
    expect(cupTitleCard('Semi-final', false)!.accessibilityLabel).toBe('Global Cup. Semi-final.');
  });

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

    expect(screen).toContain('const [titleCard] = useState(() => cupTitleCard(cupRoundLabel, reduceMotion));');
    expect(screen).toContain('const [paused, setPaused] = useState(titleCard !== null);');
    expect(screen).toContain('const pausedRef = useRef(titleCard !== null);');
    expect(screen).toContain("if (titleCard !== null) automaticPauseReasonsRef.current.add('title-card');");
    // Releasing it goes through the one pause path, so a settings overlay or a
    // backgrounded app opened over the card still wins.
    expect(screen).toContain("automaticPauseReasonsRef.current.delete('title-card');");
    expect(screen).toContain('<CupTitleCard card={titleCard} onDone={dismissTitleCard} />');
  });

  it('pauses the clock rather than dropping the time into the accumulator', () => {
    const screen = source('src/render/MatchScreen.tsx');
    const pauseBranch = screen.slice(
      screen.indexOf('if (pausedRef.current) {'),
      screen.indexOf('// Ledger item 7 — capped catch-up'),
    );

    expect(pauseBranch).toContain('last = now;');
    // 'title-card' has to be a real automatic reason or shouldPauseMatch would
    // never see it.
    expect(source('src/render/match-pause.ts')).toContain("| 'title-card'");
  });

  it('saves the kickoff whistle until the card clears', () => {
    const screen = source('src/render/MatchScreen.tsx');

    expect(screen).toContain('if (titleCardShowing || openingEventsPlayedRef.current) return;');
    expect(screen).toContain('for (const e of match.events) playForEvent(e);');
  });

  it('carries the round from the cup bracket to the screen', () => {
    const store = source('src/application/store.ts');
    const app = source('App.tsx');

    expect(store).toContain('cupRoundLabel?: NationalCupRoundLabel;');
    expect(store).toContain('cupRoundLabel: matchday.cupRoundLabel');
    expect(store).toContain('...(cupRoundLabel === undefined ? {} : { cupRoundLabel }),');
    expect(app).toContain('cupRoundLabel={store.watchedMatch.cupRoundLabel}');
  });

  it('dresses the card in the pixel bible, not a fresh look', () => {
    const card = source('src/render/CupTitleCard.tsx');

    // Silkscreen bold, uppercase; ink canvas, ink-soft face, hero gold accent.
    expect(card).toContain("fontFamily: 'Silkscreen_700Bold'");
    expect(card).toContain("backgroundColor: 'rgba(36, 31, 46, 0.95)'");
    expect(card).toContain("backgroundColor: '#3a3350'");
    expect(card).toContain("color: '#edb54a'");
    // Chunky ink outline with the heavier bottom lip.
    expect(card).toContain('borderWidth: 4');
    expect(card).toContain("borderColor: '#241f2e'");
    expect(card).toContain('borderBottomWidth: 8');
    expect(card).toContain('{card.title}');
    // The ball only mounts when the card asked for it.
    expect(card).toContain('{card.showBall ? (');
  });
});
