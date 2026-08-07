import { Text, View } from 'react-native';
import { EmptyDocket } from '../components/EmptyDocket';
import { EventPixelScene } from '../components/EventPixelScene';
import { PaperPanel, SectionLabel, StatusChip } from '../components/Scorecard';
import { PixelText } from '../components/PixelText';
import { SfxPressable as Pressable } from '../components/SfxPressable';
import type { PlayerRequestViewModel } from '../../application/player-request-view-model';
import type { PlayerRequestResolution } from '../../game/types';
import { useCopy } from '../../i18n';

/**
 * The game's own resolution codes, mapped to the chip's words.
 *
 * A table rather than a ternary on the code: the code is a discriminator that
 * `src/game` compares, and it only looked like copy because two of the three
 * spellings happen to match the English chip.
 */
const RESOLUTION_KEY: Record<PlayerRequestResolution, string> = {
  GRANTED: 'squadRequests.granted',
  REFUSED: 'squadRequests.refused',
  LAPSED: 'squadRequests.ignored',
};

/**
 * The Requests tab.
 *
 * The pending card is a Pressable rather than a pair of buttons: tapping it
 * starts the walk-on, so the manager meets the player before being asked to
 * price them. Below it sits the ledger of what was already decided, which keeps
 * the tab from being blank in the many weeks where nobody wants anything — and
 * makes a habit of saying no visible.
 *
 * The ledger has an empty state because of the one week the pair of them left
 * uncovered: the FIRST request of a career, when there is a card but nothing
 * behind it yet, which left better than half a phone blank on the exact screen
 * Bert has just sent the manager to. It also says what the ledger is for before
 * there is anything in it to infer that from.
 */
export function SquadRequestsPanel({
  viewModel,
  onOpenRequest,
  reduceMotion = false,
}: {
  viewModel: PlayerRequestViewModel;
  onOpenRequest: () => void;
  reduceMotion?: boolean;
}) {
  const t = useCopy();
  const pending = viewModel.pending;

  return (
    <View>
      <SectionLabel
        eyebrow={t('squadRequests.theDressingRoom')}
        title={t('squadRequests.requests')}
        right={pending === undefined
          ? undefined
          : (
            <StatusChip
              label={t('squadRequests.weeksToAnswer', { count: pending.weeksToAnswer })}
              tone={pending.weeksToAnswer <= 1 ? 'danger' : 'hero'}
            />
          )}
      />

      {pending === undefined ? (
        <EmptyDocket title={t('squadRequests.noRequests')} detail={viewModel.emptyDetail} />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('squadRequests.a11y.pendingRequest', {
            player: pending.playerName,
            request: pending.title,
            line: pending.line,
          })}
          onPress={onOpenRequest}
          className="min-h-24 flex-row items-center border-2 border-b-4 border-blue-dark bg-blue-light p-3"
          style={({ pressed }) => ({
            opacity: pressed ? 0.82 : 1,
            transform: [{ translateY: pressed ? 2 : 0 }],
          })}
        >
          <View className="mr-3">
            <EventPixelScene artKey={pending.artKey} reduceMotion={reduceMotion} />
          </View>
          <View className="min-w-0 flex-1">
            <PixelText className="text-sm uppercase text-blue-dark">{pending.playerName}</PixelText>
            <Text className="mt-1 text-base font-bold text-ink" numberOfLines={1}>
              {pending.title}
            </Text>
            <Text className="mt-1 text-sm leading-5 text-ink/65" numberOfLines={2}>
              &ldquo;{pending.line}&rdquo;
            </Text>
          </View>
        </Pressable>
      )}

      {viewModel.history.length === 0 ? (
        // Only under a card. With nothing pending the docket above is already
        // saying "nothing here", and two empty states stacked say it twice.
        pending === undefined ? null : (
          <View className="mt-4">
            <EmptyDocket
              title={t('squadRequests.nothingDecidedYet')}
              detail={t('squadRequests.nothingDecidedYetDetail')}
            />
          </View>
        )
      ) : (
        <PaperPanel kicker={t('squadRequests.recently')} title={t('squadRequests.whatYouDecided')} className="mt-4">
          <View className="gap-2">
            {viewModel.history.slice(0, 6).map(entry => (
              <View
                key={entry.key}
                className="flex-row items-center justify-between gap-3"
              >
                <Text className="min-w-0 flex-1 text-sm text-ink/70" numberOfLines={1}>
                  {entry.label}
                </Text>
                <StatusChip
                  label={t(RESOLUTION_KEY[entry.resolution])}
                  tone={entry.resolution === 'GRANTED' ? 'success' : 'danger'}
                />
              </View>
            ))}
          </View>
        </PaperPanel>
      )}
    </View>
  );
}
