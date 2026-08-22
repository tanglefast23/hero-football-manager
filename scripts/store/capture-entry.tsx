import '../../global.css';

import { registerRootComponent } from 'expo';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { setMasterVolume } from '../../src/render/audio';
import { setAwakeningMasterVolume } from '../../src/render/awakening-audio';
import { setBertVoiceMasterVolume } from '../../src/render/bert-voice';
import { setCelebrationMasterVolume } from '../../src/render/celebration-audio';
import { setCoachSpeechMasterVolume } from '../../src/render/coach-speech-audio';
import { setFinancialReportSfxMasterVolume } from '../../src/render/financial-report-sfx';
import { setManagementSfxMasterVolume } from '../../src/render/management-sfx';
import { setMenuMasterVolume } from '../../src/render/menu-audio';
import { setRivalHeroVoiceMasterVolume } from '../../src/render/rival-hero-voice';
import { StoreMediaScreen } from '../../src/ui/dev-harness/DevHarnessScreen';

const regularFont = require('../../assets/fonts/HFMSilkscreen_400Regular.ttf');
const boldFont = require('../../assets/fonts/HFMSilkscreen_700Bold.ttf');

setMasterVolume(0);
setAwakeningMasterVolume(0);
setBertVoiceMasterVolume(0);
setCelebrationMasterVolume(0);
setCoachSpeechMasterVolume(0);
setFinancialReportSfxMasterVolume(0);
setManagementSfxMasterVolume(0);
setMenuMasterVolume(0);
setRivalHeroVoiceMasterVolume(0);

function StoreCaptureApp() {
  const [fontsLoaded] = useFonts({
    HFMSilkscreen_400Regular: regularFont,
    HFMSilkscreen_700Bold: boldFont,
  });

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {fontsLoaded ? (
        <StoreMediaScreen
          entryId={process.env.EXPO_PUBLIC_STORE_MEDIA_ENTRY}
          caseId={process.env.EXPO_PUBLIC_STORE_MEDIA_CASE}
        />
      ) : (
        <View style={{ flex: 1, backgroundColor: '#16121f' }} />
      )}
    </SafeAreaProvider>
  );
}

registerRootComponent(StoreCaptureApp);
