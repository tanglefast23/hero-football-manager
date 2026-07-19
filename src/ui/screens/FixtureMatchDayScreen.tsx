import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, PaperPanel, SectionLabel, StatusChip } from '../components/Scorecard';
import type { MatchDayViewModel } from '../models';

export interface FixtureMatchDayScreenProps {
  viewModel: MatchDayViewModel;
  onBack: () => void;
  onToggleHeroLicense: (playerId: string) => void;
  onWatchMatch: () => void;
  onQuickResult: () => void;
  watchDisabled?: boolean;
  quickResultDisabled?: boolean;
}

const ROLE_ORDER: ReadonlyArray<'FWD' | 'MID' | 'DEF' | 'GK'> = ['FWD', 'MID', 'DEF', 'GK'];

export function FixtureMatchDayScreen({
  viewModel,
  onBack,
  onToggleHeroLicense,
  onWatchMatch,
  onQuickResult,
  watchDisabled = false,
  quickResultDisabled = false,
}: FixtureMatchDayScreenProps) {
  const fixture = viewModel.fixture;
  const licensedCount = viewModel.heroes.filter(hero => hero.licensed).length;

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'left', 'right', 'bottom']}>
      <View className="flex-row items-center justify-between border-b-2 border-ink/20 px-4 py-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Return to club management"
          onPress={onBack}
          className="min-h-11 min-w-11 items-center justify-center border border-ink/30"
          style={({ pressed }) => ({ opacity: pressed ? 0.65 : undefined })}
        >
          <Text className="font-mono text-xl font-bold text-ink">‹</Text>
        </Pressable>
        <View className="flex-1 px-3">
          <Text className="text-center text-sm font-bold uppercase text-blue-dark">Match-day docket</Text>
          <Text className="mt-1 text-center text-base font-bold uppercase text-ink">{fixture.competition}</Text>
        </View>
        <View className="min-w-11 border border-stamp px-2 py-2">
          <Text className="text-center font-mono text-sm font-bold text-stamp">{fixture.weekLabel}</Text>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <PaperPanel stamp={fixture.venueLabel}>
          <View className="flex-row items-center gap-3">
            <Text className="flex-1 text-right text-xl font-bold uppercase text-ink" numberOfLines={2}>{fixture.homeTeam}</Text>
            <View className="border-2 border-ink bg-ink px-3 py-2">
              <Text className="font-mono text-base font-bold text-signal">V</Text>
            </View>
            <Text className="flex-1 text-xl font-bold uppercase text-ink" numberOfLines={2}>{fixture.awayTeam}</Text>
          </View>
          <View className="mt-3 items-center">
            <StatusChip
              label={`${fixture.opponentHeroCount} rival hero${fixture.opponentHeroCount === 1 ? '' : 'es'} reported`}
              tone="danger"
            />
          </View>
        </PaperPanel>

        <View className="mt-6">
          <SectionLabel eyebrow="Team sheet" title="Starting eleven" right={<StatusChip label="4–4–2" />} />
          <View className="border-2 border-emerald-900 bg-pitch px-3 py-4">
            <View className="absolute inset-x-3 top-1/2 h-px bg-paper/50" />
            <View className="absolute left-1/2 top-0 h-full w-px bg-paper/40" />
            {ROLE_ORDER.map(role => {
              const players = viewModel.lineup.filter(player => player.role === role);
              return (
                <View key={role} className="my-2 flex-row justify-center gap-2">
                  {players.map(player => (
                    <View key={player.id} className="w-14 items-center">
                      <View className={player.isHero ? 'h-9 w-9 items-center justify-center border-2 border-amber-500 bg-ink' : 'h-9 w-9 items-center justify-center border-2 border-paper bg-ink'}>
                        <Text className={player.isHero ? 'font-mono text-sm font-bold text-amber-400' : 'font-mono text-sm font-bold text-paper'}>
                          {player.shirtNumber}
                        </Text>
                      </View>
                      <Text className="mt-1 text-center text-sm font-bold text-paper" numberOfLines={1}>{player.name}</Text>
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        </View>

        <View className="mt-6">
          <SectionLabel eyebrow="Touchline order" title="Tactic" right={<StatusChip label="Fixed in M1" />} />
          <View className="gap-2">
            {viewModel.tactics.map(tactic => {
              const selected = tactic.id === viewModel.selectedTacticId;
              return (
                <View
                  key={tactic.id}
                  accessible
                  accessibilityLabel={`${tactic.label} tactic. ${tactic.detail}. Tactics are fixed in M1.`}
                  className={selected ? 'min-h-14 flex-row items-center border-2 border-ink bg-signal p-3' : 'min-h-14 flex-row items-center border-2 border-ink/30 bg-white p-3'}
                >
                  <View className={selected ? 'mr-3 h-5 w-5 items-center justify-center border-2 border-ink' : 'mr-3 h-5 w-5 items-center justify-center border-2 border-ink/40'}>
                    {selected ? <View className="h-2 w-2 bg-ink" /> : null}
                  </View>
                  <View className="flex-1">
                    <Text className={selected ? 'text-base font-bold uppercase text-ink' : 'text-base font-bold uppercase text-ink'}>{tactic.label}</Text>
                    <Text className={selected ? 'mt-1 text-sm text-ink/60' : 'mt-1 text-sm text-ink/50'}>{tactic.detail}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View className="mt-6">
          <SectionLabel
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
              <PaperPanel key={hero.playerId} className={hero.licensed ? 'bg-amber-100' : undefined}>
                <View className="flex-row items-center gap-3">
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityLabel={`${hero.playerName} hero license`}
                    accessibilityState={{ checked: hero.licensed }}
                    onPress={() => onToggleHeroLicense(hero.playerId)}
                    className={hero.licensed ? 'h-11 w-11 items-center justify-center border-2 border-amber-600 bg-signal' : 'h-11 w-11 items-center justify-center border-2 border-ink bg-paper-dark'}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : undefined })}
                  >
                    <Text className="font-mono text-xl font-bold text-ink">{hero.licensed ? '★' : '○'}</Text>
                  </Pressable>
                  <View className="flex-1">
                    <Text className="text-base font-bold uppercase text-ink">{hero.playerName}</Text>
                    <Text className="mt-1 text-sm font-bold uppercase tracking-wide text-amber-700">{hero.powerName}</Text>
                  </View>
                  <View
                    accessible
                    accessibilityLabel={`${hero.playerName} activation. Watched matches use manual taps. Quick Result uses contextual auto-fire.`}
                    className="min-w-20 border-2 border-ink px-2 py-2"
                  >
                    <Text className="text-sm font-bold uppercase text-ink">Watch · Tap</Text>
                    <Text className="mt-1 text-sm font-bold uppercase text-ink/50">Quick · Auto</Text>
                  </View>
                </View>
              </PaperPanel>
            ))}
          </View>
          {viewModel.heroes.length > 0 ? (
            <Text className="mt-3 text-sm leading-5 text-ink/50">
              Owned heroes without a license must remain on the bench. Activation follows match mode:
              manual taps while watching, contextual auto-fire in Quick Result.
            </Text>
          ) : null}
          {!viewModel.licenseReady ? (
            <Text className="mt-3 text-center text-sm font-bold uppercase tracking-wide text-stamp">
              Finish the two-license selection before starting the match
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <View className="border-t-2 border-ink/20 bg-white p-3">
        <View className="flex-row gap-2">
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
              label="Watch match  ▸"
              accessibilityLabel="Watch this match"
              onPress={onWatchMatch}
              disabled={watchDisabled || !viewModel.licenseReady}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
