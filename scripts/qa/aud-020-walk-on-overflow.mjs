#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:4173';
const session = `aud020-${process.pid}`;
const widths = [320, 390, 430];

function browser(args, json = false) {
  const result = spawnSync(
    'agent-browser',
    ['--session', session, ...(json ? ['--json'] : []), ...args],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(
      result.stderr || result.stdout || `agent-browser ${args[0]} failed`,
    );
  }
  if (!json) return result.stdout.trim();
  const parsed = JSON.parse(result.stdout);
  if (!parsed.success)
    throw new Error(parsed.error ?? `agent-browser ${args[0]} failed`);
  return parsed.data?.result;
}

const auditScript = String.raw`(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  let stage;
  for (let attempt = 0; attempt < 100 && !stage; attempt += 1) {
    stage = [...document.querySelectorAll('[aria-label]')].find(
      element => element.getAttribute('aria-label') === "Play the asking player's walk-on",
    );
    if (!stage) await wait(100);
  }
  if (!stage) throw new Error('Player-request Walk-on control was not found');
  stage.click();
  await wait(60);

  let visual = document.querySelector('[data-testid="character-speech-visual-viewport"]');
  const measure = phase => {
    if (!visual) throw new Error('Character speech visual viewport was not found');
    const rect = visual.getBoundingClientRect();
    return {
      phase,
      viewportWidth: window.innerWidth,
      rootClientWidth: document.documentElement.clientWidth,
      rootScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      visualLeft: rect.left,
      visualRight: rect.right,
      visualWidth: rect.width,
      visualOverflow: getComputedStyle(visual).overflow,
    };
  };
  const overlayButton = () => {
    let candidate = visual;
    while (candidate && candidate.getAttribute('role') !== 'button') {
      candidate = candidate.parentElement;
    }
    if (!candidate) throw new Error('Character speech input surface was not found');
    return candidate;
  };

  const arrival = measure('arrival');
  overlayButton().click();
  await wait(30);
  visual = document.querySelector('[data-testid="character-speech-visual-viewport"]');
  const speaking = measure('speaking');
  overlayButton().click();
  await wait(30);
  visual = document.querySelector('[data-testid="character-speech-visual-viewport"]');
  const departure = measure('departure');

  return {
    audioMuted: [...document.querySelectorAll('audio,video')].every(element => element.muted),
    phases: [arrival, speaking, departure],
  };
})()`;

let failed = false;
try {
  for (const width of widths) {
    browser(['set', 'viewport', String(width), '760']);
    browser(['open', `${baseUrl}/?aud020=${width}#/dev/player-requests/star`]);
    browser(
      [
        'eval',
        "document.querySelectorAll('audio,video').forEach(element => { element.muted = true; }); true",
      ],
      true,
    );
    browser(['wait', '1500']);
    const result = browser(['eval', auditScript], true);
    const phaseFailures = result.phases.filter(
      (phase) =>
        phase.viewportWidth !== width ||
        phase.rootClientWidth !== width ||
        phase.rootScrollWidth !== width ||
        phase.bodyScrollWidth !== width ||
        phase.visualLeft !== 0 ||
        phase.visualRight !== width ||
        phase.visualWidth !== width ||
        phase.visualOverflow !== 'hidden',
    );
    const passed = result.audioMuted && phaseFailures.length === 0;
    failed ||= !passed;
    console.log(
      `${passed ? 'PASS' : 'FAIL'} ${width}px`,
      JSON.stringify(result),
    );
  }
} finally {
  try {
    browser(['close']);
  } catch {
    // The audit result above is more useful than a redundant close failure.
  }
}

if (failed) process.exitCode = 1;
