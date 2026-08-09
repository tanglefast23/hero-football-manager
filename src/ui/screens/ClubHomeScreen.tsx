import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import {
  ActionButton,
  Metric,
  PaperPanel,
  SectionLabel,
  StatusChip,
  formatCompactNumber,
  formatCurrency,
} from '../components/Scorecard';
import { EmptyDocket } from '../components/EmptyDocket';
import { PixelPortrait } from '../components/PixelPortrait';
import type { ClubAlertViewModel, HomeViewModel } from '../models';
import { scaledBody } from '../text-scale';
import type { TextScale } from '../../persistence';
import { TutorialTapCue } from '../TutorialTapCue';
import { TUTORIAL_TAP_CUE_WIDTH } from '../tutorial-cue-position';
import { GUIDED_ALERT_GLOW } from '../guidance-glow';
import { SfxPressable as Pressable } from '../components/SfxPressable';
import { SectionFlow, type FlowSection } from '../layout/SectionFlow';
import { useLayoutMode } from '../layout/use-layout-mode';
import { PixelText } from '../components/PixelText';
import { useDesktopContentStyle } from '../layout/DesktopClamp';
import type { ManagerTipDestination } from '../../content';
import { FormStrip } from '../components/FormStrip';
import { useCopy } from '../../i18n';
import {
  GuidanceDoubleFlash,
  type GuidanceNudgeTarget,
} from '../GuidanceDoubleFlash';

const HORIZONTAL_MARQUEE_BULBS = Array.from(
  { length: 12 },
  (_, index) => index,
);
const VERTICAL_MARQUEE_BULBS = Array.from({ length: 7 }, (_, index) => index);

function MarqueeBulb({ index }: { index: number }) {
  return (
    <View
      className={
        index % 2 === 0
          ? 'h-2 w-2 border border-ink bg-white'
          : 'h-2 w-2 border border-ink bg-paper'
      }
    />
  );
}

/**
 * Match week dresses the fixture like an old cinema marquee. The fascia stays
 * outside the ordinary paper panel so the matchup keeps its calm, readable
 * layout and non-match weeks retain the quieter desk treatment.
 */
