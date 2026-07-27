import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, PaperPanel, StatusChip } from '../components/Scorecard';
import { ChalkboardBackdrop, StageSection } from '../components/ChalkboardStage';
import { SettingsButton } from '../SettingsOverlay';
import type { MatchDayViewModel } from '../models';
import { SfxPressable as Pressable } from '../components/SfxPressable';
import { useLayoutMode } from '../layout/use-layout-mode';
import { PixelText } from '../components/PixelText';
import { PixelPortrait } from '../components/PixelPortrait';

/**
 * Three pixels per sprite pixel: a 72x87 face, which fits a w-28 pitch cell
 * beside its shirt and full name without the row outgrowing the pitch box.
 * Whole number on purpose — a fractional scale smears a 1-bit face.
 */
const PITCH_PORTRAIT_SCALE = 3;

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

const ROLE_ORDER: ReadonlyArray<'FWD' | 'MID' | 'DEF' | 'GK'> = ['FWD', 'MID', 'DEF', 'GK'];

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
  const wide = useLayoutMode() === 'twoColumn';
  const fixture = viewModel.fixture;
  const licensedCount = viewModel.heroes.filter(hero => hero.licensed).length;
  const [selectedStarterId, setSelectedStarterId] = useState<string | null>(null);
  const selectedStarter = viewModel.lineup.find(player => player.id === selectedStarterId);

  useEffect(() => {
    if (selectedStarterId !== null && selectedStarter === undefined) setSelectedStarterId(null);
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
  }, [fixture.id]);
  // A settled fixture unmounts this screen, so the pending re-arm below never
  // runs. Clearing it on the way out keeps that true even if the unmount is slow.
  useEffect(() => () => {
    if (reArmRef.current !== null) clearTimeout(reArmRef.current);
  }, []);
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
        <Text className="flex-1 text-right font-pixel text-base uppercase leading-6 text-ink" numberOfLines={2}>{fixture.homeTeam}</Text>
        <View className="border-2 border-ink bg-ink px-3 py-2">
          <Text className="font-pixel text-base text-signal">V</Text>
        </View>
        <Text className="flex-1 font-pixel text-base uppercase leading-6 text-ink" numberOfLines={2}>{fixture.awayTeam}</Text>
      </View>
      <View className="mt-3 items-center">
        <StatusChip
          label={`${fixture.opponentHeroCount} rival hero${fixture.opponentHeroCount === 1 ? '' : 'es'} reported`}
          tone="danger"
        />
      </View>
    </PaperPanel>
  );

  const teamSheet = (
    <View className="mt-6">
      <StageSection eyebrow="Team sheet" title="Starting eleven" right={<StatusChip label={viewModel.formationLabel} />} />
      <Text className="mb-3 text-sm leading-5 text-paper/70">
        To change starters, tap the starter and the replacement. Every change is saved for future matches.
      </Text>
      {/* Desktop has the room to show who these people are: a face, a full name
          and the shirt, in a cell wide enough that no name is clipped. A phone
          keeps the compact shirt-number grid, where a portrait per starter would
          not fit and eleven Skia canvases are not worth the frame. */}
      <View className={wide
        ? 'border-[3px] border-ink bg-pitch px-4 py-6'
        : 'border-[3px] border-ink bg-pitch px-3 py-4'}>
        <View className="absolute inset-x-3 top-1/2 h-px bg-paper/50" />
        <View className="absolute left-1/2 top-0 h-full w-px bg-paper/40" />
        {ROLE_ORDER.map(role => {
          const players = viewModel.lineup.filter(player => player.role === role);
          return (
            <View key={role} className={wide
              ? 'my-3 flex-row justify-center gap-4'
              : 'my-2 flex-row justify-center gap-2'}>
              {players.map(player => (
                <Pressable
                  key={player.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${player.name}, starting ${player.role}, shirt ${player.shirtNumber}. Select to replace.`}
                  accessibilityState={{ selected: player.id === selectedStarterId }}
                  onPress={() => setSelectedStarterId(current => current === player.id ? null : player.id)}
                  className={player.id === selectedStarterId
                    ? (wide ? 'w-28 items-center border-2 border-blue-dark bg-blue-light p-2' : 'w-14 items-center border-2 border-blue-dark bg-blue-light p-1')
                    : (wide ? 'w-28 items-center border-2 border-transparent p-2' : 'w-14 items-center border-2 border-transparent p-1')}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : undefined })}
                >
                  {wide ? (
                    <View className={player.isHero
                      ? 'border-2 border-gold bg-blue-light'
                      : 'border-2 border-paper bg-blue-light'}>
                      <PixelPortrait
                        playerId={player.id}
                        role={player.role}
                        lookId={player.lookId}
                        scale={PITCH_PORTRAIT_SCALE}
                      />
                    </View>
                  ) : null}
                  <View className={wide
                    ? (player.isHero
                      ? 'mt-1 h-7 w-7 items-center justify-center border-2 border-gold bg-ink'
                      : 'mt-1 h-7 w-7 items-center justify-center border-2 border-paper bg-ink')
                    : (player.isHero
                      ? 'h-9 w-9 items-center justify-center border-2 border-gold bg-ink'
                      : 'h-9 w-9 items-center justify-center border-2 border-paper bg-ink')}>
                    <Text className={player.isHero ? 'font-mono text-sm text-gold' : 'font-mono text-sm text-paper'}>
                      {player.shirtNumber}
                    </Text>
                  </View>
                  <Text
                    className={player.id === selectedStarterId
                      ? 'mt-1 text-center text-sm font-bold text-ink'
                      : 'mt-1 text-center text-sm font-bold text-paper'}
                    // Wide cells spell the name out; the phone grid still has to
                    // clip, because 56px cannot hold "Dario Flint".
                    numberOfLines={wide ? 2 : 1}
                  >
                    {player.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          );
        })}
      </View>
    </View>
  );

  const bench = (
    <View className={wide ? undefined : 'mt-4'}>
      <StageSection
        eyebrow="Selection bench"
        title={selectedStarter === undefined ? 'Choose a starter' : `Replace ${selectedStarter.name}`}
        right={selectedStarter === undefined ? undefined : <StatusChip label={selectedStarter.role} selected />}
      />
      <View className="gap-2">
        {viewModel.bench.map(player => {
          const roleMismatch = selectedStarter !== undefined && player.role !== selectedStarter.role;
          const disabled = selectedStarter === undefined || !player.canStart || roleMismatch;
          const statusLabel = player.unavailableLabel
            ?? (roleMismatch ? `${selectedStarter?.role ?? player.role} only` : 'Ready');
          return (
            <Pressable
              key={player.id}
              accessibilityRole="button"
              accessibilityLabel={`${player.name}, bench ${player.role}, rating ${player.overall}. ${statusLabel}.`}
              accessibilityState={{ disabled }}
              disabled={disabled}
              onPress={() => swapWithBenchPlayer(player.id)}
              className={disabled
                ? 'min-h-14 flex-row items-center border-2 border-ink/20 bg-white p-3 opacity-50'
                : 'min-h-14 flex-row items-center border-2 border-b-4 border-ink bg-white p-3'}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : undefined })}
            >
              <View className={player.isHero
                ? 'mr-3 h-10 w-10 items-center justify-center border-2 border-gold-dark bg-gold'
                : 'mr-3 h-10 w-10 items-center justify-center border-2 border-ink bg-paper-dark'}
              >
                <Text className="font-mono text-sm text-ink">{player.shirtNumber}</Text>
              </View>
              <View className="flex-1 pr-2">
                <PixelText className="text-base uppercase text-ink" numberOfLines={1}>{player.name}</PixelText>
                <Text className="mt-1 font-mono text-sm text-ink/60">
                  {player.role} · Rating {player.overall} · Condition {player.condition}%
                </Text>
              </View>
              <StatusChip
                label={statusLabel}
                tone={player.injuryWeeks > 0 ? 'danger' : player.isHero && !player.licensed ? 'hero' : disabled ? 'normal' : 'success'}
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
        eyebrow="League permit"
        title="Hero licenses"
        right={<StatusChip label={`${licensedCount} / ${viewModel.heroLimit}`} tone="hero" />}
      />
      <View className="gap-3">
        {viewModel.heroes.length === 0 ? (
          <PaperPanel kicker="Permit office" title="No heroes registered" stamp="Ordinary football">
            <Text className="text-base leading-6 text-ink/65">
              Eleven regular players. No powers. Remember how this feels.
            </Text>
          </PaperPanel>
        ) : viewModel.heroes.map(hero => (
          <PaperPanel key={hero.playerId} className={hero.licensed ? 'bg-gold-light' : undefined}>
            <View className="flex-row items-center gap-3">
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel={`${hero.playerName} hero license`}
                accessibilityState={{ checked: hero.licensed }}
                onPress={() => onToggleHeroLicense(hero.playerId)}
                className={hero.licensed ? 'h-11 w-11 items-center justify-center border-2 border-gold-dark bg-gold' : 'h-11 w-11 items-center justify-center border-2 border-ink bg-paper-dark'}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : undefined })}
              >
                <Text className="font-mono text-xl font-bold text-ink">{hero.licensed ? '★' : '○'}</Text>
              </Pressable>
              <View className="flex-1">
                <PixelText className="text-base uppercase text-ink">{hero.playerName}</PixelText>
                <PixelText className="mt-1 text-sm uppercase tracking-wide text-gold-dark">{hero.powerName}</PixelText>
              </View>
            </View>
          </PaperPanel>
        ))}
      </View>
      {viewModel.heroes.length > 0 ? (
        <Text className="mt-3 text-sm leading-5 text-paper/60">
          Owned heroes without a license must remain on the bench. Licensed heroes fire their
          powers automatically at the right moment in both watched and Quick Result matches.
        </Text>
      ) : null}
      {!viewModel.licenseReady ? (
        <PixelText className="mt-3 text-center text-sm uppercase tracking-wide text-red-light">
          License every starting hero before starting the match · limit {viewModel.heroLimit}
        </PixelText>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-pitch-dark" edges={['top', 'left', 'right', 'bottom']}>
      <ChalkboardBackdrop wide={wide} />
      <View className={wide
        ? 'w-full max-w-[1180px] flex-row items-center justify-between self-center px-6 py-3'
        : 'flex-row items-center justify-between px-4 py-3'}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Return to club management"
          onPress={onBack}
          className="min-h-11 min-w-11 items-center justify-center border-2 border-paper/40"
          style={({ pressed }) => ({ opacity: pressed ? 0.65 : undefined })}
        >
          <Text className="font-pixel text-xl text-paper">‹</Text>
        </Pressable>
        <View className="flex-1 px-3">
          <Text className="text-center font-pixel text-xs uppercase tracking-[2px] text-gold-light">Match-day docket</Text>
          <Text className="mt-1 text-center font-pixel text-base uppercase text-white">{fixture.competition}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <View className="min-w-11 rotate-2 border-2 border-red bg-red-light/25 px-2 py-2">
            <Text className="text-center font-pixel text-sm text-red-light">{fixture.weekLabel}</Text>
          </View>
          <SettingsButton onPress={onOpenSettings} />
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
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
        <View className={wide ? 'w-full max-w-[1180px] flex-row gap-2 self-center px-2' : 'flex-row gap-2'}>
          <View className="flex-1">
            <ActionButton
              label="Quick result"
              accessibilityLabel="Simulate this match with quick result"
              onPress={() => handOffFixture(onQuickResult)}
              disabled={quickResultDisabled || handedOff || !viewModel.licenseReady}
              variant="paper"
            />
          </View>
          <View className="flex-1">
            <ActionButton
              label={wide ? 'Watch match  ▸' : 'Watch  ▸'}
              accessibilityLabel="Watch match"
              onPress={() => handOffFixture(onWatchMatch)}
              disabled={watchDisabled || handedOff || !viewModel.licenseReady}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
