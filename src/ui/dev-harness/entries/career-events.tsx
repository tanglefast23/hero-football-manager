import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadLaunchContent, type LaunchContent } from '../../../content';
import { storyEventViewModel } from '../../../application/view-models';
import {
  sessionAttributeDelta,
} from '../../../game';
import {
  CAREER_MILESTONES,
  applyCareerEventOutcome,
  applyCoachEventEffect,
  applyFacilityEventEffect,
  dismissCareerEvent,
  offerCareerEvent,
  selectCareerEventCoach,
  selectCareerEventFacility,
  selectCareerEventPlayer,
} from '../../../game/career-events';
import { chooseWeightedOutcome, deterministicCareerEventRoll } from '../../../game/event-clock';
import type { FacilityType, PlacedFacility } from '../../../game/facilities';
import type { GameState } from '../../../game/types';
import { StoryEventScreen } from '../../screens/StoryEventScreen';
import { DevHarnessButton, devHarnessControlStyles } from '../DevHarnessControls';
import { devHarnessCareerAtWeek } from '../career';
import type { DevHarnessEntry } from '../registry';

type StoryEvent = LaunchContent['events']['events'][number];
type StoryEventChoice = StoryEvent['choices'][number];
export type RiskSide = 'success' | 'miss';

const CONTENT = loadLaunchContent();
const BASE_SEASON = 1;
const BASE_WEEK = 12;
const RISK_SEARCH_LIMIT = 512;

const FOLLOW_UP_IDS = new Set(
  CONTENT.events.events.flatMap(event => event.choices.flatMap(choice => (
    choice.outcomes.flatMap(outcome => outcome.nextEventId === undefined ? [] : [outcome.nextEventId])
  ))),
);
const TWO_PART_IDS = new Set(
  CONTENT.events.events.flatMap(event => {
    const nextIds = event.choices.flatMap(choice => (
      choice.outcomes.flatMap(outcome => outcome.nextEventId === undefined ? [] : [outcome.nextEventId])
    ));
    return nextIds.length === 0 ? [] : [event.id, ...nextIds];
  }),
);

/**
 * A real seeded career, plus review-only staff/buildings so every authored story
 * has the target it requires. This never touches production state or balance.
 */
export function careerEventsCareer(): GameState {
  const base = devHarnessCareerAtWeek(BASE_SEASON, BASE_WEEK);
  const market = base.market;
  if (market === undefined) throw new Error('career-events harness requires the career market');

  const candidates = market.coachCandidates;
  const headCoach = market.headCoach ?? candidates[0];
  const assistantCoach = market.assistantCoach
    ?? candidates.find(candidate => candidate.id !== headCoach?.id)
    ?? candidates[1];
  if (headCoach === undefined || assistantCoach === undefined) {
    throw new Error('career-events harness requires two coach candidates');
  }

  return {
    ...base,
    market: { ...market, headCoach, assistantCoach },
    facilities: {
      ...base.facilities,
      trainingGroundBuilt: true,
      grid: {
        width: 8,
        height: 6,
        nextBuildingId: 10,
        buildings: REVIEW_BUILDINGS,
        discoveredAdjacencies: [],
      },
    },
  };
}

const REVIEW_BUILDINGS: readonly PlacedFacility[] = [
  reviewBuilding('story-training-pitch', 'training-pitch', 0, 0),
  reviewBuilding('story-gym', 'gym', 2, 0),
  reviewBuilding('story-tech-center', 'tech-center', 3, 0),
  reviewBuilding('story-shooting-range', 'shooting-range', 4, 0),
  reviewBuilding('story-keeper-court', 'keeper-court', 5, 0),
  reviewBuilding('story-dorm', 'dorm', 6, 0),
  reviewBuilding('story-youth-field', 'youth-field', 6, 1),
  reviewBuilding('story-fan-shop', 'fan-shop', 2, 1),
  reviewBuilding('story-stadium-stand', 'stadium-stand', 0, 2),
];

function reviewBuilding(id: string, type: FacilityType, x: number, y: number): PlacedFacility {
  return { id, type, level: 2, capitalInvested: 10_000, x, y };
}

export function careerEventsForCase(caseId: string): readonly StoryEvent[] {
  if (caseId === 'all') return CONTENT.events.events;
  if (caseId === 'two-part') return CONTENT.events.events.filter(event => TWO_PART_IDS.has(event.id));
  return CONTENT.events.events.filter(event => event.category === caseId);
}

