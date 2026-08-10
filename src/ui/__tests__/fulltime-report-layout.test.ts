import { readFileSync } from 'fs';
import { join } from 'path';

const screen = () =>
  readFileSync(
    join(process.cwd(), 'src/ui/screens/PostMatchLedgerScreen.tsx'),
    'utf8',
  );

describe('full-time report layout', () => {
  it('gives each club its own row instead of a 24-point column', () => {
    const source = screen();

    // Side by side, the names were cut to "BRAMB LE RO_" on a phone. Stacked,
    // both spell out, and the score sits between them.
    expect(source).toContainSource(
      "outcome={result.winner === 'home' && result.outcomeLabel !== 'DRAW'",
    );
    expect(source).toContainSource(
      "outcome={result.winner === 'away' && result.outcomeLabel !== 'DRAW'",
    );
    expect(source).not.toContainSource(
      'className="w-24 text-right text-base uppercase text-ink"',
    );
  });

  it('states our result in green or red without boxing either club', () => {
    const source = screen();

    expect(source).not.toContainSource('border-stamp');
    expect(source).toContainSource("outcome === 'WIN'");
    expect(source).toContainSource(
      "t('postMatchLedger.weWon') : t('postMatchLedger.weLost')",
    );
    expect(source).toContainSource('text-pitch-ink');
    expect(source).toContainSource('text-red-dark');
    // A drawn match boxes nobody, so it still has to say so somewhere.
    expect(source).toContainSource('{result.winner === null ? (');
    expect(source).toContainSource(">{t('postMatchLedger.draw')}<");
  });

  it('puts the touchline reaction below the result, not beside it', () => {
    const source = screen();

    expect(source).toContainSource(
      '{viewModel.reaction || viewModel.rivalMockery ? (',
    );
    expect(source).toContainSource(
      '<FulltimeReaction reaction={viewModel.reaction}',
    );
    expect(source).toContainSource(
      'coach:${reaction.coachPortraitId}:${reaction.pose}',
    );
    // The assistant stands on the side the pointing arm comes out of, and only
    // ever in his resting face — he is being blamed, not joining in.
    expect(source).toContainSource(
      'coach:${reaction.assistantPortraitId}:rest',
    );
  });

  it('gives the gaffer the verdict instead of printing one over his head', () => {
    const source = screen();

    // The written headline is gone: the score states the fact and he says what
    // it meant. Two voices saying the same thing gave the silent one top
    // billing, and the manager read the caption rather than the man.
    expect(source).not.toContainSource('result.headline');
    // The bubble is no longer gated on the blame roll — it renders every week.
    expect(source).not.toContainSource('{blaming && reaction.blameLine ? (');
    expect(source).toContainSource('{reaction.line}');
  });

  it('reads the whole line to a screen reader, not just the picture', () => {
    const source = screen();

    // Mood and line both reach the label through the catalog now; the four
    // moods still have to be named, so each key is asserted by name.
    expect(source).toContainSource(
      "accessibilityLabel={t('postMatchLedger.a11y.coachReaction', { mood, line: reaction.line })}",
    );
    expect(source).toContainSource("t('postMatchLedger.a11y.coachIsBlaming'");
    expect(source).toContainSource('assistant: reaction.assistantName');
    expect(source).toContainSource("t('postMatchLedger.a11y.coachIsInTears'");
    expect(source).toContainSource(
      "t('postMatchLedger.a11y.coachIsCelebrating'",
    );
  });

  it('plays the rival laugh on arrival, not again when leaving the report', () => {
    const source = screen();

    expect(source.match(/playRivalHeroLaugh\(mockery\.heroId\)/g)).toHaveLength(
      1,
    );
    expect(source).toContainSource('pressSfx="click"');
  });
});
