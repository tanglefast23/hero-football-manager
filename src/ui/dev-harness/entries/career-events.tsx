import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadLaunchContent, type LaunchContent } from '../../../content';
import { storyEventViewModel } from '../../../application/view-models';
import {
  CAREER_MILESTONES,
  applyCareerEventOutcome,
  dismissCareerEvent,
  offerCareerEvent,
  selectCareerEventPlayer,
} from '../../../game/career-events';
import { chooseWeightedOutcome, deterministicCareerEventRoll } from '../../../game/event-clock';
import type { GameState } from '../../../game/types';
import { StoryEventScreen } from '../../screens/StoryEventScreen';
import { DevHarnessButton, devHarnessControlStyles } from '../DevHarnessControls';
import { devHarnessCareerAtWeek } from '../career';
import type { DevHarnessEntry } from '../registry';

type StoryEvent = LaunchContent['events']['events'][number];
type StoryEventChoice = StoryEvent['choices'][number];

/** Which side of a risky roll the reviewer has asked to see next. */
export type RiskSide = 'success' | 'miss';

/**
 * Parsed once at module scope, the way `view-models.ts` already does it — this
 * entry only imports that module, so the parse has happened either way.
 */
const CONTENT = loadLaunchContent();

/**
 * The management week every card is dealt from.
 *
 * Week 12 of season 1 sits inside all but one authored trigger window, and the
 * club is holding about $51k there — which matters, because two of the hundred
 * choices are gated on cash ($700 and $1,000) and a broke career would show
 * them permanently greyed out instead of letting the arc be walked.
 */
const BASE_SEASON = 1;
const BASE_WEEK = 12;

/** The seeded career every card in this reel is dealt from. Cached in `career.ts`. */
export function careerEventsCareer(): GameState {
  return devHarnessCareerAtWeek(BASE_SEASON, BASE_WEEK);
}

/** The stories one case walks, in authored order. */
export function careerEventsForCategory(category: string): readonly StoryEvent[] {
  return CONTENT.events.events.filter(event => event.category === category);
}

/**
 * How far the risky-side search is allowed to walk before it gives up.
 *
 * Enormously generous: measured against the shipped fifty, no choice needs more
 * than 5. The bound exists so a future outcome weight that cannot produce one
 * of its sides reports that instead of hanging.
 */
const RISK_SEARCH_LIMIT = 512;

/**
 * The story events themselves, driven the way a career drives them.
 *
 * Fifty are authored. In play one can appear on a quiet week, inside its own
 * trigger window, at most once — so most of them have never been on a screen.
 * This offers any of them to a REAL seeded career with the real
 * `offerCareerEvent`, picks the player with the real `selectCareerEventPlayer`,
 * and resolves the choice through the real `applyCareerEventOutcome` over the
 * real `deterministicCareerEventRoll`. Nothing here builds a view model: the
 * screen is fed `storyEventViewModel(state, content)`, the same call the app
 * makes, so what the reel shows is what a career shows.
 *
 * A column rather than an overlay, which is where this parts company with the
 * awards ceremony reel. The ceremony pins its own controls top-right and its
 * bubble measures the window, so its reel floats a panel over the bottom. This
 * screen puts its one way forward — "Return to the office" / "Continue the
 * story" — at the bottom of a bottom-anchored panel, and a floating panel would
 * sit on top of the control the reviewer needs to walk the arc. Nothing in the
 * story screen measures the window, so a shorter container is a smaller phone,
 * not a lie. Hide the panel to see it full height.
 *
 * Case and control divide up like this: the case is which slice of the fifty
 * the arrows walk, which is the input and the thing worth an address. Which
 * story inside that slice, which side of the gamble, whether Bert is talking
 * and whether motion is reduced are all "where you are standing", reachable
 * from any case in a tap, so they stay local.
 */
