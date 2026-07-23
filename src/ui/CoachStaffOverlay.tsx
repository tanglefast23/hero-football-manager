import { Modal, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, Metric, PaperPanel, formatCurrency } from './components/Scorecard';
import { ManagementSprite } from './components/ManagementSprite';

export interface CoachOverlayCoach {
  role: 'HEAD' | 'ASSISTANT';
  portraitId: string;
  name: string;
  age: number;
  level: number;
  specialtyLabels: readonly string[];
  effectLabels: readonly string[];
  weeklyWage: number;
  severanceCost?: number;
}

export interface CoachStaffOverlayProps {
  mode: 'hired' | 'confirm-dismiss' | 'dismissed';
  coach: CoachOverlayCoach;
  reduceMotion?: boolean;
  onConfirm?: () => void;
  onClose: () => void;
}

export function CoachStaffOverlay({
  mode,
  coach,
  reduceMotion = false,
  onConfirm,
  onClose,
}: CoachStaffOverlayProps) {
  const isDismissConfirmation = mode === 'confirm-dismiss';
  const roleLabel = coach.role === 'HEAD' ? 'Head coach' : 'Assistant coach';
  const roleLabelLower = coach.role === 'HEAD' ? 'head coach' : 'assistant coach';
  const expression = mode === 'hired' ? 'joy' : 'rest';
  const kicker = mode === 'hired'
    ? 'Contract signed'
    : mode === 'dismissed'
      ? 'Staff change complete'
      : 'Boardroom decision';
  const title = mode === 'hired'
    ? 'Welcome to the club!'
    : mode === 'dismissed'
      ? `${coach.name} has left the club`
      : `Dismiss ${coach.name}?`;

  return (
    <Modal
      visible
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <SafeAreaView
        className="flex-1 justify-center bg-ink/60 px-4 py-6"
        edges={['top', 'left', 'right', 'bottom']}
      >
        <View accessibilityViewIsModal className="w-full">
          <PaperPanel kicker={kicker} title={title} stamp={mode === 'hired' ? 'HIRED' : mode === 'dismissed' ? 'COMPLETE' : '1 WK'}>
            <View className="items-center border-y-2 border-ink bg-blue-light py-4">
              <View className="border-2 border-b-4 border-ink bg-white px-4 pt-3">
                <ManagementSprite
                  spriteKey={`coach:${coach.portraitId}:${expression}`}
                  width={96}
                  accessibilityLabel={`${coach.name} coach portrait`}
                />
              </View>
              <Text className="mt-3 font-pixel text-xl uppercase text-ink">{coach.name}</Text>
              <Text className="mt-1 font-mono text-sm font-bold uppercase text-blue-dark">
                {roleLabel} · Age {coach.age} · Level {coach.level}
              </Text>
            </View>

            <View className="mt-3 flex-row gap-2">
              <Metric label="Weekly wage" value={formatCurrency(coach.weeklyWage)} />
              <Metric
                label={isDismissConfirmation ? 'Severance' : 'Specialties'}
                value={isDismissConfirmation
                  ? formatCurrency(coach.severanceCost ?? coach.weeklyWage)
                  : String(coach.specialtyLabels.length)}
                tone={isDismissConfirmation ? 'negative' : 'positive'}
              />
            </View>

            <View className="mt-3 flex-row flex-wrap justify-center gap-2">
              {coach.specialtyLabels.map(specialty => (
                <View key={specialty} className="border-2 border-ink bg-paper px-3 py-2">
                  <Text className="text-sm font-bold uppercase text-ink">{specialty}</Text>
                </View>
              ))}
            </View>

            <View className="mt-3 border-2 border-blue-dark bg-blue-light px-3 py-2">
              {coach.effectLabels.map(effect => (
                <Text key={effect} className="text-center text-sm font-bold text-ink">{effect}</Text>
              ))}
            </View>

            <Text className="mt-4 text-center text-base leading-5 text-ink/65">
              {mode === 'hired'
                ? `${coach.name} is now your ${roleLabelLower}.`
                : mode === 'dismissed'
                  ? `The ${roleLabelLower} position is vacant. You may now hire a replacement.`
                  : `The club will pay one week of wages (${formatCurrency(coach.severanceCost ?? coach.weeklyWage)}) immediately.`}
            </Text>

            <View className="mt-4 gap-2">
              {isDismissConfirmation ? (
                <>
                  <ActionButton
                    label={`Pay ${formatCurrency(coach.severanceCost ?? coach.weeklyWage)} & dismiss`}
                    accessibilityLabel={`Pay one week severance and dismiss ${coach.name}`}
                    variant="danger"
                    onPress={() => onConfirm?.()}
                  />
                  <ActionButton
                    label="Keep current coach"
                    accessibilityLabel={`Keep ${coach.name} as head coach`}
                    variant="paper"
                    onPress={onClose}
                  />
                </>
              ) : (
                <ActionButton
                  label="Return to club  ▸"
                  accessibilityLabel="Close coach confirmation"
                  onPress={onClose}
                />
              )}
            </View>
          </PaperPanel>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
