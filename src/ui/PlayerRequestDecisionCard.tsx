import { Modal, Text, View } from 'react-native';
import { ActionButton, PaperPanel } from './components/Scorecard';
import { EventPixelScene } from './components/EventPixelScene';
import { PixelText } from './components/PixelText';
import type { PendingRequestViewModel } from '../application/player-request-view-model';
import { useCopy } from '../i18n';

/**
 * Grant or refuse, with both prices printed on the buttons.
 *
 * Bert never explains the numbers anywhere, because this card carries them:
 * what granting costs sits under Grant, what refusing costs sits under Refuse,
 * and neither is the safe option. There is no dismiss — the manager came here
 * to decide, and the answer window is already running.
 */
export function PlayerRequestDecisionCard({
  request,
  reduceMotion = false,
  onGrant,
  onRefuse,
}: {
  request: PendingRequestViewModel;
  reduceMotion?: boolean;
  onGrant: () => void;
  onRefuse: () => void;
}) {
  const t = useCopy();
  const grantDetail = request.canAfford
    ? request.grantLabel
    : t('playerRequestCard.notEnoughInTheBooks');

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onRefuse}>
      <View className="flex-1 items-center justify-center bg-ink/70 px-4">
        <PaperPanel
          kicker={t('playerRequestCard.asks', { player: request.playerName })}
          title={request.title}
          className="w-full max-w-[520px]"
        >
          <View className="flex-row items-center gap-3">
            <EventPixelScene artKey={request.artKey} reduceMotion={reduceMotion} />
            <Text className="min-w-0 flex-1 text-base leading-6 text-ink/75">
              &ldquo;{request.line}&rdquo;
            </Text>
          </View>

          <View className="mt-4 flex-row gap-2">
            <View className="min-w-0 flex-1">
              <ActionButton
                label={t('playerRequestCard.grant')}
                variant="primary"
                disabled={!request.canAfford}
                onPress={onGrant}
                accessibilityLabel={t('playerRequestCard.a11y.grant', { detail: grantDetail })}
              />
              <PixelText className="mt-1 text-center text-sm uppercase text-ink/60">
                {grantDetail}
              </PixelText>
            </View>
            <View className="min-w-0 flex-1">
              <ActionButton
                label={t('playerRequestCard.refuse')}
                variant="danger"
                onPress={onRefuse}
                accessibilityLabel={t('playerRequestCard.a11y.refuse', {
                  detail: request.refuseLabel,
                })}
              />
              <PixelText className="mt-1 text-center text-sm uppercase text-stamp">
                {request.refuseLabel}
              </PixelText>
            </View>
          </View>
        </PaperPanel>
      </View>
    </Modal>
  );
}
