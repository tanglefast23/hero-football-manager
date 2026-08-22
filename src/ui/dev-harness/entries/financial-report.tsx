import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { LedgerLineReveal } from '../../../game/types';
import type {
  LedgerIconViewModel,
  PostMatchLedgerLineViewModel,
  PostMatchViewModel,
} from '../../models';
import { PostMatchSummaryModal } from '../../PostMatchSummaryModal';
import { FinancialReportBody } from '../../components/FinancialReportBody';
import { SfxPressable as Pressable } from '../../components/SfxPressable';
import type { DevHarnessEntry } from '../registry';

/**
 * The Financial Report in every money mood it can arrive in: flat weeks,
 * multiplied facility weeks, each surge banner, the triple-surge
 * double-header, the $0 gate, the longest realistic ledger, and reduce
 * motion. View models are hand-built through reveal builders whose amounts
 * are COMPUTED from the reveal fields, so every case reconstructs exactly by
 * construction — the dressing under review can never disagree with its own
 * math. Rendered INLINE (no RN Modal) so the harness controls stay usable;
 * the body component is the same one the shipped modal composes.
 */

type GateOptions = {
  percent?: number;
  surge?: boolean;
  standLevel?: number;
  standCount?: number;
  cup?: boolean;
  id?: string;
};

let lineCounter = 0;

function gateLine(
  base: number,
  options: GateOptions = {},
): PostMatchLedgerLineViewModel {
  const standLevel = options.standLevel ?? 0;
  const multiplierPercent = 100 + standLevel * 100;
  const amount = base + Math.floor((base * (multiplierPercent - 100)) / 100);
  const reveal: LedgerLineReveal = {
    source: options.cup === true ? 'cup-gate' : 'league-gate',
    base,
    variancePercent: options.percent ?? 5,
    surge: options.surge ?? false,
    multiplierPercent,
    facilityCount:
      options.standCount ?? (standLevel > 0 ? Math.min(standLevel, 3) : 0),
  };
  lineCounter += 1;
  return {
    id: options.id ?? `gate-${lineCounter}`,
    label:
      options.cup === true ? 'Hero Cup Play-in home gate' : 'League home gate',
    amount,
    kind: 'income',
    reveal,
    // Mirrors `ledgerLineIcons`: the strip is the view model's job now, so a
    // harness case that skipped it would review a row the game never draws.
    ...(reveal.facilityCount < 1
      ? {}
      : {
          icons: [
            {
              id: 'stands',
              kind: 'facility' as const,
              facility: 'stadium-stand' as const,
              count: reveal.facilityCount,
            },
          ],
        }),
  };
}

type MerchOptions = {
  percent?: number;
  surge?: boolean;
  times?: number;
  count?: number;
  adjacencyPercent?: number;
  id?: string;
};

function merchLine(
  base: number,
  options: MerchOptions = {},
): PostMatchLedgerLineViewModel {
  const times = options.times ?? 1;
  const adjacencyPercent = options.adjacencyPercent ?? 0;
  const adjacencyAmount = Math.floor((base * times * adjacencyPercent) / 100);
  const amount = base * times + adjacencyAmount;
  const reveal: LedgerLineReveal = {
    source: 'merch',
    base,
    variancePercent: options.percent ?? 5,
    surge: options.surge ?? false,
    multiplierTimes: times,
    facilityCount: options.count ?? times,
    adjacencyPercent,
    adjacencyAmount,
  };
  lineCounter += 1;
  return {
    id: options.id ?? `merch-${lineCounter}`,
    label: 'Fan Shop merchandise',
    amount,
    kind: 'income',
    reveal,
    icons: [
      {
        id: 'shops',
        kind: 'facility' as const,
        facility: 'fan-shop' as const,
        count: reveal.facilityCount,
      },
    ],
  };
}

function plainLine(
  label: string,
  amount: number,
  icons?: readonly LedgerIconViewModel[],
  kind: PostMatchLedgerLineViewModel['kind'] = amount >= 0
    ? 'income'
    : 'expense',
): PostMatchLedgerLineViewModel {
  lineCounter += 1;
  return {
    id: `plain-${lineCounter}`,
    label,
    amount,
    kind,
    ...(icons === undefined ? {} : { icons }),
  };
}

/**
 * The dressed spending rows, at the widths that actually stress the strip: a
 * grounds past the six-icon cap, a full squad behind one `×18`, and both
 * coaches. Portrait ids are real sheet entries — a missing one falls back to
 * the worksite sprite and would hide a broken key.
 */
