import { useCallback, useEffect } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  useEffect(() => {
    playMatchStatementSfx();
    return () => stopMatchStatementSfx();
  }, []);

  const handleDismiss = useCallback(() => {
    stopAllFinancialReportSfx();
    onDismiss();
  }, [onDismiss]);

  return (
    <Modal
      visible
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right', 'bottom']}>
        <View className="flex-1 justify-end px-3 pb-3">
          <Pressable
            accessible={false}
            style={StyleSheet.absoluteFill}
            onPress={handleDismiss}
          >
            <View className="flex-1" style={{ backgroundColor: 'rgba(36,31,46,0.62)' }} />
          </Pressable>
          <View
            accessibilityViewIsModal
            className="w-full max-w-[560px] self-center overflow-hidden border-2 border-b-4 border-ink bg-paper"
            style={{ maxHeight: '92%' }}
          >
            <View className="flex-row items-center justify-between border-b-2 border-ink bg-paper-dark px-4 py-3">
              <View className="flex-1 pr-3">
                <Text className="font-pixel text-sm uppercase text-blue-dark">Back at the office</Text>
                <Text className="mt-1 font-pixel text-xl uppercase text-ink">Financial report</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close financial report"
                onPress={handleDismiss}
                className="h-11 w-11 items-center justify-center border-2 border-ink bg-white"
              >
                <Text className="font-pixel text-lg text-ink">×</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
              <FinancialReportBody viewModel={viewModel} reduceMotion={reduceMotion} />
            </ScrollView>

            <View className="border-t-2 border-ink/20 bg-white p-3">
              <ActionButton
                label="Continue  ▸"
                accessibilityLabel="Continue past the financial report"
                onPress={handleDismiss}
              />
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
