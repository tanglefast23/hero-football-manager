import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Animated,
  type ModalProps,
  type ViewStyle,
  type View,
} from 'react-native';
import { MOTION_MS } from '../motion';
import { trapWebDialogFocus } from './web-dialog-focus';

let visibleWebModalCount = 0;
let appRootSnapshot:
  | {
      element: HTMLElement;
      ariaHidden: string | null;
      inert: boolean;
    }
  | undefined;

function blockAppRoot(): () => void {
  const appRoot = document.getElementById('root');
  if (appRoot === null) return () => undefined;
  if (visibleWebModalCount === 0) {
    appRootSnapshot = {
      element: appRoot,
      ariaHidden: appRoot.getAttribute('aria-hidden'),
      inert: appRoot.hasAttribute('inert'),
    };
  }
  visibleWebModalCount += 1;
  appRoot.setAttribute('aria-hidden', 'true');
  appRoot.setAttribute('inert', '');

  let released = false;
  return () => {
    if (released) return;
    released = true;
    visibleWebModalCount = Math.max(0, visibleWebModalCount - 1);
    if (visibleWebModalCount > 0) return;
    const snapshot = appRootSnapshot;
    appRootSnapshot = undefined;
    if (snapshot === undefined) return;
    if (snapshot.ariaHidden === null)
      snapshot.element.removeAttribute('aria-hidden');
    else snapshot.element.setAttribute('aria-hidden', snapshot.ariaHidden);
    if (!snapshot.inert) snapshot.element.removeAttribute('inert');
  };
}

/**
 * PWA modal host without react-native-web's Modal portal machinery.
 *
 * A fixed body child cannot be clipped by a screen, transition slot, scroll
 * view, or later toolbar. The simple host also cannot keep an invisible modal
 * controller alive while its report continues to play sound.
 */
export function CrossPlatformModal({
  visible = true,
  animationType = 'none',
  onRequestClose,
  onShow,
  onDismiss,
  children,
}: ModalProps) {
  const opacity = useRef(
    new Animated.Value(animationType === 'fade' ? 0 : 1),
  ).current;
  const [present, setPresent] = useState(visible);
  const layerRef = useRef<View>(null);
  const childrenRef = useRef(children);
  if (visible) childrenRef.current = children;
  const onRequestCloseRef = useRef(onRequestClose);
  const onShowRef = useRef(onShow);
  const onDismissRef = useRef(onDismiss);
  const shownRef = useRef(false);
  onRequestCloseRef.current = onRequestClose;
  onShowRef.current = onShow;
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (visible && present && !shownRef.current) {
      shownRef.current = true;
      onShowRef.current?.(undefined as never);
    } else if (!present && shownRef.current) {
      shownRef.current = false;
      onDismissRef.current?.();
    }
  }, [present, visible]);

  useEffect(
    () => () => {
      if (shownRef.current) onDismissRef.current?.();
    },
    [],
  );

  useEffect(() => {
    if (!present || typeof document === 'undefined') return undefined;
    const previousFocus = document.activeElement as HTMLElement | null;
    const releaseAppRoot = blockAppRoot();
    const focusDialog = () => {
      const layer = layerRef.current as unknown as HTMLElement | null;
      const layers = document.querySelectorAll('[data-hfm-modal]');
      if (
        layer === null ||
        layers[layers.length - 1] !== layer ||
        layer.contains(document.activeElement)
      )
        return;
      const dialog =
        layer.querySelector<HTMLElement>('[role="dialog"]') ?? layer;
      const first = dialog.querySelector<HTMLElement>(
        '[role="heading"], button:not([disabled]), [tabindex="0"]',
      );
      if (first?.getAttribute('role') === 'heading') first.tabIndex = -1;
      first?.focus();
      if (!dialog.contains(document.activeElement)) {
        dialog.tabIndex = -1;
        dialog.focus();
      }
    };
    const frame = requestAnimationFrame(focusDialog);
    const timer = setTimeout(focusDialog, MOTION_MS.QUICK + 50);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      releaseAppRoot();
      if (previousFocus?.isConnected && !previousFocus.closest('[inert]'))
        previousFocus.focus();
    };
  }, [present]);

  useEffect(() => {
    if (!visible || typeof document === 'undefined') return undefined;
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape')
        onRequestCloseRef.current?.(undefined as never);
    };
    document.addEventListener('keydown', dismissOnEscape);
    return () => document.removeEventListener('keydown', dismissOnEscape);
  }, [visible]);

  useEffect(() => {
    if (visible && !present) {
      setPresent(true);
      return undefined;
    }
    if (!present) return undefined;
    if (animationType !== 'fade') {
      opacity.setValue(visible ? 1 : 0);
      if (!visible) setPresent(false);
      return undefined;
    }
    if (visible) opacity.setValue(0);
    const animation = Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: MOTION_MS.QUICK,
      useNativeDriver: false,
    });
    const finish = () => {
      if (!visible) setPresent(false);
    };
    animation.start(({ finished }) => {
      if (finished) finish();
    });
    const backstop = visible
      ? undefined
      : setTimeout(finish, MOTION_MS.QUICK + 100);
    return () => {
      if (backstop !== undefined) clearTimeout(backstop);
      animation.stop();
    };
  }, [animationType, opacity, present, visible]);

  if (!present || typeof document === 'undefined') return null;
  return createPortal(
    <Animated.View
      ref={layerRef}
      tabIndex={-1}
      {...{ dataSet: { hfmModal: '' }, onKeyDown: trapWebDialogFocus }}
      accessibilityViewIsModal
      accessibilityElementsHidden={!visible}
      pointerEvents={visible ? 'auto' : 'none'}
      style={[WEB_LAYER_STYLE, { opacity }]}
    >
      {childrenRef.current}
    </Animated.View>,
    document.body,
  );
}

const WEB_LAYER_STYLE = {
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  zIndex: 1_000_000,
} as unknown as ViewStyle;
