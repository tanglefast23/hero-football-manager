import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View, type LayoutChangeEvent } from 'react-native';
import { ActionButton, Metric, PaperPanel, SectionLabel, StatusChip, formatCompactNumber } from '../components/Scorecard';
import type {
  ClubFacilityBuildingViewModel,
  ClubFinancesViewModel,
  FacilityTypeViewModel,
} from '../models';
import { TutorialTapCue } from '../TutorialTapCue';
import { TUTORIAL_TAP_CUE_WIDTH } from '../tutorial-cue-position';
import { ManagementSprite } from '../components/ManagementSprite';
import { facilityBenefit } from '../facility-benefit';
import { SfxPressable as Pressable } from '../components/SfxPressable';

export interface ClubFinancesScreenProps {
  viewModel: ClubFinancesViewModel;
  onOpenLedgerLine?: (ledgerLineId: string) => void;
  onBuildTrainingGround: () => void;
  onBuildFacility?: (type: FacilityTypeViewModel, x: number, y: number) => void;
  onUpgradeFacility?: (buildingId: string) => void;
  onRelocateFacility?: (buildingId: string, x: number, y: number) => void;
  onOpenCoachMarket?: () => void;
  onDismissCoach?: () => void;
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
  onDismissCoach,
  guideTrainingGround = false,
}: ClubFinancesScreenProps) {
  const facility = viewModel.trainingGround;
  const facilities = viewModel.facilities;
  const scrollRef = useRef<ScrollView>(null);
  const facilityYRef = useRef<number | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const [selectedBuildType, setSelectedBuildType] = useState<FacilityTypeViewModel | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [relocatingBuildingId, setRelocatingBuildingId] = useState<string | null>(null);
  const [previewCell, setPreviewCell] = useState<{ x: number; y: number } | null>(null);
  const selectedBuilding = facilities.buildings.find(
    building => building.id === selectedBuildingId,
  );
  const relocatingBuilding = facilities.buildings.find(
    building => building.id === relocatingBuildingId,
  );
  const selectedBuildEntry = selectedBuildType === null
    ? undefined
    : facilities.catalog.find(entry => entry.type === selectedBuildType);

  const placementActive = selectedBuildType !== null || relocatingBuildingId !== null;
  const activeFootprint = relocatingBuilding
    ? { width: relocatingBuilding.width, height: relocatingBuilding.height }
    : selectedBuildEntry
      ? { width: selectedBuildEntry.width, height: selectedBuildEntry.height }
      : null;
  const activeLabel = relocatingBuilding?.name ?? selectedBuildEntry?.name ?? '';
  const placementType = relocatingBuilding?.type ?? selectedBuildEntry?.type;
  const placementLevel = relocatingBuilding?.level ?? 1;

  const canPlaceAt = useCallback((x: number, y: number): boolean => {
    if (activeFootprint === null) return false;
    if (x + activeFootprint.width > facilities.width) return false;
    if (y + activeFootprint.height > facilities.height) return false;
    return !facilities.buildings.some(building => {
      if (building.id === relocatingBuildingId) return false;
      return x < building.x + building.width
        && building.x < x + activeFootprint.width
        && y < building.y + building.height
        && building.y < y + activeFootprint.height;
    });
  }, [activeFootprint, facilities.buildings, facilities.height, facilities.width, relocatingBuildingId]);

  const cellIsOccupied = useCallback((x: number, y: number): boolean => (
    facilities.buildings.some(building => (
      x >= building.x
      && x < building.x + building.width
      && y >= building.y
      && y < building.y + building.height
    ))
  ), [facilities.buildings]);

  const cancelPlacement = useCallback(() => {
    setSelectedBuildType(null);
    setRelocatingBuildingId(null);
    setPreviewCell(null);
  }, []);

  const handleGridCell = useCallback((x: number, y: number) => {
    if (!canPlaceAt(x, y)) return;
    if (relocatingBuildingId !== null) {
      onRelocateFacility?.(relocatingBuildingId, x, y);
      setRelocatingBuildingId(null);
      setPreviewCell(null);
      return;
    }
    if (selectedBuildType !== null) {
      onBuildFacility?.(selectedBuildType, x, y);
      setSelectedBuildType(null);
      setPreviewCell(null);
    }
  }, [canPlaceAt, onBuildFacility, onRelocateFacility, relocatingBuildingId, selectedBuildType]);

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
              <View className="flex-row items-center gap-3 border-y-2 border-ink bg-blue-light p-3">
                <View className="border-2 border-b-4 border-ink bg-white px-2 pt-2">
                  <ManagementSprite
                    spriteKey={`coach:${viewModel.headCoach.portraitId}:rest`}
                    width={72}
                    accessibilityLabel={`${viewModel.headCoach.name} coach portrait`}
                  />
                </View>
                <View className="min-w-0 flex-1 gap-2">
                  <Metric label="Level" value={String(viewModel.headCoach.level)} />
                  <Metric label="Wage / wk" value={formatCompactNumber(viewModel.headCoach.weeklyWage)} />
                </View>
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
            <View className="mt-3 gap-2">
              <ActionButton
                label={viewModel.headCoach ? 'Review coach market' : 'Hire a head coach'}
                accessibilityLabel={viewModel.headCoach ? 'Review coach market' : 'Hire a head coach'}
                onPress={onOpenCoachMarket}
              />
              {viewModel.headCoach && onDismissCoach ? (
                <ActionButton
                  label={`Dismiss · ${formatCompactNumber(viewModel.headCoach.severanceCost)} severance`}
                  accessibilityLabel={`Dismiss ${viewModel.headCoach.name} with one week severance`}
                  variant="danger"
                  onPress={onDismissCoach}
                />
              ) : null}
            </View>
          ) : null}
        </PaperPanel>
      </View>

      <View className="mt-6">
        <SectionLabel
          eyebrow="Club grounds"
          title="Build the place around the team"
          right={<StatusChip label={`${viewModel.facilities.buildings.filter(building => building.status === 'operational').length} open`} />}
        />
        <PaperPanel
          kicker="8 x 6 grounds"
          title="Facilities grid"
          stamp={`${formatCompactNumber(viewModel.facilities.weeklyUpkeep)}/wk`}
        >
          <Text className="mb-3 text-sm leading-4 text-ink/60">
            Pick a building from the menu below, then tap a glowing square to drop it. Put useful pairs edge-to-edge to discover bonuses.
          </Text>
          {viewModel.facilities.activeProject ? (
            <View className="mb-3 flex-row items-center gap-3 border-2 border-b-4 border-amber-800 bg-amber-100 p-3">
              <ManagementSprite spriteKey="facility:worksite" width={54} accessibilityLabel="Active construction site" />
              <View className="min-w-0 flex-1">
                <Text className="font-mono text-sm font-bold uppercase text-amber-900">Works crew busy</Text>
                <Text className="mt-1 text-base font-bold uppercase text-ink">
                  {viewModel.facilities.activeProject.name} · {viewModel.facilities.activeProject.weeksRemaining}W left
                </Text>
                <Text className="mt-1 text-sm text-ink/60">Only one construction or upgrade project can run at a time.</Text>
              </View>
            </View>
          ) : null}
          <View
            className="relative overflow-hidden border-2 border-ink bg-emerald-50"
            style={{ aspectRatio: facilities.width / facilities.height }}
          >
            <View style={{ flex: 1 }}>
              {Array.from({ length: facilities.height }, (_, y) => (
                <View key={`facility-row-${y}`} style={{ flex: 1, flexDirection: 'row' }}>
                  {Array.from({ length: facilities.width }, (_, x) => {
                    const occupied = cellIsOccupied(x, y);
                    const buildable = placementActive && !occupied && canPlaceAt(x, y);
                    return (
                      <Pressable
                        key={`facility-cell-${x}-${y}`}
                        accessibilityRole={placementActive ? 'button' : 'none'}
                        accessibilityLabel={placementActive
                          ? `${buildable ? 'Build at' : 'Blocked at'} column ${x + 1}, row ${y + 1}`
                          : undefined}
                        disabled={!placementActive}
                        onPress={() => handleGridCell(x, y)}
                        onPressIn={() => setPreviewCell({ x, y })}
                        onPressOut={() => setPreviewCell(null)}
                        style={{
                          flex: 1,
                          borderRightWidth: x === facilities.width - 1 ? 0 : 1,
                          borderBottomWidth: y === facilities.height - 1 ? 0 : 1,
                          borderColor: 'rgba(36, 31, 46, 0.28)',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: occupied
                            ? undefined
                            : placementActive
                              ? (buildable ? 'rgba(237, 181, 74, 0.32)' : 'rgba(36, 31, 46, 0.05)')
                              : 'rgba(92, 184, 92, 0.12)',
                        }}
                      >
                        {buildable ? (
                          <Text className="font-mono text-xs font-bold text-gold-dark">+</Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>

            <View
              pointerEvents={placementActive ? 'none' : 'box-none'}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            >
              {facilities.buildings.map(building => {
                const selected = building.id === selectedBuildingId;
                const moving = building.id === relocatingBuildingId;
                return (
                  <Pressable
                    key={building.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${building.name}, level ${building.level}`}
                    disabled={placementActive}
                    onPress={() => {
                      setSelectedBuildingId(building.id);
                      setSelectedBuildType(null);
                    }}
                    style={{
                      position: 'absolute',
                      left: `${building.x * 100 / facilities.width}%`,
                      top: `${building.y * 100 / facilities.height}%`,
                      width: `${building.width * 100 / facilities.width}%`,
                      height: `${building.height * 100 / facilities.height}%`,
                      padding: 2,
                    }}
                  >
                    <View
                      style={{
                        flex: 1,
                        borderWidth: selected ? 3 : 2,
                        borderColor: selected ? '#c8862a' : '#241f2e',
                        backgroundColor: moving ? '#f7d894' : facilityColor(building),
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: moving ? 0.55 : 1,
                      }}
                    >
                      <ManagementSprite
                        spriteKey={building.status === 'construction'
                          ? 'facility:worksite'
                          : `facility:${building.type}:l${building.level}`}
                        width={Math.min(42, building.width * 30)}
                        accessibilityLabel={`${building.name} ${building.status}`}
                      />
                      <Text className="mt-0.5 text-center text-xs font-bold uppercase text-ink">
                        {building.status === 'operational'
                          ? `L${building.level}`
                          : `${building.status === 'construction' ? 'BUILD' : 'UP'} · ${building.weeksRemaining}W`}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {placementActive && previewCell && activeFootprint ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: `${previewCell.x * 100 / facilities.width}%`,
                  top: `${previewCell.y * 100 / facilities.height}%`,
                  width: `${activeFootprint.width * 100 / facilities.width}%`,
                  height: `${activeFootprint.height * 100 / facilities.height}%`,
                  borderWidth: 3,
                  borderColor: canPlaceAt(previewCell.x, previewCell.y) ? '#3f8a4a' : '#a83440',
                  backgroundColor: canPlaceAt(previewCell.x, previewCell.y)
                    ? 'rgba(92, 184, 92, 0.45)'
                    : 'rgba(217, 79, 82, 0.40)',
                }}
              />
            ) : null}
          </View>

          {placementActive ? (
            <View className="mt-3 flex-row items-start justify-between gap-3 border-2 border-amber-800 bg-amber-100 px-3 py-2">
              <View className="flex-1">
                <Text className="text-sm font-bold uppercase text-amber-900">
                  {relocatingBuildingId !== null ? `Moving · ${activeLabel}` : `Placing · ${activeLabel}`}
                </Text>
                <Text className="mt-1 text-sm text-amber-900/80">
                  Tap a glowing square above. A green outline fits; red is blocked.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel placement"
                onPress={cancelPlacement}
                className="min-h-11 items-center justify-center border-2 border-amber-800 bg-white px-3"
              >
                <Text className="text-sm font-bold uppercase text-amber-900">Cancel</Text>
              </Pressable>
            </View>
          ) : (
            <View className="mt-3 border-2 border-dashed border-ink/30 bg-paper px-3 py-2">
              <Text className="text-sm text-ink/70">
                Pick a building from the <Text className="font-bold text-ink">Build menu</Text> below to start — every open square will glow so you can see where it drops.
              </Text>
            </View>
          )}

          {placementActive && placementType ? (
            <View className="mt-2 flex-row items-center gap-3 border-2 border-ink bg-white p-3">
              <View className="border-2 border-ink/20 bg-paper p-1">
                <ManagementSprite
                  spriteKey={`facility:${placementType}:l${placementLevel}`}
                  width={48}
                  accessibilityLabel={activeLabel}
                />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold uppercase text-ink">What it does</Text>
                <Text className="mt-1 text-sm text-ink/80">{facilityBenefit(placementType)}</Text>
              </View>
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
                    {selectedBuilding.status === 'operational'
                      ? `${formatCompactNumber(selectedBuilding.weeklyUpkeep)}/wk upkeep · ${formatCompactNumber(selectedBuilding.relocationFee)} to move`
                      : `${selectedBuilding.status === 'construction' ? 'Building' : 'Upgrading'} · ${selectedBuilding.weeksRemaining} week${selectedBuilding.weeksRemaining === 1 ? '' : 's'} remaining`}
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
                  disabled={selectedBuilding.status !== 'operational'}
                  onPress={() => setRelocatingBuildingId(selectedBuilding.id)}
                  className={selectedBuilding.status !== 'operational'
                    ? 'min-h-11 flex-1 items-center justify-center border-2 border-ink/30 bg-ink/5 px-2'
                    : 'min-h-11 flex-1 items-center justify-center border-2 border-b-4 border-ink bg-blue-light px-2'}
                >
                  <Text className="text-sm font-bold uppercase text-ink">Move</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Upgrade ${selectedBuilding.name}`}
                  disabled={selectedBuilding.upgradeCost === undefined
                    || selectedBuilding.status !== 'operational'
                    || viewModel.facilities.activeProject !== undefined}
                  onPress={() => onUpgradeFacility?.(selectedBuilding.id)}
                  className={selectedBuilding.upgradeCost === undefined
                    || selectedBuilding.status !== 'operational'
                    || viewModel.facilities.activeProject !== undefined
                    ? 'min-h-11 flex-1 items-center justify-center border-2 border-ink/30 bg-ink/5 px-2'
                    : 'min-h-11 flex-1 items-center justify-center border-2 border-b-4 border-ink bg-signal px-2'}
                >
                  <Text className={selectedBuilding.upgradeCost === undefined
                    ? 'text-center text-sm font-bold uppercase text-ink/35'
                    : 'text-center text-sm font-bold uppercase text-ink'}>
                    {selectedBuilding.status !== 'operational'
                      ? 'Project active'
                      : viewModel.facilities.activeProject !== undefined
                        ? 'Crew busy'
                        : selectedBuilding.upgradeCost === undefined
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
                        ? `${entry.width}x${entry.height} · ${formatCompactNumber(entry.buildCost)} · ${entry.buildWeeks}W`
                        : 'Locked'}
                    </Text>
                    {entry.blockedReason ? (
                      <Text className="mt-1 text-xs font-bold text-stamp">{entry.blockedReason}</Text>
                    ) : null}
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
        <PaperPanel
          kicker="Works order"
          title="Turn mud into momentum"
          stamp={facility.built ? 'Built' : facility.underConstruction ? `${facility.weeksRemaining}W LEFT` : 'Decision'}
        >
          <View className="flex-row items-center gap-4 border-y-2 border-ink py-4">
            <View className="items-center justify-center border-2 border-emerald-900 bg-pitch p-2">
              <ManagementSprite
                spriteKey={facility.underConstruction ? 'facility:worksite' : 'facility:training-pitch:l1'}
                width={58}
                accessibilityLabel={facility.underConstruction ? 'Training Ground construction site' : 'Training Ground'}
              />
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
          {!facility.built && !facility.underConstruction ? (
            <View className={guideTrainingGround ? 'relative mt-3 border-2 border-blue-dark bg-blue-light p-1' : 'relative mt-3'}>
              {guideTrainingGround ? (
                <TutorialTapCue
                  detail="Build the facility"
                  style={{ left: '50%', marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2, top: -72 }}
                />
              ) : null}
              <ActionButton
                label="Approve build · 8,000 · 1 week"
                accessibilityLabel="Build the Training Ground for 8,000 money"
                onPress={onBuildTrainingGround}
                disabled={!facility.affordable}
              />
            </View>
          ) : null}
          {facility.underConstruction ? (
            <View className="mt-3 border-2 border-b-4 border-amber-800 bg-amber-100 p-3">
              <Text className="text-center font-pixel text-base uppercase text-amber-900">Sports facility in construction!</Text>
              <Text className="mt-2 text-center text-sm text-ink/65">Benefits start when the next weekly settlement completes the work.</Text>
            </View>
          ) : null}
          {!facility.built && !facility.underConstruction && !facility.affordable ? (
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
