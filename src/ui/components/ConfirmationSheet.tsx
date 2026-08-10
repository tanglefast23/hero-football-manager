import { useCallback, useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CrossPlatformModal as Modal } from './CrossPlatformModal';
import { ActionButton } from './Scorecard';
import { useCopy } from '../../i18n';

export interface ConfirmationRequest {
  readonly title: string;
  readonly detail: string;
  readonly confirmLabel: string;
  readonly tone?: 'normal' | 'danger' | 'hero';
  readonly confirmDisabled?: boolean;
  /** Stable focus target when the triggering control disappears on confirm. */
  readonly returnFocusId?: string;
  /** Runs after a confirmed sheet has fully left the accessibility tree. */
  readonly onAfterConfirmDismiss?: () => void;
  readonly onConfirm: () => void;
}

export interface ConfirmationSheetProps {
  readonly confirmation: ConfirmationRequest | null;
  readonly reduceMotion?: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

/**
 * The shared commit question for club decisions.
 *
 * CrossPlatformModal supplies the native dialog boundary and the PWA's fixed
 * viewport layer. This sheet adds the web focus trap, heading focus, reduced
 * motion, safe Back/Escape cancellation, and a stable fallback after a Review
 * button is replaced by its signed contract.
 */
export function ConfirmationSheet({
  confirmation,
  reduceMotion = false,
  onCancel,
  onConfirm,
}: ConfirmationSheetProps) {
  const t = useCopy();
  const headingRef = useRef<Text>(null);
  const headingFocusFrameRef = useRef<number | null>(null);
  const headingFocusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const priorWebFocusRef = useRef<HTMLElement | null>(null);
  const returnFocusIdRef = useRef<string | undefined>(undefined);
  const afterConfirmDismissRef = useRef<(() => void) | undefined>(undefined);
  const confirmedRef = useRef(false);
  const wasOpenRef = useRef(false);
  const open = confirmation !== null;
  const returnFocusId = confirmation?.returnFocusId;
  const onAfterConfirmDismiss = confirmation?.onAfterConfirmDismiss;

  const cancelHeadingFocus = useCallback(() => {
    if (headingFocusFrameRef.current !== null) {
      cancelAnimationFrame(headingFocusFrameRef.current);
      headingFocusFrameRef.current = null;
    }
    if (headingFocusTimerRef.current !== null) {
      clearTimeout(headingFocusTimerRef.current);
      headingFocusTimerRef.current = null;
    }
  }, []);

  const scheduleHeadingFocus = useCallback(() => {
    cancelHeadingFocus();
    let remainingFrames = 4;
    const focusHeading = () => {
      headingFocusFrameRef.current = null;
      const heading =
        Platform.OS === 'web' && typeof document !== 'undefined'
          ? document.getElementById('club-confirmation-heading')
          : headingRef.current;
      if (heading === null) {
        if (remainingFrames === 0) return;
        remainingFrames -= 1;
        headingFocusFrameRef.current = requestAnimationFrame(focusHeading);
        return;
      }
      (heading as unknown as { focus?: () => void }).focus?.();
      if (Platform.OS === 'web') return;
      const handle = findNodeHandle(heading as unknown as Text);
      if (handle !== null) AccessibilityInfo.setAccessibilityFocus(handle);
    };
    headingFocusFrameRef.current = requestAnimationFrame(focusHeading);
    if (Platform.OS === 'web') {
      // The web fade can return focus to the body after the layer mounts.
      // Reassert it once the fade is over; the frame path still covers reduced
      // motion and browsers that do not animate the Modal.
      headingFocusTimerRef.current = setTimeout(
        () => {
          headingFocusTimerRef.current = null;
          document.getElementById('club-confirmation-heading')?.focus();
        },
        reduceMotion ? 0 : 400,
      );
    }
  }, [cancelHeadingFocus, reduceMotion]);

  const completeDismissal = useCallback(() => {
    if (!wasOpenRef.current) return;
    wasOpenRef.current = false;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const prior = priorWebFocusRef.current;
      if (prior?.isConnected) {
        prior.focus();
      } else if (returnFocusIdRef.current !== undefined) {
        document.getElementById(returnFocusIdRef.current)?.focus();
      }
    }
    if (confirmedRef.current) afterConfirmDismissRef.current?.();
    priorWebFocusRef.current = null;
    returnFocusIdRef.current = undefined;
    afterConfirmDismissRef.current = undefined;
    confirmedRef.current = false;
  }, []);

  useEffect(() => {
    if (!open) return;
    returnFocusIdRef.current = returnFocusId;
    afterConfirmDismissRef.current = onAfterConfirmDismiss;
  }, [onAfterConfirmDismiss, open, returnFocusId]);