export function CareerEventsReel({ caseId }: { readonly caseId: string }) {
  const events = useMemo(() => careerEventsForCase(caseId), [caseId]);
  const base = useMemo(careerEventsCareer, []);
  if (events.length === 0) throw new Error(`career-events harness case ${caseId} has no stories`);

  const [index, setIndex] = useState(0);
  const [riskSide, setRiskSide] = useState<RiskSide>('success');
  const [reduceMotion, setReduceMotion] = useState(false);
  const [guideVisible, setGuideVisible] = useState(false);
  const [panelVisible, setPanelVisible] = useState(true);
  const [runKey, setRunKey] = useState(0);
  const insets = useSafeAreaInsets();

  const [state, setState] = useState<GameState>(() => offerStoryEvent(base, events[0]!.id));
  const [changes, setChanges] = useState<readonly string[]>([]);
  const [rollNote, setRollNote] = useState('');

  const activeEvent = useMemo(() => (
    CONTENT.events.events.find(candidate => candidate.id === state.pendingEvent?.eventId)
      ?? events[index]!
  ), [events, index, state.pendingEvent?.eventId]);

  const open = useCallback((eventId: string) => {
    setState(offerStoryEvent(base, eventId));
    setChanges([]);
    setRollNote('');
    setRunKey(key => key + 1);
  }, [base]);

  const step = useCallback((delta: number) => {
    const next = (index + delta + events.length) % events.length;
    setIndex(next);
    open(events[next]!.id);
  }, [events, index, open]);

  const choose = useCallback((choiceId: string) => {
    if (activeEvent.trigger.requiresCoach === true && state.pendingEvent?.selectedCoachRole === undefined) {
      setRollNote('Choose the coach below before resolving this story.');
      return;
    }
    if (activeEvent.trigger.requiresFacility !== undefined && state.pendingEvent?.selectedFacilityId === undefined) {
      setRollNote('Choose the building below before resolving this story.');
      return;
    }
    const resolution = resolveStoryEventChoice(state, activeEvent, choiceId, riskSide);
    setState(resolution.state);
    setChanges(careerEventChanges(state, resolution.state));
    setRollNote(resolution.note);
  }, [activeEvent, riskSide, state]);

  const selectPlayer = useCallback((playerId: string) => {
    setState(current => selectCareerEventPlayer(current, playerId));
  }, []);
  const selectCoach = useCallback((role: 'HEAD' | 'ASSISTANT') => {
    setState(current => selectCareerEventCoach(current, role));
  }, []);
  const selectFacility = useCallback((buildingId: string) => {
    setState(current => selectCareerEventFacility(current, buildingId));
  }, []);

  /** Follow a real part-two link and carry the person/building chosen in part one. */
  const advance = useCallback(() => {
    const pending = state.pendingEvent;
    const followUpId = pending?.resolvedNextEventId;
    const followUp = CONTENT.events.events.find(candidate => candidate.id === followUpId);
    if (followUp !== undefined && pending !== undefined) {
      const dismissed = dismissCareerEvent(state, activeEvent.trigger.repeatable !== true);
      if (!dismissed.resolvedEventIds.includes(followUp.id)) {
        setState(offerCareerEvent(dismissed, followUp.id, {
          ...(pending.selectedPlayerId === undefined ? {} : { playerId: pending.selectedPlayerId }),
          ...(pending.selectedCoachRole === undefined ? {} : { coachRole: pending.selectedCoachRole }),
          ...(pending.selectedFacilityId === undefined ? {} : { facilityId: pending.selectedFacilityId }),
        }));
        setChanges([]);
        setRollNote(`Part two: ${followUp.id} · target carried from part one`);
        setRunKey(key => key + 1);
        return;
      }
    }
    open(activeEvent.id);
  }, [activeEvent, open, state]);

  const viewModel = useMemo(() => storyEventViewModel(state, CONTENT), [state]);
  const chapterLabel = chapterFor(activeEvent);

  return (
    <View style={styles.root}>
      <View style={styles.screen}>
        <StoryEventScreen
          key={`${activeEvent.id}:${reduceMotion}:${runKey}`}
          viewModel={viewModel}
          onChoose={choose}
          onSelectPlayer={selectPlayer}
          onContinue={advance}
          onOpenSettings={() => {}}
          reduceMotion={reduceMotion}
          {...(guideVisible ? { guideCopy: CONTENT.assistantGuide.m4Fiction.events } : {})}
        />
      </View>

      {panelVisible ? (
        <View style={[styles.panel, { paddingBottom: insets.bottom + 12 }]}>
          <View style={devHarnessControlStyles.row}>
            <Text style={devHarnessControlStyles.rowLabel}>STORY</Text>
            <DevHarnessButton label="◂" hint="Previous story" onPress={() => step(-1)} />
            <DevHarnessButton label="▸" hint="Next story" onPress={() => step(1)} />
            <Text style={styles.countLine}>{index + 1} / {events.length}</Text>
          </View>

          {viewModel.coachChoices.length === 0 ? null : (
            <View style={devHarnessControlStyles.row}>
              <Text style={devHarnessControlStyles.rowLabel}>COACH</Text>
              {viewModel.coachChoices.map(coach => (
                <DevHarnessButton
                  key={coach.role}
                  label={`${coach.roleLabel} · ${coach.name}`}
                  hint={`Choose ${coach.name} for this story`}
                  selected={viewModel.selectedCoach?.role === coach.role}
                  onPress={() => selectCoach(coach.role)}
                />
              ))}
            </View>
          )}

          {viewModel.facilityChoices.length === 0 ? null : (
            <View style={devHarnessControlStyles.row}>
              <Text style={devHarnessControlStyles.rowLabel}>BUILD</Text>
              {viewModel.facilityChoices.map(facility => (
                <DevHarnessButton
                  key={facility.buildingId}
                  label={facility.name}
                  hint={`Choose ${facility.name} for this story`}
                  selected={viewModel.selectedFacility?.buildingId === facility.buildingId}
                  onPress={() => selectFacility(facility.buildingId)}
                />
              ))}
            </View>
          )}

          <View style={devHarnessControlStyles.row}>
            <Text style={devHarnessControlStyles.rowLabel}>ROLL</Text>
            <DevHarnessButton label="Success" hint="Force a real success-side roll" selected={riskSide === 'success'} onPress={() => setRiskSide('success')} />
            <DevHarnessButton label="Miss" hint="Force a real setback-side roll" selected={riskSide === 'miss'} onPress={() => setRiskSide('miss')} />
            <DevHarnessButton label="Reset" hint="Reset this story" onPress={() => open(activeEvent.id)} />
          </View>

          <View style={devHarnessControlStyles.row}>
            <Text style={devHarnessControlStyles.rowLabel}>VIEW</Text>
            <DevHarnessButton label="Bert" hint="Toggle first-story guide" selected={guideVisible} onPress={() => setGuideVisible(value => !value)} />
            <DevHarnessButton label="Full" hint="Full motion" selected={!reduceMotion} onPress={() => setReduceMotion(false)} />
            <DevHarnessButton label="Reduced" hint="Reduced motion" selected={reduceMotion} onPress={() => setReduceMotion(true)} />
            <DevHarnessButton label="Hide" hint="Hide review controls" onPress={() => setPanelVisible(false)} />
          </View>

          <Text style={styles.note}>
            {activeEvent.id} · {activeEvent.rarity} {activeEvent.category}
            {chapterLabel === '' ? '' : ` · ${chapterLabel}`}
            {activeEvent.trigger.requiresPlayer === true ? ' · choose player on card' : ''}
            {activeEvent.trigger.requiresCoach === true ? ' · choose coach below' : ''}
            {activeEvent.trigger.requiresFacility !== undefined ? ' · choose building below' : ''}
          </Text>
          <Text style={styles.note}>{rollNote === '' ? riskSideHint(activeEvent, riskSide) : rollNote}</Text>
          {changes.length === 0 ? null : <Text style={styles.stateNote}>STATE: {changes.join(' · ')}</Text>}
        </View>
      ) : (
        <View style={[styles.showRow, { paddingBottom: insets.bottom + 12 }]}>
          <DevHarnessButton label="QA ▴" hint="Show review controls" onPress={() => setPanelVisible(true)} />
        </View>
      )}
    </View>
  );
}

