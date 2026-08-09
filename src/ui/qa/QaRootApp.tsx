import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { loadLaunchContent } from '../../content';
import { useCopy } from '../../i18n';
import { MatchScreen, type PowerCutInQaEntry } from '../../render/MatchScreen';
import { PowerEffectPreview } from '../../render/PowerEffectPreview';
import {
  powerMatchShowcaseAway,
  powerMatchShowcaseHome,
} from '../../render/power-match-showcase';
import {
  playAwakeningAscension,
  playAwakeningLimp,
  stopAwakeningAscension,
  stopAwakeningLimp,
  teardownAwakeningAudio,
} from '../../render/awakening-audio';
import { teardownCelebrationAudio } from '../../render/celebration-audio';
import { setMenuTheme, teardownMenuAudio } from '../../render/menu-audio';
import type { AwakeningCutsceneViewModel } from '../models';
import { SfxPressable as Pressable } from '../components/SfxPressable';
import { AwakeningCutsceneScreen } from '../screens/AwakeningCutsceneScreen';
import { AwakeningArtQaScreen } from '../screens/AwakeningArtQaScreen';
import { AwardsCeremonyQaScreen } from '../screens/AwardsCeremonyQaScreen';
import { PowerArtQaScreen } from '../screens/PowerArtQaScreen';
import { DevHarnessScreen } from '../dev-harness/DevHarnessScreen';

const HFMSilkscreen_400Regular = require('../../../assets/fonts/HFMSilkscreen_400Regular.ttf');
const HFMSilkscreen_700Bold = require('../../../assets/fonts/HFMSilkscreen_700Bold.ttf');

export type QaRootKind =
  | 'dev-harness'
  | 'power-match'
  | 'power-cutin'
  | 'power-art'
  | 'awakening-art'
  | 'awards-ceremony'
  | 'awakening-review';

export interface QaRootAppProps {
  kind: QaRootKind;
  triggerId?: string;
}

/** All review-only controllers and imports live behind one async boundary. */
export default function QaRootApp({ kind, triggerId }: QaRootAppProps) {
  if (kind === 'dev-harness') return <DevHarnessApp />;
  if (kind === 'power-match') return <PowerMatchQaApp />;
  if (kind === 'power-cutin') return <PowerCutInQaApp />;
  if (kind === 'power-art') return <PowerArtQaApp />;
  if (kind === 'awakening-art') {
    return <AwakeningArtQaApp triggerId={triggerId ?? 'magic-sponge'} />;
  }
  if (kind === 'awards-ceremony') return <AwardsCeremonyQaApp />;
  return <AwakeningReviewApp triggerId={triggerId ?? 'magic-sponge'} />;
}

const POWER_CUT_IN_QA_ENTRIES: readonly PowerCutInQaEntry[] = [
  {
    id: 'qa-fire',
    power: 'FIRE_TORCH',
    playerName: 'Dario Flint',
    skippable: false,
  },
  {
    id: 'qa-speed',
    power: 'SUPER_SPEED',
    playerName: 'Zip Vela',
    skippable: false,
  },
  {
    id: 'qa-gravity',
    power: 'GRAVITY_WELL',
    playerName: 'Leo Quick',
    skippable: false,
  },
  {
    id: 'qa-elastic',
    power: 'ELASTIC_KEEPER',
    playerName: 'Sam Mitts',
    skippable: false,
  },
];

