import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  playMatchStatementSfx,
  stopMatchStatementSfx,
} from '../render/management-sfx';
import { stopAllFinancialReportSfx } from '../render/financial-report-sfx';
import { SfxPressable as Pressable } from './components/SfxPressable';
import type { PostMatchViewModel } from './models';
import { ActionButton } from './components/Scorecard';
import { FinancialReportBody } from './components/FinancialReportBody';
import { CrossPlatformModal as Modal } from './components/CrossPlatformModal';
import { useCopy } from '../i18n';

export interface PostMatchSummaryModalProps {
  viewModel: PostMatchViewModel;
  onDismiss: () => void;
  reduceMotion?: boolean;
}

/**
 * Back at the office: the Financial Report. Money is the star — the score and
 * result already played out on the Full-time Report screen, so this modal
 * opens straight onto the statement's slot-machine reveal. Every dismissal
 * path (close, backdrop, Continue, Android back) stops the report audio.
 */
export function PostMatchSummaryModal({
  viewModel,
  onDismiss,
  reduceMotion = false,
}: PostMatchSummaryModalProps) {
  const t = useCopy();
  useEffect(() => {
    playMatchStatementSfx();
    return () => stopMatchStatementSfx();
  }, []);

  const handleDismiss = useCallback(() => {
    stopAllFinancialReportSfx();
    onDismiss();
  }, [onDismiss]);

  /**
   * Continue spends its first press on the reveal, not on the exit.
   *
   * Pressing it mid-count used to leave the report outright, which cost the
   * manager the one number they were waiting for — the reveal is the report,
   * and the button that ends it should not also be the only way to see the end
   * of it. So while the statement is still counting, Continue lands the reels
   * (the same beat as tapping the statement) and the next press leaves.
   * The close button and the backdrop still leave immediately: those mean
   * "get me out", not "get on with it".
   */
  const [statementRunning, setStatementRunning] = useState(false);
  const [skipSignal, setSkipSignal] = useState(0);
  const handleContinue = useCallback(() => {
    if (statementRunning) {
      setSkipSignal((signal) => signal + 1);
      return;
    }
    handleDismiss();
  }, [handleDismiss, statementRunning]);

  return (
    <Modal
      visible
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      <SafeAreaView
        style={styles.safeArea}
        edges={['top', 'left', 'right', 'bottom']}
      >
        <View className="flex-1 justify-end px-3 pb-3">
          <Pressable
            accessible={false}
            style={StyleSheet.absoluteFill}
            onPress={handleDismiss}
          >
            <View
              className="flex-1"
              style={{ backgroundColor: 'rgba(36,31,46,0.62)' }}
            />
          </Pressable>
          <View
            accessibilityViewIsModal
            className="w-full max-w-[560px] self-center overflow-hidden border-2 border-b-4 border-ink bg-paper"
            style={{ maxHeight: '92%' }}
          >
            <View className="flex-row items-center justify-between border-b-2 border-ink bg-paper-dark px-4 py-3">
              <View className="flex-1 pr-3">
                <Text className="font-pixel text-[12px] uppercase text-blue-dark">
                  {t('postMatchSummary.backAtTheOffice')}
                </Text>
                <Text className="mt-1 font-pixel text-[18px] uppercase text-ink">
                  {t('postMatchSummary.financialReport')}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(
                  'postMatchSummary.a11y.closeFinancialReport',
                )}
                onPress={handleDismiss}
                className="h-11 w-11 items-center justify-center border-2 border-ink bg-white"
                // Explicit points: h-11 is 38.5pt on native, under the 44pt
                // touch-target contract — see ActionButton's minHeight.
                style={{ minWidth: 44, minHeight: 44 }}
              >
                <Text className="font-pixel text-[16px] text-ink">×</Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
            >
              <FinancialReportBody
                viewModel={viewModel}
                reduceMotion={reduceMotion}
                skipSignal={skipSignal}
                onStatementRunningChange={setStatementRunning}
              />
            </ScrollView>

            <View className="border-t-2 border-ink/20 bg-white p-3">
              <ActionButton
                label={t('postMatchSummary.continue')}
                accessibilityLabel={
                  statementRunning
                    ? t('postMatchSummary.a11y.showTheRestOfTheStatement')
                    : t('postMatchSummary.a11y.continuePastTheFinancialReport')
                }
                onPress={handleContinue}
              />
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
});
