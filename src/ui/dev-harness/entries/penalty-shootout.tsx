import { useState } from 'react';
import { Text, View } from 'react-native';
import { penaltyShootoutViewModel } from '../../../application/penalty-shootout';
import type { PlayerDef, TeamDef } from '../../../sim/types';
import { createMatch } from '../../../sim/match';
import {
  penaltyFullTimeFromMatch,
  resolvePenaltyShootout,
} from '../../../game/penalties';
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
    ...Array.from({ length: 10 }, (_, index) => ({
      id: `${id}-${index + 1}`,
      name: `${name} ${index + 1}`,
      role:
        index < 4
          ? ('DEF' as const)
          : index < 8
            ? ('MID' as const)
            : ('FWD' as const),
      attrs: { ...attrs, sho: 85 - index * 4, tec: 78 - index * 3 },
    })),
  ];
  return { id, name, players };
}

const clubTeam = team('halcyra', 'HALCYRA HEROES');
const opponentTeam = team('storm', 'STORM UNITED');
// A synthetic full-time roster exercises the real resolver without playing a fixture.
const match = createMatch(101, clubTeam, opponentTeam);
const penalties = resolvePenaltyShootout(
  23,
  penaltyFullTimeFromMatch({ ...match, phase: 'fulltime' }),
);
const shootout = penaltyShootoutViewModel({
  fixtureId: 'dev-harness-penalty-shootout',
  clubTeam,
  opponentTeam,
  clubIsHome: true,
  penalties,
});

function PenaltyShootoutReel({ reduced }: { readonly reduced: boolean }) {
  const [complete, setComplete] = useState(false);
  if (shootout === null) return null;
  if (complete)
    return (
      <View className="flex-1 items-center justify-center bg-ink">
        <Text className="font-pixel text-base text-white">
          SHOOTOUT COMPLETE
        </Text>
      </View>
    );
  return (
    <PenaltyShootout
      shootout={shootout}
      reduceMotion={reduced}
      onDone={() => setComplete(true)}
    />
  );
}

export const penaltyShootoutEntry: DevHarnessEntry = Object.freeze({
  id: 'penalty-shootout',
  group: 'Cup',
  title: 'Penalty shootout',
  summary: 'The Hero Cup tie-break shown before the settled result.',
  cases: Object.freeze([
    Object.freeze({ id: 'saved-kicks', label: 'Saved kicks' }),
    Object.freeze({ id: 'reduced', label: 'Reduced motion' }),
  ]),
  render: (caseId: string) => (
    <PenaltyShootoutReel key={caseId} reduced={caseId === 'reduced'} />
  ),
});
