import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SettingsButton } from '../ui/SettingsOverlay';
import { TutorialTapCue } from '../ui/TutorialTapCue';
import { SfxPressable } from '../ui/components/SfxPressable';
import {
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
  autoPowers: boolean;
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
  autoPowers,
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
          <Text style={styles.cardTitle}>FORMATION</Text>
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
          <Text style={styles.caption}>{FORMATION_LABELS[formation].toUpperCase()}</Text>
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
                {/* Read-only policy badge, NOT a toggle. The engine's
                    SET_AUTO_POWERS is team-wide, and MatchScreen has no
                    on-pitch tap-to-fire yet, so switching to M ('SAVE_FOR_TAP')
                    would bank heat with no way to spend it. Make this a live
                    switch once pitch-tap firing lands. */}
                <View
                  accessible
                  accessibilityLabel={autoPowers
                    ? 'Hero powers fire on their own cue'
                    : 'Hero powers wait for your tap'}
                  style={[styles.policyToggle, autoPowers ? styles.policyToggleAuto : null]}
                >
                  <Text style={styles.policyToggleText}>{autoPowers ? 'A' : 'M'}</Text>
                </View>
              </View>
            </View>
          ))}
          <Text style={styles.caption}>
            ONE POWER TILE PER FIELDED HERO — THE RAIL GROWS TO 4 TILES WITH THE HERO LICENSE CAP.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function heroStatusText(tile: MatchRailHeroTile): string {
  if (tile.status === 'firing') return 'LIVE';
  if (tile.status === 'zone' && tile.zoneSecondsLeft !== null) return `${tile.zoneSecondsLeft}s`;
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
const styles = StyleSheet.create({
  rail: {
    width: MATCH_RAIL_WIDTH,
    alignSelf: 'stretch',
  },
  railContent: { gap: 12, paddingBottom: 16 },
  card: {
    backgroundColor: '#2d283c',
    borderWidth: 2,
    borderColor: '#6b6675',
    borderBottomWidth: 4,
    borderBottomColor: '#16121f',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 8,
  },
  cardTitle: { color: '#bcb7c4', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.6 },
  cardTitleSpaced: { marginTop: 4 },
  caption: { color: '#8e88a0', fontSize: 8, fontWeight: 'bold', letterSpacing: 0.4 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  scoreBug: {
    flex: 1,
    backgroundColor: '#3a3350',
    borderWidth: 2,
    borderColor: '#241f2e',
    borderBottomWidth: 4,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  scoreText: { color: '#f4f1ea', fontSize: 20, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  scoreTextFlash: { color: '#f7d894' },
  clockText: {
    color: '#bcb7c4',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
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
  chipSelected: { backgroundColor: '#49415f', borderColor: '#f4f1ea', borderBottomColor: '#f4f1ea' },
  chipText: { color: '#bcb7c4', fontSize: 10, fontWeight: 'bold', textAlign: 'center' },
  chipTextSelected: { color: '#f4f1ea' },
  disabled: { opacity: 0.38 },
  tiredRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tiredCopy: { flex: 1, minWidth: 0 },
  tiredName: { color: '#f4f1ea', fontSize: 12, fontWeight: 'bold' },
  tiredRole: { color: '#bcb7c4', fontSize: 8, fontWeight: 'bold', marginTop: 2 },
  tiredPercent: {
    width: 40,
    textAlign: 'right',
    color: '#65b96e',
    fontSize: 10,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  energyTrack: { height: 4, backgroundColor: '#16121f', marginTop: 4, overflow: 'hidden' },
  energyFill: { height: 4 },
  energyTrackWide: { height: 8, backgroundColor: '#16121f', overflow: 'hidden', borderRadius: 2 },
  energyFillWide: { height: 8 },
  energyTextMedium: { color: '#edb54a' },
  energyTextLow: { color: '#f06b6e' },
  swapButton: {
    minWidth: 72,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3a3350',
    borderWidth: 2,
    borderColor: '#6b6675',
    borderBottomWidth: 3,
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
  swapButtonText: { color: '#f4f1ea', fontSize: 10, fontWeight: 'bold' },
  swapCue: { right: 0, bottom: '100%' },
  heroTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#241f2e',
    borderWidth: 2,
    borderColor: '#49415f',
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  heroGlyph: { width: 28, fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  heroCopy: { flex: 1, minWidth: 0 },
  heroName: { color: '#f4f1ea', fontSize: 12, fontWeight: 'bold' },
  heroPower: { fontSize: 8, fontWeight: 'bold', marginTop: 2 },
  heatFill: { height: 4, backgroundColor: '#c8862a' },
  heatFillReady: { backgroundColor: '#edb54a' },
  heroStatusColumn: { alignItems: 'center', gap: 4 },
  heroStatus: {
    color: '#bcb7c4',
    fontSize: 10,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  heroStatusReady: { color: '#edb54a' },
  policyToggle: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3a3350',
    borderWidth: 2,
    borderColor: '#49415f',
    borderBottomWidth: 3,
    borderBottomColor: '#16121f',
    borderRadius: 3,
  },
  policyToggleAuto: { backgroundColor: '#35618e', borderColor: '#77a4d8' },
  policyToggleText: { color: '#f4f1ea', fontSize: 12, fontWeight: 'bold' },
  energyFillGreen: { backgroundColor: '#65b96e' },
  energyFillAmber: { backgroundColor: '#edb54a' },
  energyFillRed: { backgroundColor: '#d94f52' },
});
