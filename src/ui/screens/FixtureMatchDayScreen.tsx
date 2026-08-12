import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, PaperPanel, StatusChip } from '../components/Scorecard';
import {
  ChalkboardBackdrop,
  StageSection,
} from '../components/ChalkboardStage';
import { SettingsButton } from '../SettingsOverlay';
import type { LineupPlayerViewModel, MatchDayViewModel } from '../models';
import { SfxPressable as Pressable } from '../components/SfxPressable';
import { useLayoutMode } from '../layout/use-layout-mode';
import { PixelText } from '../components/PixelText';
import { PixelPortrait } from '../components/PixelPortrait';
import {
  matchdayConditionStatus,
  type MatchdayConditionStatus,
} from '../matchday-condition';
import { useCopy } from '../../i18n';
import { hasHoverPointer } from '../pointer-capability';
import { ClubCrest } from '../components/ClubCrest';

/**
 * Three pixels per sprite pixel: a 72x87 face, which fits a w-28 pitch cell
 * with a full name without the row outgrowing the pitch box.
 * Whole number on purpose — a fractional scale smears a 1-bit face.
 */
const PITCH_PORTRAIT_SCALE = 3;
/** A crisp 48x58 face for the denser five-across phone rows. */
const PITCH_PORTRAIT_COMPACT_SCALE = 2;

export interface FixtureMatchDayScreenProps {
  viewModel: MatchDayViewModel;
  onBack: () => void;
  onToggleHeroLicense: (playerId: string) => void;
  onSwapStartingPlayer: (starterId: string, replacementId: string) => void;
  onWatchMatch: () => void;
  onQuickResult: () => void;
  watchDisabled?: boolean;
  quickResultDisabled?: boolean;
  onOpenSettings: () => void;
}

const ROLE_ORDER: ReadonlyArray<'FWD' | 'MID' | 'DEF' | 'GK'> = [
  'FWD',
  'MID',
  'DEF',
  'GK',
];

const CONDITION_STAMP_STYLE: Readonly<
  Record<
    MatchdayConditionStatus['kind'],
    {
      box: string;
      text: string;
    }
  >
> = {
  'below-peak': {
    box: 'border border-gold-dark bg-gold-light',
    text: 'text-gold-dark',
  },
  fatigued: {
    box: 'border-2 border-red-dark bg-red-light',
    text: 'text-red-dark',
  },
  exhausted: {
    box: 'border-2 border-paper bg-red-dark',
    text: 'text-white',
  },
};

function MatchdayConditionStamp({
  condition,
  compact = false,
  showValue = true,
}: {
  condition: number;
  compact?: boolean;
  showValue?: boolean;
}) {
  const t = useCopy();
  const status = matchdayConditionStatus(condition, t);
  if (status === null) return null;
  const style = CONDITION_STAMP_STYLE[status.kind];
  return (
    <View
      className={`${style.box} ${compact ? 'mt-1 self-start px-1.5 py-0.5' : 'mt-1 px-1 py-0.5'}`}
    >
      <PixelText
        className={`${style.text} text-center uppercase ${compact ? 'text-[10px]' : 'text-[9px]'}`}
        numberOfLines={compact ? 1 : 2}
      >
        {status.label}
        {showValue ? ` · ${condition}%` : ''}
      </PixelText>
    </View>
  );
}

