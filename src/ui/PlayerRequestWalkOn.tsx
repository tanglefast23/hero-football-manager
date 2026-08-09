import { useWindowDimensions, View } from 'react-native';
import { CharacterSpeechOverlay } from './CharacterSpeechOverlay';
import { PLAYER_SPRITE_CELL, PlayerRunSprite } from '../render/PlayerRunSprite';
import type { TutorialAnchorLayout } from './tutorial-cue-position';
import type { PendingRequestViewModel } from '../application/player-request-view-model';
import type { Role } from '../sim/types';
import { useCopy } from '../i18n';

const SPRITE_SCALE = 4;
/** Used only until the tab rail has measured itself; its top edge is the floor. */
const FALLBACK_GROUND_OFFSET = 78;
const MIN_LINE_MS = 2_400;
const MS_PER_CHARACTER = 60;

/**
 * The asking player walks on and says their line; the decision card follows.
 *
 * The same rig as the new-signing hello on purpose. The manager has already
 * learned that a player walking on means a player is talking to them, so the
 * request arrives in a language the game has taught rather than a new one.
 */
export function PlayerRequestWalkOn({
  request,
  navigationAnchor,
  reduceMotion = false,
  onDone,
}: {
  request: PendingRequestViewModel;
  /** The measured tab rail. Its top edge is the floor they walk along. */
  navigationAnchor?: TutorialAnchorLayout | null;
  reduceMotion?: boolean;
  onDone: () => void;
}) {
  const t = useCopy();
  const { height: viewportHeight } = useWindowDimensions();
  const groundOffset = navigationAnchor
    ? Math.max(0, viewportHeight - navigationAnchor.y)
    : FALLBACK_GROUND_OFFSET;

  return (
    <CharacterSpeechOverlay
      lines={[request.line]}
      characterWidth={PLAYER_SPRITE_CELL.width * SPRITE_SCALE}
      characterHeight={PLAYER_SPRITE_CELL.height * SPRITE_SCALE}
      groundOffset={groundOffset}
      autoAdvanceMs={Math.max(
        MIN_LINE_MS,
        request.line.length * MS_PER_CHARACTER,
      )}
      reduceMotion={reduceMotion}
      accessibilityLabel={t('awardsCeremony.a11y.playerSays', {
        player: request.playerName,
        line: request.line,
      })}
      onDone={onDone}
    >
      <View>
        <PlayerRunSprite
          playerId={request.playerId}
          role={request.playerRole as Role}
          lookId={request.lookId}
          scale={SPRITE_SCALE}
          walking
        />
      </View>
    </CharacterSpeechOverlay>
  );
}
