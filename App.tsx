import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MatchScreen } from './src/render/MatchScreen';
import { StressScreen } from './src/render/StressScreen';
import { setMasterVolume } from './src/render/audio';
import { devVolumePercent, nextDevVolume, type DevVolume } from './src/render/dev-volume';
import { runMatch } from './src/sim/match';
import { ROVERS, UNITED } from './src/sim/teams';
import type { MatchState } from './src/sim/types';

type Screen = 'home' | 'match' | 'stress';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [seed, setSeed] = useState(42);
  const [result, setResult] = useState<string | null>(null);
  const [devVolume, setDevVolume] = useState<DevVolume>(1);

  useEffect(() => {
    setMasterVolume(devVolume);
  }, [devVolume]);

  // Stable identity: MatchScreen's game-loop effect depends on [onDone], so an
  // unstable callback would tear down and re-arm the loop on any parent re-render.
  const finishWatched = useCallback((s: MatchState) => {
    setResult(`Watched · ROV ${s.score[0]} – ${s.score[1]} UNI (seed ${seed})`);
    setScreen('home');
  }, [seed]);

  let content;
  if (screen === 'match') {
    content = <MatchScreen seed={seed} onDone={finishWatched} />;
  } else if (screen === 'stress') {
    content = <StressScreen onBack={() => setScreen('home')} />;
  } else {
    content = (
      <View style={styles.home}>
        <Text style={styles.title}>Hero Football Manager — M0</Text>
        <Text style={styles.seed}>Seed: {seed}</Text>
        {result ? <Text style={styles.result}>{result}</Text> : null}
        <Pressable style={styles.btn} onPress={() => setScreen('match')}>
          <Text style={styles.btnText}>Watch match</Text>
        </Pressable>
        <Pressable
          style={styles.btn}
          onPress={() => {
            const r = runMatch(seed, ROVERS, UNITED);
            setResult(`Quick · ROV ${r.score[0]} – ${r.score[1]} UNI (seed ${seed})`);
          }}
        >
          <Text style={styles.btnText}>Quick result</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={() => setSeed((x) => x + 1)}>
          <Text style={styles.btnText}>New seed</Text>
        </Pressable>
        {__DEV__ ? (
          <Pressable style={styles.btn} onPress={() => setScreen('stress')}>
            <Text style={styles.btnText}>Stress test</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {content}
      {__DEV__ ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Development volume ${devVolumePercent(devVolume)} percent`}
          accessibilityHint="Cycles through mute, 25, 50, 75, and 100 percent"
          hitSlop={8}
          testID="dev-volume-button"
          style={styles.volumeBtn}
          onPress={() => setDevVolume((current) => nextDevVolume(current))}
        >
          <Text style={styles.volumeText}>
            {devVolume === 0 ? '🔇' : devVolume <= 0.5 ? '🔉' : '🔊'} {devVolumePercent(devVolume)}%
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#101418' },
  home: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  title: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  seed: { color: '#9ab', fontSize: 16, fontVariant: ['tabular-nums'] },
  result: { color: '#f5c518', fontSize: 16 },
  btn: { backgroundColor: '#1e2630', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12, minWidth: 220, alignItems: 'center' },
  btnText: { color: 'white', fontSize: 17 },
  volumeBtn: {
    position: 'absolute',
    top: 52,
    right: 12,
    minWidth: 74,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e2630',
    borderColor: '#536273',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    zIndex: 1000,
    elevation: 12,
  },
  volumeText: { color: 'white', fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
