import { createMatch, tick } from '../../sim/match';
import { ROVERS, UNITED } from '../../sim/teams';
import type { MatchState } from '../../sim/types';
import {
  advanceMatchVfxShowcase,
  initializeMatchVfxShowcase,
  MATCH_VFX_SHOWCASE_FREEZE_TICKS,
  MATCH_VFX_SHOWCASE_LEAD_TICKS,
  MATCH_VFX_SHOWCASE_SAFETY_TICK,
  matchVfxShowcaseEvent,
  matchVfxShowcaseSeed,
} from '../match-vfx-showcase';
import type { MatchVfxKind } from '../match-vfx';

const kinds: readonly MatchVfxKind[] = [
  'slide-tackle',
  'standing-tackle',
  'hard-shot',
  'save-impact',
  'power-interruption',
];

function run(kind: MatchVfxKind): MatchState {
  const match = createMatch(matchVfxShowcaseSeed(kind), ROVERS, UNITED);
  initializeMatchVfxShowcase(match, kind);
  for (let index = 0; index < 20; index += 1) {
    advanceMatchVfxShowcase(match, kind);
    if (matchVfxShowcaseEvent(match, kind) !== undefined) return match;
  }
  return match;
}

function runToReviewFreeze(kind: MatchVfxKind): MatchState {
  const match = createMatch(matchVfxShowcaseSeed(kind), ROVERS, UNITED);
  initializeMatchVfxShowcase(match, kind);
  while (match.tick < MATCH_VFX_SHOWCASE_SAFETY_TICK) {
    const event = matchVfxShowcaseEvent(match, kind);
    if (
      event !== undefined &&
      match.tick >= event.t + MATCH_VFX_SHOWCASE_FREEZE_TICKS
    )
      return match;
    if (!advanceMatchVfxShowcase(match, kind)) tick(match);
  }
  return match;
}

describe('production-path match VFX showcase fixtures', () => {
  it.each(kinds)('%s emits its intended real match event', (kind) => {
    const match = run(kind);
    const event = matchVfxShowcaseEvent(match, kind);
    expect(event).toBeDefined();
    expect(event?.t).toBe(MATCH_VFX_SHOWCASE_LEAD_TICKS);
  });

  it('uses a real slide launch and a real standing contact', () => {
    expect(
      matchVfxShowcaseEvent(run('slide-tackle'), 'slide-tackle'),
    ).toMatchObject({
      kind: 'SLIDE_STARTED',
      by: 2,
      on: 21,
    });
    expect(
      matchVfxShowcaseEvent(run('standing-tackle'), 'standing-tackle'),
    ).toMatchObject({ kind: 'TACKLE', style: 'standing', contact: true });
  });

  it('reaches real slide contact before the harness review freeze', () => {
    expect(runToReviewFreeze('slide-tackle').events).toContainEqual(
      expect.objectContaining({
        kind: 'TACKLE',
        style: 'slide',
        contact: true,
        by: 2,
        on: 21,
      }),
    );
  });

  it('keeps the safety freeze beyond the intended review frame', () => {
    expect(MATCH_VFX_SHOWCASE_SAFETY_TICK).toBeGreaterThan(
      MATCH_VFX_SHOWCASE_LEAD_TICKS + MATCH_VFX_SHOWCASE_FREEZE_TICKS,
    );
  });

  it('makes the hard-shot fixture clear the exact render threshold', () => {
    const event = matchVfxShowcaseEvent(run('hard-shot'), 'hard-shot');
    expect(event).toMatchObject({ kind: 'SHOT', by: 21 });
    if (event?.kind !== 'SHOT') throw new Error('expected hard shot');
    expect(event.power).toBeGreaterThanOrEqual(55);
  });

  it('interrupts a real winding power through a won tackle', () => {
    const match = run('power-interruption');
    expect(match.events).toContainEqual(
      expect.objectContaining({
        kind: 'TACKLE',
        style: 'standing',
        won: true,
        on: 21,
      }),
    );
    expect(matchVfxShowcaseEvent(match, 'power-interruption')).toMatchObject({
      kind: 'POWER_INTERRUPTED',
      player: 21,
    });
  });
});
