import { trapWebDialogFocus } from '../components/web-dialog-focus';

it('wraps focus inside the named dialog without visiting its outside backdrop', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const control = () => ({
    closest: () => null,
    getClientRects: () => [{}],
    focus: jest.fn(),
  });
  const first = control();
  const last = control();
  const backdrop = control();
  const document = { activeElement: last };
  const dialog = { querySelectorAll: () => [first, last], focus: jest.fn() };
  const host = {
    matches: () => false,
    querySelector: () => dialog,
    querySelectorAll: () => [first, last, backdrop],
  };
  const event = {
    key: 'Tab',
    shiftKey: false,
    currentTarget: host as unknown as EventTarget,
    preventDefault: jest.fn(),
  };
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: document,
  });
  try {
    trapWebDialogFocus(event);
    expect(first.focus).toHaveBeenCalledTimes(1);
    expect(backdrop.focus).not.toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    document.activeElement = first;
    trapWebDialogFocus({ ...event, shiftKey: true });
    expect(last.focus).toHaveBeenCalledTimes(1);
    trapWebDialogFocus({ ...event, defaultPrevented: true });
    expect(event.preventDefault).toHaveBeenCalledTimes(2);
  } finally {
    if (original) Object.defineProperty(globalThis, 'document', original);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
