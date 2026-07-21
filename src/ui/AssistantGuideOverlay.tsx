import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { AssistantGuideContent, AssistantGuideSequenceId } from '../content';
import { ActionButton } from './components/Scorecard';
import { TutorialTapCue } from './TutorialTapCue';
import {
  tutorialCuePosition,
  type TutorialAnchorLayout,
} from './tutorial-cue-position';

export interface AssistantGuideOverlayProps {
  content: AssistantGuideContent;
  sequenceId: AssistantGuideSequenceId;
  pageIndex: number;
  moneyAnchor?: TutorialAnchorLayout | null;
  navigationAnchor?: TutorialAnchorLayout | null;
  onAdvance: () => void;
}

export function AssistantGuideOverlay({
  content,
  sequenceId,
  pageIndex,
  moneyAnchor,
  navigationAnchor,
  onAdvance,
}: AssistantGuideOverlayProps) {
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const sequence = content.sequences.find(candidate => candidate.id === sequenceId);
  if (sequence === undefined) return null;
  const page = sequence.pages[Math.min(pageIndex, sequence.pages.length - 1)];
  const lastPage = pageIndex >= sequence.pages.length - 1;
  const moneyCuePosition = moneyAnchor
    ? tutorialCuePosition(moneyAnchor, viewportWidth)
    : null;
  if (page.focus === 'navigation') {
    return (
      <View
        accessibilityViewIsModal
        accessibilityLabel="Bottom navigation guide"
        className="absolute inset-0 z-50"
      >
        <TutorialSpotlight
          anchor={navigationAnchor}
          viewportWidth={viewportWidth}
          viewportHeight={viewportHeight}
        />
        {navigationAnchor && page.navItems ? (
          <NavigationGuidePage
            items={page.navItems}
            anchor={navigationAnchor}
            viewportWidth={viewportWidth}
            viewportHeight={viewportHeight}
            buttonLabel={page.buttonLabel}
            onAdvance={onAdvance}
          />
        ) : null}
      </View>
    );
  }

  const spotlightAnchor = page.focus === 'money' ? moneyAnchor : null;

  return (
    <View
      accessibilityViewIsModal
      accessibilityLabel={`${content.assistant.name}, ${content.assistant.role}. ${page.title}`}
      className="absolute inset-0 z-50"
    >
      <TutorialSpotlight
        anchor={spotlightAnchor}
        viewportWidth={viewportWidth}
        viewportHeight={viewportHeight}
      />

      {page.focus === 'money' && moneyCuePosition ? (
        <TutorialTapCue label="Look here" detail="Weekly money" direction="up" style={moneyCuePosition} />
      ) : null}

      <View className="flex-1 justify-center px-3 py-5">
        <View className="max-h-full w-full self-center" style={styles.windowShadow}>
          <View style={styles.windowFrame}>
          <View style={styles.titleHighlight} />
          <View style={styles.titleBar}>
            <Text className="font-pixel text-sm uppercase text-white" numberOfLines={1}>
              {page.kicker}
            </Text>
            <Text className="font-mono text-[10px] uppercase text-white/80">
              Bert's briefing
            </Text>
          </View>

          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.windowContent}
          >
            <View style={styles.briefingPanel}>
              <View className="min-w-0 flex-1 pr-1">
                <Text className="font-pixel text-lg uppercase text-ink">{page.title}</Text>
                <View className="mt-2 h-0.5 bg-grey-light" />
                <View className="mt-3 gap-3">
                  {page.body.map((paragraph, index) => (
                    <Text key={index} className="text-base leading-6 text-ink">
                      {paragraph}
                    </Text>
                  ))}
                </View>

                {page.objective ? (
                  <View className="mt-4 border-2 border-blue-dark bg-blue-light px-3 py-2">
                    <Text className="font-mono text-[10px] font-bold uppercase text-blue-dark">Your next move</Text>
                    <Text className="mt-1 font-pixel text-sm uppercase text-ink">{page.objective}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.bertColumn}>
                <BertFullBody pointing={page.focus !== 'assistant'} />
                <Text className="mt-1 text-center font-pixel text-xs uppercase text-ink">
                  {content.assistant.name}
                </Text>
                <Text className="mt-0.5 text-center font-mono text-[9px] uppercase text-blue-dark">
                  {content.assistant.role}
                </Text>
              </View>
            </View>

            <View className="mt-4 flex-row items-center gap-3">
              <View
                className="flex-row gap-1.5"
                accessibilityLabel={`Page ${pageIndex + 1} of ${sequence.pages.length}`}
              >
                {sequence.pages.map((_, index) => (
                  <View
                    key={index}
                    className={index === pageIndex
                      ? 'h-2.5 w-2.5 border border-ink bg-gold'
                      : 'h-2.5 w-2.5 border border-ink/30 bg-white'}
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
        </View>
      </View>

    </View>
  );
}

function NavigationGuidePage({
  items,
  anchor,
  viewportWidth,
  viewportHeight,
  buttonLabel,
  onAdvance,
}: {
  items: ReadonlyArray<{ tab: string; detail: string }>;
  anchor: TutorialAnchorLayout;
  viewportWidth: number;
  viewportHeight: number;
  buttonLabel: string;
  onAdvance: () => void;
}) {
  const left = Math.max(8, anchor.x);
  const width = Math.max(0, Math.min(anchor.width, viewportWidth - left - 8));
  const bottom = Math.max(8, viewportHeight - anchor.y + 8);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.navigationCalloutArea, { left, width, bottom }]}
    >
      <View style={styles.navigationAdvanceButton}>
        <ActionButton
          label={buttonLabel}
          accessibilityLabel="Finish bottom navigation guide"
          onPress={onAdvance}
          variant="action"
          compact
        />
      </View>
      <View style={styles.navigationCalloutRow}>
        {items.map(item => (
          <View key={item.tab} style={styles.navigationCalloutShadow}>
            <View
              accessible
              accessibilityRole="text"
              accessibilityLabel={`${item.tab}. ${item.detail}`}
              style={styles.navigationCalloutBox}
            >
              <Text
                adjustsFontSizeToFit
                numberOfLines={1}
                className="text-center font-pixel text-[11px] uppercase text-white"
              >
                {item.tab}
              </Text>
              <Text
                adjustsFontSizeToFit
                numberOfLines={4}
                className="mt-1 text-center font-mono text-[10px] leading-3 text-white/90"
              >
                {item.detail}
              </Text>
              <Text accessible={false} style={styles.navigationCalloutArrow}>▼</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function TutorialSpotlight({
  anchor,
  viewportWidth,
  viewportHeight,
}: {
  anchor?: TutorialAnchorLayout | null;
  viewportWidth: number;
  viewportHeight: number;
}) {
  if (!anchor) {
    return <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dimPane]} />;
  }

  const padding = 4;
  const left = Math.max(0, anchor.x - padding);
  const top = Math.max(0, anchor.y - padding);
  const right = Math.min(viewportWidth, anchor.x + anchor.width + padding);
  const bottom = Math.min(viewportHeight, anchor.y + anchor.height + padding);
  const spotlightHeight = Math.max(0, bottom - top);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.dimPane, { left: 0, top: 0, right: 0, height: top }]} />
      <View style={[styles.dimPane, { left: 0, top, width: left, height: spotlightHeight }]} />
      <View style={[styles.dimPane, { left: right, top, right: 0, height: spotlightHeight }]} />
      <View style={[styles.dimPane, { left: 0, top: bottom, right: 0, bottom: 0 }]} />
    </View>
  );
}