function chapterFor(event: StoryEvent): string {
  const startsChain = event.choices.some(choice => choice.outcomes.some(outcome => outcome.nextEventId !== undefined));
  if (startsChain) return 'PART 1';
  return FOLLOW_UP_IDS.has(event.id) ? 'PART 2' : '';
}

export function offerStoryEvent(base: GameState, eventId: string): GameState {
  const settled = CAREER_MILESTONES.map(milestone => milestone.eventId).filter(candidate => candidate !== eventId);
  const resolvedEventIds = [...new Set([...base.resolvedEventIds, ...settled])].filter(candidate => candidate !== eventId);
  return offerCareerEvent({ ...base, resolvedEventIds }, eventId);
}

export interface StoryEventResolution {
  readonly state: GameState;
  readonly note: string;
}

/** Mirrors the production resolver, while letting QA choose which risky side to inspect. */
export function resolveStoryEventChoice(
  state: GameState,
  event: StoryEvent,
  choiceId: string,
  side: RiskSide,
): StoryEventResolution {
  const choice = event.choices.find(candidate => candidate.id === choiceId);
  if (choice === undefined) throw new Error(`unknown event choice ${choiceId}`);

  const weights = choice.outcomes.map(outcome => outcome.weight);
  const wantedIndex = choice.risky && side === 'miss' ? 1 : 0;
  const riskyChoices = riskyChoicesForOutcome(state, choiceId, weights, wantedIndex);
  if (riskyChoices === undefined) {
    return { state, note: `No real roll in ${RISK_SEARCH_LIMIT} histories lands this ${side} outcome` };
  }

  const rolled = { ...state, eventClock: { ...state.eventClock, riskyChoices } };
  const outcomeIndex = chooseWeightedOutcome(weights, storyEventRoll(rolled, choiceId, weights));
  const outcome = choice.outcomes[outcomeIndex];
  if (outcome === undefined) throw new Error('the event outcome did not resolve');
  const working = choice.risky
    ? { ...rolled, eventClock: { ...rolled.eventClock, riskyChoices: riskyChoices + 1 } }
    : rolled;

  const playerId = state.pendingEvent?.selectedPlayerId;
  const coachRole = state.pendingEvent?.selectedCoachRole;
  const facilityId = state.pendingEvent?.selectedFacilityId;
  const morale = outcome.effects.find(effect => effect.type === 'morale');
  const squadMorale = outcome.effects.find(effect => effect.type === 'squadMorale');
  const injury = outcome.effects.find(effect => effect.type === 'injury');
  const injuryHeal = outcome.effects.find(effect => effect.type === 'injuryDelta');
  const stat = outcome.effects.find(effect => effect.type === 'statDelta');
  const statSessions = outcome.effects.find(effect => effect.type === 'statDeltaSessions');
  const loyalty = outcome.effects.find(effect => effect.type === 'loyalty');
  const condition = outcome.effects.find(effect => effect.type === 'condition');
  const fame = outcome.effects.find(effect => effect.type === 'fame');
  const coachBoosts = outcome.effects.filter(effect => effect.type === 'coachBoost');
  const coachSpecialty = outcome.effects.find(effect => effect.type === 'coachSpecialty');
  const hasPlayerEffect = playerId !== undefined
    && (morale || injury || injuryHeal || stat || statSessions || loyalty || condition || fame);
  const resolvedSessionDelta = (() => {
    if (statSessions?.type !== 'statDeltaSessions' || playerId === undefined) return undefined;
    const player = working.players.find(candidate => candidate.id === playerId);
    if (player === undefined) return undefined;
    return sessionAttributeDelta(working, player, statSessions.attribute, statSessions.sessions);
  })();

  let next = applyCareerEventOutcome(working, choice.id, outcome.text, {
    moneyDelta: sumEffect(choice, outcomeIndex, 'money'),
    trainingPointDelta: sumEffect(choice, outcomeIndex, 'tp'),
    fanDelta: sumEffect(choice, outcomeIndex, 'fans'),
    flags: outcome.effects.flatMap(effect => effect.type === 'flag' && effect.value ? [effect.flag] : []),
    ...(hasPlayerEffect ? {
      playerEffect: {
        playerId,
        ...(morale?.type === 'morale' ? { moraleDelta: morale.amount } : {}),
        ...(injury?.type === 'injury' ? { injuryWeeks: injury.weeks } : {}),
        ...(injuryHeal?.type === 'injuryDelta' ? { injuryWeeksDelta: injuryHeal.weeks } : {}),
        ...(stat?.type === 'statDelta' ? { attribute: stat.attribute, attributeDelta: stat.amount } : {}),
        ...(statSessions?.type === 'statDeltaSessions' && resolvedSessionDelta !== undefined
          ? { attribute: statSessions.attribute, attributeDelta: resolvedSessionDelta }
          : {}),
        ...(loyalty?.type === 'loyalty' ? { loyaltyDelta: loyalty.amount } : {}),
        ...(condition?.type === 'condition' ? { conditionDelta: condition.amount } : {}),
        ...(fame?.type === 'fame' ? { fameDelta: fame.amount } : {}),
      },
    } : {}),
  }, {
    outcomeIndex,
    risky: choice.risky,
    success: choice.risky && outcomeIndex === 0,
    ...(outcome.nextEventId === undefined ? {} : { nextEventId: outcome.nextEventId }),
  });

  if (squadMorale?.type === 'squadMorale') {
    next = {
      ...next,
      players: next.players.map(player => player.clubId === next.userClubId
        ? { ...player, morale: Math.max(0, Math.min(100, player.morale + squadMorale.amount)) }
        : player),
    };
  }

  if (coachRole !== undefined) {
    for (const boost of coachBoosts) {
      if (boost.type === 'coachBoost') next = applyCoachEventEffect(next, coachRole, { facet: boost.facet, amount: boost.amount });
    }
    if (coachSpecialty?.type === 'coachSpecialty') {
      next = applyCoachEventEffect(next, coachRole, { specialtyTo: coachSpecialty.to });
    }
  }

  if (facilityId !== undefined) {
    for (const effect of outcome.effects) {
      if (effect.type === 'facilityTpBonus') next = applyFacilityEventEffect(next, facilityId, 'tpBonusPercent', effect.percent);
      if (effect.type === 'facilityTrainingBonus') next = applyFacilityEventEffect(next, facilityId, 'trainingBonusPercent', effect.percent);
      if (effect.type === 'facilityRecoveryBonus') next = applyFacilityEventEffect(next, facilityId, 'recoveryBonus', effect.amount);
      if (effect.type === 'facilityIncomeBonus') next = applyFacilityEventEffect(next, facilityId, 'incomeBonusPercent', effect.percent);
    }
  }

  return {
    state: { ...next, eventClock: { ...next.eventClock, weeksWithoutEvent: 0 } },
    note: choice.risky
      ? `${side === 'miss' ? 'MISS' : 'SUCCESS'} · ${outcome.weight}% real roll · ${riskyChoices} previous risky calls`
      : 'Guaranteed outcome · no roll to steer',
  };
}