export function CareerEventsReel({ category }: { readonly category: string }) {
  const events = useMemo(() => careerEventsForCategory(category), [category]);
  const base = useMemo(careerEventsCareer, []);

  const [index, setIndex] = useState(0);
  const [riskSide, setRiskSide] = useState<RiskSide>('success');
  const [reduceMotion, setReduceMotion] = useState(false);
  const [guideVisible, setGuideVisible] = useState(false);
  const [panelVisible, setPanelVisible] = useState(true);
  const [runKey, setRunKey] = useState(0);
  const insets = useSafeAreaInsets();

  const [state, setState] = useState<GameState>(() => offerStoryEvent(base, events[0].id));
  const [changes, setChanges] = useState<readonly string[]>([]);
  const [rollNote, setRollNote] = useState<string>('');

  /**
   * The story on screen, which is the story the CAREER says is pending — not
   * the one the arrows are parked on. Following a chain moves the first without
   * moving the second, and resolving a choice against the wrong event would look
   * up a choice id that story does not have.
   */
  const activeEvent = useMemo(() => {
    const pending = CONTENT.events.events.find(
      candidate => candidate.id === state.pendingEvent?.eventId,
    );
    return pending ?? events[index];
  }, [events, index, state]);

  const open = useCallback((eventId: string) => {
    setState(offerStoryEvent(base, eventId));
    setChanges([]);
    setRollNote('');
    setRunKey(key => key + 1);
  }, [base]);

  const step = useCallback((delta: number) => {
    const next = (index + delta + events.length) % events.length;
    setIndex(next);
    open(events[next].id);
  }, [events, index, open]);

  const choose = useCallback((choiceId: string) => {
    const resolution = resolveStoryEventChoice(state, activeEvent, choiceId, riskSide);
    setState(resolution.state);
    setChanges(careerEventChanges(state, resolution.state));
    setRollNote(resolution.note);
  }, [activeEvent, riskSide, state]);

  const selectPlayer = useCallback(() => {
    setState(current => selectCareerEventPlayer(current, nextEventPlayerId(current)));
  }, []);

  /**
   * The production Continue button. A resolved story that chained — the three
   * authored follow-ups, or a milestone recognition beat — follows the chain for
   * real, through the same dismiss-then-offer the store runs. Anything else
   * returns to this card's own offer, so the other side of the gamble is one tap
   * away; the harness has no week to advance into.
   */
  const advance = useCallback(() => {
    const followUpId = state.pendingEvent?.resolvedNextEventId;
    const followUp = CONTENT.events.events.find(candidate => candidate.id === followUpId);
    if (followUp !== undefined) {
      const dismissed = dismissCareerEvent(state, activeEvent.trigger.repeatable !== true);
      if (!dismissed.resolvedEventIds.includes(followUp.id)) {
        setState(offerCareerEvent(dismissed, followUp.id));
        setChanges([]);
        setRollNote(`Followed the chain into ${followUp.id}`);
        setRunKey(key => key + 1);
        return;
      }
    }
    open(activeEvent.id);
  }, [activeEvent, open, state]);

  const viewModel = useMemo(() => storyEventViewModel(state, CONTENT), [state]);

  return (
    <View style={styles.root}>
      <View style={styles.screen}>
        <StoryEventScreen
          // The reveal springs read `reduceMotion` once, at mount, so every
          // control that changes how the outcome animates has to bring a new
          // instance with it. The offer-to-outcome step deliberately does NOT:
          // that transition is the thing being reviewed.
          key={`${activeEvent.id}:${reduceMotion}:${runKey}`}
          viewModel={viewModel}
          onChoose={choose}
          onSelectPlayer={selectPlayer}
          onContinue={advance}
          // The settings overlay is somebody else's feature; the button is here
          // because the production screen draws it, and it does nothing here.
          onOpenSettings={() => {}}
          reduceMotion={reduceMotion}
          {...(guideVisible ? { guideCopy: CONTENT.assistantGuide.m4Fiction.events } : {})}
        />
      </View>

      {panelVisible ? (
        <View style={[styles.panel, { paddingBottom: insets.bottom + 12 }]}>
          <View style={devHarnessControlStyles.row}>
            <Text style={devHarnessControlStyles.rowLabel}>STORY</Text>
            <DevHarnessButton
              label="◂"
              hint="Show the previous story in this category"
              onPress={() => step(-1)}
            />
            <DevHarnessButton
              label="▸"
              hint="Show the next story in this category"
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
              hint="Resolve the risky choice on its winning outcome"
              selected={riskSide === 'success'}
              onPress={() => setRiskSide('success')}
            />
            <DevHarnessButton
              label="Miss"
              hint="Resolve the risky choice on its losing outcome"
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
              hint="Show the one-off Bert panel a manager's first story carries"
              selected={guideVisible}
              onPress={() => setGuideVisible(visible => !visible)}
            />
            <DevHarnessButton
              label="Full"
              hint="Play the outcome reveal and the reward pop in full"
              selected={!reduceMotion}
              onPress={() => setReduceMotion(false)}
            />
            <DevHarnessButton
              label="Reduced"
              hint="Reduce motion, which shows the outcome and its rewards at once"
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
            {activeEvent.trigger.requiresPlayer === true ? ' · needs a player' : ''}
          </Text>
          <Text style={styles.note}>
            {rollNote === '' ? riskSideHint(activeEvent, riskSide) : rollNote}
          </Text>
          {changes.length === 0 ? null : (
            <Text style={styles.stateNote}>STATE: {changes.join(' · ')}</Text>
          )}
        </View>
      ) : (
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

/**
 * The story as a career would hand it over, with the milestone backlog settled.
 *
 * Marking the recognition beats resolved is what a career looks like a few
 * stories in, and it matters here: the seeded career has earned milestones that
 * nothing in the harness ever acknowledges, so without this every one of the
 * fifty would chain into "milestone-first-cup-win" and no card would ever show
 * the plain "Return to the office". The story being offered keeps its own mark
 * off the list, so the seven recognition beats stay reachable themselves.
 */
export function offerStoryEvent(base: GameState, eventId: string): GameState {
  const settled = CAREER_MILESTONES
    .map(milestone => milestone.eventId)
    .filter(candidate => candidate !== eventId);
  const resolvedEventIds = [...new Set([...base.resolvedEventIds, ...settled])]
    .filter(candidate => candidate !== eventId);
  return offerCareerEvent({ ...base, resolvedEventIds }, eventId);
}

export interface StoryEventResolution {
  readonly state: GameState;
  /** What the reel did to reach this side, in the reviewer's words. */
  readonly note: string;
}

/**
 * Resolves a choice the way `resolveContentEvent` in the store does.
 *
 * The one thing it adds is the requested side of a risky roll. The outcome is a
 * weighted draw from `deterministicCareerEventRoll`, whose only movable input
 * here is `eventClock.riskyChoices` — the count of risky calls this manager has
 * already made. So the reel searches for a count that lands the real roll on the
 * side asked for, and resolves from a career carrying that count. Nothing is
 * forced past the roll: the outcome shown is one this exact story genuinely
 * produces for a manager with that history, and the note says which history.
 *
 * MIRRORS `src/application/store.ts`. That resolver is private to the store,
 * which owns a save, so the harness cannot call it; the effect mapping below is
 * a copy and will need re-checking if the authored effect types grow.
 */
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
    return {
      state,
      note: `No career history in ${RISK_SEARCH_LIMIT} rolls lands ${choiceId} on its ${side} outcome`,
    };
  }

  const rolled: GameState = {
    ...state,
    eventClock: { ...state.eventClock, riskyChoices },
  };
  const outcomeIndex = chooseWeightedOutcome(
    weights,
    storyEventRoll(rolled, choiceId, weights),
  );
  const outcome = choice.outcomes[outcomeIndex];
  if (outcome === undefined) throw new Error('the event outcome did not resolve');

  // Every authored risky branch stores its success first and its setback second,
  // and the risk counter ticks before the outcome lands — both as the store does.
  const working: GameState = choice.risky
    ? { ...rolled, eventClock: { ...rolled.eventClock, riskyChoices: riskyChoices + 1 } }
    : rolled;
  const playerId = state.pendingEvent?.selectedPlayerId;
  const morale = outcome.effects.find(effect => effect.type === 'morale');
  const injury = outcome.effects.find(effect => effect.type === 'injury');
  const stat = outcome.effects.find(effect => effect.type === 'statDelta');
  const hasPlayerEffect = playerId !== undefined && (morale ?? injury ?? stat) !== undefined;

  let next = applyCareerEventOutcome(working, choice.id, outcome.text, {
    moneyDelta: sumEffect(choice, outcomeIndex, 'money'),
    trainingPointDelta: sumEffect(choice, outcomeIndex, 'tp'),
    fanDelta: sumEffect(choice, outcomeIndex, 'fans'),
    flags: outcome.effects.flatMap(effect => (
      effect.type === 'flag' && effect.value ? [effect.flag] : []
    )),
    ...(hasPlayerEffect ? {
      playerEffect: {
        playerId,
        ...(morale?.type === 'morale' ? { moraleDelta: morale.amount } : {}),
        ...(injury?.type === 'injury' ? { injuryWeeks: injury.weeks } : {}),
        ...(stat?.type === 'statDelta' ? {
          attribute: stat.attribute,
          attributeDelta: stat.amount,
        } : {}),
      },
    } : {}),
  }, {
    outcomeIndex,
    risky: choice.risky,
    success: choice.risky && outcomeIndex === 0,
    ...(outcome.nextEventId === undefined ? {} : { nextEventId: outcome.nextEventId }),
  });

  // A morale effect with nobody named lands on the whole squad, and it lands
  // outside `applyCareerEventOutcome` — so the screen's "squad morale" chip is
  // the only trace of it anywhere.
  if (morale?.type === 'morale' && playerId === undefined) {
    next = {
      ...next,
      players: next.players.map(player => player.clubId === next.userClubId
        ? { ...player, morale: Math.max(0, Math.min(100, player.morale + morale.amount)) }
        : player),
    };
  }

  return {
    state: { ...next, eventClock: { ...next.eventClock, weeksWithoutEvent: 0 } },
    note: choice.risky
      ? `${side === 'miss' ? 'MISS' : 'SUCCESS'} at ${outcome.weight}% · real roll, from a manager who had made ${riskyChoices} risky calls`
      : `Guaranteed outcome · no roll to steer`,
  };
}

/**
 * The smallest risky-call count that lands this choice's real roll on the
 * wanted outcome, or `undefined` if the search runs out.
 *
 * `undefined` is never papered over: a side that cannot be produced is reported
 * rather than resolved some other way, because a reel that shows an outcome the
 * game could not reach is worse than one that shows nothing.
 */
function riskyChoicesForOutcome(
  state: GameState,
  choiceId: string,
  weights: readonly number[],
  wantedIndex: number,
): number | undefined {
  for (let riskyChoices = 0; riskyChoices <= RISK_SEARCH_LIMIT; riskyChoices += 1) {
    const roll = storyEventRoll(
      { ...state, eventClock: { ...state.eventClock, riskyChoices } },
      choiceId,
      weights,
    );
    if (chooseWeightedOutcome(weights, roll) === wantedIndex) return riskyChoices;
  }
  return undefined;
}

/** The application's own outcome roll, stream and all. */
function storyEventRoll(
  state: GameState,
  choiceId: string,
  weights: readonly number[],
): number {
  return deterministicCareerEventRoll(
    {
      careerSeed: state.careerSeed,
      season: state.season,
      week: state.week,
      riskyChoices: state.eventClock.riskyChoices,
    },
    choiceId,
    0,
    weights.reduce((sum, weight) => sum + weight, 0),
  );
}

function sumEffect(
  choice: StoryEventChoice,
  outcomeIndex: number,
  type: 'money' | 'tp' | 'fans',
): number {
  return (choice.outcomes[outcomeIndex]?.effects ?? []).reduce(
    (sum, effect) => (effect.type === type ? sum + effect.amount : sum),
    0,
  );
}

/**
 * The next player the production screen would select.
 *
 * The store's own order: the starting XI first, then the rest, each by name,
 * cycling. Copied because the store owns a save and cannot be called here.
 */
function nextEventPlayerId(state: GameState): string {
  const lineup = state.lineups.find(candidate => candidate.clubId === state.userClubId);
  if (lineup === undefined) throw new Error('the user club has no lineup');
  const candidates = state.players
    .filter(player => player.clubId === state.userClubId)
    .sort((left, right) => (
      Number(!lineup.playerIds.includes(left.id)) - Number(!lineup.playerIds.includes(right.id))
      || left.name.localeCompare(right.name)
    ));
  const player = candidates[
    (candidates.findIndex(
      candidate => candidate.id === state.pendingEvent?.selectedPlayerId,
    ) + 1) % candidates.length
  ];
  if (player === undefined) throw new Error('no eligible user-club player is available');
  return player.id;
}

/**
 * Everything the resolution actually changed in the career, as short lines.
 *
 * Read straight off the two real states rather than off the effects that were
 * asked for, so it reports what LANDED. It is here because the screen's reward
 * chips are a summary of the authored effects, not a receipt: a flag that shares
 * an outcome with a reward is silent, a morale line never says whose morale, and
 * no balance is ever shown. Whatever appears here and not on the screen is a
 * gap in the screen.
 */
export function careerEventChanges(before: GameState, after: GameState): string[] {
  const lines: string[] = [];
  const wasClub = before.clubs.find(club => club.id === before.userClubId);
  const isClub = after.clubs.find(club => club.id === after.userClubId);
  if (wasClub !== undefined && isClub !== undefined) {
    if (wasClub.cash !== isClub.cash) {
      lines.push(`cash ${money(wasClub.cash)} → ${money(isClub.cash)} (${signed(isClub.cash - wasClub.cash)})`);
    }
    if (wasClub.fans !== isClub.fans) {
      lines.push(`fans ${wasClub.fans} → ${isClub.fans} (${signed(isClub.fans - wasClub.fans)})`);
    }
  }
  if (before.trainingPoints !== after.trainingPoints) {
    lines.push(`TP ${before.trainingPoints} → ${after.trainingPoints} (${signed(after.trainingPoints - before.trainingPoints)})`);
  }
  lines.push(...playerChangeLines(before, after));

  const gainedFlags = after.eventFlags.filter(flag => !before.eventFlags.includes(flag));
  if (gainedFlags.length > 0) lines.push(`flags +${gainedFlags.join(' +')}`);

  const chained = after.pendingEvent?.resolvedNextEventId;
  if (chained !== undefined) lines.push(`chains into ${chained}`);

  return lines.length === 0 ? ['nothing changed'] : lines;
}

/** Named players first; a club-wide morale swing collapses to one line. */
function playerChangeLines(before: GameState, after: GameState): string[] {
  const priorById = new Map(before.players.map(player => [player.id, player]));
  const changed = after.players.flatMap(player => {
    const prior = priorById.get(player.id);
    if (prior === undefined) return [];
    const moraleDelta = player.morale - prior.morale;
    const attrs = (Object.keys(player.attrs) as (keyof typeof player.attrs)[])
      .filter(key => player.attrs[key] !== prior.attrs[key])
      .map(key => `${key.toUpperCase()} ${prior.attrs[key]} → ${player.attrs[key]}`);
    const injured = player.injuryWeeks !== prior.injuryWeeks
      ? `out ${prior.injuryWeeks} → ${player.injuryWeeks}w`
      : undefined;
    if (moraleDelta === 0 && attrs.length === 0 && injured === undefined) return [];
    return [{ name: player.name, moraleDelta, attrs, injured }];
  });
  if (changed.length === 0) return [];

  const moraleOnly = changed.every(entry => entry.attrs.length === 0 && entry.injured === undefined);
  if (moraleOnly && changed.length > 1) {
    const deltas = changed.map(entry => entry.moraleDelta);
    const low = Math.min(...deltas);
    const high = Math.max(...deltas);
    const range = low === high ? signed(low) : `${signed(low)}..${signed(high)}`;
    return [`squad morale ${range} across ${changed.length} players`];
  }
  return changed.map(entry => [
    entry.name,
    ...(entry.moraleDelta === 0 ? [] : [`morale ${signed(entry.moraleDelta)}`]),
    ...entry.attrs,
    ...(entry.injured === undefined ? [] : [entry.injured]),
  ].join(' '));
}

/** What the ROLL buttons will do to whichever choice is tapped next. */
function riskSideHint(event: StoryEvent, side: RiskSide): string {
  const risky = event.choices.find(choice => choice.risky);
  const weight = risky?.outcomes[side === 'miss' ? 1 : 0]?.weight;
  if (weight === undefined) return 'This story has no risky choice to steer';
  return `The risky choice will land on its ${side === 'miss' ? 'setback' : 'success'} (${weight}%); the safe one is unaffected`;
}

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${value}`;
}

function money(value: number): string {
  // ASCII hyphen, matching the rest of the UI: Silkscreen has no U+2212.
  return `${value < 0 ? '-' : ''}$${Math.abs(value).toLocaleString('en-US')}`;
}

/**
 * Declared above the entry, not below it: the entry's `cases` read these while
 * the module is still evaluating, and a `const` below would still be in its
 * temporal dead zone. TypeScript cannot see that through the arrow function, so
 * the only symptom is a blank bundle at runtime.
 *
 * The cases are the categories, taken from the content rather than written out,
 * so the seven chips partition the fifty by construction — a story cannot become
 * unreachable by being authored into a category nobody listed here.
 */
const CATEGORY_IDS: readonly string[] = [
  ...new Set(CONTENT.events.events.map(event => event.category)),
];

/**
 * Why categories and not shapes: every one of the fifty carries exactly one
 * risky choice and one safe one, so a "risky" case would be all fifty, and every
 * story that needs a player picked is already a `player` story. Category is the
 * one axis that cuts the fifty into readable, non-overlapping runs.
 */
const CATEGORY_BLURBS: Readonly<Record<string, string | undefined>> = Object.freeze({
  mystery: 'Spiders, meteors, a haunted scoreboard',
  club: 'Clubhouse business, plus three recognition beats',
  media: 'Papers, pundits, the radio hour',
  sponsor: 'The money offers',
  player: 'Every story that needs a player picked',
  medical: 'Flu, physio, a clean bill of health',
  fan: 'The terraces, the mural, the hundredth fan',
});

export const careerEventsEntry: DevHarnessEntry = Object.freeze({
  id: 'career-events',
  group: 'Season',
  title: 'Career events',
  summary: 'The fifty story cards: the offer, the call, and what it did to the club.',
  cases: Object.freeze(CATEGORY_IDS.map(id => {
    const count = CONTENT.events.events.filter(event => event.category === id).length;
    const blurb = CATEGORY_BLURBS[id];
    return Object.freeze({
      id,
      label: id.toUpperCase(),
      note: `${count} stor${count === 1 ? 'y' : 'ies'}${blurb === undefined ? '' : ` · ${blurb}`}`,
    });
  })),
  render: (caseId: string) => <CareerEventsReel category={caseId} />,
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
  // Absolute once the panel is hidden, so the screen gets the whole height it
  // would have in the app rather than the height minus a button.
  showRow: {
    position: 'absolute',
    left: 12,
    bottom: 0,
    zIndex: 30,
  },
  countLine: {
    color: '#9a95a4',
    fontFamily: 'Silkscreen_700Bold',
    fontSize: 9,
  },
  note: {
    color: '#d7cfe4',
    fontSize: 11,
    lineHeight: 15,
  },
  stateNote: {
    color: '#edb54a',
    fontSize: 11,
    lineHeight: 15,
  },
});
