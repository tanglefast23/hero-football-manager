import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, PaperPanel, StatusChip } from '../components/Scorecard';
import { ChalkboardBackdrop } from '../components/ChalkboardStage';
import { SettingsButton } from '../SettingsOverlay';
import type { MatchDayViewModel } from '../models';
import { SfxPressable as Pressable } from '../components/SfxPressable';
import { useLayoutMode } from '../layout/use-layout-mode';

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

/** On-stage section header: gold pixel eyebrow over a white pixel title. */
function DocketSection({ eyebrow, title, right }: { eyebrow: string; title: string; right?: ReactNode }) {
  return (
    <View className="mb-3 flex-row items-end justify-between gap-3">
      <View className="flex-1">
        <Text className="font-pixel text-xs uppercase tracking-[2px] text-gold-light">{eyebrow}</Text>
        <Text className="mt-1 font-pixel text-lg uppercase text-white">{title}</Text>
      </View>
      {right}
    </View>
  );
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
  const wide = useLayoutMode() === 'twoColumn';
  const fixture = viewModel.fixture;
  const licensedCount = viewModel.heroes.filter(hero => hero.licensed).length;
  const [selectedStarterId, setSelectedStarterId] = useState<string | null>(null);
  const selectedStarter = viewModel.lineup.find(player => player.id === selectedStarterId);

  useEffect(() => {
    if (selectedStarterId !== null && selectedStarter === undefined) setSelectedStarterId(null);
  }, [selectedStarter, selectedStarterId]);

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
          <Text className="font-mono text-base font-bold text-signal">V</Text>
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
      <DocketSection eyebrow="Team sheet" title="Starting eleven" right={<StatusChip label={viewModel.formationLabel} />} />
      <Text className="mb-3 text-sm leading-5 text-paper/70">
        Tap a starter, then choose an available player in the same role. Every change is saved for future matches.
      </Text>
      <View className="border-[3px] border-ink bg-pitch px-3 py-4">
        <View className="absolute inset-x-3 top-1/2 h-px bg-paper/50" />
        <View className="absolute left-1/2 top-0 h-full w-px bg-paper/40" />
        {ROLE_ORDER.map(role => {
          const players = viewModel.lineup.filter(player => player.role === role);
          return (
            <View key={role} className="my-2 flex-row justify-center gap-2">
              {players.map(player => (
                <Pressable
                  key={player.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${player.name}, starting ${player.role}. Select to replace.`}
                  accessibilityState={{ selected: player.id === selectedStarterId }}
                  onPress={() => setSelectedStarterId(current => current === player.id ? null : player.id)}
                  className={player.id === selectedStarterId
                    ? 'w-14 items-center border-2 border-violet-dark bg-violet-light p-1'
                    : 'w-14 items-center border-2 border-transparent p-1'}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : undefined })}
                >
                  <View className={player.isHero ? 'h-9 w-9 items-center justify-center border-2 border-gold bg-ink' : 'h-9 w-9 items-center justify-center border-2 border-paper bg-ink'}>
                    <Text className={player.isHero ? 'font-mono text-sm font-bold text-gold' : 'font-mono text-sm font-bold text-paper'}>
                      {player.shirtNumber}
                    </Text>
                  </View>
                  <Text className={player.id === selectedStarterId
                    ? 'mt-1 text-center text-sm font-bold text-ink'
                    : 'mt-1 text-center text-sm font-bold text-paper'} numberOfLines={1}>{player.name}</Text>
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
      <DocketSection
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
                <Text className="font-mono text-sm font-bold text-ink">{player.shirtNumber}</Text>
              </View>
              <View className="flex-1 pr-2">
                <Text className="text-base font-bold uppercase text-ink" numberOfLines={1}>{player.name}</Text>
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
      <DocketSection
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
                <Text className="text-base font-bold uppercase text-ink">{hero.playerName}</Text>
                <Text className="mt-1 text-sm font-bold uppercase tracking-wide text-gold-dark">{hero.powerName}</Text>
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
        <Text className="mt-3 text-center text-sm font-bold uppercase tracking-wide text-red-light">
          License every starting hero before starting the match · limit {viewModel.heroLimit}
        </Text>
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
          <Text className="font-mono text-xl font-bold text-paper">‹</Text>
        </Pressable>
        <View className="flex-1 px-3">
          <Text className="text-center font-pixel text-xs uppercase tracking-[2px] text-gold-light">Match-day docket</Text>
          <Text className="mt-1 text-center font-pixel text-base uppercase text-white">{fixture.competition}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <View className="min-w-11 rotate-2 border-2 border-red bg-red-light/25 px-2 py-2">
            <Text className="text-center font-mono text-sm font-bold text-red-light">{fixture.weekLabel}</Text>
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

      <View className="border-t-2 border-paper/10 bg-pitch-dark p-3">
        <View className={wide ? 'w-full max-w-[1180px] flex-row gap-2 self-center px-2' : 'flex-row gap-2'}>
          <View className="flex-1">
            <ActionButton
              label="Quick result"
              accessibilityLabel="Simulate this match with quick result"
              onPress={onQuickResult}
              disabled={quickResultDisabled || !viewModel.licenseReady}
              variant="paper"
            />
          </View>
          <View className="flex-1">
            <ActionButton
              label={wide ? 'Watch match  ▸' : 'Watch  ▸'}
              accessibilityLabel="Watch match"
              onPress={onWatchMatch}
              disabled={watchDisabled || !viewModel.licenseReady}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