function riskyChoicesForOutcome(
  state: GameState,
  choiceId: string,
  weights: readonly number[],
  wantedIndex: number,
): number | undefined {
  for (let riskyChoices = 0; riskyChoices <= RISK_SEARCH_LIMIT; riskyChoices += 1) {
    const roll = storyEventRoll({ ...state, eventClock: { ...state.eventClock, riskyChoices } }, choiceId, weights);
    if (chooseWeightedOutcome(weights, roll) === wantedIndex) return riskyChoices;
  }
  return undefined;
}

function storyEventRoll(state: GameState, choiceId: string, weights: readonly number[]): number {
  return deterministicCareerEventRoll(
    { careerSeed: state.careerSeed, season: state.season, week: state.week, riskyChoices: state.eventClock.riskyChoices },
    choiceId,
    0,
    weights.reduce((sum, weight) => sum + weight, 0),
  );
}

function sumEffect(choice: StoryEventChoice, outcomeIndex: number, type: 'money' | 'tp' | 'fans'): number {
  return (choice.outcomes[outcomeIndex]?.effects ?? []).reduce(
    (sum, effect) => effect.type === type ? sum + effect.amount : sum,
    0,
  );
}

export function careerEventChanges(before: GameState, after: GameState): string[] {
  const lines: string[] = [];
  const beforeClub = before.clubs.find(club => club.id === before.userClubId);
  const afterClub = after.clubs.find(club => club.id === after.userClubId);
  if (beforeClub !== undefined && afterClub !== undefined) {
    if (beforeClub.cash !== afterClub.cash) lines.push(`cash ${money(beforeClub.cash)} → ${money(afterClub.cash)}`);
    if (beforeClub.fans !== afterClub.fans) lines.push(`fans ${beforeClub.fans} → ${afterClub.fans}`);
  }
  if (before.trainingPoints !== after.trainingPoints) lines.push(`TP ${before.trainingPoints} → ${after.trainingPoints}`);
  lines.push(...playerChangeLines(before, after));
  const gainedFlags = after.eventFlags.filter(flag => !before.eventFlags.includes(flag));
  if (gainedFlags.length > 0) lines.push(`flags +${gainedFlags.join(' +')}`);
  if (after.pendingEvent?.resolvedNextEventId !== undefined) lines.push(`chains into ${after.pendingEvent.resolvedNextEventId}`);
  return lines.length === 0 ? ['nothing changed'] : lines;
}