const CONSTANT_TAIL: readonly (() => PostMatchLedgerLineViewModel)[] = [
  () =>
    plainLine('Facility upkeep', -230, [
      { id: 'b1', kind: 'facility', facility: 'training-pitch', level: 2 },
      { id: 'b2', kind: 'facility', facility: 'fan-shop', level: 1 },
      { id: 'b3', kind: 'facility', facility: 'stadium-stand', level: 3 },
      { id: 'b4', kind: 'facility', facility: 'gym', level: 1 },
      { id: 'b5', kind: 'facility', facility: 'medical-bay', level: 1 },
      { id: 'b6', kind: 'facility', facility: 'dorm', level: 1 },
      { id: 'b7', kind: 'facility', facility: 'scout-office', level: 1 },
    ]),
  () =>
    plainLine('Weekly wages', -2703, [
      { id: 'squad', kind: 'player', count: 18 },
    ]),
  () =>
    plainLine('Coaching staff wages', -750, [
      { id: 'head', kind: 'coach', portraitId: 'amara-okafor' },
      { id: 'assistant', kind: 'coach', portraitId: 'kwame-boateng' },
    ]),
  () => plainLine('Season 1 wage subsidy', 1381),
];

function reportCase(
  lines: PostMatchLedgerLineViewModel[],
  overrides: Partial<PostMatchViewModel> = {},
): PostMatchViewModel {
  return {
    result: {
      fixtureId: 'harness-fixture',
      competition: 'Division Five',
      homeTeam: 'Bramble Rovers',
      awayTeam: 'Harbor Comets',
      homeScore: 2,
      awayScore: 0,
      outcomeLabel: 'WIN',
      winner: 'home',
      cupExit: false,
    },
    ledger: lines,
    settlementSeason: 1,
    settlementWeek: 9,
    netAmount: lines.reduce((sum, line) => sum + line.amount, 0),
    trainingPointsGained: 24,
    fanDelta: 38,
    highlights: [],
    updates: [
      {
        id: 'wage-cliff',
        title: 'Wage cliff ahead',
        detail: 'Two contracts renew at hero rates next season.',
        tone: 'warning',
      },
      {
        id: 'scout-back',
        title: 'Scout returned',
        detail: 'Three new reports are waiting at the market desk.',
        tone: 'info',
      },
    ],
  };
}

interface HarnessCase {
  id: string;
  label: string;
  note?: string;
  build: () => PostMatchViewModel;
  reduceMotion?: boolean;
  productionLayer?: boolean;
}

const CASES: readonly HarnessCase[] = [
  {
    id: 'production-layer',
    label: 'Production layer',
    note: 'The shipped full-screen layer over a tappable desk stand-in.',
    productionLayer: true,
    build: () =>
      reportCase([gateLine(1968), ...CONSTANT_TAIL.map((make) => make())]),
  },
  {
    id: 'baseline',
    label: 'Baseline home win',
    note: 'No facilities: gate reveal with no chip, constant tail.',
    build: () =>
      reportCase([gateLine(1968), ...CONSTANT_TAIL.map((make) => make())]),
  },
  {
    id: 'facilities',
    label: '2 stands + 3 shops',
    note: 'Gate ×300%, merch ×3 with adjacency caption.',
    build: () =>
      reportCase([
        gateLine(1968, { standLevel: 2, standCount: 2 }),
        merchLine(273, { times: 3, count: 3, adjacencyPercent: 10 }),
        ...CONSTANT_TAIL.map((make) => make()),
      ]),
  },
  {
    id: 'gate-surge',
    label: 'Gate surge',
    note: 'EXTREME ATTENDANCE! fire spin on the gate.',
    build: () =>
      reportCase([
        gateLine(2264, {
          percent: 15,
          surge: true,
          standLevel: 2,
          standCount: 2,
        }),
        merchLine(273, { times: 3, count: 3, adjacencyPercent: 10 }),
        ...CONSTANT_TAIL.map((make) => make()),
      ]),
  },
  {
    id: 'merch-surge',
    label: 'Merch surge',
    note: 'TRENDING MERCHANDISE! with the deterministic toy shelf.',
    build: () =>
      reportCase([
        gateLine(1968),
        merchLine(312, {
          percent: 18,
          surge: true,
          times: 3,
          count: 3,
          adjacencyPercent: 10,
        }),
        ...CONSTANT_TAIL.map((make) => make()),
      ]),
  },
  {
    id: 'triple-surge',
    label: 'Triple surge',
    note: 'League + cup double-header + merch, three queued banners.',
    build: () =>
      reportCase([
        gateLine(2264, {
          percent: 15,
          surge: true,
          standLevel: 2,
          standCount: 2,
          id: 'league',
        }),
        gateLine(1890, { percent: 12, surge: true, cup: true, id: 'cup' }),
        merchLine(312, {
          percent: 18,
          surge: true,
          times: 3,
          count: 3,
          adjacencyPercent: 10,
          id: 'merch',
        }),
        ...CONSTANT_TAIL.map((make) => make()),
      ]),
  },
  {
    id: 'zero-fan-home',
    label: 'Zero-fan gate',
    note: 'A $0 gate line carries no reveal and never surges.',
    build: () =>
      reportCase([
        plainLine('League home gate', 0, undefined, 'neutral'),
        ...CONSTANT_TAIL.map((make) => make()),
      ]),
  },
  {
    id: 'longest-ledger',
    label: 'Longest ledger',
    note: 'Sponsor portfolio + prize week: the net row must stay reachable.',
    build: () =>
      reportCase([
        gateLine(1968, { standLevel: 2, standCount: 2 }),
        merchLine(273, { times: 2, count: 2 }),
        plainLine('Copperworks Union · Monthly sponsor', 1400),
        plainLine('Harbor Biscuit Co. · Monthly sponsor', 900),
        plainLine('Grid & Girder objective bonus', 750),
        plainLine('Hero Cup Play-in win', 2000),
        plainLine('Loan repayment', -500, undefined, 'expense'),
        ...CONSTANT_TAIL.map((make) => make()),
      ]),
  },
  {
    id: 'reduce-motion',
    label: 'Reduce motion',
    note: 'Instant landing; both surged banners still show, statically.',
    reduceMotion: true,
    build: () =>
      reportCase([
        gateLine(2264, {
          percent: 15,
          surge: true,
          standLevel: 2,
          standCount: 2,
        }),
        merchLine(312, {
          percent: 18,
          surge: true,
          times: 3,
          count: 3,
          adjacencyPercent: 10,
        }),
        ...CONSTANT_TAIL.map((make) => make()),
      ]),
  },
];

