import { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { playFacilityCompleteSfx } from '../../render/management-sfx';
import type { FacilityCompletionViewModel } from '../models';
import { ManagementSprite } from './ManagementSprite';
import { StatusChip } from './Scorecard';

export function FacilityCompletionCard({
  completion,
  reduceMotion = false,
}: {
  completion: FacilityCompletionViewModel;
  reduceMotion?: boolean;
}) {
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
      accessibilityLabel={`${completion.name} level ${completion.level} is complete and operational${completion.trainingPointReward === undefined
        ? ''
        : `. ${completion.trainingPointReward} Training Points awarded`}`}
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
        <Text className="font-pixel text-base uppercase text-ink">Works complete!</Text>
        <StatusChip label={`Level ${completion.level}`} tone="success" />
      </View>
      <View className="flex-row items-center gap-4 p-4">
        <View className="border-2 border-b-4 border-ink bg-white p-2">
          <ManagementSprite
            spriteKey={`facility:${completion.type}:l${completion.level}`}
            width={88}
            accessibilityLabel={`${completion.name} facility`}
          />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-pixel text-lg uppercase text-ink">{completion.name} is open!</Text>
          <Text className="mt-2 text-sm leading-5 text-ink/65">
            {completion.trainingPointReward !== undefined
              ? `Construction is finished. You earned the first ${completion.trainingPointReward} TP now; the pitch adds ${completion.trainingPointReward} TP at each future weekly settlement.`
              : completion.kind === 'BUILD'
              ? 'Construction is finished. Its benefit is active; upkeep starts with the next weekly settlement.'
              : `The Level ${completion.level} improvements are finished and active now.`}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}
