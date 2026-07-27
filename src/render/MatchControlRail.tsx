import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SettingsButton } from '../ui/SettingsOverlay';
import { TutorialTapCue } from '../ui/TutorialTapCue';
import { TUTORIAL_TAP_CUE_WIDTH } from '../ui/tutorial-cue-position';
import { SfxPressable } from '../ui/components/SfxPressable';
import {
  ENERGY_FILL_COLORS,
  ENERGY_USE_ACCESSIBILITY,
  ENERGY_USE_LABELS,
  energyBand,
  type EnergyBand,
} from './match-energy-ui';
import {
  MATCH_RAIL_WIDTH,
  MENTALITY_CHIP_LABELS,
  type RailHeroStatus,
} from './match-rail';
import { MATCH_SPEEDS, type MatchSpeed } from './match-speed';
import {
  ENERGY_USE_MODES,
  FORMATION_LABELS,
  MENTALITIES,
  type EnergyUse,
  type FormationId,
  type Mentality,
} from '../sim/tactics';

export interface MatchRailTiredPlayer {
  id: string;
  name: string;
  role: string;
  condition: number;
}

export interface MatchRailHeroTile {
  id: string;
  name: string;
  powerName: string;
  powerGlyph: string;
  powerColor: string;
  /** 0–1 share of the Zone threshold. */
  heat: number;
  status: RailHeroStatus;
  zoneSecondsLeft: number | null;
}

export interface MatchControlRailProps {
  /** Score bug line, e.g. "BRB 1 – 0 QRZ". */
  scoreLine: string;
  /** Half + minute line, e.g. "1ST HALF · 23'". */
  clockLine: string;
  scoreFlash: boolean;
  paused: boolean;
  speed: MatchSpeed;
  onSelectSpeed: (speed: MatchSpeed) => void;
  onTogglePause: () => void;
  onOpenSettings: () => void;
  formations: readonly FormationId[];
  formation: FormationId;
  onSelectFormation: (formation: FormationId) => void;
  mentality: Mentality;
  onSelectMentality: (mentality: Mentality) => void;
  coachingDisabled: boolean;
  substitutionsRemaining: number;
  tiredPlayers: readonly MatchRailTiredPlayer[];
  swapDisabled: boolean;
  /** First-match tutorial: highlight the top swap control and float its cue. */
  guideSwap: boolean;
  onSwap: () => void;
  teamEnergy: number;
  tiredCount: number;
  energyUse: EnergyUse;
  onSelectEnergyUse: (mode: EnergyUse) => void;
  heroTiles: readonly MatchRailHeroTile[];
  /** True while the controlled team's heroes fire on the engine's context cue. */
}

/**
 * Desktop-only match control rail (design sign-off 2026-07-23). Phone and
 * tablet keep the scorebar + bottom coaching dock; this rail is the wide-window
 * alternative, wired to exactly the same recorded coaching inputs.
 *
 * Every control is an SfxPressable: it plays the shared tap cue and tracks its
 * pressed state with local state, passing style down as a plain array. A
 * function style on a Pressable silently collapses layout on iOS.
 */