export function FinancialReportCase({
  caseId,
  storeMedia = false,
}: {
  caseId: string;
  storeMedia?: boolean;
}) {
  const [replayKey, setReplayKey] = useState(0);
  const [layerVisible, setLayerVisible] = useState(true);
  const [backgroundPressed, setBackgroundPressed] = useState(false);
  const entry = CASES.find((candidate) => candidate.id === caseId) ?? CASES[0];
  if (entry.productionLayer === true) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-paper-dark p-6">
        <Text className="font-pixel text-base uppercase text-ink">
          Desk behind the report
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Background desk control"
          onPress={() => setBackgroundPressed(true)}
          className="min-h-11 border-2 border-b-4 border-ink bg-red-light px-4 py-3"
        >
          <Text className="font-pixel text-sm uppercase text-ink">
            {backgroundPressed
              ? 'Background was pressed'
              : 'Background control'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reopen the Financial Report"
          onPress={() => {
            setBackgroundPressed(false);
            setLayerVisible(true);
          }}
          className="min-h-11 border-2 border-b-4 border-ink bg-blue-light px-4 py-3"
        >
          <Text className="font-pixel text-sm uppercase text-ink">
            Reopen report
          </Text>
        </Pressable>
        {layerVisible ? (
          <PostMatchSummaryModal
            viewModel={entry.build()}
            reduceMotion={false}
            onDismiss={() => setLayerVisible(false)}
          />
        ) : null}
      </View>
    );
  }
  return (
    <ScrollView
      className="flex-1 bg-paper"
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
    >
      {storeMedia ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Replay the reveal"
          onPress={() => setReplayKey((key) => key + 1)}
          className="mb-3 self-start border-2 border-b-4 border-ink bg-white px-3 py-2"
          style={{ minHeight: 44 }}
        >
          <Text className="font-pixel text-sm uppercase text-ink">Replay ▸</Text>
        </Pressable>
      )}
      <FinancialReportBody
        key={`${entry.id}-${replayKey}`}
        viewModel={entry.build()}
        reduceMotion={entry.reduceMotion === true}
      />
    </ScrollView>
  );
}

export const financialReportEntry: DevHarnessEntry = Object.freeze({
  id: 'financial-report',
  group: 'Match',
  title: 'Financial report',
  summary:
    'The post-match money reveal: reels, multipliers, and surge banners.',
  cases: Object.freeze(
    CASES.map((entry) => ({
      id: entry.id,
      label: entry.label,
      note: entry.note,
    })),
  ),
  render: (caseId: string) => <FinancialReportCase caseId={caseId} />,
});
