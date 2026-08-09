import { DEFAULT_CREATION_RATINGS } from '../../game';
import { TRUE_ENDING_SEEN_FLAG } from '../endgame-celebration';
import { careerClimbCompleted, useM1Store } from '../store';

function openedCareer() {
  useM1Store.setState(useM1Store.getInitialState(), true);
  useM1Store.getState().startNewCareer(917);
  useM1Store.getState().completePlayerCreation({
    name: 'Jo Rook',
    ratings: DEFAULT_CREATION_RATINGS,
  });
}

describe('the veteran unlock', () => {
  it('is locked for a fresh career and when no career is loaded', () => {
    useM1Store.setState(useM1Store.getInitialState(), true);
    expect(careerClimbCompleted(useM1Store.getState())).toBe(false);

    openedCareer();
    expect(careerClimbCompleted(useM1Store.getState())).toBe(false);
  });

  it('recognizes the durable true-ending proof on an existing save', () => {
    openedCareer();
    const career = useM1Store.getState().career!;
    useM1Store.setState({
      career: {
        ...career,
        eventFlags: [...career.eventFlags, TRUE_ENDING_SEEN_FLAG],
      },
    });

    expect(careerClimbCompleted(useM1Store.getState())).toBe(true);
  });
});
