import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('renewal talks dismissal', () => {
  const seasonEnd = source('src/ui/screens/SeasonEndScreen.tsx');
  const market = source('src/ui/screens/MarketScreen.tsx');

  it('hides open talks without abandoning the saved negotiation', () => {
    expect(seasonEnd).toContainSource('hiddenRenewalId');
    expect(seasonEnd).toContainSource(
      'onDismiss={() => setHiddenRenewalId(renewalNegotiation.id)}',
    );
    expect(seasonEnd).toContainSource("t('seasonEnd.resumeAgentTalks')");
    expect(market).toContainSource('onPress={onDismiss ?? onClose}');
    expect(market).toContainSource("t('market.leaveTalksOpen')");
  });
});
