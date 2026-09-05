import { AppRegistry } from 'react-native';
import { assertRuntimeGoldenReplay } from '../../src/sim/runtime-golden';

// CI replaces the bundle only in a temporary copy of the Release simulator app.
// This entry never imports the game UI, audio, or persistence.
AppRegistry.registerComponent('main', () => () => null);

const hermes = 'HermesInternal' in globalThis;
let report;
try {
  if (!hermes) throw new Error('Golden replay must execute under Hermes');
  report = { ok: true, hermes, fingerprints: assertRuntimeGoldenReplay() };
} catch (error) {
  report = { ok: false, hermes, error: String(error) };
}
void fetch(process.env.EXPO_PUBLIC_GOLDEN_RESULT_URL!, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(report),
});