export function MatchControlRail({
  scoreLine,
  clockLine,
  scoreFlash,
  paused,
  speed,
  onSelectSpeed,
  onTogglePause,
  onOpenSettings,
  formations,
  formation,
  onSelectFormation,
  mentality,
  onSelectMentality,
  coachingDisabled,
  substitutionsRemaining,
  tiredPlayers,
  swapDisabled,
  guideSwap,
  onSwap,
  teamEnergy,
  tiredCount,
  energyUse,
  onSelectEnergyUse,
  heroTiles,
}: MatchControlRailProps) {
  const teamBand = energyBand(teamEnergy);
  return (
    <View style={styles.rail}>
      <ScrollView contentContainerStyle={styles.railContent}>
        <View style={styles.card}>
          <View style={styles.scoreRow}>
            <View style={styles.scoreBug}>
              <Text style={[styles.scoreText, scoreFlash ? styles.scoreTextFlash : null]}>
                {scoreLine}
              </Text>
              <Text style={styles.clockText}>{clockLine}</Text>
            </View>
            <SettingsButton onPress={onOpenSettings} variant="match" />
          </View>
          <View style={styles.chipRow}>
            {MATCH_SPEEDS.map((option) => {
              const selected = !paused && speed === option;
              return (
                <SfxPressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityLabel={`Match speed ${option} times`}
                  accessibilityState={{ selected }}
                  style={[styles.chip, selected ? styles.chipSelected : null]}
                  onPress={() => onSelectSpeed(option)}
                >
                  <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>
                    {option}x
                  </Text>
                </SfxPressable>
              );
            })}
            <SfxPressable
              accessibilityRole="button"
              accessibilityLabel={paused ? 'Resume the match' : 'Pause the match'}
              accessibilityState={{ selected: paused }}
              style={[styles.chip, paused ? styles.chipSelected : null]}
              onPress={onTogglePause}
            >
              <Text style={[styles.chipText, paused ? styles.chipTextSelected : null]}>
                {paused ? '▶' : '❙❙'}
              </Text>
            </SfxPressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>FORMATION ({FORMATION_LABELS[formation].toUpperCase()})</Text>
          <View style={styles.chipRow}>
            {formations.map((option) => {
              const selected = formation === option;
              return (
                <SfxPressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityLabel={`Formation ${option}, ${FORMATION_LABELS[option]}`}
                  accessibilityState={{ selected, disabled: coachingDisabled }}
                  disabled={coachingDisabled}
                  style={[
                    styles.chip,
                    selected ? styles.chipSelected : null,
                    coachingDisabled ? styles.disabled : null,
                  ]}
                  onPress={() => onSelectFormation(option)}
                >
                  <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>
                    {option}
                  </Text>
                </SfxPressable>
              );
            })}
          </View>
          <Text style={[styles.cardTitle, styles.cardTitleSpaced]}>PLAYSTYLE</Text>
          <View style={styles.chipRow}>
            {MENTALITIES.map((option) => {
              const selected = mentality === option;
              return (
                <SfxPressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityLabel={`Playstyle ${MENTALITY_CHIP_LABELS[option]}`}
                  accessibilityState={{ selected, disabled: coachingDisabled }}
                  disabled={coachingDisabled}
                  style={[
                    styles.chip,
                    selected ? styles.chipSelected : null,
                    coachingDisabled ? styles.disabled : null,
                  ]}
                  onPress={() => onSelectMentality(option)}
                >
                  <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>
                    {MENTALITY_CHIP_LABELS[option]}
                  </Text>
                </SfxPressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>SUBSTITUTIONS · {substitutionsRemaining} LEFT</Text>
          <Text style={styles.caption}>MOST TIRED ON THE PITCH</Text>
          {tiredPlayers.map((player, position) => {
            const band = energyBand(player.condition);
            const guided = guideSwap && position === 0;
            return (
              <View key={player.id} style={styles.tiredRow}>
                <View style={styles.tiredCopy}>
                  <Text numberOfLines={1} style={styles.tiredName}>{player.name}</Text>
                  <Text style={styles.tiredRole}>{player.role}</Text>
                  <View style={styles.energyTrack}>
                    <View
                      style={[
                        styles.energyFill,
                        fillForBand(band),
                        { width: `${Math.max(0, Math.min(100, player.condition))}%` },
                      ]}
                    />
                  </View>
                </View>
                <Text style={[styles.tiredPercent, textForBand(band)]}>
                  {Math.round(player.condition)}%
                </Text>
                <SfxPressable
                  accessibilityRole="button"
                  accessibilityLabel={`Swap ${player.name}, ${Math.round(player.condition)} percent energy`}
                  accessibilityState={{ disabled: swapDisabled }}
                  disabled={swapDisabled}
                  style={[
                    styles.swapButton,
                    guided ? styles.swapButtonGuided : null,
                    swapDisabled ? styles.disabled : null,
                  ]}
                  onPress={onSwap}
                >
                  {guided ? (
                    <TutorialTapCue
                      label="Tap here"
                      detail="Swap players"
                      style={styles.swapCue}
                    />
                  ) : null}
                  <Text style={styles.swapButtonText}>SWAP</Text>
                </SfxPressable>
              </View>
            );
          })}
          <Text style={styles.caption}>SWAP OPENS THE BENCH · FRESH LEGS ENTER AT 100%</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>TEAM ENERGY ({ENERGY_USE_LABELS[energyUse]})</Text>
          <View style={styles.energyTrackWide}>
            <View
              style={[
                styles.energyFillWide,
                fillForBand(teamBand),
                { width: `${Math.max(0, Math.min(100, teamEnergy))}%` },
              ]}
            />
          </View>
          <Text style={styles.caption}>
            {teamEnergy}% AVERAGE · {tiredCount} TIRED (≤ 40%)
          </Text>
          <View style={styles.chipRow}>
            {ENERGY_USE_MODES.map((mode) => {
              const selected = energyUse === mode;
              return (
                <SfxPressable
                  key={mode}
                  accessibilityRole="button"
                  accessibilityLabel={`${ENERGY_USE_LABELS[mode]}. ${ENERGY_USE_ACCESSIBILITY[mode]}`}
                  accessibilityState={{ selected, disabled: coachingDisabled }}
                  disabled={coachingDisabled}
                  style={[
                    styles.chip,
                    selected ? styles.chipSelected : null,
                    coachingDisabled ? styles.disabled : null,
                  ]}
                  onPress={() => onSelectEnergyUse(mode)}
                >
                  <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>
                    {ENERGY_USE_LABELS[mode]}
                  </Text>
                </SfxPressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>HERO POWERS</Text>
          {heroTiles.map((tile) => (
            <View key={tile.id} style={styles.heroTile}>
              <Text style={[styles.heroGlyph, { color: tile.powerColor }]}>{tile.powerGlyph}</Text>
              <View style={styles.heroCopy}>
                <Text numberOfLines={1} style={styles.heroName}>{tile.name}</Text>
                <Text numberOfLines={1} style={[styles.heroPower, { color: tile.powerColor }]}>
                  {tile.powerName}
                </Text>
                <View style={styles.energyTrack}>
                  <View
                    style={[
                      styles.heatFill,
                      tile.status === 'building' ? null : styles.heatFillReady,
                      { width: `${Math.round(tile.heat * 100)}%` },
                    ]}
                  />
                </View>
              </View>
              <View style={styles.heroStatusColumn}>
                <Text
                  style={[
                    styles.heroStatus,
                    tile.status === 'building' ? null : styles.heroStatusReady,
                  ]}
                >
                  {heroStatusText(tile)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function heroStatusText(tile: MatchRailHeroTile): string {
  if (tile.status === 'firing') return 'LIVE';
  // m1.27 removed the Zone countdown from the sim: remainingTicks never
  // decrements, so a seconds readout would sit frozen at "7s" for the whole
  // hold. The tile states the phase instead of faking a timer.
  if (tile.status === 'zone') return 'ZONE';
  return `${Math.round(tile.heat * 100)}%`;
}

function fillForBand(band: EnergyBand) {
  if (band === 'amber') return styles.energyFillAmber;
  if (band === 'red') return styles.energyFillRed;
  return styles.energyFillGreen;
}

function textForBand(band: EnergyBand) {
  if (band === 'amber') return styles.energyTextMedium;
  if (band === 'red') return styles.energyTextLow;
  return null;
}

// Palette from the pixel-art bible (docs/11), matching MatchScreen's dock:
// ink #241f2e, ink-soft #3a3350, card #2d283c, cream #f4f1ea, muted #bcb7c4,
// structure #6b6675, hero gold #edb54a / #c8862a, threat red #d94f52.
//
// Type is Silkscreen per docs/11 — the rail previously ran on the platform's
// system font at 8–12pt, which is why it read as a web sidebar next to pixel
// sprites. `fontWeight: 'bold'` is deliberately absent: the bold face is a
// separate family here, and asking the platform to embolden a bitmap font
// smears it. Everything is a step larger, on the 4/8 spacing grid.
const PIXEL_BOLD = 'Silkscreen_700Bold';
const PIXEL = 'Silkscreen_400Regular';

const styles = StyleSheet.create({
  rail: {
    width: MATCH_RAIL_WIDTH,
    alignSelf: 'stretch',
  },
  railContent: { gap: 16, paddingBottom: 24 },
  card: {
    backgroundColor: '#2d283c',
    borderWidth: 3,
    borderColor: '#6b6675',
    borderBottomWidth: 6,
    borderBottomColor: '#16121f',
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
  },
  cardTitle: { color: '#bcb7c4', fontFamily: PIXEL_BOLD, fontSize: 14, letterSpacing: 1 },
  cardTitleSpaced: { marginTop: 8 },
  caption: { color: '#8e88a0', fontFamily: PIXEL, fontSize: 11, lineHeight: 16, letterSpacing: 0.8 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  scoreBug: {
    flex: 1,
    backgroundColor: '#3a3350',
    borderWidth: 3,
    borderColor: '#241f2e',
    borderBottomWidth: 6,
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  scoreText: {
    color: '#f4f1ea',
    fontFamily: PIXEL_BOLD,
    fontSize: 26,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  scoreTextFlash: { color: '#f7d894' },
  clockText: {
    color: '#bcb7c4',
    fontFamily: PIXEL,
    fontSize: 12,
    letterSpacing: 0.8,
    marginTop: 8,
    fontVariant: ['tabular-nums'],
  },
  chipRow: { flexDirection: 'row', gap: 12 },
  chip: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3a3350',
    borderWidth: 2,
    borderColor: '#49415f',
    borderBottomWidth: 4,
    borderBottomColor: '#16121f',
    borderRadius: 3,
    paddingHorizontal: 8,
  },
  chipSelected: { backgroundColor: '#49415f', borderColor: '#f4f1ea', borderBottomColor: '#f4f1ea' },
  chipText: {
    color: '#bcb7c4',
    fontFamily: PIXEL_BOLD,
    fontSize: 13,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  chipTextSelected: { color: '#f4f1ea' },
  disabled: { opacity: 0.38 },
  tiredRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tiredCopy: { flex: 1, minWidth: 0 },
  tiredName: { color: '#f4f1ea', fontFamily: PIXEL_BOLD, fontSize: 16 },
  tiredRole: { color: '#bcb7c4', fontFamily: PIXEL, fontSize: 11, marginTop: 4 },
  tiredPercent: {
    width: 52,
    textAlign: 'right',
    color: '#65b96e',
    fontFamily: PIXEL_BOLD,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  energyTrack: { height: 6, backgroundColor: '#16121f', marginTop: 8, overflow: 'hidden' },
  energyFill: { height: 6 },
  energyTrackWide: { height: 12, backgroundColor: '#16121f', overflow: 'hidden', borderRadius: 2 },
  energyFillWide: { height: 12 },
  energyTextMedium: { color: '#edb54a' },
  energyTextLow: { color: '#f06b6e' },
  swapButton: {
    minWidth: 92,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3a3350',
    borderWidth: 2,
    borderColor: '#6b6675',
    borderBottomWidth: 4,
    borderBottomColor: '#16121f',
    borderRadius: 3,
  },
  swapButtonGuided: {
    opacity: 1,
    zIndex: 50,
    elevation: 12,
    backgroundColor: '#5a8fd6',
    borderColor: '#a3c8f0',
    borderBottomColor: '#3f6fb5',
  },
  swapButtonText: { color: '#f4f1ea', fontFamily: PIXEL_BOLD, fontSize: 14, letterSpacing: 0.5 },
  // Centred over the swap button it points at: the cue's arrow sits in the middle
  // of its own width, so anchoring by the right edge aimed it off to one side.
  swapCue: { left: '50%', marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2, bottom: '100%' },
  heroTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#241f2e',
    borderWidth: 2,
    borderColor: '#49415f',
    borderRadius: 3,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  heroGlyph: { width: 36, fontFamily: PIXEL_BOLD, fontSize: 26, textAlign: 'center' },
  heroCopy: { flex: 1, minWidth: 0 },
  heroName: { color: '#f4f1ea', fontFamily: PIXEL_BOLD, fontSize: 15 },
  heroPower: { fontFamily: PIXEL, fontSize: 11, marginTop: 4 },
  heatFill: { height: 6, backgroundColor: '#c8862a' },
  heatFillReady: { backgroundColor: '#edb54a' },
  heroStatusColumn: { alignItems: 'center', gap: 8 },
  heroStatus: {
    color: '#bcb7c4',
    fontFamily: PIXEL_BOLD,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  heroStatusReady: { color: '#edb54a' },
  energyFillGreen: { backgroundColor: ENERGY_FILL_COLORS.green },
  energyFillAmber: { backgroundColor: ENERGY_FILL_COLORS.amber },
  energyFillRed: { backgroundColor: ENERGY_FILL_COLORS.red },
});
