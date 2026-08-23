import { useEffect } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { CharacterSpeechOverlay } from './CharacterSpeechOverlay';
import { PLAYER_SPRITE_CELL, PlayerRunSprite } from '../render/PlayerRunSprite';
import { playPositiveSfx } from '../render/management-sfx';
import { arrivalLine } from './player-arrival-lines';
import type { TutorialAnchorLayout } from './tutorial-cue-position';
import type { PlayerSigningConfirmation } from './PlayerSigningOverlay';
import { useCopy } from '../i18n';

const SPRITE_SCALE = 4;
/**
 * Only used until the tab rail has measured itself. A fixed clearance cannot be
 * right on both a phone and a desktop window — on a phone it walked him through
 * the nav buttons — so the rail's own top edge is the floor.
 */
const FALLBACK_GROUND_OFFSET = 78;
/**
 * How long the bubble holds. The floor suits the short lines; anything longer
 * is given reading time, because the academy pool runs to a full sentence and a
 * remark that leaves mid-read is worse than no remark. A tap still skips it.
 */
const MIN_LINE_MS = 2_400;
const MS_PER_CHARACTER = 60;

/**
 * A new signing's hello.
 *
 * This used to be a framed card with a portrait and a button. It is now the
 * player themselves — the same sprite the match renders — walking onto the
 * screen, saying one line, and leaving. Nothing is covered and nothing has to
 * be dismissed: the celebration IS the screen you were already looking at.
 *
 * The rookie and the academy graduates both come through here. The rookie says
 * the one line written for them; a graduate draws from a pool, so signing a
 * dozen of them over a career meets a dozen personalities.
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
  const t = useCopy();
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

  const line = arrivalLine(player, t);

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
      <WalkingPlayer player={player} />
    </CharacterSpeechOverlay>
  );
}

export function AcademyGroupWalkOnWelcome({
  players,
  navigationAnchor,
  reduceMotion = false,
  onDone,
}: {
  players: readonly PlayerSigningConfirmation[];
  navigationAnchor?: TutorialAnchorLayout | null;
  reduceMotion?: boolean;
  onDone: () => void;
}) {
  const t = useCopy();
  const { width: viewportWidth, height: viewportHeight } =
    useWindowDimensions();
  const line = t('academyArrival.thanks');
  const groundOffset = navigationAnchor
    ? Math.max(0, viewportHeight - navigationAnchor.y)
    : FALLBACK_GROUND_OFFSET;
  const groupScale = Math.max(
    1,
    Math.min(
      SPRITE_SCALE,
      Math.floor(
        (viewportWidth - 32) /
          (Math.max(1, players.length) * PLAYER_SPRITE_CELL.width),
      ),
    ),
  );
  const characterWidth = players.length * PLAYER_SPRITE_CELL.width * groupScale;

  useEffect(() => {
    playPositiveSfx();
  }, []);

  return (
    <CharacterSpeechOverlay
      lines={[line]}
      characterWidth={characterWidth}
      characterHeight={PLAYER_SPRITE_CELL.height * groupScale}
      groundOffset={groundOffset}
      autoAdvanceMs={Math.max(MIN_LINE_MS, line.length * MS_PER_CHARACTER)}
      reduceMotion={reduceMotion}
      accessibilityLabel={t('academyArrival.a11y.groupSays', {
        players: players.map((player) => player.playerName).join(', '),
        line,
      })}
      onDone={onDone}
    >
      <View className="flex-row items-end">
        {players.map((player) => (
          <WalkingPlayer
            key={player.playerId}
            player={player}
            scale={groupScale}
          />
        ))}
      </View>
    </CharacterSpeechOverlay>
  );
}

/**
 * The overlay owns the walk, so the sprite is told to cycle its frames the
 * whole time it is on screen — a two-frame run held still would read as a
 * glitch, and he is only stationary for the length of one line.
 */
function WalkingPlayer({
  player,
  scale = SPRITE_SCALE,
}: {
  player: PlayerSigningConfirmation;
  scale?: number;
}) {
  return (
    <View>
      <PlayerRunSprite
        playerId={player.playerId}
        role={player.role}
        lookId={player.lookId}
        scale={scale}
        walking
      />
    </View>
  );
}
