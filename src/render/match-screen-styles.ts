import { StyleSheet } from 'react-native';
import { usePixelStyles, type LocaleFaces } from '../i18n';
import { ENERGY_FILL_COLORS } from './match-energy-ui';
import {
  MATCH_RAIL_GUTTER,
  MATCH_RAIL_TOP_INSET,
  MATCH_RAIL_WIDTH,
} from './match-rail';
import { KIT_PANEL_BORDER_COLOR, KIT_PANEL_TEXT_COLOR } from './team-kit-ui';
import {
  BANNER_BIG_FONT_PX,
  BANNER_FONT_PX,
  OUTLINE_PX,
  SHADOW_DROP_PX,
  TICKER_LANE_HEIGHT,
  TICKER_LANES,
  TICKER_TOP_INSET,
} from './match-ticker';

// Possession-card padding and frame. The width is not here: it is capped
// against the pitch at render time — see carrierCardGeometry.
import {
  CARRIER_CARD_BORDER,
  CARRIER_CARD_DESKTOP_PADDING_X,
  CARRIER_CARD_PADDING_X,
} from './match-carrier-card';

/** Heat-strip height, phone and desktop. */
export const CARRIER_CHARGE_HEIGHT = 4;
export const CARRIER_CHARGE_DESKTOP_HEIGHT = 7;

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
/**
 * MatchScreen's StyleSheet, built per language.
 *
 * It names pixel faces directly rather than through a NativeWind class, so the
 * CSS-variable swap at the app root cannot reach it — a module-scope sheet is
 * evaluated once at import. `useMatchScreenStyles()` rebuilds it when the
 * language changes; `usePixelStyles` caches per locale so this runs once per
 * language, not once per render.
 */