function playerChangeLines(before: GameState, after: GameState): string[] {
  const priorById = new Map(before.players.map(player => [player.id, player]));
  return after.players.flatMap(player => {
    const prior = priorById.get(player.id);
    if (prior === undefined) return [];
    const details: string[] = [];
    if (player.morale !== prior.morale) details.push(`morale ${signed(player.morale - prior.morale)}`);
    if (player.injuryWeeks !== prior.injuryWeeks) details.push(`out ${prior.injuryWeeks} → ${player.injuryWeeks}w`);
    if ((player.condition ?? 100) !== (prior.condition ?? 100)) details.push(`condition ${signed((player.condition ?? 100) - (prior.condition ?? 100))}`);
    if ((player.fame ?? 0) !== (prior.fame ?? 0)) details.push(`fame ${signed((player.fame ?? 0) - (prior.fame ?? 0))}`);
    for (const key of Object.keys(player.attrs) as (keyof typeof player.attrs)[]) {
      if (player.attrs[key] !== prior.attrs[key]) details.push(`${key.toUpperCase()} ${prior.attrs[key]} → ${player.attrs[key]}`);
    }
    return details.length === 0 ? [] : [`${player.name} ${details.join(' ')}`];
  });
}

function riskSideHint(event: StoryEvent, side: RiskSide): string {
  const risky = event.choices.find(choice => choice.risky);
  const weight = risky?.outcomes[side === 'miss' ? 1 : 0]?.weight;
  return weight === undefined
    ? 'This story has no risky choice to steer'
    : `Risky choice lands on ${side === 'miss' ? 'setback' : 'success'} (${weight}%)`;
}

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${value}`;
}

function money(value: number): string {
  return `${value < 0 ? '-' : ''}$${Math.abs(value).toLocaleString('en-US')}`;
}

const CATEGORY_IDS: readonly string[] = [...new Set(CONTENT.events.events.map(event => event.category))];
const CATEGORY_BLURBS: Readonly<Record<string, string | undefined>> = Object.freeze({
  mystery: 'Spiders, meteors, and the strange stuff',
  club: 'Clubhouse business and recognition beats',
  media: 'Papers, pundits, and the radio hour',
  sponsor: 'Money and sponsor stories',
  player: 'Player-centred stories',
  medical: 'Flu, physio, and recovery',
  fan: 'Terraces, murals, and supporters',
});

const CASES = [
  {
    id: 'all',
    label: 'ALL',
    note: `${CONTENT.events.events.length} stories · every authored event in one reel`,
  },
  {
    id: 'two-part',
    label: '2-PART',
    note: `${TWO_PART_IDS.size} chapters · every authored part one and part two`,
  },
  ...CATEGORY_IDS.map(id => {
    const count = CONTENT.events.events.filter(event => event.category === id).length;
    const blurb = CATEGORY_BLURBS[id];
    return {
      id,
      label: id.toUpperCase(),
      note: `${count} stor${count === 1 ? 'y' : 'ies'}${blurb === undefined ? '' : ` · ${blurb}`}`,
    };
  }),
] as const;

export const careerEventsEntry: DevHarnessEntry = Object.freeze({
  id: 'career-events',
  group: 'Season',
  title: 'Career events',
  summary: `${CONTENT.events.events.length} story cards, including two-part chains and target selection.`,
  cases: Object.freeze(CASES.map(item => Object.freeze(item))),
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
  countLine: { color: '#9a95a4', fontFamily: 'HFMSilkscreen_700Bold', fontSize: 9 },
  note: { color: '#d7cfe4', fontSize: 11, lineHeight: 15 },
  stateNote: { color: '#edb54a', fontSize: 11, lineHeight: 15 },
});
