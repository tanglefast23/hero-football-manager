import { penaltyShootoutViewModel } from '../../../application/penalty-shootout';
import type { PlayerDef, TeamDef } from '../../../sim/types';
import { PenaltyShootout } from '../../DeferredSkiaSurfaces';
import type { DevHarnessEntry } from '../registry';

const attrs = {
  pac: 60,
  sho: 60,
  pas: 60,
  def: 60,
  tec: 60,
  sta: 60,
  ref: 60,
};

function team(id: string, name: string): TeamDef {
  const players: PlayerDef[] = [
    { id: `${id}-gk`, name: `${name} Keeper`, role: 'GK', attrs },
    ...Array.from({ length: 5 }, (_, index) => ({
      id: `${id}-${index + 1}`,
      name: `${name} ${index + 1}`,
      role: 'FWD' as const,
      attrs: { ...attrs, sho: 85 - index * 4, tec: 78 - index * 3 },
    })),
  ];
  return { id, name, players };
}

const shootout = penaltyShootoutViewModel({
  fixtureId: 'dev-harness-penalty-shootout',
  careerSeed: 23,
  matchSeed: 101,
  round: 4,
  clubTeam: team('halcyra', 'HALCYRA HEROES'),
  opponentTeam: team('storm', 'STORM UNITED'),
  clubIsHome: true,
  winner: 'club',
});

function PenaltyShootoutReel({ reduced }: { readonly reduced: boolean }) {
  if (shootout === null) return null;
  return (
    <PenaltyShootout
      shootout={shootout}
      reduceMotion={reduced}
      onDone={() => undefined}
    />
  );
}

export const penaltyShootoutEntry: DevHarnessEntry = Object.freeze({
  id: 'penalty-shootout',
  group: 'Cup',
  title: 'Penalty shootout',
  summary: 'The Hero Cup tie-break shown before the settled result.',
  cases: Object.freeze([
    Object.freeze({ id: 'club-wins', label: 'Club wins' }),
    Object.freeze({ id: 'reduced', label: 'Reduced motion' }),
  ]),
  render: (caseId: string) => (
    <PenaltyShootoutReel reduced={caseId === 'reduced'} />
  ),
});
