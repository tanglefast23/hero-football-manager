import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, type LayoutChangeEvent } from 'react-native';
import { ActionButton, Metric, PaperPanel, SectionLabel, StatusChip, formatCompactNumber } from '../components/Scorecard';
import type {
  ClubFacilityBuildingViewModel,
  ClubFinancesViewModel,
  FacilityTypeViewModel,
} from '../models';
import { TutorialTapCue } from '../TutorialTapCue';
import { TUTORIAL_TAP_CUE_WIDTH } from '../tutorial-cue-position';

export interface ClubFinancesScreenProps {
  viewModel: ClubFinancesViewModel;
  onOpenLedgerLine?: (ledgerLineId: string) => void;
  onBuildTrainingGround: () => void;
  onBuildFacility?: (type: FacilityTypeViewModel, x: number, y: number) => void;
  onUpgradeFacility?: (buildingId: string) => void;
  onRelocateFacility?: (buildingId: string, x: number, y: number) => void;
  onOpenCoachMarket?: () => void;
  guideTrainingGround?: boolean;
}

export function ClubFinancesScreen({
  viewModel,
  onOpenLedgerLine,
  onBuildTrainingGround,
  onBuildFacility,
  onUpgradeFacility,
  onRelocateFacility,
  onOpenCoachMarket,
  guideTrainingGround = false,
}: ClubFinancesScreenProps) {
  const facility = viewModel.trainingGround;
  const scrollRef = useRef<ScrollView>(null);
  const facilityYRef = useRef<number | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const [selectedBuildType, setSelectedBuildType] = useState<FacilityTypeViewModel | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [relocatingBuildingId, setRelocatingBuildingId] = useState<string | null>(null);
  const selectedBuilding = viewModel.facilities.buildings.find(
    building => building.id === selectedBuildingId,
  );

  const handleGridCell = useCallback((x: number, y: number) => {
    if (relocatingBuildingId !== null) {
      onRelocateFacility?.(relocatingBuildingId, x, y);
      setRelocatingBuildingId(null);
      return;
    }
    if (selectedBuildType !== null) {
      onBuildFacility?.(selectedBuildType, x, y);
      setSelectedBuildType(null);
    }
  }, [onBuildFacility, onRelocateFacility, relocatingBuildingId, selectedBuildType]);

  const scrollToTrainingGround = useCallback(() => {
    if (!guideTrainingGround || facilityYRef.current === null) return;
    if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      scrollRef.current?.scrollTo({ y: Math.max(0, facilityYRef.current! - 12), animated: true });
    });
  }, [guideTrainingGround]);

  useEffect(() => {
    scrollToTrainingGround();
    return () => {
      if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
    };
  }, [scrollToTrainingGround]);

  const onTrainingGroundLayout = useCallback((event: LayoutChangeEvent) => {
    facilityYRef.current = event.nativeEvent.layout.y;
    scrollToTrainingGround();
  }, [scrollToTrainingGround]);

  return (
    <ScrollView ref={scrollRef} className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
      <View className="flex-row items-end justify-between">
        <View>
          <Text className="text-sm font-bold uppercase text-blue-dark">Accounts office</Text>
          <Text className="mt-1 text-xl font-bold uppercase text-ink">Club finances</Text>
        </View>
        <StatusChip label={viewModel.periodLabel} />
      </View>

      <PaperPanel kicker="Cash position" title="The board’s bottom line" stamp="Current" className="mt-5">
        <View className="flex-row gap-2">
          <Metric label="Balance" value={formatCompactNumber(viewModel.resources.money)} />
          <Metric
            label="Weekly net"
            value={`${viewModel.weeklyNet > 0 ? '+' : ''}${formatCompactNumber(viewModel.weeklyNet)}`}
            tone={viewModel.weeklyNet < 0 ? 'negative' : 'positive'}
          />
          <Metric label="Projected" value={formatCompactNumber(viewModel.projectedBalance)} />
        </View>
        {viewModel.wageSubsidyLabel ? (
          <View className="mt-3 border border-emerald-700 bg-emerald-100 px-3 py-2">
            <Text className="text-sm font-bold uppercase tracking-wide text-emerald-800">
              {viewModel.wageSubsidyLabel}
            </Text>
          </View>
        ) : null}
      </PaperPanel>

      <View className="mt-6">
        <SectionLabel eyebrow="Itemized statement" title="Every coin accounted for" />
        <View className="border-2 border-ink bg-white">
          <View className="flex-row border-b border-ink/20 px-3 py-2">
            <Text className="flex-1 text-sm font-bold uppercase tracking-wide text-ink/50">Entry</Text>
            <Text className="text-right text-sm font-bold uppercase tracking-wide text-ink/50">Amount</Text>
          </View>
          {viewModel.ledger.map(line => {
            const amountClass = line.kind === 'income'
              ? 'text-pitch-dark'
              : line.kind === 'expense'
                ? 'text-red-dark'
                : 'text-ink';
            return (
              <Pressable
                key={line.id}
                accessibilityRole={onOpenLedgerLine ? 'button' : 'text'}
                accessibilityLabel={`${line.label}, ${line.amount > 0 ? 'plus ' : ''}${formatCompactNumber(line.amount)}`}
                disabled={!onOpenLedgerLine}
                onPress={() => onOpenLedgerLine?.(line.id)}
                className="min-h-11 flex-row items-center border-b border-ink/10 px-3 py-2"
                style={({ pressed }) => ({ opacity: pressed ? 0.65 : undefined })}
              >
                <Text className="flex-1 text-base text-ink">{line.label}</Text>
                <Text className={`font-mono text-base font-bold ${amountClass}`}>
                  {line.amount > 0 ? '+' : ''}{formatCompactNumber(line.amount)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {viewModel.recentTransactions.length > 0 ? (
        <View className="mt-6">
          <SectionLabel eyebrow="Cash activity" title="Recent club transactions" />
          <View className="border-2 border-ink bg-white">
            {viewModel.recentTransactions.map(transaction => (
              <View
                key={transaction.id}
                className="min-h-12 flex-row items-center border-b border-ink/10 px-3 py-2"
              >
                <View className="flex-1 pr-3">
                  <Text className="text-base font-bold text-ink">{transaction.label}</Text>
                  <Text className="font-mono text-xs uppercase text-ink/50">
                    {transaction.periodLabel} · Balance {formatCompactNumber(transaction.balanceAfter)}
                  </Text>
                </View>
                <Text className={`font-mono text-base font-bold ${transaction.kind === 'income' ? 'text-pitch-dark' : 'text-red-dark'}`}>
                  {transaction.amount > 0 ? '+' : ''}{formatCompactNumber(transaction.amount)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View className="mt-6">
        <SectionLabel eyebrow="Backroom staff" title="Head coach" />
        <PaperPanel
          kicker={viewModel.headCoach ? `Employed ${viewModel.headCoach.seasonsEmployed} season${viewModel.headCoach.seasonsEmployed === 1 ? '' : 's'}` : 'Vacancy'}
          title={viewModel.headCoach?.name ?? 'The touchline needs a voice'}
          stamp={viewModel.headCoach ? `LV${viewModel.headCoach.level}` : 'OPEN'}
        >
          {viewModel.headCoach ? (
            <>
              <View className="flex-row gap-2">
                <Metric label="Level" value={String(viewModel.headCoach.level)} />
                <Metric label="Wage / wk" value={formatCompactNumber(viewModel.headCoach.weeklyWage)} />
              </View>
              <View className="mt-3 flex-row gap-2">
                {viewModel.headCoach.specialtyLabels.map(specialty => (
                  <View key={specialty} className="flex-1 border-2 border-ink bg-blue-light px-2 py-2">
                    <Text className="text-center text-sm font-bold uppercase text-ink">{specialty}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <Text className="text-sm leading-5 text-ink/60">
              Coaches improve their specialist drills and charge a separate weekly wage.
            </Text>
          )}
          {onOpenCoachMarket ? (
            <View className="mt-3">
              <ActionButton
                label={viewModel.headCoach ? 'Review coach market' : 'Hire a head coach'}
                accessibilityLabel={viewModel.headCoach ? 'Review coach market' : 'Hire a head coach'}
                onPress={onOpenCoachMarket}
              />
            </View>
          ) : null}
        </PaperPanel>
      </View>

      <View className="mt-6">
        <SectionLabel
          eyebrow="Club grounds"
          title="Build the place around the team"
          right={<StatusChip label={`${viewModel.facilities.buildings.length} built`} />}
        />
        <PaperPanel
          kicker="8 x 6 grounds"
          title="Facilities grid"
          stamp={`${formatCompactNumber(viewModel.facilities.weeklyUpkeep)}/wk`}
        >
          <Text className="mb-3 text-sm leading-4 text-ink/60">
            Pick a building, then tap its top-left tile. Put useful pairs edge-to-edge to discover bonuses.
          </Text>
          <View
            className="relative overflow-hidden border-2 border-ink bg-emerald-50"
            style={{ aspectRatio: viewModel.facilities.width / viewModel.facilities.height }}
          >
            {Array.from(
              { length: viewModel.facilities.width * viewModel.facilities.height },
              (_, index) => {
                const x = index % viewModel.facilities.width;
                const y = Math.floor(index / viewModel.facilities.width);
                const placementActive = selectedBuildType !== null || relocatingBuildingId !== null;
                return (
                  <Pressable
                    key={`facility-cell-${x}-${y}`}
                    accessibilityRole={placementActive ? 'button' : 'none'}
                    accessibilityLabel={placementActive ? `Place at column ${x + 1}, row ${y + 1}` : undefined}
                    disabled={!placementActive}
                    onPress={() => handleGridCell(x, y)}
                    style={({ pressed }) => ({
                      position: 'absolute',
                      left: `${x * 100 / viewModel.facilities.width}%`,
                      top: `${y * 100 / viewModel.facilities.height}%`,
                      width: `${100 / viewModel.facilities.width}%`,
                      height: `${100 / viewModel.facilities.height}%`,
                      borderRightWidth: 1,
                      borderBottomWidth: 1,
                      borderColor: 'rgba(22, 45, 36, 0.18)',
                      backgroundColor: pressed ? 'rgba(250, 204, 21, 0.45)' : undefined,
                    })}
                  />
                );
              },
            )}
            {viewModel.facilities.buildings.map(building => {
              const selected = building.id === selectedBuildingId;
              return (
                <Pressable
                  key={building.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${building.name}, level ${building.level}`}
                  onPress={() => {
                    setSelectedBuildingId(building.id);
                    setSelectedBuildType(null);
                  }}
                  style={({ pressed }) => ({
                    position: 'absolute',
                    left: `${building.x * 100 / viewModel.facilities.width}%`,
                    top: `${building.y * 100 / viewModel.facilities.height}%`,
                    width: `${building.width * 100 / viewModel.facilities.width}%`,
                    height: `${building.height * 100 / viewModel.facilities.height}%`,
                    borderWidth: selected ? 3 : 2,
                    borderColor: selected ? '#B45309' : '#162D24',
                    backgroundColor: selected ? '#FDE68A' : facilityColor(building),
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.75 : 1,
                    zIndex: 2,
                  })}
                >
                  <Text className="font-mono text-sm font-bold text-ink">{facilityMark(building)}</Text>
                  <Text className="mt-0.5 text-xs font-bold uppercase text-ink">L{building.level}</Text>
                </Pressable>
              );
            })}
          </View>

          {selectedBuildType !== null || relocatingBuildingId !== null ? (
            <View className="mt-3 border-2 border-amber-800 bg-amber-100 px-3 py-2">
              <Text className="text-sm font-bold uppercase text-amber-900">
                {relocatingBuildingId !== null ? 'Tap a destination tile' : 'Tap a build tile'}
              </Text>
              <Text className="mt-1 text-sm text-amber-900/70">The highlighted tile is the building’s top-left corner.</Text>
            </View>
          ) : null}

          {selectedBuilding ? (
            <View className="mt-3 border-2 border-ink bg-white p-3">
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-base font-bold uppercase text-ink">
                    {selectedBuilding.name} · Level {selectedBuilding.level}
                  </Text>
                  <Text className="mt-1 text-sm text-ink/60">
                    {formatCompactNumber(selectedBuilding.weeklyUpkeep)}/wk upkeep · {formatCompactNumber(selectedBuilding.relocationFee)} to move
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close selected facility"
                  onPress={() => {
                    setSelectedBuildingId(null);
                    setRelocatingBuildingId(null);
                  }}
                  className="h-8 w-8 items-center justify-center border-2 border-ink bg-paper"
                >
                  <Text className="font-mono text-base font-bold text-ink">×</Text>
                </Pressable>
              </View>
              <View className="mt-3 flex-row gap-2">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Move ${selectedBuilding.name}`}
                  onPress={() => setRelocatingBuildingId(selectedBuilding.id)}
                  className="min-h-11 flex-1 items-center justify-center border-2 border-b-4 border-ink bg-blue-light px-2"
                >
                  <Text className="text-sm font-bold uppercase text-ink">Move</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Upgrade ${selectedBuilding.name}`}
                  disabled={selectedBuilding.upgradeCost === undefined}
                  onPress={() => onUpgradeFacility?.(selectedBuilding.id)}
                  className={selectedBuilding.upgradeCost === undefined
                    ? 'min-h-11 flex-1 items-center justify-center border-2 border-ink/30 bg-ink/5 px-2'
                    : 'min-h-11 flex-1 items-center justify-center border-2 border-b-4 border-ink bg-signal px-2'}
                >
                  <Text className={selectedBuilding.upgradeCost === undefined
                    ? 'text-center text-sm font-bold uppercase text-ink/35'
                    : 'text-center text-sm font-bold uppercase text-ink'}>
                    {selectedBuilding.upgradeCost === undefined
                      ? 'Max level'
                      : `Upgrade · ${formatCompactNumber(selectedBuilding.upgradeCost)}`}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View className="mt-4">
            <Text className="mb-2 text-sm font-bold uppercase tracking-wide text-ink/50">Build menu</Text>
            <View className="flex-row flex-wrap gap-2">
              {viewModel.facilities.catalog.map(entry => {
                const selected = selectedBuildType === entry.type;
                return (
                  <Pressable
                    key={entry.type}
                    accessibilityRole="button"
                    accessibilityLabel={`${entry.name}, build cost ${formatCompactNumber(entry.buildCost)}`}
                    disabled={!entry.available || !entry.affordable}
                    onPress={() => {
                      setSelectedBuildType(selected ? null : entry.type);
                      setSelectedBuildingId(null);
                      setRelocatingBuildingId(null);
                    }}
                    className={selected
                      ? 'w-[48%] border-2 border-b-4 border-amber-800 bg-amber-100 p-2'
                      : entry.available && entry.affordable
                        ? 'w-[48%] border-2 border-b-4 border-ink bg-white p-2'
                        : 'w-[48%] border-2 border-ink/20 bg-ink/5 p-2'}
                  >
                    <Text className={entry.available && entry.affordable
                      ? 'text-sm font-bold uppercase text-ink'
                      : 'text-sm font-bold uppercase text-ink/35'}>
                      {entry.name}
                    </Text>
                    <Text className={entry.available && entry.affordable
                      ? 'mt-1 font-mono text-sm text-ink/60'
                      : 'mt-1 font-mono text-sm text-ink/30'}>
                      {entry.available
                        ? `${entry.width}x${entry.height} · ${formatCompactNumber(entry.buildCost)}`
                        : 'Locked'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View className="mt-4 border-t-2 border-ink/20 pt-3">
            <Text className="text-sm font-bold uppercase tracking-wide text-ink/50">Adjacency codex</Text>
            {viewModel.facilities.discoveredAdjacencies.length === 0 ? (
              <Text className="mt-2 text-sm text-ink/55">No pairings discovered yet.</Text>
            ) : viewModel.facilities.discoveredAdjacencies.map(adjacency => (
              <View key={adjacency} className="mt-2 flex-row items-center justify-between border border-ink/20 bg-white px-2 py-2">
                <Text className="text-sm font-bold uppercase text-ink">{adjacencyLabel(adjacency)}</Text>
                <StatusChip
                  label={viewModel.facilities.activeAdjacencies.includes(adjacency) ? 'Active' : 'Known'}
                  tone={viewModel.facilities.activeAdjacencies.includes(adjacency) ? 'success' : 'normal'}
                />
              </View>
            ))}
          </View>
        </PaperPanel>
      </View>

      {viewModel.legacyTrainingGroundVisible ? (
      <View className="mt-6" onLayout={onTrainingGroundLayout}>
        <SectionLabel eyebrow="One big call" title="Training Ground" right={<StatusChip label="Facility 01" />} />
        <PaperPanel kicker="Works order" title="Turn mud into momentum" stamp={facility.built ? 'Built' : 'Decision'}>
          <View className="flex-row items-center gap-4 border-y-2 border-ink py-4">
            <View className="h-16 w-16 items-center justify-center border-2 border-emerald-900 bg-pitch">
              <View className="h-10 w-10 border-2 border-paper/80">
                <View className="absolute left-1/2 top-0 h-full w-px bg-paper/70" />
                <View className="absolute left-0 top-1/2 h-px w-full bg-paper/70" />
              </View>
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold uppercase text-ink">Training Ground · Level 1</Text>
              <Text className="mt-2 text-sm leading-4 text-ink/60">
                A proper weekly practice base. Small, dependable improvement without adding another management chore.
              </Text>
            </View>
          </View>
          <View className="mt-3 flex-row gap-2">
            <Metric label="Build cost" value={formatCompactNumber(facility.cost)} tone="negative" />
            <Metric label="Weekly return" value={`+${facility.weeklyTrainingPoints} TP`} tone="positive" />
          </View>
          <Text className="mt-3 text-sm font-bold uppercase tracking-wide text-ink/50">
            M1 offer: 8,000 cost · +5 TP every week
          </Text>
          {!facility.built ? (
            <View className={guideTrainingGround ? 'relative mt-3 border-2 border-blue-dark bg-blue-light p-1' : 'relative mt-3'}>
              {guideTrainingGround ? (
                <TutorialTapCue
                  detail="Build the facility"
                  style={{ left: '50%', marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2, top: -72 }}
                />
              ) : null}
              <ActionButton
                label="Approve build · 8,000"
                accessibilityLabel="Build the Training Ground for 8,000 money"
                onPress={onBuildTrainingGround}
                disabled={!facility.affordable}
              />
            </View>
          ) : null}
          {!facility.built && !facility.affordable ? (
            <Text className="mt-2 text-center text-sm font-bold uppercase tracking-wide text-stamp">
              Insufficient balance
            </Text>
          ) : null}
        </PaperPanel>
      </View>
      ) : null}
    </ScrollView>
  );
}

function facilityMark(building: ClubFacilityBuildingViewModel): string {
  return building.name
    .split(' ')
    .map(word => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function facilityColor(building: ClubFacilityBuildingViewModel): string {
  if (building.type === 'training-pitch' || building.type === 'youth-field') return '#86C07A';
  if (building.type === 'medical-bay') return '#F8C7C7';
  if (building.type === 'fan-shop' || building.type === 'stadium-stand') return '#C8DDF0';
  if (building.type === 'hero-lab') return '#E6D5F2';
  return '#F4E7C5';
}

function adjacencyLabel(id: string): string {
  if (id === 'gym-dorm') return 'Gym + Dorm · STA +10%';
  if (id === 'fan-shop-stadium') return 'Shop + Stand · Merch +10%';
  if (id === 'medical-training-pitch') return 'Medical + Pitch · Injury -20%';
  return id;
}
