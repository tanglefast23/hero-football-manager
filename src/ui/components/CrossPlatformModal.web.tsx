import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Animated, type ModalProps, type ViewStyle } from 'react-native';

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
  const onRequestCloseRef = useRef(onRequestClose);
  const onShowRef = useRef(onShow);
  const onDismissRef = useRef(onDismiss);
  onRequestCloseRef.current = onRequestClose;
  onShowRef.current = onShow;
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!visible) return undefined;
    onShowRef.current?.(undefined as never);
    return () => onDismissRef.current?.();
  }, [visible]);

  useEffect(() => {
    if (!visible || typeof document === 'undefined') return undefined;
    const releaseAppRoot = blockAppRoot();
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape')
        onRequestCloseRef.current?.(undefined as never);
    };
    document.addEventListener('keydown', dismissOnEscape);
    return () => {
      document.removeEventListener('keydown', dismissOnEscape);
      releaseAppRoot();
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return undefined;
    if (animationType !== 'fade') {
      opacity.setValue(1);
      return undefined;
    }
    opacity.setValue(0);
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [animationType, opacity, visible]);

  if (!visible || typeof document === 'undefined') return null;
  return createPortal(
    <Animated.View
      accessibilityViewIsModal
      style={[WEB_LAYER_STYLE, { opacity }]}
    >
      {children}
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
