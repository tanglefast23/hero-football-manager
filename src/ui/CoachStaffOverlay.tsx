import { Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActionButton,
  Metric,
  PaperPanel,
  formatCurrency,
} from './components/Scorecard';
import { ManagementSprite } from './components/ManagementSprite';
import { PixelText } from './components/PixelText';
import { useCopy } from '../i18n';

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
  const t = useCopy();
  const isDismissConfirmation = mode === 'confirm-dismiss';
  const roleLabel =
    coach.role === 'HEAD'
      ? t('coachStaff.headCoach')
      : t('coachStaff.assistantCoach');
  const roleLabelLower =
    coach.role === 'HEAD'
      ? t('coachStaff.roleHeadLower')
      : t('coachStaff.roleAssistantLower');
  const expression = mode === 'hired' ? 'joy' : 'rest';
  const kicker =
    mode === 'hired'
      ? t('coachStaff.kickerContractSigned')
      : mode === 'dismissed'
        ? t('coachStaff.kickerStaffChangeComplete')
        : t('coachStaff.kickerBoardroomDecision');
  const title =
    mode === 'hired'
      ? t('coachStaff.titleWelcome')
      : mode === 'dismissed'
        ? t('coachStaff.titleHasLeft', { name: coach.name })
        : t('coachStaff.titleDismiss', { name: coach.name });

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
        {/* Receipts ("hired", "dismissed") close on an outside tap; the dismissal
            question does not, because a stray tap must never answer it. The
            backdrop is a sibling of the panel so taps on its controls never
            bubble into the close target. */}
        {isDismissConfirmation ? null : (
          <Pressable
            accessible={false}
            className="absolute inset-0"
            onPress={onClose}
          />
        )}
        <View
          accessibilityViewIsModal
          className="w-full max-w-[560px] self-center"
        >
          <PaperPanel
            kicker={kicker}
            title={title}
            stamp={
              mode === 'hired'
                ? t('coachStaff.stampHired')
                : mode === 'dismissed'
                  ? t('coachStaff.stampComplete')
                  : t('coachStaff.stampOneWeek')
            }
          >
            <View className="items-center border-y-2 border-ink bg-blue-light py-4">
              <View className="border-2 border-b-4 border-ink bg-white px-4 pt-3">
                <ManagementSprite
                  spriteKey={`coach:${coach.portraitId}:${expression}`}
                  width={96}
                  accessibilityLabel={t('coachStaff.a11y.coachPortrait', {
                    name: coach.name,
                  })}
                />
              </View>
              <Text className="mt-3 font-pixel text-xl uppercase text-ink">
                {coach.name}
              </Text>
              <Text className="mt-1 font-pixel text-sm uppercase text-blue-dark">
                {t('coachStaff.coachLine', {
                  role: roleLabel,
                  age: coach.age,
                  level: coach.level,
                })}
              </Text>
            </View>

            <View className="mt-3 flex-row gap-2">
              <Metric
                label={t('coachStaff.weeklyWage')}
                value={formatCurrency(t, coach.weeklyWage)}
              />
              <Metric
                label={
                  isDismissConfirmation
                    ? t('coachStaff.severance')
                    : t('coachStaff.specialties')
                }
                value={
                  isDismissConfirmation
                    ? formatCurrency(t, coach.severanceCost ?? coach.weeklyWage)
                    : String(coach.specialtyLabels.length)
                }
                tone={isDismissConfirmation ? 'negative' : 'positive'}
              />
            </View>

            <View className="mt-3 flex-row flex-wrap justify-center gap-2">
              {coach.specialtyLabels.map((specialty) => (
                <View
                  key={specialty}
                  className="border-2 border-ink bg-paper px-3 py-2"
                >
                  <PixelText className="text-sm uppercase text-ink">
                    {specialty}
                  </PixelText>
                </View>
              ))}
            </View>

            <View className="mt-3 border-2 border-blue-dark bg-blue-light px-3 py-2">
              {coach.effectLabels.map((effect) => (
                <Text
                  key={effect}
                  className="text-center text-sm font-bold text-ink"
                >
                  {effect}
                </Text>
              ))}
            </View>

            <Text className="mt-4 text-center text-base leading-5 text-ink/65">
              {mode === 'hired'
                ? t('coachStaff.nowYourRole', {
                    name: coach.name,
                    role: roleLabelLower,
                  })
                : mode === 'dismissed'
                  ? t('coachStaff.positionVacant', { role: roleLabelLower })
                  : t('coachStaff.severanceNotice', {
                      amount: formatCurrency(
                        t,
                        coach.severanceCost ?? coach.weeklyWage,
                      ),
                    })}
            </Text>

            <View className="mt-4 gap-2">
              {isDismissConfirmation ? (
                <>
                  <ActionButton
                    label={t('coachStaff.payAndDismiss', {
                      amount: formatCurrency(
                        t,
                        coach.severanceCost ?? coach.weeklyWage,
                      ),
                    })}
                    accessibilityLabel={t(
                      'coachStaff.a11y.paySeveranceAndDismiss',
                      { name: coach.name },
                    )}
                    variant="danger"
                    onPress={() => onConfirm?.()}
                  />
                  <ActionButton
                    label={t('coachStaff.keepCurrentCoach')}
                    accessibilityLabel={t('coachStaff.a11y.keepAsHeadCoach', {
                      name: coach.name,
                    })}
                    variant="paper"
                    onPress={onClose}
                  />
                </>
              ) : (
                <ActionButton
                  label={t('coachStaff.returnHome')}
                  accessibilityLabel={t(
                    'coachStaff.a11y.closeCoachConfirmationAndReturnHome',
                  )}
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
