import { Rect } from '@shopify/react-native-skia';
import type { AwakeningCutsceneViewModel } from '../../models';
import { BallOfDestinyVisual } from './BallOfDestinyVisual';
import { BuzzingShinGuardVisual } from './BuzzingShinGuardVisual';
import { ChosenFeatherVisual } from './ChosenFeatherVisual';
import { ConfettiCannonVisual } from './ConfettiCannonVisual';
import { DefibrillatorStarVisual } from './DefibrillatorStarVisual';
import { GlowingCaterpillarVisual } from './GlowingCaterpillarVisual';
import { HeroThermometerVisual } from './HeroThermometerVisual';
import { IcePackMoonsTriggerVisual } from './ice-pack-moons';
import { MagicSpongeTriggerVisual } from './magic-sponge';
import { MeteoriteInTheBootVisual } from './MeteoriteInTheBootVisual';
import { RhythmicCprTriggerVisual } from './rhythmic-cpr';
import { RunawaySprinklerVisual } from './RunawaySprinklerVisual';
import { SmellingSaltSuperSneezeTriggerVisual } from './smelling-salt-super-sneeze';
import { StrongManStrongDrinkTriggerVisual } from './strong-man-strong-drink';
import { WaterBottleVisual } from './WaterBottleVisual';
import { AWAKENING_PIXEL_PALETTE as P } from './AwakeningPixelArt';

const CARD_SIZE = 80;
const CARD_BORDER = 4;

interface AwakeningTriggerVisualProps {
  visual: AwakeningCutsceneViewModel['triggerVisual'];
  x: number;
  y: number;
}

export function AwakeningTriggerVisual({ visual, x, y }: AwakeningTriggerVisualProps) {
  if (visual === 'caterpillar') {
    return <GlowingCaterpillarVisual x={x} y={y} />;
  }

  const art = (() => {
    switch (visual) {
    case 'water':
      return <WaterBottleVisual x={x} y={y} />;
    case 'cpr':
      return <RhythmicCprTriggerVisual x={x} y={y} />;
    case 'sponge':
      return <MagicSpongeTriggerVisual x={x} y={y} />;
    case 'sneeze':
      return <SmellingSaltSuperSneezeTriggerVisual x={x} y={y} />;
    case 'ice':
      return <IcePackMoonsTriggerVisual x={x} y={y} />;
    case 'drink':
      return <StrongManStrongDrinkTriggerVisual x={x} y={y} />;
    case 'sprinkler':
      return <RunawaySprinklerVisual x={x} y={y} />;
    case 'shin-guard':
      return <BuzzingShinGuardVisual x={x} y={y} />;
    case 'meteor':
      return <MeteoriteInTheBootVisual x={x} y={y} />;
    case 'ball':
      return <BallOfDestinyVisual x={x} y={y} />;
    case 'confetti':
      return <ConfettiCannonVisual x={x} y={y} />;
    case 'feather':
      return <ChosenFeatherVisual x={x} y={y} />;
    case 'thermometer':
      return <HeroThermometerVisual x={x} y={y} />;
    case 'defibrillator':
      return <DefibrillatorStarVisual x={x} y={y} />;
    }
  })();

  const left = Math.round(x - CARD_SIZE / 2);
  const top = Math.round(y - CARD_SIZE / 2);

  return (
    <>
      <Rect
        x={left}
        y={top}
        width={CARD_SIZE}
        height={CARD_SIZE}
        color={P.ink}
        antiAlias={false}
      />
      <Rect
        x={left + CARD_BORDER}
        y={top + CARD_BORDER}
        width={CARD_SIZE - CARD_BORDER * 2}
        height={CARD_SIZE - CARD_BORDER * 2}
        color={P.cream}
        antiAlias={false}
      />
      {art}
    </>
  );
}
