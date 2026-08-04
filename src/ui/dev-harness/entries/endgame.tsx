import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { playerLookId } from '../../../render/sprites/player-look';
import { EndgameCelebrationScreen } from '../../screens/EndgameCelebrationScreen';
import { DevHarnessButton, devHarnessControlStyles } from '../DevHarnessControls';
import type { DevHarnessEntry } from '../registry';
import type {
  EndgameCelebrationKind,
  EndgameCelebrationPlayerViewModel,
  EndgameCelebrationViewModel,
} from '../../models';

/**
 * The three endgame celebrations, as the dev harness shows them.
 *
 * Each one plays at most once in a whole career, behind a D1 title or a Cup
 * run — a state a played career takes many hours to reach and can never reach
 * twice. Jest runs with no DOM, so without this nobody would ever look at the
 * fireworks, the walk-out or the speech bubbles before a player did.
 *
 * The screen rendered here is the REAL one, fed a fabricated view model built
 * to the same shape `endgameCelebrationViewModel` produces. Nothing about the
 * presentation is re-implemented, so a fault seen here is a fault in the game.
 *
 * NOT REGISTERED in `registry.ts`. Import it there to put it in the menu.
 */
export function EndgameCelebrationReel({ caseId }: { readonly caseId: EndgameCelebrationKind }) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const insets = useSafeAreaInsets();
  const viewModel = useMemo(() => endgameQaViewModel(caseId), [caseId]);

  return (
    <View style={styles.root}>
      <EndgameCelebrationScreen
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
            hint="Toggle reduced motion: walk-ons, jumping and fireworks go static"
            selected={reduceMotion}
            onPress={() => setReduceMotion(current => !current)}
          />
          <DevHarnessButton
            label="Replay"
            hint="Play this celebration again from the top"
            onPress={() => setRunKey(current => current + 1)}
          />
        </View>
      </View>
    </View>
  );
}

/** Eleven men and Bert, so the walk-out is the width a real squad makes it. */
function qaSquad(): EndgameCelebrationPlayerViewModel[] {
  const roles: EndgameCelebrationPlayerViewModel['role'][] = [
    'GK', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'FWD', 'MID',
  ];
  return roles.map((role, index) => {
    const id = `qa-p${index + 1}`;
    return {
      id,
      name: `Player ${index + 1}`,
      role,
      isHero: index === 3 || index === 8,
      fame: 40 - index,
      // Resolved through the real look table, so the atlas the screen builds is
      // the one a career builds and never the missing-sprite fallback.
      spriteKey: `r:${playerLookId(id, role)}:run0`,
    };
  });
}

/**
 * The same copy the application module writes, kept as data here rather than
 * imported: the harness must be able to show a moment the running save has no
 * legal state for, and building a whole D1 career to read three strings would
 * make the reel unrunnable.
 */
function endgameQaViewModel(kind: EndgameCelebrationKind): EndgameCelebrationViewModel {
  const squad = qaSquad();
  const star: EndgameCelebrationPlayerViewModel = {
    id: 'qa-star',
    name: 'Rook Halloway',
    role: 'FWD',
    isHero: true,
    fame: 91,
    spriteKey: `r:${playerLookId('qa-star', 'FWD')}:run0`,
  };
  const copy = QA_COPY[kind];
  return {
    kind,
    seasonLabel: 'Season 9',
    clubName: 'Bramble Rovers',
    assistantName: 'Bert Rudge',
    headline: copy.headline,
    subheading: copy.subheading,
    lines: copy.lines,
    star,
    // Every moment gets the squad now: the trophy screens walk them out at the
    // top, and the true ending brings them on for the curtain call once the
    // star has finished talking.
    squad,
    // Two of the thirty-two, so the harness shows the staff row staged rather
    // than the empty-club case the scenes also have to survive.
    coaches: [
      { id: 'qa-head', name: 'Amara Okafor', spriteKey: 'coach:amara-okafor:field-cheer' },
      { id: 'qa-assistant', name: 'Kenji Sato', spriteKey: 'coach:kenji-sato:field-cheer' },
    ],
    skippable: kind !== 'true-ending',
    accessibilityLabel: `${copy.headline}. ${copy.subheading}. ${copy.lines.join(' ')}`,
  };
}

const QA_COPY: Readonly<Record<EndgameCelebrationKind, {
  headline: string;
  subheading: string;
  lines: readonly string[];
}>> = Object.freeze({
  'global-league': {
    headline: 'GLOBAL LEAGUE CHAMPIONS',
    subheading: 'Bramble Rovers · Top of the pyramid',
    lines: [
      'There is no division above this one. The ladder is finished.',
      'Rook Halloway climbed every rung of it with you.',
      'One trophy is still out there. Win the Hero Cup and the climb is complete.',
    ],
  },
  'cup-winners': {
    headline: 'HERO CUP WINNERS',
    subheading: 'Bramble Rovers · Knockout champions',
    lines: [
      'Every round a single tie, every tie a single chance. You took all of them.',
      'Rook Halloway carried the run.',
      'The division is still the goal. Win D1 and the climb is complete.',
    ],
  },
  'true-ending': {
    headline: 'THE CLIMB IS COMPLETE',
    subheading: 'Bramble Rovers · Global League and Hero Cup',
    lines: [
      'Boss. Before anyone else gets in here, thank you.',
      'You made me the player I am. Every bit of it came out of your coaching.',
      'We won the league. We won the Cup. I am glad we did.',
      'But it is not the trophies I will carry. It is the mornings on the training pitch, and the one man who kept turning up for me.',
      'Wherever this goes next, I got here with you. Thank you, boss.',
    ],
  },
});

const CASE_NOTES: Readonly<Record<EndgameCelebrationKind, string>> = Object.freeze({
  'global-league': 'First D1 title, Cup unwon · full squad walk-out, biggest staging',
  'cup-winners': 'First Cup, D1 unwon · smaller staging, still not a consolation',
  'true-ending': 'Both trophies in · five bubbles, then the squad out and Bert’s sign-off. No skip. The last tap goes to the title screen in the game; here it replays.',
});

export const endgameCelebrationEntry: DevHarnessEntry = Object.freeze({
  id: 'endgame',
  group: 'Season',
  title: 'Endgame celebrations',
  summary: 'The end of the climb: D1, the Cup, and the true ending.',
  cases: Object.freeze([
    { id: 'global-league', label: 'Global League', note: CASE_NOTES['global-league'] },
    { id: 'cup-winners', label: 'Cup Winners', note: CASE_NOTES['cup-winners'] },
    { id: 'true-ending', label: 'True ending', note: CASE_NOTES['true-ending'] },
  ]),
  render: (caseId: string) => (
    <EndgameCelebrationReel caseId={caseId as EndgameCelebrationKind} />
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
