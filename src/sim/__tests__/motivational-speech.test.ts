import {
  createMatch,
  envelopeFrom,
  MAX_SPEECH_BOOST,
  queueInput,
  runReplay,
  tick,
} from '../match';
import { ROVERS, UNITED } from '../teams';
import { HALF_TICKS } from '../geometry';
import type { Attrs, MatchState } from '../types';

const CONTROLLED = { controlledTeam: 0 } as const;
const BOOST = 6;

/** Runs to the first tick of the second half, where the speech is offered. */
function playToHalfTime(state: MatchState): void {
  while (state.half === 1) tick(state);
}

function attrsOf(state: MatchState, index: number): Attrs {
  return state.players[index].def.attrs;
}

describe('motivational speech', () => {
  it('lifts every attribute of the controlled team and nobody else', () => {
    const state = createMatch(42, ROVERS, UNITED, CONTROLLED);
    const homeBefore = { ...attrsOf(state, 0) };
    const awayBefore = { ...attrsOf(state, 11) };
    const benchBefore = state.bench[0].map((def) => ({ ...def.attrs }));

    playToHalfTime(state);
    queueInput(state, {
      tick: state.tick + 1,
      kind: 'MOTIVATIONAL_SPEECH',
      boost: BOOST,
    });
    tick(state);

    expect(attrsOf(state, 0).pac).toBe(homeBefore.pac + BOOST);
    expect(attrsOf(state, 0).sho).toBe(homeBefore.sho + BOOST);
    expect(attrsOf(state, 0).ref).toBe(homeBefore.ref + BOOST);
    expect(attrsOf(state, 11)).toEqual(awayBefore);
    state.bench[0].forEach((def, index) => {
      expect(def.attrs.pac).toBe(benchBefore[index].pac + BOOST);
    });
  });

  it('leaves the caller squad and the recorded opening line-up unboosted', () => {
    const roversPac = ROVERS.players[0].attrs.pac;
    const state = createMatch(42, ROVERS, UNITED, CONTROLLED);
    playToHalfTime(state);
    queueInput(state, {
      tick: state.tick + 1,
      kind: 'MOTIVATIONAL_SPEECH',
      boost: BOOST,
    });
    tick(state);

    // The caller's team definition is shared career data; the envelope's squad
    // is what a replay starts from. A speech may reach neither.
    expect(ROVERS.players[0].attrs.pac).toBe(roversPac);
    expect(envelopeFrom(state).home.players[0].attrs.pac).toBe(roversPac);
  });

  it('replays a match containing a speech byte-identically', () => {
    const state = createMatch(7, ROVERS, UNITED, CONTROLLED);
    playToHalfTime(state);
    queueInput(state, {
      tick: state.tick + 1,
      kind: 'MOTIVATIONAL_SPEECH',
      boost: BOOST,
    });
    while (state.phase !== 'fulltime') tick(state);

    const replayed = runReplay(envelopeFrom(state));
    expect(replayed.score).toEqual(state.score);
    expect(replayed.events).toEqual(state.events);
  });

  it('changes the second half it is given', () => {
    const withSpeech = createMatch(7, ROVERS, UNITED, CONTROLLED);
    playToHalfTime(withSpeech);
    queueInput(withSpeech, {
      tick: withSpeech.tick + 1,
      kind: 'MOTIVATIONAL_SPEECH',
      boost: MAX_SPEECH_BOOST,
    });
    while (withSpeech.phase !== 'fulltime') tick(withSpeech);

    const without = createMatch(7, ROVERS, UNITED, CONTROLLED);
    while (without.phase !== 'fulltime') tick(without);

    // Same seed, same first half, different second half — a speech that changed
    // nothing would make every other assertion here vacuous.
    expect(withSpeech.events.filter((event) => event.t <= HALF_TICKS)).toEqual(
      without.events.filter((event) => event.t <= HALF_TICKS),
    );
    expect(withSpeech.events).not.toEqual(without.events);
  });

  it('refuses a second speech, an out-of-range boost, and an uncontrolled team', () => {
    const state = createMatch(42, ROVERS, UNITED, CONTROLLED);
    playToHalfTime(state);
    const speech = {
      tick: state.tick + 1,
      kind: 'MOTIVATIONAL_SPEECH',
      boost: BOOST,
    } as const;
    queueInput(state, speech);
    expect(() =>
      queueInput(state, { ...speech, tick: state.tick + 2 }),
    ).toThrow(/already had its motivational speech/);

    const fresh = createMatch(42, ROVERS, UNITED, CONTROLLED);
    expect(() =>
      queueInput(fresh, { ...speech, tick: 1, boost: MAX_SPEECH_BOOST + 1 }),
    ).toThrow(/boost must be an integer/);
    expect(() => queueInput(fresh, { ...speech, tick: 1, boost: 0 })).toThrow(
      /boost must be an integer/,
    );

    const uncontrolled = createMatch(42, ROVERS, UNITED);
    expect(() => queueInput(uncontrolled, { ...speech, tick: 1 })).toThrow(
      /controlled team/,
    );

    // A first-half speech is not a thing the app can produce; a hand-edited
    // replay is, and it would lift the squad for the whole match.
    const firstHalf = createMatch(42, ROVERS, UNITED, CONTROLLED);
    expect(() => queueInput(firstHalf, { ...speech, tick: 1 })).toThrow(
      /given at half time/,
    );
  });
});
