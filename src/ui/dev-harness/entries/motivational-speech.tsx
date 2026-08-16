import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MotivationalSpeechCutscene } from '../../../render/MotivationalSpeechCutscene';
import type { DevHarnessEntry } from '../registry';

/**
 * The half-time motivational speech cutscene, without a D3 half time.
 *
 * The cutscene lasts four seconds and then removes itself, so the harness needs
 * a Replay control or there is nothing to look at after the first run. The
 * `key` on each run is what forces a genuinely fresh mount: the lines, the card
 * positions and the entrance animation are all chosen once per mount, and
 * re-rendering the same instance would show the same run again.
 *
 * The three boost cases are the three divisions that can reach this screen.
 * Reduced motion is a toggle rather than a case, because it is something a
 * reviewer flips while looking at a boost, not a separate thing to bookmark.
 */
const BOOST_CASES = Object.freeze([
  {
    id: 'd3',
    label: 'D3 · +6',
    note: 'The first division that can buy one',
    boost: 6,
  },
  { id: 'd2', label: 'D2 · +8', note: 'Two-digit cards start here', boost: 8 },
  { id: 'd1', label: 'D1 · +10', note: 'Widest card copy', boost: 10 },
]);

const BOOST_BY_ID = new Map(BOOST_CASES.map((entry) => [entry.id, entry]));

function MotivationalSpeechHarness({ caseId }: { readonly caseId: string }) {
  const boost = BOOST_BY_ID.get(caseId)?.boost ?? 6;
  const [run, setRun] = useState(1);
  const [playing, setPlaying] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [endedAt, setEndedAt] = useState<string | null>(null);

  return (
    <View style={styles.root}>
      <View style={styles.controls}>
        <Pressable
          onPress={() => {
            setEndedAt(null);
            setRun((value) => value + 1);
            setPlaying(true);
          }}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Replay</Text>
        </Pressable>
        <Pressable
          onPress={() => setReduceMotion((value) => !value)}
          style={[styles.button, reduceMotion ? styles.buttonOn : null]}
        >
          <Text style={styles.buttonText}>
            {reduceMotion ? 'Reduced motion ON' : 'Reduced motion off'}
          </Text>
        </Pressable>
        <Text style={styles.status}>
          {playing
            ? `Run ${run} · tap the screen to change the line · 4 taps ends it`
            : `Ended ${endedAt ?? ''}`}
        </Text>
      </View>
      {playing ? (
        <MotivationalSpeechCutscene
          key={`${caseId}:${reduceMotion ? 'reduced' : 'full'}:${run}`}
          boost={boost}
          coachName="Thandi Mokoena"
          // A legend id on purpose: it is NOT in the sprite sheet, so this also
          // exercises the resolver that keeps one stand-in face across both
          // expressions of the mouth flap.
          coachPortraitId="legend-42"
          onDone={() => {
            // Proves the cutscene ends exactly once, by whichever route.
            setEndedAt(new Date().toISOString().slice(11, 23));
            setPlaying(false);
          }}
          reduceMotion={reduceMotion}
        />
      ) : null}
    </View>
  );
}

export const motivationalSpeechEntry: DevHarnessEntry = {
  id: 'motivational-speech',
  group: 'Match',
  title: 'Motivational speech cutscene',
  summary: 'Half-time team talk: flash, coach, +X cards, four seconds',
  cases: BOOST_CASES.map(({ id, label, note }) => ({ id, label, note })),
  render: (caseId) => <MotivationalSpeechHarness caseId={caseId} />,
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#2f7d43' },
  controls: { gap: 8, padding: 12 },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderColor: '#241f2e',
    borderWidth: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  buttonOn: { backgroundColor: '#ffe14d' },
  buttonText: { color: '#241f2e', fontWeight: 'bold' },
  status: { color: '#ffffff' },
});
