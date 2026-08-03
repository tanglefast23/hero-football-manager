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
    expect(source).toContain('<TeamLine name={result.homeTeam} won={result.winner === \'home\'} />');
    expect(source).toContain('<TeamLine name={result.awayTeam} won={result.winner === \'away\'} />');
    expect(source).not.toContain('className="w-24 text-right text-base uppercase text-ink"');
  });

  it('boxes the winner in red and puts WIN on its own row underneath', () => {
    const source = screen();

    expect(source).toContain("? 'border-2 border-stamp px-4 py-2'");
    expect(source).toContain('{won ? (');
    expect(source).toContain('className="mt-2 text-xl uppercase text-stamp">Win<');
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
    expect(source).toContain('{reaction.blameLine}');
  });

  it('reads the whole outburst to a screen reader, not just the picture', () => {
    const source = screen();

    expect(source).toContain('accessibilityLabel={blaming && reaction.blameLine');
    expect(source).toContain('is blaming ${reaction.assistantName}');
    expect(source).toContain('is in tears');
    expect(source).toContain('is celebrating');
  });
});
