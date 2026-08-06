import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AssistantMode } from '../../game/types';
import { ASSISTANT_MODE_CHOICE } from '../assistant-mode-choice';
import { BertFullBody } from '../BertFullBody';
import { ChalkboardBackdrop } from '../components/ChalkboardStage';
import { ActionButton } from '../components/Scorecard';
import { useLayoutMode } from '../layout/use-layout-mode';
import { useCopy } from '../../i18n';

export interface AssistantModeChoiceScreenProps {
  onChoose: (mode: AssistantMode) => void;
  onBack: () => void;
}

/** The one question a proven manager gets before starting another career. */
export function AssistantModeChoiceScreen({
  onChoose,
  onBack,
}: AssistantModeChoiceScreenProps) {
  const t = useCopy();
  const wide = useLayoutMode() === 'twoColumn';

  return (
    <SafeAreaView className="flex-1 bg-pitch-dark" edges={['top', 'left', 'right', 'bottom']}>
      <ChalkboardBackdrop wide={wide} />
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
        <View
          className={wide
            ? 'w-full max-w-[1180px] flex-1 self-center justify-center px-10 py-8'
            : 'flex-1 justify-center px-5 py-6'}
        >
          <Text className={wide
            ? 'font-pixel text-sm uppercase tracking-[4px] text-gold-light'
            : 'font-pixel text-xs uppercase tracking-[3px] text-gold-light'}
          >
            {ASSISTANT_MODE_CHOICE.kicker}
          </Text>

          <View className={wide
            ? 'mt-7 flex-row items-end gap-6'
            : 'mt-5 flex-row items-end gap-3'}
          >
            <BertFullBody
              pointing={false}
              moment={ASSISTANT_MODE_CHOICE.moment}
              scale={wide ? 1 : 0.75}
            />
            <View
              accessible
              accessibilityRole="text"
              accessibilityLabel={ASSISTANT_MODE_CHOICE.line}
              className="mb-3 flex-1 border-2 border-b-4 border-ink bg-white p-4"
            >
              <Text className="text-base leading-6 text-ink">
                {ASSISTANT_MODE_CHOICE.line}
              </Text>
            </View>
          </View>

          <View className={wide ? 'mt-7 flex-row gap-5' : 'mt-6 gap-4'}>
            {ASSISTANT_MODE_CHOICE.options.map(option => (
              <View key={option.mode} className={wide ? 'flex-1 gap-2' : 'gap-2'}>
                <ActionButton
                  label={option.label}
                  accessibilityLabel={option.accessibilityLabel}
                  onPress={() => onChoose(option.mode)}
                  variant={option.mode === 'teacher' ? 'hero' : 'paper'}
                  pressSfx="click"
                />
                <Text className="px-1 text-sm leading-5 text-paper/75">{option.detail}</Text>
              </View>
            ))}
          </View>

          <View className={wide ? 'mt-7 w-48' : 'mt-6'}>
            <ActionButton
              label="‹ Back"
              accessibilityLabel={t('assistantModeChoice.a11y.back')}
              onPress={onBack}
              variant="paper"
              pressSfx="click"
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
