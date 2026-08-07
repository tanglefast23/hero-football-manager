import { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { playFacilityCompleteSfx } from '../../render/management-sfx';
import type { FacilityCompletionViewModel } from '../models';
import { ManagementSprite } from './ManagementSprite';
import { StatusChip } from './Scorecard';
import { useCopy } from '../../i18n';

export function FacilityCompletionCard({
  completion,
  reduceMotion = false,
}: {
  completion: FacilityCompletionViewModel;
  reduceMotion?: boolean;
}) {
  const t = useCopy();
  const entrance = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    playFacilityCompleteSfx();
    if (reduceMotion) {
      entrance.setValue(1);
      return undefined;
    }
    entrance.setValue(0);
    const animation = Animated.spring(entrance, {
      toValue: 1,
      damping: 7,
      stiffness: 155,
      mass: 0.72,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [completion.kind, completion.level, completion.type, entrance, reduceMotion]);

  return (
    <Animated.View
      accessibilityRole="summary"
      accessibilityLabel={t('facilityCompletionCard.a11y.completeAndOperational', {
        name: completion.name,
        level: completion.level,
      })}
      className="mt-4 overflow-hidden border-2 border-b-4 border-gold-dark bg-gold-light"
      style={{
        opacity: entrance,
        transform: [
          { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
          { scale: entrance.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.82, 1.06, 1] }) },
        ],
      }}
    >
      <View className="flex-row items-center justify-between border-b-2 border-gold-dark bg-signal px-3 py-2">
        <Text className="font-pixel text-base uppercase text-ink">{t('facilityCompletionCard.worksComplete')}</Text>
        <StatusChip label={t('facilityCompletionCard.level', { level: completion.level })} tone="success" />
      </View>
      <View className="flex-row items-center gap-4 p-4">
        <View className="border-2 border-b-4 border-ink bg-white p-2">
          <ManagementSprite
            spriteKey={`facility:${completion.type}:l${completion.level}`}
            width={88}
            accessibilityLabel={t('facilityCompletionCard.a11y.facility', { name: completion.name })}
          />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-pixel text-lg uppercase text-ink">{t('facilityCompletion.isOpen', { name: completion.name })}</Text>
          <Text className="mt-2 text-sm leading-5 text-ink/65">
            {completion.kind === 'BUILD'
              ? t('facilityCompletionCard.buildFinished')
              : t('facilityCompletionCard.upgradeFinished', { level: completion.level })}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}
