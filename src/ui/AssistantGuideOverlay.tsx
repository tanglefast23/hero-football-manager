import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { AssistantGuideContent, AssistantGuideSequenceId } from '../content';
import { ActionButton } from './components/Scorecard';

export interface AssistantGuideOverlayProps {
  content: AssistantGuideContent;
  sequenceId: AssistantGuideSequenceId;
  pageIndex: number;
  onAdvance: () => void;
}

export function AssistantGuideOverlay({
  content,
  sequenceId,
  pageIndex,
  onAdvance,
}: AssistantGuideOverlayProps) {
  const sequence = content.sequences.find(candidate => candidate.id === sequenceId);
  if (sequence === undefined) return null;
  const page = sequence.pages[Math.min(pageIndex, sequence.pages.length - 1)];
  const lastPage = pageIndex >= sequence.pages.length - 1;

  return (
    <View
      accessibilityViewIsModal
      accessibilityLabel={`${content.assistant.name}, ${content.assistant.role}. ${page.title}`}
      className="absolute inset-0 z-50 justify-center bg-ink/70 px-4"
      style={{ paddingBottom: page.focus === 'navigation' ? 112 : 16, paddingTop: 16 }}
    >
      {page.focus === 'money' ? <FocusTag label="WEEKLY MONEY" placement="top" /> : null}
      <View className="max-h-full w-full self-center border-2 border-b-4 border-ink bg-paper" style={styles.cardShadow}>
        <View className="h-3 bg-blue-light" />
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16 }}
        >
          <View className="flex-row items-center gap-4">
            <BertPortrait />
            <View className="min-w-0 flex-1">
              <Text className="font-mono text-sm font-bold uppercase text-blue-dark">{page.kicker}</Text>
              <Text className="mt-1 font-pixel text-xl uppercase text-ink">{page.title}</Text>
              <View className="mt-2 self-start border-2 border-ink bg-white px-2 py-1">
                <Text className="font-mono text-xs font-bold uppercase text-ink">
                  {content.assistant.name} · {content.assistant.role}
                </Text>
              </View>
            </View>
          </View>

          <View className="my-4 h-0.5 bg-ink/20" />

          <View className="gap-3">
            {page.body.map((paragraph, index) => (
              <Text key={index} className="text-base leading-6 text-ink">
                {paragraph}
              </Text>
            ))}
          </View>

          {page.navItems ? (
            <View className="mt-4 flex-row flex-wrap justify-between gap-y-2">
              {page.navItems.map((item, index) => {
                const unavailable = item.tab === 'MARKET';
                return (
                  <View
                    key={item.tab}
                    className={unavailable
                      ? 'border-2 border-grey-dark bg-grey-light p-2 opacity-70'
                      : 'border-2 border-blue-dark bg-blue-light p-2'}
                    style={{ width: index === page.navItems!.length - 1 ? '100%' : '48.5%' }}
                  >
                    <Text className="font-mono text-xs font-bold text-ink">{item.tab}</Text>
                    <Text className="mt-1 text-sm leading-4 text-ink/70">{item.detail}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          {page.objective ? (
            <View className="mt-4 border-2 border-b-4 border-blue-dark bg-blue-light p-3">
              <Text className="font-mono text-xs font-bold uppercase text-blue-dark">Bert's one job</Text>
              <Text className="mt-1 font-pixel text-base uppercase text-ink">{page.objective}</Text>
            </View>
          ) : null}

          <View className="mt-5 flex-row items-center gap-3">
            <View className="flex-row gap-1.5" accessibilityLabel={`Page ${pageIndex + 1} of ${sequence.pages.length}`}>
              {sequence.pages.map((_, index) => (
                <View
                  key={index}
                  className={index === pageIndex ? 'h-2.5 w-2.5 bg-blue-dark' : 'h-2.5 w-2.5 bg-grey-light'}
                />
              ))}
            </View>
            <View className="flex-1">
              <ActionButton
                label={page.buttonLabel}
                accessibilityLabel={lastPage ? `Finish ${page.title} guide` : `Continue, page ${pageIndex + 2}`}
                onPress={onAdvance}
                variant="action"
                compact
              />
            </View>
          </View>
        </ScrollView>
      </View>
      {page.focus === 'navigation' ? <FocusTag label="THE BOTTOM RAIL  ↓" placement="bottom" /> : null}
    </View>
  );
}

function FocusTag({ label, placement }: { label: string; placement: 'top' | 'bottom' }) {
  return (
    <View
      pointerEvents="none"
      className="absolute z-10 border-2 border-b-4 border-blue-dark bg-blue-light px-3 py-2"
      style={placement === 'top' ? styles.topFocus : styles.bottomFocus}
    >
      <Text className="font-mono text-xs font-bold uppercase text-ink">{label}</Text>
    </View>
  );
}

/** Block-built Gaffer portrait: bald crown, heavy brow, bulbous nose and moustache. */
function BertPortrait() {
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.portraitFrame}>
      <View style={styles.portraitSky} />
      <View style={styles.shoulderLeft} />
      <View style={styles.shoulderRight} />
      <View style={styles.shirt} />
      <View style={styles.tie} />
      <View style={styles.leftEar} />
      <View style={styles.rightEar} />
      <View style={styles.headTop} />
      <View style={styles.headFace} />
      <View style={styles.headJaw} />
      <View style={styles.leftHair} />
      <View style={styles.rightHair} />
      <View style={styles.baldHighlight} />
      <View style={styles.leftBrow} />
      <View style={styles.rightBrow} />
      <View style={styles.leftEye} />
      <View style={styles.rightEye} />
      <View style={styles.nose} />
      <View style={styles.noseLight} />
      <View style={styles.moustacheLeft} />
      <View style={styles.moustacheRight} />
      <View style={styles.mouth} />
    </View>
  );
}

const styles = StyleSheet.create({
  cardShadow: {
    maxWidth: 520,
    shadowColor: '#241f2e',
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 0,
    elevation: 14,
  },
  topFocus: { right: 12, top: 82, transform: [{ rotate: '2deg' }] },
  bottomFocus: { bottom: 62, left: 24, transform: [{ rotate: '-2deg' }] },
  portraitFrame: {
    width: 104,
    height: 116,
    overflow: 'hidden',
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#241f2e',
    backgroundColor: '#a3c8f0',
  },
  portraitSky: { position: 'absolute', inset: 0, backgroundColor: '#a3c8f0' },
  shoulderLeft: { position: 'absolute', left: 8, bottom: 0, width: 44, height: 30, backgroundColor: '#3a3350' },
  shoulderRight: { position: 'absolute', right: 8, bottom: 0, width: 44, height: 30, backgroundColor: '#3a3350' },
  shirt: { position: 'absolute', left: 38, bottom: 0, width: 28, height: 28, backgroundColor: '#f4f1ea' },
  tie: { position: 'absolute', left: 47, bottom: 0, width: 10, height: 25, backgroundColor: '#d94f52' },
  leftEar: { position: 'absolute', left: 12, top: 42, width: 14, height: 30, backgroundColor: '#cf9268' },
  rightEar: { position: 'absolute', right: 12, top: 42, width: 14, height: 30, backgroundColor: '#cf9268' },
  headTop: { position: 'absolute', left: 28, top: 13, width: 48, height: 22, backgroundColor: '#eab48c' },
  headFace: { position: 'absolute', left: 22, top: 27, width: 60, height: 48, backgroundColor: '#eab48c' },
  headJaw: { position: 'absolute', left: 29, top: 68, width: 46, height: 23, backgroundColor: '#cf9268' },
  leftHair: { position: 'absolute', left: 20, top: 23, width: 9, height: 23, backgroundColor: '#7d7887' },
  rightHair: { position: 'absolute', right: 20, top: 23, width: 9, height: 23, backgroundColor: '#7d7887' },
  baldHighlight: { position: 'absolute', left: 38, top: 17, width: 22, height: 5, backgroundColor: '#f7d7ba' },
  leftBrow: { position: 'absolute', left: 28, top: 41, width: 16, height: 7, backgroundColor: '#6a4326', transform: [{ rotate: '8deg' }] },
  rightBrow: { position: 'absolute', right: 28, top: 41, width: 16, height: 7, backgroundColor: '#6a4326', transform: [{ rotate: '-8deg' }] },
  leftEye: { position: 'absolute', left: 35, top: 50, width: 5, height: 5, backgroundColor: '#241f2e' },
  rightEye: { position: 'absolute', right: 35, top: 50, width: 5, height: 5, backgroundColor: '#241f2e' },
  nose: { position: 'absolute', left: 42, top: 48, width: 26, height: 24, backgroundColor: '#cf9268' },
  noseLight: { position: 'absolute', left: 46, top: 51, width: 13, height: 7, backgroundColor: '#f7d7ba' },
  moustacheLeft: { position: 'absolute', left: 30, top: 70, width: 23, height: 10, backgroundColor: '#6a4326', transform: [{ rotate: '8deg' }] },
  moustacheRight: { position: 'absolute', right: 30, top: 70, width: 23, height: 10, backgroundColor: '#6a4326', transform: [{ rotate: '-8deg' }] },
  mouth: { position: 'absolute', left: 45, top: 82, width: 14, height: 4, backgroundColor: '#a83440' },
});
