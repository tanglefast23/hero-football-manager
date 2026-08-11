import { useWindowDimensions, View } from 'react-native';
import type { Role } from '../sim/types';
import { PLAYER_SPRITE_CELL, PlayerRunSprite } from '../render/PlayerRunSprite';
import { useCopy } from '../i18n';
import { CharacterSpeechOverlay } from './CharacterSpeechOverlay';
import { playerSaleFarewellLine } from './player-sale-farewell-lines';
import type { TutorialAnchorLayout } from './tutorial-cue-position';

const SPRITE_SCALE = 4;
const FALLBACK_GROUND_OFFSET = 78;
const MIN_LINE_MS = 2_400;
const MS_PER_CHARACTER = 60;

export interface PlayerSaleFarewellModel {
  readonly playerId: string;
  readonly playerName: string;
  readonly role: Role;
  readonly lookId?: string;
  readonly selectionKey: string;
}

/** The sold player walks on, says one farewell, then walks out to their new club. */
export function PlayerSaleFarewellWalkOn({
  player,
  navigationAnchor,
  reduceMotion = false,
  onDone,
}: {
  player: PlayerSaleFarewellModel;
  navigationAnchor?: TutorialAnchorLayout | null;
  reduceMotion?: boolean;
  onDone: () => void;
}) {
  const t = useCopy();
  const { height: viewportHeight } = useWindowDimensions();
  const groundOffset = navigationAnchor
    ? Math.max(0, viewportHeight - navigationAnchor.y)
    : FALLBACK_GROUND_OFFSET;
  const line = playerSaleFarewellLine(player.selectionKey, t);

  return (
    <CharacterSpeechOverlay
      lines={[line]}
      characterWidth={PLAYER_SPRITE_CELL.width * SPRITE_SCALE}
      characterHeight={PLAYER_SPRITE_CELL.height * SPRITE_SCALE}
      groundOffset={groundOffset}
      autoAdvanceMs={Math.max(MIN_LINE_MS, line.length * MS_PER_CHARACTER)}
      reduceMotion={reduceMotion}
      accessibilityLabel={t('awardsCeremony.a11y.playerSays', {
        player: player.playerName,
        line,
      })}
      onDone={onDone}
    >
      <View>
        <PlayerRunSprite
          playerId={player.playerId}
          role={player.role}
          lookId={player.lookId}
          scale={SPRITE_SCALE}
          walking
        />
      </View>
    </CharacterSpeechOverlay>
  );
}
