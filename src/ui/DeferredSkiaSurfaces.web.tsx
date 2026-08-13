import { lazy, Suspense } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { QuickResultFaceOffProps } from '../render/QuickResultFaceOff';
import type { PenaltyShootoutProps } from '../render/PenaltyShootout';
import type { RivalHeroIntroScreenProps } from './RivalHeroIntroScreen';
import type { MatchDayBannerProps } from './components/MatchDayBanner';
import type { AwakeningCutsceneScreenProps } from './screens/AwakeningCutsceneScreen';
import type { ChampionshipCelebrationScreenProps } from './screens/ChampionshipCelebrationScreen';
import type { EndgameCelebrationScreenProps } from './screens/EndgameCelebrationScreen';
import type { MidseasonTrainingCelebrationScreenProps } from './screens/MidseasonTrainingCelebrationScreen';
import type { StoryEventScreenProps } from './screens/StoryEventScreen';
import { useCopy, usePixelStyles, type LocaleFaces } from '../i18n';

async function loadSkia() {
  const { LoadSkiaWeb } =
    await import('@shopify/react-native-skia/lib/module/web');
  await LoadSkiaWeb({ locateFile: (file) => `/${file}` });
}

function LoadingSurface() {
  const t = useCopy();
  const styles = usePixelStyles(makeStyles);
  return (
    <View
      style={styles.loading}
      accessibilityLabel={t('app.a11y.loadingMatchArtwork')}
    >
      <Text style={styles.loadingText}>{t('app.loadingMatchArtwork')}</Text>
    </View>
  );
}

const DeferredQuickResultFaceOff = lazy(async () => {
  await loadSkia();
  const module = await import('./SkiaSurfaceImplementations');
  return { default: module.QuickResultFaceOff };
});

const DeferredPenaltyShootout = lazy(async () => {
  await loadSkia();
  const module = await import('./SkiaSurfaceImplementations');
  return { default: module.PenaltyShootout };
});

const DeferredRivalHeroIntroScreen = lazy(async () => {
  await loadSkia();
  const module = await import('./SkiaSurfaceImplementations');
  return { default: module.RivalHeroIntroScreen };
});

const DeferredMatchDayBanner = lazy(async () => {
  await loadSkia();
  const module = await import('./SkiaSurfaceImplementations');
  return { default: module.MatchDayBanner };
});

const DeferredAwakeningCutsceneScreen = lazy(async () => {
  await loadSkia();
  const module = await import('./SkiaSurfaceImplementations');
  return { default: module.AwakeningCutsceneScreen };
});

const DeferredChampionshipCelebrationScreen = lazy(async () => {
  await loadSkia();
  const module = await import('./SkiaSurfaceImplementations');
  return { default: module.ChampionshipCelebrationScreen };
});

const DeferredEndgameCelebrationScreen = lazy(async () => {
  await loadSkia();
  const module = await import('./SkiaSurfaceImplementations');
  return { default: module.EndgameCelebrationScreen };
});

const DeferredMidseasonTrainingCelebrationScreen = lazy(async () => {
  await loadSkia();
  const module = await import('./SkiaSurfaceImplementations');
  return { default: module.MidseasonTrainingCelebrationScreen };
});

const DeferredStoryEventScreen = lazy(async () => {
  await loadSkia();
  const module = await import('./SkiaSurfaceImplementations');
  return { default: module.StoryEventScreen };
});

export function QuickResultFaceOff(props: QuickResultFaceOffProps) {
  return (
    <Suspense fallback={<LoadingSurface />}>
      <DeferredQuickResultFaceOff {...props} />
    </Suspense>
  );
}

export function PenaltyShootout(props: PenaltyShootoutProps) {
  return (
    <Suspense fallback={<LoadingSurface />}>
      <DeferredPenaltyShootout {...props} />
    </Suspense>
  );
}

export function RivalHeroIntroScreen(props: RivalHeroIntroScreenProps) {
  return (
    <Suspense fallback={<LoadingSurface />}>
      <DeferredRivalHeroIntroScreen {...props} />
    </Suspense>
  );
}

export function MatchDayBanner(props: MatchDayBannerProps) {
  return (
    <Suspense fallback={null}>
      <DeferredMatchDayBanner {...props} />
    </Suspense>
  );
}

export function AwakeningCutsceneScreen(props: AwakeningCutsceneScreenProps) {
  return (
    <Suspense fallback={<LoadingSurface />}>
      <DeferredAwakeningCutsceneScreen {...props} />
    </Suspense>
  );
}

export function ChampionshipCelebrationScreen(
  props: ChampionshipCelebrationScreenProps,
) {
  return (
    <Suspense fallback={<LoadingSurface />}>
      <DeferredChampionshipCelebrationScreen {...props} />
    </Suspense>
  );
}

export function EndgameCelebrationScreen(props: EndgameCelebrationScreenProps) {
  return (
    <Suspense fallback={<LoadingSurface />}>
      <DeferredEndgameCelebrationScreen {...props} />
    </Suspense>
  );
}

export function MidseasonTrainingCelebrationScreen(
  props: MidseasonTrainingCelebrationScreenProps,
) {
  return (
    <Suspense fallback={<LoadingSurface />}>
      <DeferredMidseasonTrainingCelebrationScreen {...props} />
    </Suspense>
  );
}

export function StoryEventScreen(props: StoryEventScreenProps) {
  return (
    <Suspense fallback={<LoadingSurface />}>
      <DeferredStoryEventScreen {...props} />
    </Suspense>
  );
}

const makeStyles = (faces: LocaleFaces) =>
  StyleSheet.create({
    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#241f2e',
    },
    loadingText: {
      color: '#f4ead0',
      fontFamily: faces.display,
      fontSize: 12,
    },
  });
