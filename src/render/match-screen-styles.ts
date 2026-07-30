import { StyleSheet } from 'react-native';
import { ENERGY_FILL_COLORS } from './match-energy-ui';
import { MATCH_RAIL_GUTTER, MATCH_RAIL_TOP_INSET, MATCH_RAIL_WIDTH } from './match-rail';
import { KIT_PANEL_BORDER_COLOR, KIT_PANEL_TEXT_COLOR } from './team-kit-ui';

// Possession-card geometry. The charge meter's rainbow strip is built from real
// pixel bands, so it needs the card's content width rather than a percentage.
const CARRIER_CARD_WIDTH = 150;
const CARRIER_CARD_PADDING_X = 7;
// Standard HUD ink pixel frame — a solid kit-coloured panel needs it to hold
// its edge against the pitch, where the old 1pt cream hairline washed out.
const CARRIER_CARD_BORDER = 2;
export const CARRIER_CARD_CONTENT_WIDTH =
  CARRIER_CARD_WIDTH - (CARRIER_CARD_PADDING_X + CARRIER_CARD_BORDER) * 2;

// MatchScreen's StyleSheet, lifted out of a 3,000-line file. Presentation only:
// no component, no state, no behaviour — the screen imports `styles` and nothing
// else changes.
//
// All colours below come from the pixel-art bible palette (docs/11): ink
// #241f2e / ink-soft #3a3350 (dark canvas + chrome faces), cream #f4f1ea
// (text), hero gold #edb54a / #c8862a / #f7d894 (hero-only accents), red
// #d94f52 / #a83440 (rival threat), grey-dark #6b6675 (structure). Interactive
// chrome (Track A) uses an ink outline with a thicker bottom edge as the
// raised "lip"; gold is reserved for hero/power moments per docs/08.
export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#241f2e' },
  rootHighContrast: { backgroundColor: '#09070d' },
  // Desktop two-pane body: control rail then pitch, centred as ONE group so the
  // rail always sits directly left of the touchline. A flexed pitch pane
  // centred the (height-limited) pitch inside all the leftover width instead,
  // stranding the controls a third of a screen away from the match.
  desktopBody: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: MATCH_RAIL_GUTTER,
    paddingHorizontal: MATCH_RAIL_GUTTER,
    paddingTop: MATCH_RAIL_TOP_INSET,
    paddingBottom: MATCH_RAIL_GUTTER,
  },
  desktopPitchPane: { alignItems: 'center', justifyContent: 'center' },
  presentationBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scorebar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 56,
    paddingBottom: 12,
  },
  scorebarCompact: { paddingTop: 24, paddingBottom: 6 },
  scorebarFlipped: { flexDirection: 'row-reverse' },
  // Scoreboard "bug": a lighter ink-soft pill on the ink canvas, outlined in
  // ink with a thicker bottom lip for a raised, pressable-panel read.
  scoreBug: {
    backgroundColor: '#3a3350',
    borderWidth: 2,
    borderColor: '#241f2e',
    borderBottomWidth: 4,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  scoreText: { fontFamily: 'Silkscreen_700Bold', color: '#f4f1ea', fontSize: 18, fontVariant: ['tabular-nums'] },
  scoreTextFlash: { color: '#f7d894' },
  // Top-right controls: small beveled buttons (same Track-A recipe as the bug).
  controls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ctrlButton: {
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    backgroundColor: '#3a3350',
    borderWidth: 2,
    borderColor: '#241f2e',
    borderBottomWidth: 4,
    borderRadius: 4,
  },
  ctrlText: { fontFamily: 'Silkscreen_700Bold', color: '#f4f1ea', fontSize: 16 },
  bannerStack: {
    position: 'absolute',
    zIndex: 8,
    top: '40%',
    left: 18,
    right: 18,
    gap: 4,
    // Banners size to their own text instead of filling the row. A stretched
    // bar reads as a page element; a lozenge reads as an announcement.
    alignItems: 'center',
  },
  banner: {
    textAlign: 'center',
    color: '#edb54a',
    fontFamily: 'Silkscreen_700Bold',
    fontSize: 18,
    backgroundColor: '#241f2edd',
    borderWidth: 2,
    borderColor: '#edb54a',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 4,
    maxWidth: '100%',
    overflow: 'hidden',
  },
  bannerThreat: { color: '#f4f1ea', borderColor: '#d94f52', backgroundColor: '#3a1512ee' },
  bannerAction: { color: '#f4f1ea', borderColor: '#77a4d8', backgroundColor: '#214566ee' },
  carrierCard: {
    position: 'absolute',
    zIndex: 4,
    bottom: 8,
    width: CARRIER_CARD_WIDTH,
    // backgroundColor is the carrier's kit colour, applied inline.
    borderWidth: CARRIER_CARD_BORDER,
    borderColor: KIT_PANEL_BORDER_COLOR,
    borderRadius: 3,
    paddingHorizontal: CARRIER_CARD_PADDING_X,
    paddingVertical: 5,
  },
  carrierCardLeft: { left: 8 },
  carrierCardRight: { right: 8 },
  carrierLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  carrierName: { fontFamily: 'Silkscreen_700Bold', flex: 1, color: KIT_PANEL_TEXT_COLOR, fontSize: 11 },
  carrierEnergy: {
    fontFamily: 'Silkscreen_400Regular',
    color: KIT_PANEL_TEXT_COLOR,
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
  // The possession card sits on a solid kit colour, so the track wears the same
  // ink frame as the card: without it a fill close to the kit has no edge and
  // the bar reads as an empty dark stub. 6px tall so the fill keeps its 4px
  // inside the border.
  energyTrack: {
    height: 6,
    backgroundColor: '#3a3350',
    marginTop: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: KIT_PANEL_BORDER_COLOR,
  },
  energyFill: { height: 4, backgroundColor: ENERGY_FILL_COLORS.green },
  energyFillMedium: { backgroundColor: ENERGY_FILL_COLORS.amber },
  energyFillLow: { backgroundColor: ENERGY_FILL_COLORS.red },
  energyTextMedium: { color: '#edb54a' },
  energyTextLow: { color: '#f06b6e' },
  coachingDock: {
    gap: 6,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#241f2e',
  },
  coachingDockCompact: { paddingTop: 4, paddingBottom: 6, gap: 4 },
  coachBar: {
    flexDirection: 'row',
    gap: 6,
  },
  coachButton: {
    flex: 1,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#3a3350',
    borderWidth: 2,
    borderColor: '#6b6675',
    borderBottomWidth: 5,
    borderBottomColor: '#16121f',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 5,
  },
  coachButtonCompact: { minHeight: 52, borderBottomWidth: 4, paddingVertical: 2 },
  coachButtonDisabled: { opacity: 0.38 },
  coachButtonDisabledReadable: { opacity: 0.68 },
  coachButtonGuided: {
    opacity: 1,
    zIndex: 50,
    elevation: 12,
    backgroundColor: '#5a8fd6',
    borderColor: '#a3c8f0',
    borderBottomColor: '#3f6fb5',
    shadowColor: '#a3c8f0',
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    transform: [{ scale: 1.04 }],
  },
  coachButtonGuidedHighlight: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    height: 18,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    backgroundColor: '#a3c8f066',
  },
  coachCopy: { flexShrink: 1, alignItems: 'flex-start' },
  coachLabel: { fontFamily: 'Silkscreen_700Bold', color: '#bcb7c4', fontSize: 8 },
  coachLabelGuided: { color: '#f4f1ea' },
  coachValue: { fontFamily: 'Silkscreen_700Bold', color: '#f4f1ea', fontSize: 11, marginTop: 3 },
  coachValueGuided: { color: '#f4f1ea' },
  mentalityIcon: { color: '#70b879', fontSize: 28, fontWeight: 'bold' },
  swapIcon: { color: '#77a4d8', fontSize: 30, fontWeight: 'bold' },
  swapIconGuided: { color: '#f4f1ea' },
  tiredValue: { fontFamily: 'Silkscreen_400Regular', color: '#edb54a', fontSize: 9 },
  energyUseRow: {
    backgroundColor: '#2d283c',
    borderWidth: 2,
    borderColor: '#6b6675',
    borderBottomWidth: 4,
    borderBottomColor: '#16121f',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingTop: 4,
    paddingBottom: 5,
  },
  energyUseRowCompact: { paddingTop: 2, paddingBottom: 3 },
  energyUseHeader: {
    minHeight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: 3,
  },
  energyUseTitle: { fontFamily: 'Silkscreen_700Bold', color: '#bcb7c4', fontSize: 8, letterSpacing: 0.6 },
  teamEnergy: {
    color: '#65b96e',
    fontSize: 9,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  energySegments: { flexDirection: 'row', gap: 4 },
  energySegment: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3a3350',
    borderWidth: 2,
    borderColor: '#49415f',
    borderBottomWidth: 3,
    borderBottomColor: '#16121f',
    borderRadius: 3,
    paddingHorizontal: 4,
  },
  energySegmentNarrow: { paddingHorizontal: 1 },
  energySegmentSelected: { borderColor: '#f4f1ea', borderBottomColor: '#f4f1ea' },
  energySegmentSave: { backgroundColor: '#35618e' },
  energySegmentBalanced: { backgroundColor: '#4f6753' },
  energySegmentAllOut: { backgroundColor: '#a83440' },
  energySegmentText: { fontFamily: 'Silkscreen_700Bold', color: '#bcb7c4', fontSize: 9, textAlign: 'center' },
  energySegmentTextSelected: { color: '#f4f1ea' },
  cancelButton: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3a3350',
    borderWidth: 2,
    borderColor: '#6b6675',
    borderBottomWidth: 4,
    borderBottomColor: '#16121f',
  },
  cancelText: { fontFamily: 'Silkscreen_700Bold', color: '#f4f1ea', fontSize: 12 },
  selectionPlaceholder: {
    color: '#bcb7c4',
    fontSize: 10,
  },
});
