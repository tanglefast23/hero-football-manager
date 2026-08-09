import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SfxPressable as Pressable } from './components/SfxPressable';
import { PixelText } from './components/PixelText';
import { useCopy } from '../i18n';

interface ScreenErrorBoundaryProps {
  children: ReactNode;
  /** Sends the player somewhere that does not render the failing screen. */
  onRecover: () => void;
}

interface ScreenErrorBoundaryState {
  message: string | null;
}

interface ScreenErrorCopy {
  heading: string;
  body: string;
  technicalDetail: (message: string) => string;
  backToTitle: string;
  returnToTitle: string;
}

/**
 * Last line of defence for the career screens. View models assert their
 * invariants by throwing, and several of those invariants depend on authored
 * content — a story or power a later content drop retires can still be
 * referenced by a save written under the old build. Without a boundary that
 * throw escapes React, takes the whole app down, and repeats on every relaunch
 * because the offending state is persisted. Recovery returns to the title so
 * the save is left intact rather than deleted.
 */
class ScreenErrorBoundaryCatcher extends Component<
  ScreenErrorBoundaryProps & { copy: ScreenErrorCopy },
  ScreenErrorBoundaryState
> {
  state: ScreenErrorBoundaryState = { message: null };

  static getDerivedStateFromError(error: unknown): ScreenErrorBoundaryState {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('[screen] render failed', error, info.componentStack);
  }

  render(): ReactNode {
    const { message } = this.state;
    if (message === null) return this.props.children;

    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-ink px-6">
        <View className="w-full border-2 border-stamp bg-paper p-5">
          <PixelText className="text-lg uppercase text-stamp">
            {this.props.copy.heading}
          </PixelText>
          <Text className="mt-3 text-sm leading-5 text-ink/70">
            {this.props.copy.body}
          </Text>
          <Text className="mt-2 text-xs leading-4 text-ink/50">
            {this.props.copy.technicalDetail(message)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={this.props.copy.returnToTitle}
            onPress={() => {
              this.setState({ message: null });
              this.props.onRecover();
            }}
            className="mt-5 min-h-12 items-center justify-center border-2 border-b-4 border-ink bg-blue px-4"
            style={({ pressed }) => ({
              transform: [{ translateY: pressed ? 2 : 0 }],
            })}
          >
            <Text className="font-pixel text-sm uppercase text-paper">
              {this.props.copy.backToTitle}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }
}

/**
 * The class remains the error catcher. This wrapper reads the active catalog
 * before the child screen throws and passes plain strings into that class.
 */
export function ScreenErrorBoundary(props: ScreenErrorBoundaryProps) {
  const t = useCopy();
  const copy: ScreenErrorCopy = {
    heading: t('screenErrorBoundary.thisScreenCouldNotOpen'),
    body: t('screenErrorBoundary.body'),
    technicalDetail: (message) =>
      t('screenErrorBoundary.technicalDetail', { message }),
    backToTitle: t('screenErrorBoundary.backToTitle'),
    returnToTitle: t('screenErrorBoundary.a11y.returnToTheTitleScreen'),
  };
  return <ScreenErrorBoundaryCatcher {...props} copy={copy} />;
}
