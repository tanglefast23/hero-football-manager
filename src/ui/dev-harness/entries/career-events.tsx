import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadLaunchContent } from '../../../content';
import { storyEventViewModel } from '../../../application/view-models';
import {
  selectCareerEventCoach,
  selectCareerEventFacility,
  selectCareerEventPlayer,
  type GameState,
} from '../../../game';
import { StoryEventScreen } from '../../screens/StoryEventScreen';
import {
  DevHarnessButton,
  devHarnessControlStyles,
} from '../DevHarnessControls';
import type { DevHarnessEntry } from '../registry';
import {
  careerEventCaseDefinitions,
  careerEventChanges,
  careerEventsCareer,
  continueStoryEvent,
  eventsForCase,
  offerStoryEvent,
  resolveStoryEventChoice,
  riskSideHint,
  type RiskSide,
} from './career-events-controller';
import { careerEventTargetCandidates } from '../../../application/career-event-targets';

const CONTENT = loadLaunchContent();

/** Visible review surface backed by the exact production target and resolution paths. */
export function CareerEventsReel({
  caseId,
  storeMedia = false,
}: {
  readonly caseId: string;
  readonly storeMedia?: boolean;
}) {
  const events = useMemo(() => eventsForCase(caseId), [caseId]);
  const base = useMemo(careerEventsCareer, []);
  if (events.length === 0)
    throw new Error(`career-events case ${caseId} contains no stories`);

  const [index, setIndex] = useState(0);
  const [riskSide, setRiskSide] = useState<RiskSide>('success');
  const [reduceMotion, setReduceMotion] = useState(storeMedia);
  const [guideVisible, setGuideVisible] = useState(false);
  const [panelVisible, setPanelVisible] = useState(!storeMedia);
  const [runKey, setRunKey] = useState(0);
  const [state, setState] = useState<GameState>(() =>
    offerStoryEvent(base, events[0]!.id),
  );
  const [changes, setChanges] = useState<readonly string[]>([]);
  const [rollNote, setRollNote] = useState('');
  const insets = useSafeAreaInsets();

  const activeEvent = useMemo(
    () =>
      CONTENT.events.events.find(
        (candidate) => candidate.id === state.pendingEvent?.eventId,
      ) ?? events[index]!,
    [events, index, state.pendingEvent?.eventId],
  );

  const open = useCallback(
    (eventId: string) => {
      setState(offerStoryEvent(base, eventId));
      setChanges([]);
      setRollNote('');
      setRunKey((key) => key + 1);
    },
    [base],
  );

  const step = useCallback(
    (delta: number) => {
      const next = (index + delta + events.length) % events.length;
      setIndex(next);
      open(events[next]!.id);
    },
    [events, index, open],
  );

  const choose = useCallback(
    (choiceId: string) => {
      const resolution = resolveStoryEventChoice(
        state,
        activeEvent,
        choiceId,
        riskSide,
      );
      setState(resolution.state);
      setChanges(careerEventChanges(state, resolution.state));
      setRollNote(resolution.note);
    },
    [activeEvent, riskSide, state],
  );

  const advance = useCallback(() => {
    const followUpId = state.pendingEvent?.resolvedNextEventId;
    const next = continueStoryEvent(state);
    if (next.pendingEvent !== undefined) {
      setState(next);
      setChanges([]);
      setRollNote(`Followed the chain into ${next.pendingEvent.eventId}`);
      setRunKey((key) => key + 1);
      return;
    }
    open(activeEvent.id);
    if (followUpId !== undefined)
      setRollNote(`Skipped unavailable follow-up ${followUpId}`);
  }, [activeEvent.id, open, state]);

  const viewModel = useMemo(() => storyEventViewModel(state, CONTENT), [state]);

  return (
    <View style={styles.root}>
      <View style={styles.screen}>
        <StoryEventScreen
          key={`${activeEvent.id}:${reduceMotion}:${runKey}`}
          viewModel={viewModel}
          onChoose={choose}
          onSelectPlayer={(playerId) =>
            setState((current) =>
              selectCareerEventPlayer(
                current,
                playerId,
                careerEventTargetCandidates(current, activeEvent).playerIds,
              ),
            )
          }
          onSelectCoach={(role) =>
            setState((current) => selectCareerEventCoach(current, role))
          }
          onSelectFacility={(buildingId) =>
            setState((current) =>
              selectCareerEventFacility(current, buildingId),
            )
          }
          onContinue={advance}
          onOpenSettings={() => {}}
          reduceMotion={reduceMotion}
          {...(guideVisible
            ? { guideCopy: CONTENT.assistantGuide.m4Fiction.events }
            : {})}
        />
      </View>

      {panelVisible ? (
        <View style={[styles.panel, { paddingBottom: insets.bottom + 12 }]}>
          <View style={devHarnessControlStyles.row}>
            <Text style={devHarnessControlStyles.rowLabel}>STORY</Text>
            <DevHarnessButton
              label="◂"
              hint="Show the previous story in this lane"
              onPress={() => step(-1)}
            />
            <DevHarnessButton
              label="▸"
              hint="Show the next story in this lane"
              onPress={() => step(1)}
            />
            <Text style={styles.countLine}>
              {index + 1} / {events.length}
            </Text>
          </View>

          <View style={devHarnessControlStyles.row}>
            <Text style={devHarnessControlStyles.rowLabel}>ROLL</Text>
            <DevHarnessButton
              label="Success"
              hint="Resolve the risky choice on its real winning roll"
              selected={riskSide === 'success'}
              onPress={() => setRiskSide('success')}
            />
            <DevHarnessButton
              label="Miss"
              hint="Resolve the risky choice on its real losing roll"
              selected={riskSide === 'miss'}
              onPress={() => setRiskSide('miss')}
            />
            <DevHarnessButton
              label="Reset"
              hint="Put this story back to its offer"
              onPress={() => open(activeEvent.id)}
            />
          </View>

          <View style={devHarnessControlStyles.row}>
            <Text style={devHarnessControlStyles.rowLabel}>VIEW</Text>
            <DevHarnessButton
              label="Bert"
              hint="Show the one-off Bert rules panel"
              selected={guideVisible}
              onPress={() => setGuideVisible((visible) => !visible)}
            />
            <DevHarnessButton
              label="Full"
              hint="Play the full outcome reveal"
              selected={!reduceMotion}
              onPress={() => setReduceMotion(false)}
            />
            <DevHarnessButton
              label="Reduced"
              hint="Show the reduced-motion result"
              selected={reduceMotion}
              onPress={() => setReduceMotion(true)}
            />
            <DevHarnessButton
              label="Hide"
              hint="Hide the review controls"
              onPress={() => setPanelVisible(false)}
            />
          </View>

          <Text style={styles.note}>
            {activeEvent.id} · {activeEvent.rarity} {activeEvent.category}
            {activeEvent.trigger.requiresPlayer === true
              ? ' · needs a player'
              : ''}
            {activeEvent.trigger.requiresCoach === true
              ? ' · needs a coach'
              : ''}
            {activeEvent.trigger.requiresFacility !== undefined
              ? ' · needs a facility'
              : ''}
          </Text>
          <Text style={styles.note}>
            {rollNote === '' ? riskSideHint(activeEvent, riskSide) : rollNote}
          </Text>
          {changes.length === 0 ? null : (
            <Text style={styles.stateNote}>STATE: {changes.join(' · ')}</Text>
          )}
        </View>
      ) : storeMedia ? null : (
        <View style={[styles.showRow, { paddingBottom: insets.bottom + 12 }]}>
          <DevHarnessButton
            label="QA ▴"
            hint="Show the review controls"
            onPress={() => setPanelVisible(true)}
          />
        </View>
      )}
    </View>
  );
}

export const careerEventsEntry: DevHarnessEntry = Object.freeze({
  id: 'career-events',
  group: 'Season',
  title: 'Career events',
  summary:
    'All 54 story cards, including player, coach, facility, and two-part interactions.',
  cases: Object.freeze(
    careerEventCaseDefinitions().map((entry) => Object.freeze(entry)),
  ),
  render: (caseId: string) => <CareerEventsReel caseId={caseId} />,
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#241f2e' },
  screen: { flex: 1 },
  panel: {
    gap: 6,
    borderTopWidth: 3,
    borderTopColor: '#edb54a',
    backgroundColor: 'rgba(18,16,25,0.94)',
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  showRow: { position: 'absolute', left: 12, bottom: 0, zIndex: 30 },
  countLine: {
    color: '#9a95a4',
    fontFamily: 'HFMSilkscreen_700Bold',
    fontSize: 9,
  },
  note: { color: '#d7cfe4', fontSize: 11, lineHeight: 15 },
  stateNote: { color: '#edb54a', fontSize: 11, lineHeight: 15 },
});
