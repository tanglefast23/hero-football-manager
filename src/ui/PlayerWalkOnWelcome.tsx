import { useEffect } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { CharacterSpeechOverlay } from './CharacterSpeechOverlay';
import { PLAYER_SPRITE_CELL, PlayerRunSprite } from '../render/PlayerRunSprite';
import { playPositiveSfx } from '../render/management-sfx';
import type { TutorialAnchorLayout } from './tutorial-cue-position';
import type { PlayerSigningConfirmation } from './PlayerSigningOverlay';

const SPRITE_SCALE = 4;
/**
 * Only used until the tab rail has measured itself. A fixed clearance cannot be
 * right on both a phone and a desktop window — on a phone it walked him through
 * the nav buttons — so the rail's own top edge is the floor.
 */
const FALLBACK_GROUND_OFFSET = 78;
const LINE_MS = 2_400;

/**
 * The rookie's hello.
 *
 * This used to be a framed card with a portrait and a button. It is now the
 * player themselves — the same sprite the match renders — walking onto the home
 * screen, saying one line, and leaving. Nothing is covered and nothing has to
 * be dismissed: the celebration IS the screen you were already looking at.
 */
export function PlayerWalkOnWelcome({
  player,
  navigationAnchor,
  reduceMotion = false,
  onDone,
}: {
  player: PlayerSigningConfirmation;
  /** The measured tab rail. Its top edge is the floor he walks along. */
  navigationAnchor?: TutorialAnchorLayout | null;
  reduceMotion?: boolean;
  onDone: () => void;
}) {
  const { height: viewportHeight } = useWindowDimensions();

  useEffect(() => {
    playPositiveSfx();
  }, []);

  // Measured from the bottom of the screen, because that is what the overlay
  // positions against. An unmeasured rail falls back rather than dropping him
  // to the very bottom edge.
  const groundOffset = navigationAnchor
    ? Math.max(0, viewportHeight - navigationAnchor.y)
    : FALLBACK_GROUND_OFFSET;

  return (
    <CharacterSpeechOverlay
      lines={['Thanks for believing in me!']}
      characterWidth={PLAYER_SPRITE_CELL.width * SPRITE_SCALE}
      characterHeight={PLAYER_SPRITE_CELL.height * SPRITE_SCALE}
      groundOffset={groundOffset}
      autoAdvanceMs={LINE_MS}
      reduceMotion={reduceMotion}
      accessibilityLabel={`${player.playerName} says: thanks for believing in me.`}
      onDone={onDone}
    >
      <WalkingPlayer player={player} />
    </CharacterSpeechOverlay>
  );
}

/**
 * The overlay owns the walk, so the sprite is told to cycle its frames the
 * whole time it is on screen — a two-frame run held still would read as a
 * glitch, and he is only stationary for the length of one line.
 */
function WalkingPlayer({ player }: { player: PlayerSigningConfirmation }) {
  return (
    <View>
      <PlayerRunSprite
        playerId={player.playerId}
        role={player.role}
        lookId={player.lookId}
        scale={SPRITE_SCALE}
        walking
      />
    </View>
  );
}