/** Original full-body Gaffer: bald crown, heavy brow, moustache and old club suit. */
export function BertFullBody({ pointing }: { pointing: boolean }) {
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.bertSprite}>
      <View style={styles.bertGroundShadow} />
      <View style={styles.bertLeftShoe} />
      <View style={styles.bertRightShoe} />
      <View style={styles.bertLeftLeg} />
      <View style={styles.bertRightLeg} />
      <View style={styles.bertJacket} />
      <View style={styles.bertShirt} />
      <View style={styles.bertTie} />
      <View style={styles.bertLeftLapelle} />
      <View style={styles.bertRightLapelle} />
      {pointing ? (
        <>
          <View style={styles.bertPointingArm} />
          <View style={styles.bertPointingHand} />
          <View style={styles.bertPointingFinger} />
        </>
      ) : (
        <>
          <View style={styles.bertLeftArm} />
          <View style={styles.bertLeftHand} />
        </>
      )}
      <View style={styles.bertRightArm} />
      <View style={styles.bertRightHand} />
      <View style={styles.bertLeftEar} />
      <View style={styles.bertRightEar} />
      <View style={styles.bertHeadTop} />
      <View style={styles.bertHeadFace} />
      <View style={styles.bertHeadJaw} />
      <View style={styles.bertLeftHair} />
      <View style={styles.bertRightHair} />
      <View style={styles.bertBaldHighlight} />
      <View style={styles.bertLeftBrow} />
      <View style={styles.bertRightBrow} />
      <View style={styles.bertLeftEye} />
      <View style={styles.bertRightEye} />
      <View style={styles.bertNose} />
      <View style={styles.bertNoseLight} />
      <View style={styles.bertMoustacheLeft} />
      <View style={styles.bertMoustacheRight} />
      <View style={styles.bertMouth} />
    </View>
  );
}

