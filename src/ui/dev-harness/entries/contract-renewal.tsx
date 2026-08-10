import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadLaunchContent } from '../../../content/load';
import { seasonEndViewModel } from '../../../application/view-models';
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
  const [career] = useState(() =>
    devHarnessCareerAtSeasonEnd(caseId === 'hero-cliff' ? 3 : 2),
  );
  const viewModel = useMemo(
    () => seasonEndViewModel(career, CONTENT, 1),
    [career],
  );

  return (
    <View style={{ paddingTop: insets.top }}>
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
      />
    </View>
  );
}
