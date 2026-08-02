import { useState } from 'react';
import { Text, View } from 'react-native';
import {
  AWARDS_CEREMONY_QA_CASES,
  type AwardsCeremonyQaCaseId,
} from '../awards-ceremony-qa';
import {
  DevHarnessButton,
  devHarnessControlStyles,
} from '../dev-harness/DevHarnessControls';
import { AwardsCeremonyReel } from '../dev-harness/entries/awards-ceremony';

/**
 * The standalone `EXPO_PUBLIC_AWARDS_CEREMONY_QA` reel.
 *
 * The ceremony, the fabricated podiums and every control now live in
 * `dev-harness/entries/awards-ceremony`, where the harness reaches them too.
 * All this adds is the case picker, which under the harness lives in the
 * harness bar and is part of the address.
 *
 * Kept alive so a flag someone already has in a shell history still works.
 * `EXPO_PUBLIC_DEV_HARNESS=1` is the one to reach for.
 */
export function AwardsCeremonyQaScreen() {
  const [caseId, setCaseId] = useState<AwardsCeremonyQaCaseId>('mixed');

  return (
    <AwardsCeremonyReel
      caseId={caseId}
      caseControls={(
        <View style={devHarnessControlStyles.row}>
          <Text style={devHarnessControlStyles.rowLabel}>CASE</Text>
          {AWARDS_CEREMONY_QA_CASES.map(entry => (
            <DevHarnessButton
              key={entry.id}
              label={entry.label}
              hint={`Show the ${entry.label} ceremony`}
              selected={entry.id === caseId}
              onPress={() => setCaseId(entry.id)}
            />
          ))}
        </View>
      )}
    />
  );
}
