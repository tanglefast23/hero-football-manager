import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SfxPressable as Pressable } from './components/SfxPressable';
import { ActionButton } from './components/Scorecard';
import type { TrainingSlotStatOption } from './models';

export interface TrainingDrillModalProps {
  playerId: string;
  playerName: string;
  options: readonly TrainingSlotStatOption[];
  /** The player's committed drill path, when one is already picked. */
  currentPathId?: string;
  onPickDrill: (playerId: string, pathId: string) => void;
  onRemoveFromTraining: (playerId: string) => void;
  onDismiss: () => void;
  reduceMotion?: boolean;
}

/** Bottom-anchored drill picker that opens the moment a player joins training. */
export function TrainingDrillModal({
  playerId,
  playerName,
  options,
  currentPathId,
  onPickDrill,
  onRemoveFromTraining,
  onDismiss,
  reduceMotion = false,
}: TrainingDrillModalProps) {
  return (
    <Modal
      visible
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right', 'bottom']}>
        <View className="flex-1 justify-end px-3 pb-3">
          <Pressable
            accessible={false}
            style={StyleSheet.absoluteFill}
            onPress={onDismiss}
          >
            <View className="flex-1" style={{ backgroundColor: 'rgba(36,31,46,0.62)' }} />
          </Pressable>
          <View
            accessibilityViewIsModal
            className="w-full overflow-hidden border-2 border-b-4 border-ink bg-paper"
            style={{ maxHeight: '92%' }}
          >
            <View className="flex-row items-center justify-between border-b-2 border-ink bg-paper-dark px-4 py-3">
              <View className="flex-1 pr-3">
                <Text className="font-mono text-sm font-bold uppercase text-blue-dark">Training focus</Text>
                <Text className="mt-1 font-pixel text-xl uppercase text-ink" numberOfLines={1}>{playerName}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Close training focus for ${playerName}`}
                onPress={onDismiss}
                className="h-11 w-11 items-center justify-center border-2 border-ink bg-white"
              >
                <Text className="font-mono text-lg font-bold text-ink">×</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 8 }}>
              <View className="gap-2">
                {options.map(option => {
                  const isCurrent = option.pathId === currentPathId;
                  return (
                    <Pressable
                      key={option.pathId}
                      accessibilityRole="radio"
                      accessibilityLabel={`Train ${playerName} in ${option.label}`}
                      accessibilityHint={`${option.drillName}. Gains ${option.gain} ${option.label}. Currently ${option.current} of ${option.cap}.`}
                      accessibilityState={{ checked: isCurrent, disabled: option.atCap }}
                      disabled={option.atCap}
                      onPress={() => onPickDrill(playerId, option.pathId)}
                      className={option.atCap
                        ? 'flex-row items-center justify-between border-2 border-ink/20 bg-white px-3 py-3 opacity-40'
                        : isCurrent
                          ? 'flex-row items-center justify-between border-2 border-violet-dark bg-violet-light px-3 py-3'
                          : 'flex-row items-center justify-between border-2 border-ink/30 bg-white px-3 py-3'}
                      style={({ pressed }) => ({ opacity: pressed && !option.atCap ? 0.65 : undefined })}
                    >
                      <View className="min-w-0 flex-1 pr-2">
                        <Text className="text-base font-bold uppercase text-ink" numberOfLines={1}>{option.drillName}</Text>
                        <Text className="mt-0.5 font-mono text-sm font-bold text-ink/60" numberOfLines={1}>
                          {option.current}/{option.cap} {option.shortCode}
                        </Text>
                      </View>
                      <Text
                        className={isCurrent ? 'font-mono text-base font-bold text-violet-dark' : 'font-mono text-base font-bold text-ink'}
                        numberOfLines={1}
                      >
                        +{option.gain} {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
            <View className="border-t-2 border-ink/15 px-4 py-3">
              <ActionButton
                label="Remove from training"
                variant="danger"
                compact
                accessibilityLabel={`Remove ${playerName} from this week's training slots`}
                onPress={() => onRemoveFromTraining(playerId)}
              />
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