const makeStyles = (faces: LocaleFaces) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: '#241f2e' },
    rootHighContrast: { backgroundColor: '#16121f' },
    firstMatchGuideOverlay: { zIndex: 20, elevation: 20 },
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
    desktopRailPane: { flexDirection: 'row' },
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
    scoreText: {
      fontFamily: faces.display,
      color: '#f4f1ea',
      fontSize: 18,
      fontVariant: ['tabular-nums'],
    },
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
    ctrlText: { fontFamily: faces.display, color: '#f4f1ea', fontSize: 16 },
    // The event ticker's band. An absolute child of the pitch frame, so it
    // sits under the scorebar on a phone and on the top touchline on desktop
    // without either layout needing its own offset — and the clip makes the
    // touchlines themselves the point where a line enters and leaves.
    bannerStack: {
      position: 'absolute',
      zIndex: 8,
      top: TICKER_TOP_INSET,
      left: 0,
      right: 0,
      height: TICKER_LANES * TICKER_LANE_HEIGHT + SHADOW_DROP_PX + OUTLINE_PX,
      overflow: 'hidden',
    },
    // One lane. Full width so the held (reduce-motion) line can centre inside
    // it; the glyph stack within shrink-wraps, which is what lets a crossing
    // line start genuinely off the left edge instead of half on screen.
    tickerRow: { position: 'absolute', left: 0, right: 0 },
    tickerRowHeld: { alignItems: 'center' },
    tickerGlyphs: { alignSelf: 'flex-start', flexDirection: 'row' },
    // Unplated announcement type. No background, no border, no padding and no
    // maxWidth: the ring around the glyphs is what holds the line off the
    // grass now, and any of those would clip it or wrap the longer locales.
    // The goal line doubles this (bannerBigFontSize); everything else keeps it.
    banner: {
      color: '#edb54a',
      flexShrink: 0,
      fontFamily: faces.display,
      fontSize: BANNER_FONT_PX,
    },
    // Each tone keeps the accent its plate used to carry in its border.
    bannerThreat: { color: '#d94f52' },
    bannerAction: { color: '#77a4d8' },
    // A footnote to the line above it, not an announcement of its own.
    bannerSmall: { fontSize: 12 },
    // The goal line: double the announcement, because the scorer's name is the
    // one line of the ticker a player is actually trying to read. Its box is
    // taller than a lane, so it is given two (tickerLaneSpan). A long name is
    // wider than a phone's pitch and sweeps through the frame as it crosses.
    bannerBig: { fontSize: BANNER_BIG_FONT_PX },
    // The hard ink ring, drawn as eight offset copies under the fill.
    bannerOutline: { position: 'absolute', color: '#241f2e' },
    // The extruded copy under the ring: darker still, with a soft edge so the
    // drop reads as depth rather than as a second outline.
    bannerShadow: {
      position: 'absolute',
      color: '#16121f',
      textShadowColor: 'rgba(0,0,0,0.45)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 3,
    },
    performanceNotice: {
      position: 'absolute',
      zIndex: 12,
      top: 74,
      alignSelf: 'center',
      maxWidth: '92%',
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 2,
      borderBottomWidth: 4,
      borderColor: '#77a4d8',
      backgroundColor: '#214566ee',
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    performanceNoticeText: {
      flexShrink: 1,
      color: '#f4f1ea',
      fontFamily: faces.display,
      fontSize: 11,
      lineHeight: 16,
    },
    performanceNoticeDismiss: {
      color: '#f4f1ea',
      fontFamily: faces.display,
      fontSize: 18,
    },
    graphicsRecoveryOverlay: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      zIndex: 60,
      elevation: 60,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(22,18,31,0.88)',
      padding: 18,
    },
    graphicsRecoveryCard: {
      width: '100%',
      maxWidth: 520,
      borderWidth: 3,
      borderBottomWidth: 7,
      borderColor: '#241f2e',
      backgroundColor: '#f4f1ea',
      padding: 16,
    },
    graphicsRecoveryTitle: {
      color: '#241f2e',
      fontFamily: faces.display,
      fontSize: 18,
      lineHeight: 24,
      textTransform: 'uppercase',
    },
    graphicsRecoveryDetail: {
      marginTop: 8,
      color: '#3a3350',
      fontSize: 14,
      lineHeight: 20,
    },
    graphicsRecoveryButtons: {
      marginTop: 16,
      flexDirection: 'row',
      gap: 10,
    },
    graphicsRecoveryButton: {
      flex: 1,
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderBottomWidth: 5,
      borderColor: '#241f2e',
      backgroundColor: '#6b6675',
      paddingHorizontal: 8,
    },
    graphicsRecoveryButtonPrimary: {
      flex: 1,
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderBottomWidth: 5,
      borderColor: '#241f2e',
      backgroundColor: '#2f55b8',
      paddingHorizontal: 8,
    },
    graphicsRecoveryButtonText: {
      color: '#f4f1ea',
      fontFamily: faces.display,
      fontSize: 11,
      textAlign: 'center',
    },
    carrierCard: {
      position: 'absolute',
      zIndex: 4,
      bottom: 8,
      // Width is set inline from the pitch — see carrierCardGeometry.
      // backgroundColor is the carrier's kit colour, applied inline.
      borderWidth: CARRIER_CARD_BORDER,
      borderColor: KIT_PANEL_BORDER_COLOR,
      borderRadius: 3,
      paddingHorizontal: CARRIER_CARD_PADDING_X,
      paddingVertical: 5,
    },
    carrierCardLeft: { left: 8 },
    carrierCardRight: { right: 8 },
    carrierCardDesktop: {
      bottom: 12,
      paddingHorizontal: CARRIER_CARD_DESKTOP_PADDING_X,
      paddingVertical: 9,
    },
    carrierLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    carrierName: {
      fontFamily: faces.display,
      flex: 1,
      color: KIT_PANEL_TEXT_COLOR,
      fontSize: 11,
    },
    carrierEnergy: {
      fontFamily: faces.data,
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
    carrierNameDesktop: { fontSize: 18 },
    carrierEnergyDesktop: { fontSize: 16 },
    energyTrackDesktop: { height: 12, marginTop: 7 },
    energyFill: { height: 4, backgroundColor: ENERGY_FILL_COLORS.green },
    energyFillDesktop: { height: 10 },
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
    coachButtonCompact: {
      minHeight: 52,
      borderBottomWidth: 4,
      paddingVertical: 2,
    },
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
    coachLabel: { fontFamily: faces.display, color: '#b9b4c2', fontSize: 8 },
    coachLabelGuided: { color: '#f4f1ea' },
    coachValue: {
      fontFamily: faces.display,
      color: '#f4f1ea',
      fontSize: 11,
      marginTop: 3,
    },
    coachValueGuided: { color: '#f4f1ea' },
    mentalityIcon: { color: '#65b96e', fontSize: 28, fontWeight: 'bold' },
    swapIcon: { color: '#77a4d8', fontSize: 30, fontWeight: 'bold' },
    swapIconGuided: { color: '#f4f1ea' },
    tiredValue: { fontFamily: faces.data, color: '#edb54a', fontSize: 9 },
    energyUseRow: {
      backgroundColor: '#241f2e',
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
    energyUseTitle: {
      fontFamily: faces.display,
      color: '#b9b4c2',
      fontSize: 8,
      letterSpacing: 0.6,
    },
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
    energySegmentSelected: {
      borderColor: '#f4f1ea',
      borderBottomColor: '#f4f1ea',
    },
    energySegmentSave: { backgroundColor: '#2f55b8' },
    energySegmentBalanced: { backgroundColor: '#31703f' },
    energySegmentAllOut: { backgroundColor: '#a83440' },
    energySegmentText: {
      fontFamily: faces.display,
      color: '#b9b4c2',
      fontSize: 9,
      textAlign: 'center',
    },
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
    cancelText: { fontFamily: faces.display, color: '#f4f1ea', fontSize: 12 },
    selectionPlaceholder: {
      color: '#b9b4c2',
      fontSize: 10,
    },
  });

export function useMatchScreenStyles() {
  return usePixelStyles(makeStyles);
}
