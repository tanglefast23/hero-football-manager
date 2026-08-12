import { useEffect } from 'react';
import { AgentFullBody, AGENT_SPRITE_SIZE } from './AgentFullBody';
import { CharacterSpeechOverlay } from './CharacterSpeechOverlay';
import { playManagementActionSfx } from '../render/management-sfx';
import { useCopy } from '../i18n';

const AGENT_SCALE = 1.5;
/** Enough to keep the type in proportion with him without crowding a phone. */
const AGENT_BUBBLE_SCALE = 1.15;
/**
 * Only used until the panel below has measured itself. Matches the fallback
 * every other walk-on uses, so the three characters stand on the same floor.
 */
const FALLBACK_GROUND_OFFSET = 78;

export interface AgentFinalDemandWalkOnProps {
  /** The ultimatum, already carrying the figure. */
  line: string;
  reduceMotion?: boolean;
  /**
   * Leaves on a timer instead of waiting for a tap. Only for a remark that
   * carries no number to read — the ultimatum itself always waits.
   */
  autoAdvanceMs?: number;
  /** Fires once the manager has heard him out. The panel decides what next. */
  onDone: () => void;
}

/**
 * The agent, walking on to name his price.
 *
 * The negotiation used to end in a form: a third offer that silently failed and
 * a red panel afterwards explaining that talks were over. Nothing ever said
 * what the number had been, so the manager learned only that they had guessed
 * wrong three times.
 *
 * He arrives instead, in the same speech bubble the players and Bert use,
 * because the beat is a person refusing you rather than a validation error. One
 * line, one figure, and then the panel offers exactly two buttons.
 *
 * He is deliberately NOT `BertBriefingWalkOn`: Bert is the manager's man and
 * teaches, this one is the opposition and states terms. Sharing the briefing
 * component would put the tutorial's spotlight and dimming behind a character
 * who is not explaining anything.
 */
export function AgentFinalDemandWalkOn({
  line,
  reduceMotion = false,
  autoAdvanceMs,
  onDone,
}: AgentFinalDemandWalkOnProps) {
  const t = useCopy();

  useEffect(() => {
    // The card cue, not the success one: he is closing a door, not opening it.
    playManagementActionSfx('card');
  }, []);

  return (
    <CharacterSpeechOverlay
      lines={[line]}
      characterWidth={AGENT_SPRITE_SIZE.width * AGENT_SCALE}
      characterHeight={AGENT_SPRITE_SIZE.height * AGENT_SCALE}
      groundOffset={FALLBACK_GROUND_OFFSET}
      reduceMotion={reduceMotion}
      typewriter
      focusOnMount
      bubbleScale={AGENT_BUBBLE_SCALE}
      // No auto-advance by default. He has just told the manager to choose;
      // pulling the sentence off screen on a timer would take the number with
      // it. A caller whose line holds no number may still set one.
      {...(autoAdvanceMs === undefined ? {} : { autoAdvanceMs })}
      mirrorSprite={false}
      accessibilityLabel={t('market.a11y.agentSays', { line })}
      onDone={onDone}
      renderCharacter={({ walking }) => (
        <AgentFullBody
          presenting={!walking}
          walking={walking}
          scale={AGENT_SCALE}
          // The overlay draws its own contact shadow; the baked one would stack
          // a second, darker patch under the same shoes.
          groundShadow={false}
        />
      )}
    />
  );
}
