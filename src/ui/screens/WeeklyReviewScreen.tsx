import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { WeeklyReviewViewModel } from '../models';
import {
  ActionButton,
  PaperPanel,
  formatCompactNumber,
  formatCurrency,
} from '../components/Scorecard';
import {
  ChalkboardBackdrop,
  StageSection,
} from '../components/ChalkboardStage';
import { useLayoutMode } from '../layout/use-layout-mode';
import { FacilityCompletionCard } from '../components/FacilityCompletionCard';
import { scaledBody } from '../text-scale';
import type { TextScale } from '../../persistence';
import { PixelText } from '../components/PixelText';
import { LedgerRowIcons } from '../components/LedgerRowIcons';
import { ClubCrest } from '../components/ClubCrest';
import { useCopy } from '../../i18n';

export interface WeeklyReviewScreenProps {
  viewModel: WeeklyReviewViewModel;
  onContinue: () => void;
  animationsReady?: boolean;
  reduceMotion?: boolean;
  textScale?: TextScale;
}

export function WeeklyReviewScreen({
  viewModel,
  onContinue,
  reduceMotion = false,
  textScale = 1,
}: WeeklyReviewScreenProps) {
  const t = useCopy();
  const wide = useLayoutMode() === 'twoColumn';
  const moneyCard = (
    <WeeklyBalanceCard
      label={t('weeklyReview.money')}
      startingAmount={viewModel.cashBefore}
      currentAmount={viewModel.cashAfter}
      netAmount={viewModel.netAmount}
      kind="money"
    />
  );

  const cashMovement = (
    <View className="flex-row items-center justify-between border-2 border-ink bg-ink px-3 py-2.5">
      <Text className="font-pixel text-[12px] uppercase text-paper/75">
        {t('weeklyReview.cashMovement')}
      </Text>
      <Text className="font-mono text-base text-paper">
        {formatCurrency(t, viewModel.cashBefore)} →{' '}
        {formatCurrency(t, viewModel.cashAfter)}
      </Text>
    </View>
  );

  const statement = (
    <PaperPanel
      kicker={t('weeklyReview.accountsOffice')}
      title={t('weeklyReview.weeklyStatement')}
      stamp={t('weeklyReview.recorded')}
    >
      {viewModel.ledger.map((line) => (
        <View
          key={line.id}
          className="flex-row items-center border-b border-ink/10 py-2.5 last:border-b-0"
        >
          {/* Wrapping, so a long label carries its icons onto the next line
              instead of pinning them against the amount. */}
          <View className="min-w-0 flex-1 flex-row flex-wrap items-center">
            <Text className="text-ink" style={scaledBody(textScale)}>
              {line.label}
            </Text>
            {line.icons === undefined ? null : (
              <LedgerRowIcons icons={line.icons} />
            )}
          </View>
          <Text
            className={
              line.amount < 0
                ? 'font-mono text-base text-stamp'
                : line.amount > 0
                  ? 'font-mono text-base text-pitch-ink'
                  : 'font-mono text-base text-ink'
            }
          >
            {formatCurrency(t, line.amount, true)}
          </Text>
        </View>
      ))}
    </PaperPanel>
  );

  return (
    <SafeAreaView
      className="flex-1 bg-pitch-ink"
      edges={['top', 'left', 'right', 'bottom']}
    >
      <ChalkboardBackdrop wide={wide} />
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
        <View
          className={
            wide
              ? 'w-full max-w-[1180px] self-center px-4 pb-7 pt-4'
              : 'w-full px-4 pb-7 pt-4'
          }
        >
          <View className="border-b-2 border-paper/15 pb-3">
            <Text className="font-pixel text-[10px] uppercase tracking-[2px] text-gold-light">
              {t('weeklyReview.weeklyReview')}
            </Text>
            <Text className="mt-1 font-pixel text-[18px] uppercase text-white">
              {viewModel.completedWeekLabel}
            </Text>
            <View className="mt-2 flex-row items-center gap-2">
              <ClubCrest clubName={viewModel.clubName} />
              <Text className="font-pixel text-[12px] uppercase text-paper/75">
                {viewModel.clubName}
              </Text>
            </View>
          </View>

          {viewModel.facilityCompletion ? (
            <FacilityCompletionCard
              completion={viewModel.facilityCompletion}
              reduceMotion={reduceMotion}
            />
          ) : null}

          {wide ? (
            <View className="mt-5 flex-row items-start gap-6">
              <View className="flex-1 gap-2">
                <View className="flex-row">{moneyCard}</View>
                {cashMovement}
              </View>
              <View className="flex-1">{statement}</View>
            </View>
          ) : (
            <>
              <View className="mt-3 flex-row">{moneyCard}</View>
              <View className="mt-3">{cashMovement}</View>
              <View className="mt-5">{statement}</View>
            </>
          )}
        </View>
      </ScrollView>

      <View className="border-t-[6px] border-white bg-ink/25 p-3">
        <View className={wide ? 'w-full max-w-[1180px] self-center' : 'w-full'}>
          {/* Leaving is the skip. This press used to be eaten while the
              count-ups ran, so the button played its chime and the week never
              started — a dead button, since nothing here is worth holding a
              manager on. Skipping elsewhere is its own labelled control. */}
          <ActionButton
            // ▸ has no Silkscreen glyph, so it is appended here rather than
            // baked into a catalog entry a translator would inherit.
            label={`${t('weeklyReview.startWeek', { week: viewModel.nextWeekLabel })}  ▸`}
            accessibilityLabel={t('weeklyReview.a11y.finishAndStart', {
              week: viewModel.nextWeekLabel,
            })}
            onPress={onContinue}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

type WeeklyBalanceKind = 'money' | 'training-points';

function WeeklyBalanceCard({
  label,
  startingAmount,
  currentAmount,
  netAmount,
  kind,
}: {
  label: string;
  startingAmount: number;
  currentAmount: number;
  netAmount: number;
  kind: WeeklyBalanceKind;
}) {
  const t = useCopy();
  return (
    <View className="min-w-0 flex-1 border-2 border-b-4 border-ink bg-white px-3 py-2">
      <PixelText className="text-right text-[12px] uppercase text-ink/50">
        {label}
      </PixelText>
      <AnimatedBalanceAmount
        from={startingAmount}
        to={currentAmount}
        kind={kind}
      />
      <View className="mt-2 border-t border-ink/20 pt-2">
        <PixelText className="text-right text-[12px] uppercase text-ink/50">
          {t(kind === 'money' ? 'weeklyReview.net' : 'weeklyReview.netTp')}
        </PixelText>
        <AnimatedNetAmount amount={netAmount} kind={kind} />
      </View>
    </View>
  );
}

function AnimatedNetAmount({
  amount,
  kind,
}: {
  amount: number;
  kind: WeeklyBalanceKind;
}) {
  const t = useCopy();

  return (
    <View className="self-stretch">
      <Text
        accessible
        accessibilityLabel={t('weeklyReview.a11y.net', {
          sign:
            amount < 0
              ? t('weeklyReview.a11y.minus')
              : amount > 0
                ? t('weeklyReview.a11y.plus')
                : '',
          amount: Math.abs(amount),
          unit: t(
            kind === 'money'
              ? 'weeklyReview.a11y.dollars'
              : 'weeklyReview.a11y.trainingPoints',
          ),
        })}
        className={
          amount < 0
            ? 'mt-1 text-right font-mono text-[18px] text-stamp'
            : 'mt-1 text-right font-mono text-[18px] text-pitch-ink'
        }
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {/* ASCII hyphen on purpose: Silkscreen has no U+2212 glyph, and a true
            minus flips this one character to the system fallback face mid-string
            — see formatCompactNumber in components/Scorecard.tsx. */}
        {amount > 0 ? '+' : amount < 0 ? '-' : ''}
        {kind === 'money' ? '$' : ''}
        {formatCompactNumber(t, Math.abs(amount))}
        {kind === 'training-points' ? ' TP' : ''}
      </Text>
    </View>
  );
}

function AnimatedBalanceAmount({
  from,
  to,
  kind,
}: {
  from: number;
  to: number;
  kind: WeeklyBalanceKind;
}) {
  const t = useCopy();
  const movementClass =
    to < from ? 'text-stamp' : to > from ? 'text-pitch-ink' : 'text-ink';
  return (
    <View>
      <Text
        accessibilityLabel={t('weeklyReview.a11y.balanceMovement', {
          label: t(
            kind === 'money'
              ? 'weeklyReview.money'
              : 'weeklyReview.trainingPoints',
          ),
          from,
          to,
        })}
        className={`mt-1 text-right font-mono text-[18px] ${movementClass}`}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {kind === 'money'
          ? formatCurrency(t, to)
          : `${formatCompactNumber(t, to)} TP`}
      </Text>
    </View>
  );
}