function MatchWeekMarquee({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  if (!active) return <>{children}</>;

  return (
    <View className="relative">
      <View
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="absolute -inset-3 border-2 border-ink bg-red-dark"
      />
      <View
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="absolute -inset-3"
      >
        <View className="absolute left-1 right-1 top-1 flex-row justify-between">
          {HORIZONTAL_MARQUEE_BULBS.map((index) => (
            <MarqueeBulb key={`top-${index}`} index={index} />
          ))}
        </View>
        <View className="absolute bottom-1 left-1 right-1 flex-row justify-between">
          {HORIZONTAL_MARQUEE_BULBS.map((index) => (
            <MarqueeBulb key={`bottom-${index}`} index={index + 1} />
          ))}
        </View>
        <View className="absolute bottom-4 left-1 top-4 justify-between">
          {VERTICAL_MARQUEE_BULBS.map((index) => (
            <MarqueeBulb key={`left-${index}`} index={index + 1} />
          ))}
        </View>
        <View className="absolute bottom-4 right-1 top-4 justify-between">
          {VERTICAL_MARQUEE_BULBS.map((index) => (
            <MarqueeBulb key={`right-${index}`} index={index} />
          ))}
        </View>
      </View>
      {children}
    </View>
  );
}

/** Full-card tint per alert tone — bible palette only, never off-palette Tailwind hues. */
function alertPalette(alert: ClubAlertViewModel): string {
  if (alert.mustDoDutyId !== undefined) return 'border-blue-dark bg-blue-light';
  if (alert.tone === 'urgent') return 'border-red-dark bg-red-light';
  return 'border-grey-dark bg-paper-dark';
}

export interface ClubHomeScreenProps {
  viewModel: HomeViewModel;
  onOpenFixture: (fixtureId: string) => void;
  onOpenAlert: (alertId: string) => void;
  onOpenManagerTipDestination?: (destination: ManagerTipDestination) => void;
  onOpenLeague: () => void;
  onProtectBoardCandidate: (playerId: string) => void;
  guideAlertId?: string;
  guidanceNudgeTarget?: GuidanceNudgeTarget;
  guidanceNudgeToken?: number;
  /**
   * Clears the optional manager's notes off the desk so the guided row is the
   * loudest thing on it. It does NOT disable the other alerts: the first week's
   * two jobs — hire a coach, build the pitch — are both required before the
   * week can advance, and which one you do first is your call. Bert points at
   * one; he no longer bars the other.
   */
  focusGuidedAlert?: boolean;
  /**
   * Lights the guided row once Bert has walked off. He tells you to check the
   * inbox and then leaves; without this the instruction leaves with him, and
   * the row he meant is one of several identical cards.
   *
   * Held back until he is gone on purpose — a glow competing with the dimmed
   * screen and the spotlight would be a third thing asking for attention.
   */
  glowGuidedAlert?: boolean;
  guideBoard?: boolean;
  /** Second-career players can hide optional tips without hiding calendar notes. */
  showManagerTips?: boolean;
  textScale?: TextScale;
  /** Stills the form strip's cascade for a manager who asked for less motion. */
  reduceMotion?: boolean;
}

export function ClubHomeScreen({
  viewModel,
  onOpenFixture,
  onOpenAlert,
  onOpenManagerTipDestination,
  onOpenLeague,
  onProtectBoardCandidate,
  guideAlertId,
  guidanceNudgeTarget,
  guidanceNudgeToken,
  focusGuidedAlert = false,
  glowGuidedAlert = false,
  guideBoard = false,
  showManagerTips = true,
  textScale = 1,
  reduceMotion = false,
}: ClubHomeScreenProps) {
  const t = useCopy();
  const desktopContent = useDesktopContentStyle();
  const fixture = viewModel.nextFixture;
  const fixtureIsThisWeek = viewModel.isCurrentGameWeek;
  const layoutMode = useLayoutMode();
  // While the tutorial is pointing at one card, no optional reading belongs on
  // the desk. The other alerts stay — they are jobs, not notes.
  const visibleNotes = focusGuidedAlert
    ? []
    : viewModel.notes.filter((note) => showManagerTips || note.kind !== 'tip');

  const sections: FlowSection[] = [
    {
      key: 'next-match',
      weight: 7,
      node: (
        <MatchWeekMarquee active={fixtureIsThisWeek}>
          <PaperPanel
            kicker={t('clubHome.nextMatch')}
            title={fixture.competition}
            stamp={viewModel.nextMatchTimingLabel}
          >
            <View className="border-y-2 border-ink py-4">
              <View className="flex-row items-center justify-between gap-2">
                <PixelText
                  className="flex-1 text-right text-xl uppercase text-ink"
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.65}
                >
                  {fixture.homeTeam}
                </PixelText>
                <View className="border-2 border-ink bg-ink px-3 py-2">
                  <Text className="font-pixel text-base text-paper">
                    {t('app.versus')}
                  </Text>
                </View>
                <PixelText
                  className="flex-1 text-xl uppercase text-ink"
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.65}
                >
                  {fixture.awayTeam}
                </PixelText>
              </View>
              <View className="mt-3 flex-row justify-center gap-2">
                <StatusChip label={fixture.venueLabel} />
                <StatusChip
                  label={t('clubHome.rivalHeroes', {
                    n: fixture.opponentHeroCount,
                    count: fixture.opponentHeroCount,
                  })}
                  tone="hero"
                />
              </View>
            </View>
            {/* Only match day is a job for this card. Until then the week is
                advanced from the bar at the bottom, so the card shows no button
                rather than a dead one repeating that instruction. */}
            {fixture.matchdayReady ? (
              <View className="mt-4">
                <ActionButton
                  // '▸' is not in Silkscreen, so it stays outside the catalog
                  // and keeps rendering in the fallback face.
                  label={`${t('clubHome.prepareMatchDay')}  ▸`}
                  accessibilityLabel={t('clubHome.a11y.openMatchDay', {
                    home: fixture.homeTeam,
                    away: fixture.awayTeam,
                  })}
                  onPress={() => onOpenFixture(fixture.id)}
                  variant="action"
                />
              </View>
            ) : null}
          </PaperPanel>
        </MatchWeekMarquee>
      ),
    },
    {
      key: 'inbox',
      weight:
        2 + 2 * Math.max(viewModel.alerts.length, 1) + 3 * visibleNotes.length,
      node: (
        <View>
          <SectionLabel
            eyebrow={t('clubHome.inbox')}
            title={t('clubHome.needsYourCall')}
            right={
              <StatusChip
                label={t('clubHome.openCount', {
                  count: viewModel.alerts.length,
                })}
                tone={viewModel.alerts.length ? 'danger' : 'normal'}
              />
            }
          />
          <View className="gap-2">
            {viewModel.alerts.length === 0 && visibleNotes.length === 0 ? (
              <PaperPanel>
                <Text className="text-ink/60" style={scaledBody(textScale)}>
                  {t('clubHome.deskClearTheBoard')}
                </Text>
              </PaperPanel>
            ) : null}
            {viewModel.alerts.map((alert) => {
              const guided = alert.id === guideAlertId;
              const nudged =
                (guidanceNudgeTarget === 'training-ground-alert' &&
                  alert.id === 'training-ground') ||
                (guidanceNudgeTarget === 'coaching-office' &&
                  alert.guideSequenceId === 'coaching-office') ||
                (guidanceNudgeTarget === 'youth-intake' &&
                  alert.guideSequenceId === 'youth-intake');
              return (
                <Pressable
                  key={alert.id}
                  accessibilityRole="button"
                  accessibilityLabel={
                    alert.mustDoDutyId === undefined
                      ? `${alert.title}. ${alert.detail}`
                      : t('clubHome.a11y.mustDoAlert', {
                          title: alert.title,
                          detail: alert.detail,
                        })
                  }
                  onPress={() => onOpenAlert(alert.id)}
                  className={`relative min-h-14 flex-row items-center justify-between border-2 border-b-4 p-3 ${alertPalette(alert)}`}
                  // Kept in the existing function form rather than split into an
                  // array: switching a Pressable's style to or from a function
                  // has twice collapsed layout on iOS only in this project.
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.75 : undefined,
                    ...(guided && glowGuidedAlert ? GUIDED_ALERT_GLOW : {}),
                  })}
                >
                  <GuidanceDoubleFlash
                    trigger={nudged ? guidanceNudgeToken : undefined}
                    reduceMotion={reduceMotion}
                  />
                  {guided ? (
                    <TutorialTapCue
                      detail={t('clubHome.buildTheFacility')}
                      style={{
                        left: '50%',
                        marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2,
                        top: -72,
                      }}
                    />
                  ) : null}
                  <View className="flex-1 pr-3">
                    <View className="flex-row items-center gap-2">
                      <PixelText className="flex-1 text-base uppercase text-ink">
                        {alert.title}
                      </PixelText>
                      {alert.isHero ? (
                        <StatusChip label={t('clubHome.hero')} tone="hero" />
                      ) : null}
                      {alert.mustDoDutyId !== undefined ? (
                        <StatusChip
                          label={t('clubHome.mustDo')}
                          tone="normal"
                        />
                      ) : null}
                    </View>
                    <Text
                      className="mt-1 text-ink/70"
                      style={scaledBody(textScale, 14, 18)}
                      numberOfLines={2}
                    >
                      {alert.detail}
                    </Text>
                  </View>
                  <Text className="font-pixel text-xl text-ink">›</Text>
                </Pressable>
              );
            })}
            {/* Calendar notes carry their whole message. A small subset of tips
                also offers a data-declared demonstration; ordinary notes and
                tips remain read-only cards. */}
            {visibleNotes.map((note) => (
              <View
                key={note.id}
                className={`border-2 border-b-4 p-3 ${
                  note.kind === 'tip'
                    ? 'border-gold-dark bg-gold-light'
                    : 'border-grey-dark bg-paper-dark'
                }`}
              >
                <View
                  accessible
                  accessibilityRole="summary"
                  accessibilityLabel={
                    note.kind === 'tip'
                      ? t('clubHome.a11y.managersTipNote', {
                          title: note.title,
                          detail: note.detail,
                        })
                      : `${note.title}. ${note.detail}`
                  }
                >
                  {note.kind === 'tip' ? (
                    <PixelText className="mb-1 text-xs uppercase text-gold-dark">
                      {t('clubHome.managersTip')}
                    </PixelText>
                  ) : null}
                  <PixelText className="text-base uppercase text-ink">
                    {note.title}
                  </PixelText>
                  <Text
                    className="mt-1 text-ink/70"
                    style={scaledBody(textScale, 14, 18)}
                  >
                    {note.detail}
                  </Text>
                </View>
                {note.destination !== undefined &&
                onOpenManagerTipDestination !== undefined ? (
                  <View className="mt-3">
                    <ActionButton
                      // '▸' is not in Silkscreen, so it stays outside the
                      // catalog and keeps rendering in the fallback face.
                      label={`${t('clubHome.takeMeThere')}  ▸`}
                      // One whole sentence per destination rather than a keyed
                      // fragment dropped into a keyed frame: the destination
                      // name does not sit at the end in every language.
                      accessibilityLabel={
                        note.destination === 'drill-shop'
                          ? t('clubHome.a11y.takeMeToDrillShop')
                          : t('clubHome.a11y.takeMeToPlayerColumns')
                      }
                      onPress={() => {
                        if (note.destination !== undefined) {
                          onOpenManagerTipDestination(note.destination);
                        }
                      }}
                      variant="action"
                      compact
                      pressSfx="click"
                    />
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      ),
    },
    ...(viewModel.boardResolution
      ? [
          {
            key: 'board-resolution',
            weight:
              viewModel.boardResolution.soldPlayer &&
              viewModel.boardResolution.replacementPlayer
                ? 13
                : 6,
            node: (
              <View>
                <SectionLabel
                  eyebrow={t('clubHome.boardroomAftermath')}
                  title={viewModel.boardResolution.headline}
                  right={
                    <StatusChip
                      label={
                        viewModel.boardResolution.kind === 'TARGET_MET'
                          ? t('clubHome.resolved')
                          : t('clubHome.squadRebuilt')
                      }
                      tone="success"
                    />
                  }
                />
                <PaperPanel
                  kicker={
                    viewModel.boardResolution.kind === 'TARGET_MET'
                      ? t('clubHome.interventionClosed')
                      : t('clubHome.academyReliefPromotion')
                  }
                  title={
                    viewModel.boardResolution.kind === 'TARGET_MET'
                      ? t('clubHome.noSaleRequired')
                      : viewModel.boardResolution.replacementPlayer?.name
                  }
                  stamp={
                    viewModel.boardResolution.kind === 'TARGET_MET'
                      ? t('clubHome.safe')
                      : t('clubHome.newYouth')
                  }
                  className="bg-pitch-light"
                >
                  <Text
                    className="text-ink/70"
                    style={scaledBody(textScale, 14, 20)}
                  >
                    {viewModel.boardResolution.detail}
                  </Text>
                  {viewModel.boardResolution.soldPlayer &&
                  viewModel.boardResolution.replacementPlayer ? (
                    <>
                      <View className="mt-4 flex-row items-center gap-3">
                        <View className="flex-1 items-center border-2 border-red-dark bg-red-light p-2">
                          <View className="overflow-hidden border-2 border-ink bg-white opacity-70">
                            <PixelPortrait
                              playerId={viewModel.boardResolution.soldPlayer.id}
                              role={viewModel.boardResolution.soldPlayer.role}
                              lookId={
                                viewModel.boardResolution.soldPlayer.lookId
                              }
                              expression="rest"
                            />
                          </View>
                          <Text
                            className="mt-2 text-center text-sm font-bold text-ink"
                            numberOfLines={1}
                          >
                            {viewModel.boardResolution.soldPlayer.name}
                          </Text>
                          <Text className="mt-1 text-center font-mono text-sm text-stamp">
                            {t('clubHome.soldFor', {
                              fee: formatCurrency(
                                t,
                                viewModel.boardResolution.soldPlayer.fee,
                              ),
                            })}
                          </Text>
                        </View>
                        <Text className="font-mono text-2xl font-bold text-ink">
                          →
                        </Text>
                        <View className="flex-1 items-center border-2 border-pitch-dark bg-white p-2">
                          <View className="overflow-hidden border-2 border-ink bg-blue-light">
                            <PixelPortrait
                              playerId={
                                viewModel.boardResolution.replacementPlayer.id
                              }
                              role={
                                viewModel.boardResolution.replacementPlayer.role
                              }
                              lookId={
                                viewModel.boardResolution.replacementPlayer
                                  .lookId
                              }
                              expression="joy"
                            />
                          </View>
                          <Text
                            className="mt-2 text-center text-sm font-bold text-ink"
                            numberOfLines={1}
                          >
                            {viewModel.boardResolution.replacementPlayer.name}
                          </Text>
                          <Text className="mt-1 text-center font-mono text-sm text-pitch-ink">
                            {t('clubHome.replacementTerms', {
                              age: viewModel.boardResolution.replacementPlayer
                                .age,
                              wage: formatCurrency(
                                t,
                                viewModel.boardResolution.replacementPlayer
                                  .weeklyWage,
                              ),
                            })}
                          </Text>
                        </View>
                      </View>
                      {/* Aftermath reads as things that happened to the club, never a
                    raw modifier — docs/08: no "Fans -3", no bare "-8" morale.
                    (U+2212 is also missing from Silkscreen, so a typed minus
                    rendered in the system fallback face.) The fans tile only
                    appears when fans actually walked, so "-0" cannot render. */}
                      <View className="mt-3 flex-row gap-2">
                        {(viewModel.boardResolution.fansLost ?? 0) > 0 ? (
                          <Metric
                            label={t('clubHome.fansWalkedAway')}
                            value={formatCompactNumber(
                              t,
                              viewModel.boardResolution.fansLost ?? 0,
                            )}
                            tone="negative"
                          />
                        ) : null}
                        <Metric
                          label={t('clubHome.squadMood')}
                          value={t('clubHome.shaken')}
                          tone="negative"
                        />
                      </View>
                    </>
                  ) : null}
                </PaperPanel>
              </View>
            ),
          },
        ]
      : []),
    ...(viewModel.boardUltimatum
      ? [
          {
            key: 'board-ultimatum',
            weight: 8 + 2 * viewModel.boardUltimatum.candidates.length,
            node: (
              <View
                className={
                  guideBoard
                    ? 'relative border-2 border-blue-dark bg-blue-light p-1'
                    : 'relative'
                }
              >
                {guideBoard ? (
                  <TutorialTapCue
                    label={t('clubHome.bertSays')}
                    detail={t('clubHome.protectOnePlayer')}
                    style={{
                      left: '50%',
                      marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2,
                      top: -72,
                    }}
                  />
                ) : null}
                <SectionLabel
                  eyebrow={t('clubHome.boardIntervention')}
                  title={t('clubHome.protectOnePlayer')}
                  right={
                    <StatusChip
                      label={t('clubHome.weeksRemaining', {
                        n: viewModel.boardUltimatum.weeksRemaining,
                        count: viewModel.boardUltimatum.weeksRemaining,
                      })}
                      tone="danger"
                    />
                  }
                />
                <PaperPanel
                  kicker={t('clubHome.boardDeadline')}
                  title={t('clubHome.reachTheTarget')}
                  stamp={t('clubHome.careerContinues')}
                  className="bg-red-light"
                >
                  <Text
                    className="text-ink/70"
                    style={scaledBody(textScale, 14, 20)}
                  >
                    {/* One sentence, one key. Split across JSX it would force every
                  language into English word order, and the target and discount
                  do not sit in the same place in all of them. */}
                    {t('clubHome.boardUltimatumBody', {
                      target: viewModel.boardUltimatum.targetLabel,
                      discount:
                        viewModel.boardUltimatum.candidates[0]
                          ?.discountPercent ?? 30,
                    })}
                  </Text>
                  <View className="mt-3 flex-row gap-2">
                    <Metric
                      label={t('clubHome.cashNeeded')}
                      value={formatCurrency(
                        t,
                        viewModel.boardUltimatum.cashNeeded,
                      )}
                      tone="negative"
                    />
                    <Metric
                      label={t('clubHome.deadline')}
                      value={t('clubHome.deadlineWeeks', {
                        count: viewModel.boardUltimatum.weeksRemaining,
                      })}
                    />
                  </View>
                  <View className="mt-4 gap-2">
                    {viewModel.boardUltimatum.candidates.map((candidate) => {
                      const protectedPlayer =
                        candidate.playerId ===
                        viewModel.boardUltimatum?.protectedPlayerId;
                      return (
                        <Pressable
                          key={candidate.playerId}
                          accessibilityRole="radio"
                          // One whole sentence per state, so the closing clause is
                          // free to move where the language needs it.
                          accessibilityLabel={t(
                            protectedPlayer
                              ? 'clubHome.a11y.candidateProtected'
                              : 'clubHome.a11y.candidateProtect',
                            {
                              player: candidate.playerName,
                              role: candidate.role,
                              wage: formatCurrency(t, candidate.weeklyWage),
                              fee: formatCurrency(t, candidate.forcedSaleFee),
                            },
                          )}
                          accessibilityState={{ selected: protectedPlayer }}
                          onPress={() =>
                            onProtectBoardCandidate(candidate.playerId)
                          }
                          className={
                            protectedPlayer
                              ? 'min-h-14 flex-row items-center gap-3 border-2 border-b-4 border-blue-dark bg-blue-light p-2'
                              : 'min-h-14 flex-row items-center gap-3 border-2 border-ink bg-white p-2'
                          }
                          style={({ pressed }) => ({
                            opacity: pressed ? 0.72 : undefined,
                          })}
                        >
                          <View className="overflow-hidden border-2 border-ink bg-blue-light">
                            <PixelPortrait
                              playerId={candidate.playerId}
                              role={candidate.role}
                              lookId={candidate.lookId}
                            />
                          </View>
                          <View className="flex-1">
                            <View className="flex-row items-center gap-2">
                              <Text
                                className="flex-1 text-base font-bold text-ink"
                                numberOfLines={1}
                              >
                                {candidate.playerName}
                              </Text>
                              {candidate.isHero ? (
                                <StatusChip
                                  label={t('clubHome.hero')}
                                  tone="hero"
                                />
                              ) : null}
                            </View>
                            <Text className="mt-1 font-mono text-sm text-ink/65">
                              {t('clubHome.candidateTerms', {
                                role: candidate.role,
                                wage: formatCurrency(t, candidate.weeklyWage),
                                fee: formatCurrency(t, candidate.forcedSaleFee),
                              })}
                            </Text>
                          </View>
                          <Text
                            className={
                              protectedPlayer
                                ? 'font-pixel text-sm uppercase text-blue-dark'
                                : 'font-pixel text-sm uppercase text-ink/45'
                            }
                          >
                            {protectedPlayer
                              ? t('clubHome.protected')
                              : t('clubHome.protect')}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </PaperPanel>
              </View>
            ),
          },
        ]
      : []),
    {
      key: 'table',
      weight: 2 + viewModel.table.length,
      node: (
        <View>
          <SectionLabel
            eyebrow={viewModel.divisionLabel}
            title={t('clubHome.tableSnapshot')}
            right={
              <Text className="font-pixel text-sm uppercase text-blue-dark">
                {t('clubHome.table')}
              </Text>
            }
          />
          {viewModel.table.length === 0 ? (
            <EmptyDocket
              title={t('clubHome.tableNotPublished')}
              detail={t('clubHome.standingsAppearOnce')}
            />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('clubHome.a11y.openFullLeagueTable')}
              onPress={onOpenLeague}
              className="border-2 border-b-4 border-ink bg-white"
              style={({ pressed }) => ({ opacity: pressed ? 0.75 : undefined })}
            >
              <View className="flex-row border-b-2 border-ink/20 px-3 py-2">
                <Text className="w-8 font-mono text-sm text-ink/50">
                  {t('col.league.position')}
                </Text>
                <PixelText className="flex-1 text-sm uppercase text-ink/50">
                  {t('col.league.club')}
                </PixelText>
                <Text className="w-8 text-right font-mono text-sm text-ink/50">
                  {t('col.league.played')}
                </Text>
                <Text className="w-10 text-right font-mono text-sm text-ink/50">
                  {t('col.league.goalDifference')}
                </Text>
                <Text className="w-10 text-right font-mono text-sm text-ink/50">
                  {t('col.league.points')}
                </Text>
              </View>
              {viewModel.table.map((row) => {
                const isUser = row.clubName === viewModel.clubName;
                return (
                  <View
                    key={row.clubName}
                    className={
                      isUser
                        ? 'flex-row bg-blue-light px-3 py-2'
                        : 'flex-row px-3 py-2'
                    }
                  >
                    <Text
                      className={
                        isUser
                          ? 'w-8 font-mono text-base text-ink'
                          : 'w-8 font-mono text-base text-ink'
                      }
                    >
                      {row.position}
                    </Text>
                    <Text
                      className={
                        isUser
                          ? 'flex-1 text-base font-bold text-ink'
                          : 'flex-1 text-base text-ink'
                      }
                      numberOfLines={1}
                    >
                      {row.clubName}
                    </Text>
                    <Text
                      className={
                        isUser
                          ? 'w-8 text-right font-mono text-base text-ink'
                          : 'w-8 text-right font-mono text-base text-ink'
                      }
                    >
                      {row.played}
                    </Text>
                    <Text
                      className={
                        isUser
                          ? 'w-10 text-right font-mono text-base text-ink'
                          : 'w-10 text-right font-mono text-base text-ink'
                      }
                    >
                      {row.goalDifference > 0 ? '+' : ''}
                      {row.goalDifference}
                    </Text>
                    <Text
                      className={
                        isUser
                          ? 'w-10 text-right font-mono text-base text-ink'
                          : 'w-10 text-right font-mono text-base text-ink'
                      }
                    >
                      {row.points}
                    </Text>
                  </View>
                );
              })}
            </Pressable>
          )}
        </View>
      ),
    },
  ];

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={[
        { padding: 16, paddingBottom: 28 },
        desktopContent,
      ]}
    >
      <SectionFlow
        mode={layoutMode}
        header={
          <>
            {/* The greeting and the heading share a line; the strip gets the
                whole width below them. Boxed into the right half it could only
                ever hold four or five results — the row it fills is the point. */}
            <View className="flex-row items-end justify-between">
              {/* Shrink, not flex-1: a gap or a grown column costs the greeting
                  its single line at phone width, where it only just fits. */}
              <View className="shrink">
                <Text className="font-pixel text-sm uppercase text-blue-dark">
                  {t('clubHome.goodMorningBoss')}
                </Text>
                <PixelText className="mt-1 text-xl uppercase tracking-wide text-ink">
                  {viewModel.managerName}
                </PixelText>
              </View>
              <PixelText className="text-sm uppercase tracking-wide text-ink/50">
                {t('clubHome.recentForm')}
              </PixelText>
            </View>
            {viewModel.form.length === 0 ? (
              <PixelText className="mt-2 text-right text-sm uppercase tracking-wide text-ink/40">
                {t('clubHome.noGamesYet')}
              </PixelText>
            ) : (
              /* A trophy for a win, the letter for anything else. Neither is
                 obvious on its own — hold one and it says so. */
              <FormStrip results={viewModel.form} reduceMotion={reduceMotion} />
            )}
            <View className="my-5 h-0.5 bg-ink/15" />
          </>
        }
        sections={sections}
      />
    </ScrollView>
  );
}
