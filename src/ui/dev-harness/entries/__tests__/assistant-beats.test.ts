import { readFileSync } from 'fs';
import { join } from 'path';
import assistantGuide from '../../../../../content/assistant-guide.json';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

/**
 * `assistant-beats.tsx` imports react-native, which throws under Jest's node
 * environment, so the entry cannot be imported here. Both things worth checking
 * are visible in its source anyway, and both are silent failures on screen:
 *
 * - a sequence that belongs to no group is simply unreachable, and the reel
 *   looks complete while hiding one of the twenty-six;
 * - the list of sequences with an authored expression run is mirrored from a
 *   private map in `bert-beat-moments.ts`, and the reel PRINTS that fact, so
 *   drift would make it state the opposite of the truth.
 */
const entry = read('src/ui/dev-harness/entries/assistant-beats.tsx');
const moments = read('src/ui/bert-beat-moments.ts');

function quoted(block: string): string[] {
  return [...block.matchAll(/'([a-z-]+)'/g)].map(match => match[1]);
}

function groupedSequenceIds(): string[] {
  return [...entry.matchAll(/sequenceIds: \[([\s\S]*?)\]/g)].flatMap(match => quoted(match[1]));
}

function mirroredAuthoredIds(): string[] {
  const block = /const AUTHORED_EXPRESSION_RUNS[^[]*\[([\s\S]*?)\]\);/.exec(entry);
  if (block === null) throw new Error('assistant-beats.tsx no longer declares AUTHORED_EXPRESSION_RUNS');
  return quoted(block[1]);
}

function realAuthoredIds(): string[] {
  const block = /const AUTHORED: Record<string, readonly BertMomentId\[\]> = \{([\s\S]*?)\n\};/.exec(moments);
  if (block === null) throw new Error('bert-beat-moments.ts no longer declares AUTHORED');
  return [...block[1].matchAll(/^\s*'([a-z-]+)':/gm)].map(match => match[1]);
}

describe("the reel of Bert's briefings", () => {
  const grouped = groupedSequenceIds();
  const authored = assistantGuide.sequences.map(sequence => sequence.id);

  it('reaches every sequence the content ships', () => {
    expect([...grouped].sort()).toEqual([...authored].sort());
  });

  it('files each sequence under exactly one group', () => {
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it('has a chip label for every sequence it can play', () => {
    const labels = /const SEQUENCE_LABELS[^{]*\{([\s\S]*?)\n\}\);/.exec(entry);
    expect(labels).not.toBeNull();
    for (const id of grouped) expect(labels![1]).toContain(`'${id}':`);
  });

  /**
   * The reel tells a reviewer whether the faces they are watching were chosen
   * for these lines or handed out by the fallback run. That claim is only worth
   * anything while the mirrored list matches the real map.
   */
  it('mirrors the authored expression runs exactly', () => {
    expect([...mirroredAuthoredIds()].sort()).toEqual([...realAuthoredIds()].sort());
  });

  /**
   * Every sequence now has an authored run.
   *
   * The eight that used to be here were the ones where Bert breaks something to
   * you — an injury, a loan, a transfer request, a retirement, the board's
   * deadline — and they were the ones on the fallback, so all seven single-page
   * ones were delivered with `explaining`, the face for walking you through the
   * scouting screen. Everything that had been authored was a tutorial.
   *
   * The reel keeps the fallback machinery: it still labels a sequence as
   * unauthored if one ever appears again, and this asserts none does today.
   */
  it('leaves no sequence on the fallback run', () => {
    const fallback = authored.filter(id => !mirroredAuthoredIds().includes(id));

    expect(fallback).toEqual([]);
  });

  /**
   * `cases` is read while the module is still evaluating, so anything it reads
   * has to be initialised before it. A `const` below the entry is still in its
   * temporal dead zone there, and the only symptom is a blank bundle.
   */
  it('declares its groups above the entry that reads them', () => {
    expect(entry.indexOf('const BEAT_GROUPS')).toBeLessThan(
      entry.indexOf('export const assistantBeatsEntry'),
    );
  });

  /** The harness adds no audio: the management SFX table is index-addressed. */
  it('plays no sound of its own', () => {
    expect(entry).not.toContain('SfxPressable');
    expect(entry).not.toContain('playManagement');
  });
});
