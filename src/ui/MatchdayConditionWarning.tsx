import { useEffect, useMemo } from 'react';
import {
  bertVoiceDurationMs,
  playBertVoice,
  stopBertVoice,
} from '../render/bert-voice';
import { BertFullBody } from './BertFullBody';
import { BERT_SPRITE_SIZE } from './bert-walk-frames';
import { CharacterSpeechOverlay } from './CharacterSpeechOverlay';
import { matchdayConditionWarningCopy } from './matchday-condition';
import { useCopy } from '../i18n';

const BERT_SCALE = 1.5;
const BERT_BUBBLE_SCALE = 1.15;
const MATCHDAY_ACTION_RAIL_CLEARANCE = 86;

export interface MatchdayConditionWarningProps {
  playerName: string;
  reduceMotion?: boolean;
  onDone: () => void;
}

/** Bert's one-time lesson when the first Below Peak badge reaches matchday. */
export function MatchdayConditionWarning({
  playerName,
  reduceMotion = false,
  onDone,
}: MatchdayConditionWarningProps) {
  const t = useCopy();
  const line = useMemo(
    () => matchdayConditionWarningCopy(playerName, t),
    [playerName, t],
  );

  useEffect(() => {
    playBertVoice(bertVoiceDurationMs(line));
    return () => stopBertVoice();
  }, [line]);

  return (
    <CharacterSpeechOverlay
      lines={[line]}
      characterWidth={BERT_SPRITE_SIZE.width * BERT_SCALE}
      characterHeight={BERT_SPRITE_SIZE.height * BERT_SCALE}
      groundOffset={MATCHDAY_ACTION_RAIL_CLEARANCE}
      reduceMotion={reduceMotion}
      typewriter
      bubbleScale={BERT_BUBBLE_SCALE}
      mirrorSprite={false}
      accessibilityLabel={t('clubHome.a11y.bertSays', { line })}
      onDone={onDone}
      renderCharacter={({ walking }) => (
        <BertFullBody
          pointing={!walking}
          walking={walking}
          scale={BERT_SCALE}
          groundShadow={false}
        />
      )}
    />
  );
}
