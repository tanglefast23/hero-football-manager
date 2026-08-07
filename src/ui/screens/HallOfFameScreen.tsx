import { ScrollView, Text, View } from 'react-native';
import { ActionButton } from '../components/Scorecard';
import { PixelText } from '../components/PixelText';
import type { HallOfFameStatViewModel, HallOfFameViewModel } from '../models';
import { useCopy } from '../../i18n';

export interface HallOfFameScreenProps {
  viewModel: HallOfFameViewModel;
  onBack: () => void;
  backLabel?: string;
}

/**
 * The Hall of Fame: one page, opened from Settings, holding what a finished
 * career left behind.
 *
 * It draws only what the view model hands it. Every number was captured when
 * the climb completed, so this screen has nothing to compute and nothing to
 * fall back on — which is deliberate: a page that recomputed a career total
 * from live state would quietly print a smaller one every season after the end.
 *
 * Laid out as a sub-page of Settings, the way the glossary is: same paper, same
 * back control, so a manager who has opened one already knows how to leave.
 */
export function HallOfFameScreen({
  viewModel,
  onBack,
  backLabel,
}: HallOfFameScreenProps) {
  const t = useCopy();
  const backButtonLabel = backLabel ?? t('privacySupport.backToSettings');
  return (
    <View className="min-h-0 flex-1">
      {/* The completed record is summarised on the header, so a screen reader
          hears the figures the page exists for without scrolling every row. */}
      <View
        accessible={viewModel.status === 'complete'}
        accessibilityRole="header"
        {...(viewModel.status === 'complete'
          ? { accessibilityLabel: viewModel.accessibilityLabel }
          : {})}
        className="border-b-2 border-ink pb-4"
      >
        <PixelText className="text-sm uppercase tracking-[3px] text-blue-dark">{viewModel.kicker}</PixelText>
        <Text className="mt-1 font-pixel text-2xl uppercase text-ink">{viewModel.title}</Text>
        <Text className="mt-2 text-sm leading-5 text-ink/60">
          {viewModel.status === 'complete' ? viewModel.subheading : viewModel.headline}
        </Text>
      </View>

      <ScrollView
        className="min-h-0 flex-1"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 16 }}
        showsVerticalScrollIndicator
      >
        {viewModel.status === 'locked' ? (
          <View
            accessible
            accessibilityRole="text"
            accessibilityLabel={viewModel.accessibilityLabel}
            className="border-2 border-ink bg-paper-dark px-3 py-4"
          >
            {viewModel.lines.map((line, index) => (
              <Text
                key={line}
                className={index === 0
                  ? 'text-base leading-6 text-ink'
                  : 'mt-2 text-sm leading-5 text-ink/60'}
              >
                {line}
              </Text>
            ))}
          </View>
        ) : (
          <View accessible={false}>
            <Text className="mb-2 font-pixel text-base uppercase text-blue-dark">{viewModel.headline}</Text>
            <StatList rows={viewModel.stats} />

            <Text className="mb-2 mt-6 font-pixel text-base uppercase text-blue-dark">{t('hallOfFame.honours')}</Text>
            {viewModel.honours.length === 0 ? (
              <View className="border-2 border-ink/25 bg-paper-dark px-3 py-4">
                <Text className="text-center text-sm text-ink/60">{viewModel.honoursEmptyLabel}</Text>
              </View>
            ) : (
              <View className="border-2 border-gold-dark bg-gold-light">
                {viewModel.honours.map((honour, index) => (
                  <View
                    key={honour.id}
                    className={index === viewModel.honours.length - 1
                      ? 'px-3 py-3'
                      : 'border-b border-gold-dark/40 px-3 py-3'}
                  >
                    <Text className="font-pixel text-sm uppercase text-gold-dark">{honour.label}</Text>
                    <Text className="mt-1 text-base font-bold text-ink">{honour.value}</Text>
                  </View>
                ))}
              </View>
            )}

            <Text className="mb-2 mt-6 font-pixel text-base uppercase text-blue-dark">{t('hallOfFame.theClimb')}</Text>
            <View className="border-2 border-ink bg-white">
              {viewModel.tiers.map((tier, index) => (
                <View
                  key={tier.division}
                  className={index === viewModel.tiers.length - 1
                    ? 'px-3 py-3'
                    : 'border-b border-ink/15 px-3 py-3'}
                >
                  {/* Same three lines as a stat row — name, figure, context —
                      so the ladder reads with the record above it. */}
                  <Text className="text-base font-bold text-ink">{tier.label}</Text>
                  <Text className="mt-1 font-mono text-base text-ink">{tier.best}</Text>
                  <Text className="mt-1 text-sm leading-5 text-ink/65">{tier.detail}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <View className="border-t border-ink/15 pt-3">
        <ActionButton
          label={`‹  ${backButtonLabel}`}
          accessibilityLabel={backButtonLabel}
          onPress={onBack}
          variant="paper"
        />
      </View>
    </View>
  );
}

/**
 * Label, number, and what the number is of — one visual row for every figure.
 *
 * Stacked rather than label-left / figure-right. Side by side, the two halves
 * share a phone's width and both wrap: at 375pt inside the Settings panel the
 * row has about 255pt of text width, and "Won / Drawn / Lost" plus "71 / 21 /
 * 16" is half again as wide as that. A wrapped label is untidy; a wrapped
 * figure is worse, because "125 /" over "141" reads as a broken renderer
 * rather than as a number. Stacking gives each line the full width, which no
 * figure on this page comes close to, and it holds for the two rows whose
 * value is a player's name and therefore has no length the layout can assume.
 */
function StatList({ rows }: { rows: readonly HallOfFameStatViewModel[] }) {
  return (
    <View className="border-2 border-ink bg-white">
      {rows.map((row, index) => (
        <View
          key={row.id}
          className={index === rows.length - 1
            ? 'px-3 py-3'
            : 'border-b border-ink/15 px-3 py-3'}
        >
          <Text className="font-pixel text-sm uppercase text-ink/60">{row.label}</Text>
          {/* Monospace so the figures line up down the page. */}
          <Text className="mt-1 font-mono text-base text-ink">{row.value}</Text>
          <Text className="mt-1 text-sm leading-5 text-ink/65">{row.detail}</Text>
        </View>
      ))}
    </View>
  );
}
