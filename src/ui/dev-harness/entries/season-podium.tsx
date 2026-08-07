import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createCareer, type GameState } from '../../../game';
import { createLaunchCareerSetup } from '../../../application/launch';
import { seasonPodiumViewModel } from '../../../application/season-podium';
import { SeasonPodiumScreen } from '../../screens/SeasonPodiumScreen';
import { DevHarnessButton, devHarnessControlStyles } from '../DevHarnessControls';
import type { DevHarnessEntry } from '../registry';

/**
 * The season podium, as the dev harness shows it.
 *
 * The scene plays for one season in a career and only when that season ends
 * second or third, which is a state a played career reaches after half an hour
 * and cannot be asked to reach again. Jest runs with no DOM, so without this
 * nobody would see the blocks rise, the figures hop or the confetti before a
 * player did.
 *
 * The view model is built by the REAL `seasonPodiumViewModel` from a REAL
 * career — only the results are fabricated, and they are fabricated by rank so
 * the table is exactly the order below. Nothing about the podium is
 * re-implemented here, so a fault seen in the reel is a fault in the game.
 */
export function SeasonPodiumReel({ caseId }: { readonly caseId: 'second' | 'third' }) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const insets = useSafeAreaInsets();
  const viewModel = useMemo(
    () => seasonPodiumViewModel(seasonEndedInPosition(caseId === 'second' ? 2 : 3)),
    [caseId],
  );

  return (
    <View style={styles.root}>
      <SeasonPodiumScreen
        key={`${caseId}:${reduceMotion}:${runKey}`}
        viewModel={viewModel}
        reduceMotion={reduceMotion}
        onComplete={() => setRunKey(current => current + 1)}
      />
      <View style={[styles.panel, { paddingBottom: Math.max(10, insets.bottom) }]}>
        <Text style={styles.note}>{CASE_NOTES[caseId]}</Text>
        <View style={devHarnessControlStyles.row}>
          <DevHarnessButton
            label={reduceMotion ? 'Motion: reduced' : 'Motion: full'}
            hint="Toggle reduced motion: the blocks, the hop and the confetti go static"
            selected={reduceMotion}
            onPress={() => setReduceMotion(current => !current)}
          />
          <DevHarnessButton
            label="Replay"
            hint="Play the ceremony again from the top"
            onPress={() => setRunKey(current => current + 1)}
          />
        </View>
      </View>
    </View>
  );
}

/**
 * A finished season whose table puts the user club exactly where asked.
 *
 * Every fixture is decided by the two clubs' places in the order, so no two
 * clubs can tie and the table is the order. Cached per position: building a
 * career and settling ninety fixtures is not free, and the reel switches cases
 * on a tap.
 */
const cache = new Map<number, GameState>();

function seasonEndedInPosition(position: number): GameState {
  const cached = cache.get(position);
  if (cached !== undefined) return cached;
  const state = createCareer(createLaunchCareerSetup(777));
  const others = state.clubs.map(club => club.id).filter(id => id !== state.userClubId);
  const order = [...others];
  order.splice(position - 1, 0, state.userClubId);
  const rank = new Map(order.map((clubId, index) => [clubId, index]));
  const built: GameState = {
    ...state,
    week: 30,
    phase: 'season-end',
    fixtures: state.fixtures.map(fixture => ({
      ...fixture,
      status: 'played' as const,
      score: rank.get(fixture.homeClubId)! < rank.get(fixture.awayClubId)!
        ? { homeGoals: 2, awayGoals: 0 }
        : { homeGoals: 0, awayGoals: 2 },
    })),
  };
  cache.set(position, built);
  return built;
}

const CASE_NOTES: Readonly<Record<'second' | 'third', string>> = Object.freeze({
  second: 'Finished 2nd · our club on the middle-left block, gold row second in the table',
  third: 'Finished 3rd · our club on the lowest block, at the right of the podium',
});

export const seasonPodiumEntry: DevHarnessEntry = Object.freeze({
  id: 'season-podium',
  group: 'Season',
  title: 'Season podium',
  summary: 'The medal ceremony a second or third place finish plays before the awards.',
  cases: Object.freeze([
    { id: 'second', label: 'Second', note: CASE_NOTES.second },
    { id: 'third', label: 'Third', note: CASE_NOTES.third },
  ]),
  render: (caseId: string) => (
    <SeasonPodiumReel caseId={caseId as 'second' | 'third'} />
  ),
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#241f2e' },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    gap: 6,
    borderTopWidth: 3,
    borderTopColor: '#edb54a',
    backgroundColor: 'rgba(18,16,25,0.94)',
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  note: { color: '#d7cfe4', fontSize: 12, lineHeight: 17 },
});
