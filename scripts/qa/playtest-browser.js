// Inject into a muted local ?qa=playtest page with the current browser tool.
(() => {
  if (!window.__HFM_QA__)
    throw Error('Open a local URL with ?qa=playtest first.');
  if (window.HFMPlaytest) return 'HFMPlaytest is already installed.';
  const media = HTMLMediaElement.prototype;
  if (!media.play.qaMuted) {
    const play = media.play;
    const mutedPlay = function (...args) {
      this.muted = true;
      return play.apply(this, args);
    };
    mutedPlay.qaMuted = true;
    media.play = mutedPlay;
  }
  document.querySelectorAll('audio,video').forEach((element) => {
    element.muted = true;
    element.pause();
  });
  // Fallback for browsers that block workers. A fresh task avoids nested
  // timer clamps, but an occluded page can still throttle this clock.
  const pagePause = (ms) =>
    new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => {
        channel.port1.close();
        channel.port2.close();
        setTimeout(resolve, ms);
      };
      channel.port2.postMessage(null);
    });
  // Keep the 450 ms input guards without relying on the page's timer budget.
  // Each worker owns one delay and is released before the promise resolves.
  const pause = (ms = 450) => {
    if (!Number.isFinite(ms) || ms < 0 || ms > 30000)
      throw Error('Delay must be 0–30000 ms.');
    if (
      typeof Worker !== 'function' ||
      typeof Blob !== 'function' ||
      typeof URL === 'undefined' ||
      typeof URL.createObjectURL !== 'function' ||
      typeof URL.revokeObjectURL !== 'function'
    )
      return pagePause(ms);
    return new Promise((resolve) => {
      let worker, url;
      let finished = false;
      const finish = (fallback = false) => {
        if (finished) return;
        finished = true;
        if (worker) {
          worker.onmessage = null;
          worker.onerror = null;
          worker.terminate();
        }
        if (url) URL.revokeObjectURL(url);
        if (fallback) pagePause(ms).then(resolve);
        else resolve();
      };
      try {
        url = URL.createObjectURL(
          new Blob(
            [
              'self.onmessage = ({data}) => setTimeout(() => self.postMessage(null), data);',
            ],
            { type: 'text/javascript' },
          ),
        );
        worker = new Worker(url);
        worker.onmessage = () => finish();
        worker.onerror = () => finish(true);
        worker.postMessage(ms);
      } catch {
        finish(true);
      }
    });
  };
  const actions = [];
  let busy = false;
  let lastClick = 0;
  const read = () => window.__HFM_QA__.read();
  const brief = (snapshot) => ({
    screen: snapshot.screen,
    tab: snapshot.activeTab,
    error: snapshot.error,
    saveError: snapshot.persistenceLoadError,
    serializationError: snapshot.careerSerializationError,
    saving: snapshot.saving,
    persisted: snapshot.careerIsPersisted,
    seed: snapshot.career?.careerSeed,
    season: snapshot.career?.season,
    week: snapshot.career?.week,
    phase: snapshot.career?.phase,
    cash: snapshot.career?.clubs.find(
      (club) => club.id === snapshot.career.userClubId,
    )?.cash,
    tp: snapshot.career?.trainingPoints,
  });
  const label = (element) =>
    element.getAttribute('aria-label') || element.textContent.trim();
  const elements = () =>
    [
      ...document.querySelectorAll(
        'button,[role="button"],[role="switch"],[role="tab"],[role="radio"],[role="checkbox"]',
      ),
    ].filter(
      (element) =>
        element.getClientRects().length &&
        !element.closest('[aria-hidden="true"],[inert]') &&
        getComputedStyle(element).visibility !== 'hidden',
    );
  const disabled = (element) =>
    element.disabled || element.getAttribute('aria-disabled') === 'true';
  async function waitFor(predicate, timeoutMs = 8000) {
    if (!Number.isFinite(timeoutMs) || timeoutMs < 0 || timeoutMs > 30000)
      throw Error('Timeout must be 0–30000 ms.');
    const end = Date.now() + timeoutMs;
    do {
      const snapshot = read();
      if (
        snapshot.error ||
        snapshot.persistenceLoadError ||
        snapshot.careerSerializationError
      )
        throw Error(JSON.stringify(brief(snapshot)));
      if (await predicate(snapshot)) return brief(snapshot);
      await pause(100);
    } while (Date.now() < end);
    throw Error('Timed out: ' + JSON.stringify(brief(read())));
  }
  async function tap(exactLabel) {
    if (busy) throw Error('Another tap is still running.');
    busy = true;
    const entry = {
      label: exactLabel,
      time: new Date().toISOString(),
      before: brief(read()),
    };
    actions.push(entry);
    try {
      if (
        entry.before.error ||
        entry.before.saveError ||
        entry.before.serializationError
      )
        throw Error('Resolve the reported error before continuing.');
      // Both confirmation focus and useTapGuard need more than 400 ms.
      await pause(Math.max(450, 450 - (Date.now() - lastClick)));
      const matches = elements().filter(
        (element) => label(element) === exactLabel,
      );
      if (matches.length !== 1)
        throw Error(
          `Expected one visible control "${exactLabel}"; found ${matches.length}.`,
        );
      if (disabled(matches[0])) throw Error('Disabled control: ' + exactLabel);
      matches[0].click();
      lastClick = Date.now();
      await pause(450);
      entry.after = brief(read());
      if (
        entry.after.error ||
        entry.after.saveError ||
        entry.after.serializationError
      )
        throw Error(JSON.stringify(entry.after));
      return entry.after;
    } catch (error) {
      entry.failure = String(error);
      throw error;
    } finally {
      busy = false;
    }
  }
  window.HFMPlaytest = Object.freeze({
    read,
    brief: () => brief(read()),
    controls: () =>
      elements().map((element) => ({
        label: label(element),
        disabled: Boolean(disabled(element)),
      })),
    tap,
    waitFor,
    pause,
    log: () => JSON.parse(JSON.stringify(actions)),
    checkpoint: () => ({
      ...read(),
      actions: JSON.parse(JSON.stringify(actions)),
    }),
    chunks: (value, size = 40000) => {
      if (!Number.isInteger(size) || size < 1 || size > 45000)
        throw Error('Chunk size must be 1–45000.');
      const serialized = JSON.stringify(value);
      if (serialized === undefined)
        throw Error('Value must be JSON-serializable.');
      return Array.from(
        { length: Math.ceil(serialized.length / size) },
        (_, index) => serialized.slice(index * size, (index + 1) * size),
      );
    },
  });
  return window.HFMPlaytest.brief();
})();
