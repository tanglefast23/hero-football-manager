import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadLaunchContent } from '../../../content/load';
import { seasonEndViewModel } from '../../../application/view-models';
import {
  beginCareerRenewalTalks,
  submitCareerRenewalOffer,
} from '../../../game/market-career';
import { devHarnessCareerAtSeasonEnd } from '../career';
import { SeasonEndScreen } from '../../screens/SeasonEndScreen';
import type { DevHarnessEntry } from '../registry';

const CONTENT = loadLaunchContent();

/**
 * Clean contract renewal queue for App Store screenshots.
 * Shows the season-end renewal cards (including hero wage cliff cases).
 */
export const contractRenewalEntry: DevHarnessEntry = {
  id: 'contract-renewal',
  group: 'Season',
  title: 'Contract Renewal',
  summary: 'Season-end renewal queue with hero wage cliff',
  cases: [
    { id: 'standard', label: 'Standard', note: 'Normal renewals' },
    { id: 'hero-cliff', label: 'Hero Cliff', note: 'Hero rate jump visible' },
  ],
  render: (caseId) => <ContractRenewalReel caseId={caseId} />,
};

function ContractRenewalReel({ caseId }: { readonly caseId: string }) {
  const insets = useSafeAreaInsets();
  const [career] = useState(() => {
    const base = devHarnessCareerAtSeasonEnd(caseId === 'hero-cliff' ? 3 : 2);
    if (caseId !== 'hero-cliff') return base;
    const hero = base.players.find(
      (player) => player.clubId === base.userClubId,
    );
    if (hero === undefined) throw new Error('Hero renewal reel needs a player');
    const heroCareer = {
      ...base,
      players: base.players.map((player) =>
        player.clubId !== base.userClubId
          ? player
          : {
              ...player,
              contractSeasonsRemaining: player.id === hero.id ? 0 : 1,
              ...(player.id === hero.id
                ? { power: 'SUPER_SPEED' as const, onHeroWage: false }
                : {}),
            },
      ),
    };
    if (heroCareer.market === undefined) {
      throw new Error('Hero renewal reel needs a transfer market');
    }
    const opened = beginCareerRenewalTalks(
      heroCareer,
      heroCareer.market,
      hero.id,
    );
    const ask = opened.renewalTalks!.negotiation.weeklyAsk;
    return {
      ...heroCareer,
      market: submitCareerRenewalOffer(heroCareer, opened, {
        weeklyWage: Math.floor(ask * 0.55),
        termSeasons: 3,
        perk: 'GUARANTEED_STARTER',
      }),
    };
  });
  const viewModel = useMemo(
    () => seasonEndViewModel(career, CONTENT, 1),
    [career],
  );

  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <SeasonEndScreen
        viewModel={viewModel}
        onSelectContractTerm={() => {}}
        onRenewContract={() => {}}
        onReleaseContract={() => {}}
        onStartRenewal={() => {}}
        onSubmitRenewalOffer={() => {}}
        onCloseRenewal={() => {}}
        onPrimaryAction={() => {}}
        onOpenSettings={() => {}}
        initialScrollY={2_300}
      />
    </View>
  );
}