  useEffect(() => {
    if (!open) {
      cancelHeadingFocus();
      // React Native does not emit Modal.onDismiss on Android. The modal stops
      // rendering as soon as visible becomes false, so the following frame is
      // the first safe point for a replacement control to receive AX focus.
      if (Platform.OS !== 'android' || !wasOpenRef.current) return undefined;
      const frame = requestAnimationFrame(completeDismissal);
      return () => cancelAnimationFrame(frame);
    }
    wasOpenRef.current = true;
    confirmedRef.current = false;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      priorWebFocusRef.current = document.activeElement as HTMLElement | null;
    }
    scheduleHeadingFocus();
    return cancelHeadingFocus;
  }, [cancelHeadingFocus, completeDismissal, open, scheduleHeadingFocus]);

  const cancel = useCallback(() => {
    confirmedRef.current = false;
    onCancel();
  }, [onCancel]);

  const confirm = useCallback(() => {
    confirmedRef.current = true;
    onConfirm();
  }, [onConfirm]);

  return (
    <Modal
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      visible={open}
      onShow={scheduleHeadingFocus}
      onDismiss={completeDismissal}
      onRequestClose={cancel}
    >
      <SafeAreaView
        edges={['bottom']}
        className="flex-1 justify-end bg-ink/70 px-4 pb-8"
      >
        <View
          accessibilityViewIsModal
          accessibilityLabelledBy="club-confirmation-heading"
          className="w-full max-w-[1180px] self-center border-2 border-b-4 border-ink bg-paper p-5"
          style={{ zIndex: 1 }}
          {...webDialogLabelProps()}
        >
          <Text className="font-pixel text-sm uppercase text-red-dark">
            {t('confirmationSheet.confirmClubDecision')}
          </Text>
          <Text
            ref={headingRef}
            nativeID="club-confirmation-heading"
            accessibilityRole="header"
            className="mt-2 font-pixel text-xl uppercase text-ink"
            {...webHeadingProps()}
          >
            {confirmation?.title}
          </Text>
          <Text className="mt-3 text-base leading-6 text-ink/70">
            {confirmation?.detail}
          </Text>
          <View className="mt-5 flex-row gap-3">
            <View className="flex-1">
              <ActionButton
                label={t('clubFinances.cancel')}
                accessibilityLabel={t('confirmationSheet.a11y.cancelDecision')}
                variant="paper"
                pressSfx="click"
                onPress={cancel}
              />
            </View>
            <View className="flex-1">
              <ActionButton
                label={
                  confirmation?.confirmLabel ??
                  t('confirmationSheet.confirmDecision')
                }
                accessibilityLabel={
                  confirmation?.confirmLabel ??
                  t('confirmationSheet.confirmDecision')
                }
                variant={
                  confirmation?.tone === 'danger'
                    ? 'danger'
                    : confirmation?.tone === 'hero'
                      ? 'hero'
                      : 'confirm'
                }
                disabled={confirmation?.confirmDisabled === true}
                onPress={confirm}
              />
            </View>
          </View>
        </View>
        {/*
         * Keep the backdrop after the dialog in DOM order so RN Web's modal
         * focus trap reaches the heading first. zIndex leaves it visually and
         * interactively behind the sheet. Outside, Escape, and Android Back
         * all choose the reversible path.
         */}
        <Pressable
          accessible={false}
          focusable={false}
          className="absolute inset-0"
          style={{ zIndex: 0 }}
          onPress={cancel}
          {...webBackdropProps()}
        />
      </SafeAreaView>
    </Modal>
  );
}

/** Props react-native-web forwards to the dialog's DOM node. */
function webDialogLabelProps(): object {
  if (Platform.OS !== 'web') return {};
  return {
    role: 'dialog',
    'aria-modal': true,
    'aria-labelledby': 'club-confirmation-heading',
    onKeyDown: trapWebDialogFocus,
  };
}

function trapWebDialogFocus(event: {
  readonly key: string;
  readonly shiftKey: boolean;
  readonly currentTarget: EventTarget | null;
  preventDefault: () => void;
}): void {
  if (event.key !== 'Tab' || typeof document === 'undefined') return;
  const dialog = event.currentTarget as HTMLElement | null;
  if (dialog === null) return;
  const controls = [
    ...dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ];
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (first === undefined || last === undefined) return;
  const active = document.activeElement;
  const activeIndex = controls.indexOf(active as HTMLElement);
  if (event.shiftKey && activeIndex <= 0) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

function webHeadingProps(): object {
  if (Platform.OS !== 'web') return { focusable: true };
  return { tabIndex: -1 };
}

/** The outside-click target must never become a silent keyboard stop. */
function webBackdropProps(): object {
  if (Platform.OS !== 'web') return {};
  return { tabIndex: -1, 'aria-hidden': true };
}

/** Hide the entire interactive page from pointer, keyboard and AX while open. */
export function confirmationBackgroundProps(open: boolean): object {
  if (Platform.OS !== 'web' || !open) return {};
  return { inert: true, 'aria-hidden': true };
}