function StarterStatsPanel({
  player,
  wide,
}: {
  player: LineupPlayerViewModel;
  wide: boolean;
}) {
  const t = useCopy();
  const cells = [
    { label: t('col.squad.overall'), value: player.overall },
    { label: t('col.squad.potential'), value: player.potentialGrade },
    { label: t('col.squad.condition'), value: player.condition },
    { label: 'PAC', value: player.attributes.PAC },
    {
      label: player.role === 'GK' ? 'REF' : 'SHO',
      value:
        player.role === 'GK' ? player.attributes.REF : player.attributes.SHO,
    },
    { label: 'PAS', value: player.attributes.PAS },
    { label: 'DEF', value: player.attributes.DEF },
    { label: 'TEC', value: player.attributes.TEC },
    { label: 'STA', value: player.attributes.STA },
  ] as const;

  return (
    <View
      accessible={false}
      className={`${wide ? 'h-[91px] w-[76px]' : 'h-[62px] w-[52px]'} border-2 border-paper bg-white p-px`}
    >
      {[0, 3, 6].map((start) => (
        <View key={start} className="min-h-0 flex-1 flex-row">
          {cells.slice(start, start + 3).map((cell) => (
            <View
              key={cell.label}
              className="min-w-0 flex-1 items-center justify-center"
            >
              <Text
                maxFontSizeMultiplier={1}
                adjustsFontSizeToFit
                numberOfLines={1}
                className={`${wide ? 'text-[7px]' : 'text-[5px]'} font-mono font-bold uppercase text-blue-dark`}
              >
                {cell.label}
              </Text>
              <Text
                maxFontSizeMultiplier={1}
                adjustsFontSizeToFit
                numberOfLines={1}
                className={`${wide ? 'text-[9px]' : 'text-[7px]'} font-mono font-bold text-ink`}
              >
                {cell.value}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function starterStatsAccessibilityLabel(
  player: LineupPlayerViewModel,
  t: ReturnType<typeof useCopy>,
): string {
  return [
    `${t('col.squad.overall')} ${player.overall}`,
    `${t('col.squad.potential')} ${player.potentialGrade}`,
    `${t('col.squad.condition')} ${player.condition}`,
    `PAC ${player.attributes.PAC}`,
    player.role === 'GK'
      ? `REF ${player.attributes.REF}`
      : `SHO ${player.attributes.SHO}`,
    `PAS ${player.attributes.PAS}`,
    `DEF ${player.attributes.DEF}`,
    `TEC ${player.attributes.TEC}`,
    `STA ${player.attributes.STA}`,
  ].join(', ');
}

export function FixtureMatchDayScreen({
  viewModel,
  onBack,
  onToggleHeroLicense,
  onSwapStartingPlayer,
  onWatchMatch,
  onQuickResult,
  watchDisabled = false,
  quickResultDisabled = false,
  onOpenSettings,
}: FixtureMatchDayScreenProps) {
  const t = useCopy();
  const wide = useLayoutMode() === 'twoColumn';
  const pointer = hasHoverPointer();
  const fixture = viewModel.fixture;
  const licensedCount = viewModel.heroes.filter((hero) => hero.licensed).length;
  const [selectedStarterId, setSelectedStarterId] = useState<string | null>(
    null,
  );
  const [hoveredStarterId, setHoveredStarterId] = useState<string | null>(null);
  const selectedStarter = viewModel.lineup.find(
    (player) => player.id === selectedStarterId,
  );

  useEffect(() => {
    if (selectedStarterId !== null && selectedStarter === undefined)
      setSelectedStarterId(null);
  }, [selectedStarter, selectedStarterId]);

  // Handing the fixture off changes the screen, but this one is not unmounted
  // until the next render — long enough for a second tap to settle the fixture
  // after it, which is a real one when a cup tie shares the week: it would be
  // played with the league match's ledger never shown. The ref closes that
  // window on the press itself; the state only drives the disabled look. Both
  // re-arm on the next fixture, which is how that cup tie stays playable.
  const [handedOff, setHandedOff] = useState(false);
  const handedOffRef = useRef(false);
  const reArmRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    handedOffRef.current = false;
    setHandedOff(false);
    setHoveredStarterId(null);
  }, [fixture.id]);
  // A settled fixture unmounts this screen, so the pending re-arm below never
  // runs. Clearing it on the way out keeps that true even if the unmount is slow.
  useEffect(
    () => () => {
      if (reArmRef.current !== null) clearTimeout(reArmRef.current);
    },
    [],
  );
  const handOffFixture = (settle: () => void) => {
    if (handedOffRef.current) return;
    handedOffRef.current = true;
    setHandedOff(true);
    settle();
    // The store can refuse — a blocked save is reachable right here — and then
    // nothing navigates away, leaving both buttons latched off for good with
    // only Back as an escape. Still being mounted on the next turn of the loop
    // means the fixture never left, so the latch releases.
    if (reArmRef.current !== null) clearTimeout(reArmRef.current);
    reArmRef.current = setTimeout(() => {
      reArmRef.current = null;
      handedOffRef.current = false;
      setHandedOff(false);
    }, 0);
  };

  const swapWithBenchPlayer = (replacementId: string) => {
    if (selectedStarter === undefined) return;
    onSwapStartingPlayer(selectedStarter.id, replacementId);
    setSelectedStarterId(null);
  };

  const fixtureCard = (
    <PaperPanel stamp={fixture.venueLabel}>
      <View className="flex-row items-center gap-3">
        <View className="min-w-0 flex-1 flex-row items-center justify-end gap-2">
          <ClubCrest clubName={fixture.homeTeam} size={24} />
          <Text
            className="min-w-0 text-right font-pixel text-base uppercase leading-6 text-ink"
            numberOfLines={2}
          >
            {fixture.homeTeam}
          </Text>
        </View>
        <View className="border-2 border-ink bg-ink px-3 py-2">
          <Text className="font-pixel text-base text-signal">V</Text>
        </View>
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
          <ClubCrest clubName={fixture.awayTeam} size={24} />
          <Text
            className="min-w-0 font-pixel text-base uppercase leading-6 text-ink"
            numberOfLines={2}
          >
            {fixture.awayTeam}
          </Text>
        </View>
      </View>
      {fixture.opponentHeroes.length > 0 ? (
        <View className="mt-3 flex-row flex-wrap justify-center gap-2">
          {fixture.opponentHeroes.map((hero) => (
            <View
              key={hero.id}
              accessible
              accessibilityLabel={`${hero.name}. ${t(
                'fixtureMatchDay.rivalHeroesReported',
                { n: 1, count: 1 },
              )}`}
              className="flex-row items-center gap-2 border-2 border-red-dark bg-red-light px-2 py-1"
            >
              <View className="border-2 border-red-dark bg-paper">
                <PixelPortrait
                  playerId={hero.id}
                  role={hero.role}
                  lookId={hero.lookId}
                  scale={PITCH_PORTRAIT_COMPACT_SCALE}
                />
              </View>
              <PixelText className="max-w-40 text-sm uppercase text-ink">
                {hero.name}
              </PixelText>
              <View className="border-2 border-b-4 border-gold-dark bg-gold-light px-2 py-1">
                <PixelText className="text-[10px] uppercase text-gold-dark">
                  {t('rivalHeroIntro.divisionRival')}
                </PixelText>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View className="mt-3 items-center">
          <StatusChip
            label={t('fixtureMatchDay.rivalHeroesReported', {
              n: 0,
              count: 0,
            })}
            tone="danger"
          />
        </View>
      )}
    </PaperPanel>
  );

  const teamSheet = (
    <View className="mt-6">
      <StageSection
        eyebrow={t('fixtureMatchDay.teamSheet')}
        title={t('fixtureMatchDay.startingEleven')}
        right={<StatusChip label={viewModel.formationLabel} />}
      />
      <Text className="mb-3 text-sm leading-5 text-paper/75">
        {t('fixtureMatchDay.toChangeStartersTap')}
      </Text>
      {/* Every starter is identified by their face and name. Phone cells share
          the full row rather than stopping at 64pt, so the space that used to
          sit around the grid now belongs to names. */}
      <View
        className={
          wide
            ? 'border-[3px] border-ink bg-pitch px-4 py-6'
            : 'border-[3px] border-ink bg-pitch px-1 py-3'
        }
      >
        <View className="absolute inset-x-3 top-1/2 h-px bg-paper/50" />
        <View className="absolute left-1/2 top-0 h-full w-px bg-paper/40" />
        {ROLE_ORDER.map((role) => {
          const players = viewModel.lineup.filter(
            (player) => player.formationRole === role,
          );
          return (
            <View
              key={role}
              className={
                wide
                  ? 'my-3 flex-row justify-center gap-4'
                  : 'my-1.5 flex-row justify-center gap-1'
              }
            >
              {players.map((player) => {
                const conditionStatus = matchdayConditionStatus(
                  player.condition,
                  t,
                );
                const selected = player.id === selectedStarterId;
                const cardClass = selected
                  ? wide
                    ? 'w-28 items-center border-2 border-blue-dark bg-blue-light p-2'
                    : 'min-w-0 max-w-24 flex-1 items-center border-2 border-blue-dark bg-blue-light px-0.5 py-1'
                  : conditionStatus?.kind === 'exhausted'
                    ? wide
                      ? 'w-28 items-center border-2 border-red-light bg-red-dark p-2'
                      : 'min-w-0 max-w-24 flex-1 items-center border-2 border-red-light bg-red-dark px-0.5 py-1'
                    : conditionStatus?.kind === 'fatigued'
                      ? wide
                        ? 'w-28 items-center border-2 border-red-dark bg-red-light p-2'
                        : 'min-w-0 max-w-24 flex-1 items-center border-2 border-red-dark bg-red-light px-0.5 py-1'
                      : conditionStatus?.kind === 'below-peak'
                        ? wide
                          ? 'w-28 items-center border-2 border-gold-dark bg-gold-light p-2'
                          : 'min-w-0 max-w-24 flex-1 items-center border-2 border-gold-dark bg-gold-light px-0.5 py-1'
                        : wide
                          ? 'w-28 items-center border-2 border-transparent p-2'
                          : 'min-w-0 max-w-24 flex-1 items-center border-2 border-transparent px-0.5 py-1';

                const spokenStats = starterStatsAccessibilityLabel(player, t);
                const showStats =
                  hoveredStarterId === player.id || (!pointer && selected);
                return (
                  <Pressable
                    key={player.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${t(
                      'fixtureMatchDay.a11y.starterCard',
                      {
                        player: player.name,
                        position:
                          player.role === player.formationRole
                            ? t('fixtureMatchDay.a11y.startingRole', {
                                role: player.formationRole,
                              })
                            : t('fixtureMatchDay.a11y.naturalStartingRole', {
                                role: player.role,
                                formationRole: player.formationRole,
                              }),
                        shirt: player.shirtNumber,
                        condition: player.condition,
                        // The separator is punctuation, not copy; the label it
                        // introduces still comes from matchday-condition.
                        status:
                          conditionStatus === null
                            ? ''
                            : `, ${conditionStatus.label}`,
                      },
                    )} ${spokenStats}`}
                    accessibilityState={{ selected }}
                    onHoverIn={() => setHoveredStarterId(player.id)}
                    onHoverOut={() =>
                      setHoveredStarterId((current) =>
                        current === player.id ? null : current,
                      )
                    }
                    onPress={() =>
                      setSelectedStarterId((current) =>
                        current === player.id ? null : player.id,
                      )
                    }
                    className={cardClass}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.7 : undefined,
                    })}
                  >
                    {showStats ? (
                      <StarterStatsPanel player={player} wide={wide} />
                    ) : (
                      <View
                        className={
                          player.isHero
                            ? 'border-2 border-gold bg-blue-light'
                            : 'border-2 border-paper bg-blue-light'
                        }
                      >
                        <PixelPortrait
                          playerId={player.id}
                          role={player.role}
                          lookId={player.lookId}
                          scale={
                            wide
                              ? PITCH_PORTRAIT_SCALE
                              : PITCH_PORTRAIT_COMPACT_SCALE
                          }
                        />
                      </View>
                    )}
                    <Text
                      className={
                        selected
                          ? 'mt-1 text-center text-sm font-bold text-ink'
                          : conditionStatus?.kind === 'exhausted'
                            ? 'mt-1 text-center text-sm font-bold text-white'
                            : conditionStatus !== null
                              ? 'mt-1 text-center text-sm font-bold text-ink'
                              : 'mt-1 text-center text-sm font-bold text-paper'
                      }
                      numberOfLines={2}
                    >
                      {player.name}
                    </Text>
                    <MatchdayConditionStamp
                      condition={player.condition}
                      showValue={wide}
                    />
                  </Pressable>
                );
              })}
            </View>
          );
        })}
      </View>
    </View>
  );

  const bench = (
    <View className={wide ? undefined : 'mt-4'}>
      <StageSection
        eyebrow={t('fixtureMatchDay.selectionBench')}
        title={
          selectedStarter === undefined
            ? t('fixtureMatchDay.chooseAStarter')
            : t('fixtureMatchDay.replacePlayer', {
                player: selectedStarter.name,
              })
        }
        right={
          selectedStarter === undefined ? undefined : (
            <StatusChip label={selectedStarter.formationRole} selected />
          )
        }
      />
      <View className="gap-2">
        {viewModel.bench.map((player) => {
          const conditionStatus = matchdayConditionStatus(player.condition, t);
          const roleMismatch =
            selectedStarter !== undefined &&
            (player.role === 'GK') !== (selectedStarter.formationRole === 'GK');
          const disabled =
            selectedStarter === undefined || !player.canStart || roleMismatch;
          const statusLabel =
            player.unavailableLabel ??
            (roleMismatch
              ? selectedStarter?.formationRole === 'GK'
                ? t('fixtureMatchDay.gkOnly')
                : t('fixtureMatchDay.outfieldOnly')
              : t('fixtureMatchDay.ready'));
          return (
            <Pressable
              key={player.id}
              accessibilityRole="button"
              accessibilityLabel={t('fixtureMatchDay.a11y.benchCard', {
                player: player.name,
                role: player.role,
                rating: player.overall,
                condition: player.condition,
                status:
                  conditionStatus === null ? '' : `, ${conditionStatus.label}`,
                availability: statusLabel,
              })}
              accessibilityState={{ disabled }}
              disabled={disabled}
              onPress={() => swapWithBenchPlayer(player.id)}
              className={
                disabled
                  ? 'min-h-14 flex-row items-center border-2 border-ink/20 bg-white p-3 opacity-50'
                  : conditionStatus?.kind === 'below-peak'
                    ? 'min-h-14 flex-row items-center border-2 border-b-4 border-gold-dark bg-white p-3'
                    : conditionStatus === null
                      ? 'min-h-14 flex-row items-center border-2 border-b-4 border-ink bg-white p-3'
                      : 'min-h-14 flex-row items-center border-2 border-b-4 border-red-dark bg-white p-3'
              }
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : undefined })}
            >
              <View
                className={
                  player.isHero
                    ? 'mr-3 h-10 w-10 items-center justify-center border-2 border-gold-dark bg-gold'
                    : 'mr-3 h-10 w-10 items-center justify-center border-2 border-ink bg-paper-dark'
                }
              >
                <Text className="font-mono text-[12px] text-ink">
                  {player.shirtNumber}
                </Text>
              </View>
              <View className="flex-1 pr-2">
                <PixelText
                  className="text-base uppercase text-ink"
                  numberOfLines={1}
                >
                  {player.name}
                </PixelText>
                <Text className="mt-1 font-mono text-[12px] text-ink/60">
                  {t('fixtureMatchDay.playerLine', {
                    role: player.role,
                    rating: player.overall,
                    condition: player.condition,
                  })}
                </Text>
                <MatchdayConditionStamp condition={player.condition} compact />
              </View>
              <StatusChip
                label={statusLabel}
                tone={
                  player.injuryWeeks > 0
                    ? 'danger'
                    : player.isHero && !player.licensed
                      ? 'hero'
                      : disabled
                        ? 'normal'
                        : 'success'
                }
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const heroLicenses = (
    <View className="mt-6">
      <StageSection
        eyebrow={t('fixtureMatchDay.leaguePermit')}
        title={t('fixtureMatchDay.heroLicenses')}
        right={
          <StatusChip
            label={`${licensedCount} / ${viewModel.heroLimit}`}
            tone="hero"
          />
        }
      />
      <View className="gap-3">
        {viewModel.heroes.length === 0 ? (
          <PaperPanel
            kicker={t('fixtureMatchDay.permitOffice')}
            title={t('fixtureMatchDay.noHeroesRegistered')}
            stamp={t('fixtureMatchDay.ordinaryFootball')}
          >
            <Text className="text-base leading-6 text-ink/65">
              {t('fixtureMatchDay.elevenRegularPlayersNo')}
            </Text>
          </PaperPanel>
        ) : (
          viewModel.heroes.map((hero) => (
            <PaperPanel
              key={hero.playerId}
              className={hero.licensed ? 'bg-gold-light' : undefined}
            >
              <View className="flex-row items-center gap-3">
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel={t('fixtureMatchDay.a11y.heroLicenseFor', {
                    player: hero.playerName,
                  })}
                  accessibilityState={{ checked: hero.licensed }}
                  onPress={() => onToggleHeroLicense(hero.playerId)}
                  className={
                    hero.licensed
                      ? 'h-11 w-11 items-center justify-center border-2 border-gold-dark bg-gold'
                      : 'h-11 w-11 items-center justify-center border-2 border-ink bg-paper-dark'
                  }
                  // Static style, not a function: layout in a function-form style
                  // is the twice-hit iOS zero-height trap. 44pt in explicit points
                  // (h-11 is 38.5pt); SfxPressable supplies the pressed dim.
                  style={{ minWidth: 44, minHeight: 44 }}
                >
                  <Text className="font-mono text-[18px] font-bold text-ink">
                    {hero.licensed ? '★' : '○'}
                  </Text>
                </Pressable>
                <View className="flex-1">
                  <PixelText className="text-base uppercase text-ink">
                    {hero.playerName}
                  </PixelText>
                  <PixelText className="mt-1 text-[12px] uppercase tracking-wide text-gold-dark">
                    {hero.powerName}
                  </PixelText>
                </View>
              </View>
            </PaperPanel>
          ))
        )}
      </View>
      {viewModel.heroes.length > 0 ? (
        <Text className="mt-3 text-sm leading-5 text-paper/75">
          {t('fixtureMatchDay.ownedHeroesWithoutA')}
        </Text>
      ) : null}
      {!viewModel.licenseReady ? (
        <PixelText className="mt-3 text-center text-[12px] uppercase tracking-wide text-red-light">
          {t('fixtureMatchDay.licenseWarning', { limit: viewModel.heroLimit })}
        </PixelText>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView
      className="flex-1 bg-pitch-ink"
      edges={['top', 'left', 'right', 'bottom']}
    >
      <ChalkboardBackdrop wide={wide} />
      <View
        className={
          wide
            ? 'w-full max-w-[1180px] flex-row items-center justify-between self-center px-6 py-3'
            : 'flex-row items-center justify-between px-4 py-3'
        }
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('fixtureMatchDay.a11y.returnToClubManagement')}
          onPress={onBack}
          className="min-h-11 min-w-11 items-center justify-center border-2 border-paper/40"
          style={({ pressed }) => ({ opacity: pressed ? 0.65 : undefined })}
        >
          <Text className="font-pixel text-[18px] text-paper">‹</Text>
        </Pressable>
        <View className="flex-1 px-3">
          <Text className="text-center font-pixel text-[10px] uppercase tracking-[2px] text-gold-light">
            {t('fixtureMatchDay.match-dayDocket')}
          </Text>
          <Text className="mt-1 text-center font-pixel text-base uppercase text-white">
            {fixture.competition}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <View className="min-w-11 rotate-2 border-2 border-red bg-red-light/25 px-2 py-2">
            <Text className="text-center font-pixel text-[12px] text-red-light">
              {fixture.weekLabel}
            </Text>
          </View>
          <SettingsButton onPress={onOpenSettings} />
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      >
        {wide ? (
          <View className="w-full max-w-[1180px] flex-row items-start gap-8 self-center px-2">
            <View className="flex-1">
              {fixtureCard}
              {teamSheet}
            </View>
            <View className="flex-1 pt-1">
              {bench}
              {heroLicenses}
            </View>
          </View>
        ) : (
          <View className="w-full max-w-[720px] self-center">
            {fixtureCard}
            {teamSheet}
            {bench}
            {heroLicenses}
          </View>
        )}
      </ScrollView>

      <View className="border-t-[6px] border-white bg-ink/25 p-3">
        <View
          className={
            wide
              ? 'w-full max-w-[1180px] flex-row gap-2 self-center px-2'
              : 'flex-row gap-2'
          }
        >
          <View className="flex-1">
            <ActionButton
              label={t('fixtureMatchDay.quickResult')}
              accessibilityLabel={t(
                'fixtureMatchDay.a11y.simulateThisMatchWithQuickResult',
              )}
              onPress={() => handOffFixture(onQuickResult)}
              disabled={
                quickResultDisabled || handedOff || !viewModel.licenseReady
              }
              variant="paper"
            />
          </View>
          <View className="flex-1">
            <ActionButton
              // The arrow stays out of the catalog: Silkscreen has no U+25B8
              // (measured), so a key containing it would fail gate 5. It draws
              // through the system fallback here, as it always has.
              label={`${wide ? t('fixtureMatchDay.playMatch') : t('fixtureMatchDay.play')}  ▸`}
              accessibilityLabel={t('fixtureMatchDay.a11y.playMatch')}
              onPress={() => handOffFixture(onWatchMatch)}
              disabled={watchDisabled || handedOff || !viewModel.licenseReady}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
