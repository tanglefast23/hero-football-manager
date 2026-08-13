import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { playerFacingErrorText } from '../store';

/**
 * The red banner shows engine text, and the engine writes for two audiences.
 *
 * A manager once read `unavailable player bramble-rovers-created-player must
 * be replaced in the lineup` — an invariant failure, verbatim, with an internal
 * id in it. Sentence punctuation is now the marker: a refusal written for the
 * manager ends in one, a note to a programmer does not.
 */

function engineFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') engineFiles(path, found);
    } else if (path.endsWith('.ts')) {
      found.push(path);
    }
  }
  return found;
}

function thrownMessages(): string[] {
  const messages = new Set<string>();
  for (const file of [
    ...engineFiles('src/game'),
    ...engineFiles('src/sim'),
  ]) {
    const source = readFileSync(file, 'utf8');
    const pattern = /throw new Error\(\s*([`'"])((?:\\.|(?!\1)[\s\S])*?)\1/g;
    let match = pattern.exec(source);
    while (match !== null) {
      messages.add(match[2].replace(/\s+/g, ' ').trim());
      match = pattern.exec(source);
    }
  }
  return [...messages];
}

describe('player-facing error text', () => {
  it('replaces an engine fragment with copy and keeps the raw text off screen', () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const raw = 'unavailable player bramble-rovers-created-player must be replaced in the lineup';

    const shown = playerFacingErrorText(raw);

    expect(shown).not.toContain('bramble-rovers-created-player');
    expect(shown).toBe('That did not work. Nothing has changed — try again.');
    expect(error).toHaveBeenCalledWith(`[engine] ${raw}`);
    error.mockRestore();
  });

  it('passes a refusal written for the manager through untouched', () => {
    expect(playerFacingErrorText('The replacement must come from the bench.')).toBe(
      'The replacement must come from the bench.',
    );
    expect(playerFacingErrorText('Nora Vale is injured and cannot train.')).toBe(
      'Nora Vale is injured and cannot train.',
    );
  });

  it('leaves no engine message that reads like prose but lacks the full stop', () => {
    // The trap this rule can fall into: someone writes a real refusal, forgets
    // the period, and the manager silently gets the apology instead. A message
    // that names a player or a club is prose; make it end like prose.
    const suspects = thrownMessages().filter(
      (message) =>
        /\$\{[a-zA-Z]+(\.name|Name)\}/.test(message) && !/[.!?]$/.test(message),
    );
    expect(suspects).toEqual([]);
  });
});
