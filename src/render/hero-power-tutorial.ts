import {
  findHeroPowerCell,
  firstArmedHeroPowerCell,
  type HeroPowerCell,
  type HeroPowerTarget,
} from './hero-power-dock';

export type HeroPowerTutorialAttempt =
  | { readonly step: 'armed'; readonly target: HeroPowerTarget }
  | {
      readonly step: 'waiting-fire';
      readonly target: HeroPowerTarget;
      readonly armedDismissedAtTick: number;
    }
  | {
      readonly step: 'fire';
      readonly target: HeroPowerTarget;
      readonly armedDismissedAtTick: number;
    };

export interface HeroPowerTutorialTickResult {
  readonly attempt: HeroPowerTutorialAttempt | null;
  readonly pause: boolean;
}

/** One deterministic decision after one completed match tick. */
export function advanceHeroPowerTutorial(
  attempt: HeroPowerTutorialAttempt | null,
  cells: readonly HeroPowerCell[],
  tick: number,
  eligible: boolean,
  presentationBlocked: boolean,
): HeroPowerTutorialTickResult {
  if (!eligible) return { attempt: null, pause: false };
  if (attempt === null) {
    if (presentationBlocked) return { attempt: null, pause: false };
    const cell = firstArmedHeroPowerCell(cells);
    return cell === undefined
      ? { attempt: null, pause: false }
      : {
          attempt: {
            step: 'armed',
            target: {
              slot: cell.slot,
              playerId: cell.playerId,
              power: cell.power,
            },
          },
          pause: true,
        };
  }
  if (attempt.step !== 'waiting-fire') {
    return { attempt, pause: false };
  }
  const cell = findHeroPowerCell(cells, attempt.target);
  if (cell === undefined) return { attempt: null, pause: false };
  if (
    cell.state !== 'fire' ||
    tick <= attempt.armedDismissedAtTick ||
    presentationBlocked
  ) {
    return { attempt, pause: false };
  }
  return { attempt: { ...attempt, step: 'fire' }, pause: true };
}

export function dismissHeroPowerTutorialArmed(
  attempt: HeroPowerTutorialAttempt | null,
  tick: number,
): HeroPowerTutorialAttempt | null {
  if (attempt?.step !== 'armed') return attempt;
  return {
    step: 'waiting-fire',
    target: attempt.target,
    armedDismissedAtTick: tick,
  };
}