function PowerMatchQaApp() {
  const t = useCopy();
  const content = useMemo(loadLaunchContent, []);
  const powers = content.powers.powers;
  const [selectedPowerIndex, setSelectedPowerIndex] = useState(0);
  const [replayKey, setReplayKey] = useState(0);
  const powerCount = powers.length;
  const powerIndex = selectedPowerIndex % powerCount;
  const power = powers[powerIndex];
  const home = useMemo(() => powerMatchShowcaseHome(power.id), [power.id]);
  const away = useMemo(powerMatchShowcaseAway, []);
  const powerMatchQa = useMemo(() => ({ power: power.id }), [power.id]);
  const [fontsLoaded] = useQaFonts();

  return (
    <SafeAreaProvider>
      {!fontsLoaded ? (
        <LoadingScreen />
      ) : (
        <>
          <StatusBar style="light" />
          <SafeAreaView className="flex-1 bg-ink">
            <View className="border-b-2 border-ink bg-blue-dark px-2 py-2">
              <View className="flex-row items-center gap-2">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t(
                    'app.a11y.showPreviousPowerInALiveMatch',
                  )}
                  className="min-h-11 items-center justify-center border-2 border-b-4 border-ink bg-paper px-3"
                  onPress={() => {
                    setSelectedPowerIndex(
                      (powerIndex - 1 + powerCount) % powerCount,
                    );
                    setReplayKey((key) => key + 1);
                  }}
                >
                  <Text className="font-pixel text-xs uppercase text-ink">
                    {t('app.prev')}
                  </Text>
                </Pressable>
                <View className="flex-1 items-center">
                  <Text className="font-pixel text-[10px] uppercase tracking-widest text-gold">
                    {t('app.liveMatchCount', {
                      index: String(powerIndex + 1).padStart(2, '0'),
                      total: String(powerCount).padStart(2, '0'),
                    })}
                  </Text>
                  <Text
                    numberOfLines={1}
                    className="font-pixel text-base uppercase text-paper"
                  >
                    {power.name}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('app.a11y.restartLiveMatchScenario', {
                    power: power.name,
                  })}
                  className="min-h-11 items-center justify-center border-2 border-b-4 border-ink bg-gold px-3"
                  onPress={() => setReplayKey((key) => key + 1)}
                >
                  <Text className="font-pixel text-xs uppercase text-ink">
                    ↻
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('app.a11y.showNextPowerInALiveMatch')}
                  className="min-h-11 items-center justify-center border-2 border-b-4 border-ink bg-paper px-3"
                  onPress={() => {
                    setSelectedPowerIndex((powerIndex + 1) % powerCount);
                    setReplayKey((key) => key + 1);
                  }}
                >
                  <Text className="font-pixel text-xs uppercase text-ink">
                    {t('app.next')}
                  </Text>
                </Pressable>
              </View>
              <Text className="mt-1 text-center font-pixel text-[10px] leading-4 text-paper/80">
                {power.description}
              </Text>
            </View>
            <View className="flex-1">
              <MatchScreen
                key={`${power.id}:${replayKey}`}
                seed={42}
                home={home}
                away={away}
                controlledTeam={0}
                reduceMotion={false}
                cutInMode="full"
                powerMatchQa={powerMatchQa}
                onOpenSettings={() => undefined}
                onDone={() => undefined}
              />
            </View>
          </SafeAreaView>
        </>
      )}
    </SafeAreaProvider>
  );
}

function PowerCutInQaApp() {
  const [fontsLoaded] = useQaFonts();
  return (
    <SafeAreaProvider>
      {!fontsLoaded ? (
        <LoadingScreen />
      ) : (
        <>
          <StatusBar style="light" />
          <SafeAreaView style={{ flex: 1, backgroundColor: '#16121f' }}>
            <MatchScreen
              seed={42}
              reduceMotion={false}
              cutInMode="full"
              powerCutInQaEntries={POWER_CUT_IN_QA_ENTRIES}
              onOpenSettings={() => undefined}
              onDone={() => undefined}
            />
          </SafeAreaView>
        </>
      )}
    </SafeAreaProvider>
  );
}

function PowerArtQaApp() {
  const content = useMemo(loadLaunchContent, []);
  const powers = content.powers.powers;
  const [selectedPowerIndex, setSelectedPowerIndex] = useState(0);
  const [replayKey, setReplayKey] = useState(0);
  const powerCount = powers.length;
  const powerIndex = selectedPowerIndex % powerCount;
  const power = powers[powerIndex];
  const [fontsLoaded] = useQaFonts();

  return (
    <SafeAreaProvider>
      {!fontsLoaded ? (
        <LoadingScreen />
      ) : (
        <>
          <StatusBar style="light" />
          <PowerArtQaScreen
            index={powerIndex}
            total={powerCount}
            name={power.name}
            description={power.description}
            category={power.category}
            tier={power.tier === 'starter' ? 'starter' : 'standard'}
            preview={
              <PowerEffectPreview power={power.id} replayKey={replayKey} />
            }
            onPrevious={() =>
              setSelectedPowerIndex((powerIndex - 1 + powerCount) % powerCount)
            }
            onReplay={() => setReplayKey((key) => key + 1)}
            onNext={() => setSelectedPowerIndex((powerIndex + 1) % powerCount)}
          />
        </>
      )}
    </SafeAreaProvider>
  );
}

function AwakeningArtQaApp({ triggerId }: { triggerId: string }) {
  const content = useMemo(loadLaunchContent, []);
  const [selectedTriggerIndex, setSelectedTriggerIndex] = useState(() => {
    const requestedIndex = content.onboarding.triggers.findIndex(
      (candidate) => candidate.id === triggerId,
    );
    return requestedIndex >= 0 ? requestedIndex : 0;
  });
  const triggerCount = content.onboarding.triggers.length;
  const triggerIndex = Math.min(selectedTriggerIndex, triggerCount - 1);
  const [fontsLoaded] = useQaFonts();
  const trigger = content.onboarding.triggers[triggerIndex];

  if (!fontsLoaded) return <LoadingScreen />;
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AwakeningArtQaScreen
        index={triggerIndex}
        total={triggerCount}
        title={trigger.title}
        callout={trigger.callout}
        visual={trigger.visual}
        onPrevious={() =>
          setSelectedTriggerIndex(
            (triggerIndex - 1 + triggerCount) % triggerCount,
          )
        }
        onNext={() =>
          setSelectedTriggerIndex((triggerIndex + 1) % triggerCount)
        }
      />
    </SafeAreaProvider>
  );
}

