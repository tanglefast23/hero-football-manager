import { useEffect } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { CharacterSpeechOverlay } from './CharacterSpeechOverlay';
import { CrossPlatformModal as Modal } from './components/CrossPlatformModal';
import { ActionButton, PaperPanel } from './components/Scorecard';
import { PixelText } from './components/PixelText';
import { PLAYER_SPRITE_CELL, PlayerRunSprite } from '../render/PlayerRunSprite';
import { playPositiveSfx } from '../render/management-sfx';
import type { MidseasonTrainingViewModel } from './models';
import type { TutorialAnchorLayout } from './tutorial-cue-position';
import { useCopy } from '../i18n';

const SPRITE_SCALE = 4;
const FALLBACK_GROUND_OFFSET = 78;
const MIN_LINE_MS = 2_400;
const MS_PER_CHARACTER = 60;

export function MidseasonTrainingCaptainWalkOn({
  viewModel,
  navigationAnchor,
  reduceMotion = false,
  onDone,
}: {
  readonly viewModel: MidseasonTrainingViewModel;
  readonly navigationAnchor?: TutorialAnchorLayout | null;
  readonly reduceMotion?: boolean;
  readonly onDone: () => void;
}) {
  const t = useCopy();
  const { height: viewportHeight } = useWindowDimensions();
  const line = t('midseasonTraining.captainLine');
  const groundOffset = navigationAnchor
    ? Math.max(0, viewportHeight - navigationAnchor.y)
    : FALLBACK_GROUND_OFFSET;

  useEffect(() => {
    playPositiveSfx();
  }, []);

  return (
    <CharacterSpeechOverlay
      lines={[line]}
      characterWidth={PLAYER_SPRITE_CELL.width * SPRITE_SCALE}
      characterHeight={PLAYER_SPRITE_CELL.height * SPRITE_SCALE}
      groundOffset={groundOffset}
      autoAdvanceMs={Math.max(MIN_LINE_MS, line.length * MS_PER_CHARACTER)}
      reduceMotion={reduceMotion}
      accessibilityLabel={t('midseasonTraining.a11y.captainSays', {
        player: viewModel.captain.name,
        line,
      })}
      onDone={onDone}
    >
      <View>
        <PlayerRunSprite
          playerId={viewModel.captain.id}
          role={viewModel.captain.role}
          scale={SPRITE_SCALE}
          walking
        />
        <View pointerEvents="none" style={styles.armbandOutline}>
          <View style={styles.armband} />
        </View>
      </View>
    </CharacterSpeechOverlay>
  );
}

export function MidseasonTrainingDecisionCard({
  viewModel,
  reduceMotion = false,
  onYes,
  onNo,
}: {
  readonly viewModel: MidseasonTrainingViewModel;
  readonly reduceMotion?: boolean;
  readonly onYes: () => void;
  readonly onNo: () => void;
}) {
  const t = useCopy();
  return (
    <Modal
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      visible
      onRequestClose={onNo}
    >
      <View className="flex-1 items-center justify-center bg-ink/70 px-4">
        <PaperPanel
          kicker={t('midseasonTraining.decisionKicker')}
          title={t('midseasonTraining.decisionTitle')}
          className="w-full max-w-[520px]"
        >
          <Text className="text-center text-lg leading-7 text-ink">
            {t('midseasonTraining.spendAllTp', {
              tp: viewModel.trainingPointsLabel,
              condition: viewModel.conditionCost,
            })}
          </Text>
          <PixelText className="mt-3 text-center text-sm uppercase text-pitch-ink">
            {t('midseasonTraining.divisionReward', {
              gain: viewModel.statGain,
            })}
          </PixelText>
          <View className="mt-5 flex-row gap-3">
            <View className="flex-1">
              <ActionButton
                label={t('midseasonTraining.no')}
                accessibilityLabel={t('midseasonTraining.a11y.no')}
                variant="paper"
                onPress={onNo}
              />
            </View>
            <View className="flex-1">
              <ActionButton
                label={t('midseasonTraining.yes')}
                accessibilityLabel={t('midseasonTraining.a11y.yes', {
                  tp: viewModel.trainingPointsLabel,
                  condition: viewModel.conditionCost,
                })}
                variant="confirm"
                onPress={onYes}
              />
            </View>
          </View>
        </PaperPanel>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  armbandOutline: {
    position: 'absolute',
    right: 14,
    top: 45,
    width: 13,
    height: 8,
    borderWidth: 2,
    borderColor: '#241f2e',
    backgroundColor: '#241f2e',
  },
  armband: {
    flex: 1,
    backgroundColor: '#f6c744',
  },
});
