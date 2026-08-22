import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { currentStoreCopy } from '../application/store';
import { SfxPressable as Pressable } from './components/SfxPressable';
import { PixelText } from './components/PixelText';
import { reloadBrowserDocument } from '../persistence';
import { isStaleBundleError } from './stale-bundle';

interface ScreenErrorBoundaryProps {
  children: ReactNode;
  /** Sends the player somewhere that does not render the failing screen. */
  onRecover: () => void;
}

interface ScreenErrorBoundaryState {
  message: string | null;
  /** The failing screen's code no longer exists on the server (see below). */
  staleBundle: boolean;
}

/**
 * Last line of defence for the career screens. View models assert their
 * invariants by throwing, and several of those invariants depend on authored
 * content — a story or power a later content drop retires can still be
 * referenced by a save written under the old build. Without a boundary that
 * throw escapes React, takes the whole app down, and repeats on every relaunch
 * because the offending state is persisted. Recovery returns to the title so
 * the save is left intact rather than deleted — except for a stale web bundle,
 * where the only real recovery is reloading the document.
 */
export class ScreenErrorBoundary extends Component<
  ScreenErrorBoundaryProps,
  ScreenErrorBoundaryState
> {
  state: ScreenErrorBoundaryState = { message: null, staleBundle: false };

  static getDerivedStateFromError(error: unknown): ScreenErrorBoundaryState {
    return {
      message: error instanceof Error ? error.message : String(error),
      staleBundle: isStaleBundleError(error),
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('[screen] render failed', error, info.componentStack);
  }

  render(): ReactNode {
    const { message, staleBundle } = this.state;
    if (message === null) return this.props.children;
    // Reloading is only possible (and only needed) in a browser document.
    const offerReload = staleBundle && typeof window !== 'undefined';
    const t = currentStoreCopy();
    const copy = {
      heading: t('screenErrorBoundary.thisScreenCouldNotOpen'),
      body: t('screenErrorBoundary.body'),
      updateBody: t('screenErrorBoundary.updateBody'),
      technicalDetail: t('screenErrorBoundary.technicalDetail', { message }),
      backToTitle: t('screenErrorBoundary.backToTitle'),
      returnToTitle: t('screenErrorBoundary.a11y.returnToTheTitleScreen'),
      reloadGame: t('screenErrorBoundary.reloadGame'),
      reloadToLatest: t(
        'screenErrorBoundary.a11y.reloadTheGameToItsLatestVersion',
      ),
    };

    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-ink px-6">
        <View className="w-full border-2 border-stamp bg-paper p-5">
          <PixelText className="text-lg uppercase text-stamp">
            {copy.heading}
          </PixelText>
          <Text className="mt-3 text-sm leading-5 text-ink/70">
            {offerReload ? copy.updateBody : copy.body}
          </Text>
          <Text className="mt-2 text-xs leading-4 text-ink/50">
            {copy.technicalDetail}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              offerReload ? copy.reloadToLatest : copy.returnToTitle
            }
            onPress={() => {
              if (offerReload && reloadBrowserDocument()) return;
              this.setState({ message: null, staleBundle: false });
              this.props.onRecover();
            }}
            className="mt-5 min-h-12 items-center justify-center border-2 border-b-4 border-ink bg-blue px-4"
            style={({ pressed }) => ({
              transform: [{ translateY: pressed ? 2 : 0 }],
            })}
          >
            <Text className="font-pixel text-sm uppercase text-paper">
              {offerReload ? copy.reloadGame : copy.backToTitle}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }
}