const styles = StyleSheet.create({
  dimPane: {
    position: 'absolute',
    backgroundColor: 'rgba(36,31,46,0.6)',
  },
  navigationCalloutArea: {
    position: 'absolute',
    gap: 10,
    zIndex: 40,
  },
  navigationAdvanceButton: {
    width: '50%',
    minWidth: 170,
    maxWidth: 280,
    alignSelf: 'center',
  },
  navigationCalloutRow: {
    flexDirection: 'row',
    gap: 4,
  },
  navigationCalloutShadow: {
    minWidth: 0,
    flex: 1,
    paddingRight: 3,
    paddingBottom: 4,
    borderRadius: 7,
    backgroundColor: '#241f2e',
  },
  navigationCalloutBox: {
    minHeight: 88,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingTop: 7,
    paddingBottom: 20,
    borderWidth: 2,
    borderColor: '#f4f1ea',
    borderRadius: 6,
    backgroundColor: '#3f6fb5',
  },
  navigationCalloutArrow: {
    position: 'absolute',
    bottom: 3,
    alignSelf: 'center',
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 14,
  },
  windowShadow: {
    maxWidth: 540,
    paddingBottom: 7,
    paddingRight: 7,
    backgroundColor: '#241f2e',
  },
  windowFrame: {
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#241f2e',
    backgroundColor: '#d9d3e0',
  },
  titleHighlight: { height: 5, backgroundColor: '#a3c8f0' },
  titleBar: {
    minHeight: 47,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderBottomWidth: 3,
    borderBottomColor: '#241f2e',
    backgroundColor: '#3f6fb5',
  },
  windowContent: { padding: 12 },
  briefingPanel: {
    minHeight: 236,
    flexDirection: 'row',
    gap: 7,
    paddingBottom: 14,
    paddingLeft: 14,
    paddingRight: 8,
    paddingTop: 14,
    borderWidth: 3,
    borderColor: '#9a95a4',
    borderRadius: 14,
    backgroundColor: '#ffffff',
  },
  bertColumn: {
    width: 104,
    alignSelf: 'flex-end',
    alignItems: 'center',
    paddingTop: 4,
  },
  bertSprite: { width: 104, height: 180 },
  bertGroundShadow: { position: 'absolute', left: 14, bottom: 1, width: 78, height: 9, backgroundColor: '#c9c5d0' },
  bertLeftShoe: { position: 'absolute', left: 26, bottom: 6, width: 25, height: 10, backgroundColor: '#241f2e' },
  bertRightShoe: { position: 'absolute', right: 22, bottom: 6, width: 25, height: 10, backgroundColor: '#241f2e' },
  bertLeftLeg: { position: 'absolute', left: 31, bottom: 15, width: 18, height: 37, backgroundColor: '#3a3350' },
  bertRightLeg: { position: 'absolute', right: 26, bottom: 15, width: 18, height: 37, backgroundColor: '#3a3350' },
  bertJacket: { position: 'absolute', left: 23, top: 88, width: 60, height: 51, backgroundColor: '#3a3350' },
  bertShirt: { position: 'absolute', left: 43, top: 91, width: 20, height: 43, backgroundColor: '#f4f1ea' },
  bertTie: { position: 'absolute', left: 49, top: 96, width: 9, height: 35, backgroundColor: '#d94f52' },
  bertLeftLapelle: { position: 'absolute', left: 31, top: 93, width: 18, height: 26, backgroundColor: '#5b3a91', transform: [{ rotate: '18deg' }] },
  bertRightLapelle: { position: 'absolute', right: 30, top: 93, width: 18, height: 26, backgroundColor: '#5b3a91', transform: [{ rotate: '-18deg' }] },
  bertPointingArm: { position: 'absolute', left: 3, top: 101, width: 33, height: 13, backgroundColor: '#3a3350', transform: [{ rotate: '-8deg' }] },
  bertPointingHand: { position: 'absolute', left: 0, top: 98, width: 15, height: 14, backgroundColor: '#cf9268' },
  bertPointingFinger: { position: 'absolute', left: -8, top: 101, width: 13, height: 6, backgroundColor: '#eab48c' },
  bertLeftArm: { position: 'absolute', left: 16, top: 101, width: 13, height: 42, backgroundColor: '#3a3350', transform: [{ rotate: '5deg' }] },
  bertLeftHand: { position: 'absolute', left: 17, top: 137, width: 13, height: 15, backgroundColor: '#cf9268' },
  bertRightArm: { position: 'absolute', right: 14, top: 101, width: 13, height: 42, backgroundColor: '#3a3350', transform: [{ rotate: '-5deg' }] },
  bertRightHand: { position: 'absolute', right: 15, top: 137, width: 13, height: 15, backgroundColor: '#cf9268' },
  bertLeftEar: { position: 'absolute', left: 17, top: 42, width: 13, height: 28, backgroundColor: '#cf9268' },
  bertRightEar: { position: 'absolute', right: 17, top: 42, width: 13, height: 28, backgroundColor: '#cf9268' },
  bertHeadTop: { position: 'absolute', left: 31, top: 12, width: 44, height: 23, backgroundColor: '#eab48c' },
  bertHeadFace: { position: 'absolute', left: 24, top: 27, width: 58, height: 48, backgroundColor: '#eab48c' },
  bertHeadJaw: { position: 'absolute', left: 31, top: 68, width: 44, height: 24, backgroundColor: '#cf9268' },
  bertLeftHair: { position: 'absolute', left: 22, top: 22, width: 10, height: 27, backgroundColor: '#7d7887' },
  bertRightHair: { position: 'absolute', right: 21, top: 22, width: 10, height: 27, backgroundColor: '#7d7887' },
  bertBaldHighlight: { position: 'absolute', left: 40, top: 17, width: 21, height: 5, backgroundColor: '#f7d7ba' },
  bertLeftBrow: { position: 'absolute', left: 30, top: 41, width: 15, height: 7, backgroundColor: '#6a4326', transform: [{ rotate: '8deg' }] },
  bertRightBrow: { position: 'absolute', right: 29, top: 41, width: 15, height: 7, backgroundColor: '#6a4326', transform: [{ rotate: '-8deg' }] },
  bertLeftEye: { position: 'absolute', left: 36, top: 50, width: 5, height: 5, backgroundColor: '#241f2e' },
  bertRightEye: { position: 'absolute', right: 35, top: 50, width: 5, height: 5, backgroundColor: '#241f2e' },
  bertNose: { position: 'absolute', left: 42, top: 48, width: 25, height: 24, backgroundColor: '#cf9268' },
  bertNoseLight: { position: 'absolute', left: 46, top: 51, width: 13, height: 7, backgroundColor: '#f7d7ba' },
  bertMoustacheLeft: { position: 'absolute', left: 31, top: 70, width: 22, height: 10, backgroundColor: '#6a4326', transform: [{ rotate: '8deg' }] },
  bertMoustacheRight: { position: 'absolute', right: 29, top: 70, width: 22, height: 10, backgroundColor: '#6a4326', transform: [{ rotate: '-8deg' }] },
  bertMouth: { position: 'absolute', left: 46, top: 82, width: 13, height: 4, backgroundColor: '#a83440' },
});