function AwardsCeremonyQaApp() {
  const [fontsLoaded] = useQaFonts();
  return (
    <SafeAreaProvider>
      {!fontsLoaded ? (
        <LoadingScreen />
      ) : (
        <>
          <StatusBar style="light" />
          <AwardsCeremonyQaScreen />
        </>
      )}
    </SafeAreaProvider>
  );
}

function DevHarnessApp() {
  const [fontsLoaded] = useQaFonts();
  return (
    <SafeAreaProvider>
      {!fontsLoaded ? (
        <LoadingScreen />
      ) : (
        <>
          <StatusBar style="light" />
          <DevHarnessScreen />
        </>
      )}
    </SafeAreaProvider>
  );
}

function AwakeningReviewApp({ triggerId }: { triggerId: string }) {
  const t = useCopy();
  const content = useMemo(loadLaunchContent, []);
  const [triggerIndex, setTriggerIndex] = useState(() => {
    const requestedIndex = content.onboarding.triggers.findIndex(
      (candidate) => candidate.id === triggerId,
    );
    return requestedIndex >= 0 ? requestedIndex : 0;
  });
  const trigger = content.onboarding.triggers[triggerIndex];
  const [fontsLoaded] = useQaFonts();
  const [previewBeat, setPreviewBeat] = useState<1 | 2 | 3>(1);
  const nextTriggerIndex =
    (triggerIndex + 1) % content.onboarding.triggers.length;

  useEffect(
    () => () => {
      teardownMenuAudio();
      teardownAwakeningAudio();
      teardownCelebrationAudio();
    },
    [],
  );

  useEffect(() => {
    setMenuTheme(null);
    if (previewBeat === 1) {
      playAwakeningLimp();
      stopAwakeningAscension();
      return undefined;
    }
    if (previewBeat === 3) {
      stopAwakeningLimp();
      playAwakeningAscension();
      return () => stopAwakeningAscension();
    }
    stopAwakeningAscension();
    return undefined;
  }, [previewBeat]);

  const viewModel: AwakeningCutsceneViewModel = {
    fixtureLabel: t('app.dev.awakeningReviewFixture', {
      index: triggerIndex + 1,
      total: content.onboarding.triggers.length,
    }),
    playerId: 'r10',
    playerName: 'ZIP VELA',
    role: 'FWD',
    powerId: 'SUPER_STRENGTH',
    powerName: 'SUPER STRENGTH',
    powerDescription:
      content.powers.powers.find((power) => power.id === 'SUPER_STRENGTH')
        ?.description ?? t('app.dev.awakeningReviewPowerDescription'),
    limpCopy: content.onboarding.limp.split('{name}').join('ZIP VELA'),
    triggerVisual: trigger.visual,
    triggerKicker: trigger.kicker,
    triggerTitle: trigger.title,
    triggerCallout: trigger.callout,
    triggerDetail: trigger.detail,
    triggerCopy: trigger.copy.split('{name}').join('ZIP VELA'),
    omenCopy: t('app.dev.awakeningReviewOmen', { name: 'ZIP VELA' }),
    revealCopy: t('app.dev.awakeningReviewReveal', { name: 'ZIP VELA' }),
    firstHero: true,
    licenseLabel: t('awakening.licenseActive'),
    continueLabel:
      triggerIndex === content.onboarding.triggers.length - 1
        ? 'RESTART SCENE REVIEW'
        : `NEXT SCENE · ${nextTriggerIndex + 1}/${content.onboarding.triggers.length}`,
  };

  return (
    <SafeAreaProvider>
      {!fontsLoaded ? (
        <LoadingScreen />
      ) : (
        <>
          <StatusBar style="light" />
          <AwakeningCutsceneScreen
            key={trigger.id}
            viewModel={viewModel}
            initialBeat={1}
            onBeatChange={setPreviewBeat}
            onContinue={() => {
              setPreviewBeat(1);
              setTriggerIndex(nextTriggerIndex);
            }}
          />
        </>
      )}
    </SafeAreaProvider>
  );
}

function useQaFonts() {
  return useFonts({ HFMSilkscreen_400Regular, HFMSilkscreen_700Bold });
}

function LoadingScreen() {
  const t = useCopy();
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-ink">
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t('app.a11y.openingClubFiles')}
        className="-rotate-2 border-2 border-signal px-5 py-4"
      >
        <Text className="font-pixel text-lg uppercase tracking-widest text-signal">
          {t('app.openingClubFiles')}
        </Text>
      </View>
    </SafeAreaView>
  );
}
