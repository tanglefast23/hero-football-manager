import { readFileSync } from 'fs';
import { join } from 'path';

const screen = () => readFileSync(
  join(process.cwd(), 'src/ui/screens/PostMatchLedgerScreen.tsx'),
  'utf8',
);

describe('full-time report layout', () => {
  it('gives each club its own row instead of a 24-point column', () => {
    const source = screen();

    // Side by side, the names were cut to "BRAMB LE RO_" on a phone. Stacked,
    // both spell out, and the score sits between them.
    expect(source).toContain("outcome={result.winner === 'home' && result.outcomeLabel !== 'DRAW'");
    expect(source).toContain("outcome={result.winner === 'away' && result.outcomeLabel !== 'DRAW'");
    expect(source).not.toContain('className="w-24 text-right text-base uppercase text-ink"');
  });

  it('states our result in green or red without boxing either club', () => {
    const source = screen();

    expect(source).not.toContain('border-stamp');
    expect(source).toContain("outcome === 'WIN'");
    expect(source).toContain("? 'We Won!' : 'We Lost'");
    expect(source).toContain('text-pitch-ink');
    expect(source).toContain('text-red-dark');
    // A drawn match boxes nobody, so it still has to say so somewhere.
    expect(source).toContain('{result.winner === null ? (');
    expect(source).toContain('>Draw<');
  });

  it('puts the touchline reaction below the result, not beside it', () => {
    const source = screen();

    expect(source).toContain('{viewModel.reaction ? (');
    expect(source).toContain('<FulltimeReaction reaction={viewModel.reaction}');
    expect(source).toContain('coach:${reaction.coachPortraitId}:${reaction.pose}');
    // The assistant stands on the side the pointing arm comes out of, and only
    // ever in his resting face — he is being blamed, not joining in.
    expect(source).toContain('coach:${reaction.assistantPortraitId}:rest');
  });

  it('gives the gaffer the verdict instead of printing one over his head', () => {
    const source = screen();

    // The written headline is gone: the score states the fact and he says what
    // it meant. Two voices saying the same thing gave the silent one top
    // billing, and the manager read the caption rather than the man.
    expect(source).not.toContain('result.headline');
    // The bubble is no longer gated on the blame roll — it renders every week.
    expect(source).not.toContain('{blaming && reaction.blameLine ? (');
    expect(source).toContain('{reaction.line}');
  });

  it('reads the whole line to a screen reader, not just the picture', () => {
    const source = screen();

    expect(source).toContain('accessibilityLabel={`${mood}. "${reaction.line}"`}');
    expect(source).toContain('is blaming ${reaction.assistantName}');
    expect(source).toContain('is in tears');
    expect(source).toContain('is celebrating');
  });
});
