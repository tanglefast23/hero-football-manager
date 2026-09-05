/** Keeps keyboard focus inside a dialog. Nested dialogs handle the key first. */
export function trapWebDialogFocus(event: {
  readonly key: string;
  readonly shiftKey: boolean;
  readonly defaultPrevented?: boolean;
  readonly currentTarget: EventTarget | null;
  preventDefault: () => void;
}): void {
  if (
    event.key !== 'Tab' ||
    event.defaultPrevented ||
    typeof document === 'undefined'
  )
    return;
  const host = event.currentTarget as HTMLElement | null;
  if (host === null) return;
  const dialog = host.matches('[role="dialog"]')
    ? host
    : (host.querySelector<HTMLElement>('[role="dialog"]') ?? host);
  const controls = [
    ...dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ].filter(
    (element) =>
      !element.closest('[inert],[aria-hidden="true"],[aria-disabled="true"]') &&
      element.getClientRects().length > 0,
  );
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (first === undefined || last === undefined) {
    event.preventDefault();
    dialog.focus();
    return;
  }
  const active = document.activeElement;
  const activeIndex = controls.indexOf(active as HTMLElement);
  if (event.shiftKey && activeIndex <= 0) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || activeIndex === -1)) {
    event.preventDefault();
    first.focus();
  }
}
