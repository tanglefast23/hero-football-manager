import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { rivalHeroIntroViewModelForHeroId } from '../../../application/rival-hero-intro';
import { loadLaunchContent } from '../../../content';
import type { RivalHeroIntroHeroId } from '../../../game/rival-hero-intro';
import { useCopy } from '../../../i18n';
import { RivalHeroIntroScreen } from '../../RivalHeroIntroScreen';
import {
  DevHarnessButton,
  devHarnessControlStyles,
} from '../DevHarnessControls';
import type { DevHarnessEntry } from '../registry';

const content = loadLaunchContent();

export const RIVAL_HERO_INTRO_CASES = [
  {
    id: 'barry-allan',
    label: 'Larry',
    heroId: 'special-f171',
    note: 'D5 · Super Speed · tutorial teaser',
  },
  {
    id: 'scott-somers',
    label: 'Scott',
    heroId: 'special-f178',
    note: 'D4 · Thunder Strike',
  },
  {
    id: 'steve-rodgers',
    label: 'Steve',
    heroId: 'special-f174',
    note: 'D3 · Rally Cry',
  },
  {
    id: 'bruno-bannor',
    label: 'Bruno',
    heroId: 'special-f176',
    note: 'D2 · Super Strength',
  },
  {
    id: 'bruce-wain',
    label: 'Bruce',
    heroId: 'special-f168',
    note: 'D1 · Shadow Mark',
  },
] as const;

type RivalHeroIntroCaseId = (typeof RIVAL_HERO_INTRO_CASES)[number]['id'];

function heroIdForCase(caseId: RivalHeroIntroCaseId): RivalHeroIntroHeroId {
  const found = RIVAL_HERO_INTRO_CASES.find(
    (candidate) => candidate.id === caseId,
  );
  if (found === undefined)
    throw new Error(`unknown rival hero intro case ${caseId}`);
  return found.heroId;
}

export function RivalHeroIntroReel({
  caseId,
}: {
  caseId: RivalHeroIntroCaseId;
}) {
  const t = useCopy();
  const insets = useSafeAreaInsets();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [runKey, setRunKey] = useState(0);
  const [finished, setFinished] = useState(false);
  const heroId = heroIdForCase(caseId);
  const viewModel = useMemo(
    () => rivalHeroIntroViewModelForHeroId(heroId, content, t),
    [heroId, t],
  );

  const replay = () => {
    setFinished(false);
    setRunKey((key) => key + 1);
  };

  return (
    <View style={styles.root}>
      <RivalHeroIntroScreen
        key={`${heroId}:${reduceMotion}:${runKey}`}
        viewModel={viewModel}
        reduceMotion={reduceMotion}
        onComplete={() => setFinished(true)}
      />

      {controlsVisible ? (
        <View style={[styles.panel, { paddingBottom: insets.bottom + 12 }]}>
          <View style={devHarnessControlStyles.row}>
            <Text style={devHarnessControlStyles.rowLabel}>MOTION</Text>
            <DevHarnessButton
              label="Full"
              hint="Play the full power-card motion"
              selected={!reduceMotion}
              onPress={() => {
                setReduceMotion(false);
                replay();
              }}
            />
            <DevHarnessButton
              label="Reduced"
              hint="Keep both beats without spatial motion"
              selected={reduceMotion}
              onPress={() => {
                setReduceMotion(true);
                replay();
              }}
            />
            <DevHarnessButton
              label="Replay"
              hint="Restart this rival intro"
              onPress={replay}
            />
            <DevHarnessButton
              label="Hide"
              hint="Hide the review controls"
              onPress={() => setControlsVisible(false)}
            />
          </View>
          <Text style={styles.note}>
            {viewModel.name} ·{' '}
            {RIVAL_HERO_INTRO_CASES.find((entry) => entry.id === caseId)?.note}
            {finished ? ' · FINISHED — REPLAY WHEN READY' : ''}
          </Text>
        </View>
      ) : (
        <View style={[styles.showRow, { paddingBottom: insets.bottom + 12 }]}>
          <DevHarnessButton
            label="QA ▴"
            hint="Show the review controls"
            onPress={() => setControlsVisible(true)}
          />
        </View>
      )}
    </View>
  );
}

export const rivalHeroIntroEntry: DevHarnessEntry = Object.freeze({
  id: 'rival-hero-intro',
  group: 'Match',
  title: 'Division rival intros',
  summary:
    'First-meeting power reveal and taunt for each division-headline hero.',
  cases: Object.freeze(
    RIVAL_HERO_INTRO_CASES.map((entry) =>
      Object.freeze({
        id: entry.id,
        label: entry.label,
        note: entry.note,
      }),
    ),
  ),
  render: (caseId: string) => (
    <RivalHeroIntroReel caseId={caseId as RivalHeroIntroCaseId} />
  ),
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    gap: 7,
    borderTopWidth: 3,
    borderTopColor: '#edb54a',
    backgroundColor: 'rgba(18,16,25,0.94)',
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  showRow: {
    position: 'absolute',
    left: 12,
    bottom: 0,
    zIndex: 30,
  },
  note: {
    color: '#d7cfe4',
    fontSize: 12,
    lineHeight: 17,
  },
});
