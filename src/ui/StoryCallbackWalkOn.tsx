import { useWindowDimensions, View } from 'react-native';
import type { GameState, StoryCallback } from '../game/types';
import { PLAYER_SPRITE_CELL, PlayerRunSprite } from '../render/PlayerRunSprite';
import { CharacterSpeechOverlay } from './CharacterSpeechOverlay';
import { ManagementSprite } from './components/ManagementSprite';
import type { TutorialAnchorLayout } from './tutorial-cue-position';

const PLAYER_SCALE = 4;
const COACH_WIDTH = 96;

export function StoryCallbackWalkOn({
  callback,
  state,
  line,
  navigationAnchor,
  reduceMotion = false,
  onDone,
}: {
  callback: StoryCallback;
  state: GameState;
  line: string;
  navigationAnchor?: TutorialAnchorLayout | null;
  reduceMotion?: boolean;
  onDone: () => void;
}) {
  const { height } = useWindowDimensions();
  const groundOffset = navigationAnchor
    ? Math.max(0, height - navigationAnchor.y)
    : 78;
  const player = state.players.find(
    (candidate) => candidate.id === callback.playerId,
  );
  const coach =
    callback.coachRole === 'HEAD'
      ? state.market?.headCoach
      : state.market?.assistantCoach;
  const playerVisible = callback.speaker === 'PLAYER' && player !== undefined;

  return (
    <CharacterSpeechOverlay
      lines={[line]}
      characterWidth={
        playerVisible ? PLAYER_SPRITE_CELL.width * PLAYER_SCALE : COACH_WIDTH
      }
      characterHeight={
        playerVisible ? PLAYER_SPRITE_CELL.height * PLAYER_SCALE : 128
      }
      groundOffset={groundOffset}
      reduceMotion={reduceMotion}
      onDone={onDone}
    >
      <View>
        {playerVisible ? (
          <PlayerRunSprite
            playerId={player.id}
            role={player.role}
            lookId={player.lookId}
            scale={PLAYER_SCALE}
            walking
          />
        ) : (
          <ManagementSprite
            spriteKey={`coach:${coach?.portraitId ?? coach?.id ?? 'head-default'}:rest`}
            width={COACH_WIDTH}
          />
        )}
      </View>
    </CharacterSpeechOverlay>
  );
}
