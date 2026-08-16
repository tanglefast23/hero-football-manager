import { readFileSync } from 'fs';
import { join } from 'path';

const source = (path: string) =>
  readFileSync(join(process.cwd(), path), 'utf8');

/**
 * Source with comments removed.
 *
 * Needed for the negative assertions below. A rule worth pinning is usually
 * worth a comment saying why, and that comment names the very identifier the
 * assertion is checking is absent — so `not.toContain` on the raw text fails on
 * the explanation rather than on the code.
 */
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const CUTSCENE = 'src/render/MotivationalSpeechCutscene.tsx';
const MATCH_SCREEN = 'src/render/MatchScreen.tsx';
const AUDIO = 'src/render/coach-speech-audio.ts';

/**
 * Source contracts, because this project's Jest environment is `node` with no
 * DOM, no React Native and no renderer — a component cannot be mounted here.
 *
 * These are therefore weaker than behavioural tests and are chosen for exactly
 * that reason: each one pins a rule whose violation is silent, cheap to
 * reintroduce in an edit, and expensive in play. The real behavioural coverage
 * for this feature lives in the pure rings — `coach-speech.test.ts`,
 * `coach-speech-bank-codec.test.ts` and `coach-portrait-resolver.test.ts`.
 */
describe('the motivational speech cutscene, as source contracts', () => {
  it('never lets unmount finish the cutscene', () => {
    // The single most costly mistake available here. `finish` restarts the
    // match theme and calls `onDone`; unmount happens while MatchScreen is
    // already running `stopTheme()` and `teardownAudio()` in its own cleanup,
    // so doing either from unmount raises a wanted flag against a player being
    // released, and reports a completed cutscene for one that was abandoned.
    const file = source(CUTSCENE);
    const cleanup = file.slice(
      file.indexOf('return () => {'),
      file.indexOf('}, [coachScale, finish, flash, reduceMotion]);'),
    );
    expect(cleanup.length).toBeGreaterThan(0);
    expect(cleanup).toContain('teardownCoachSpeechAudio()');
    const cleanupCode = code(cleanup);
    expect(cleanupCode).not.toContain('startTheme');
    expect(cleanupCode).not.toContain('onDone');
    expect(cleanupCode).not.toContain('finish(');
  });

  it('ends exactly once, however it ended', () => {
    const file = source(CUTSCENE);
    // The timer, the overlay's last tap and the modal's Back/Escape all route
    // through one guarded `finish`, so two of them landing on the same frame
    // cannot resume the theme twice or double-report to the parent.
    expect(file).toContainSource('if (finishedRef.current) return;');
    expect(file).toContainSource('finishedRef.current = true;');
    expect(file).toContainSource('onRequestClose={finish}');
    expect(file).toContainSource('onDone={finish}');
    expect(file).toContainSource('setTimeout(finish, CUTSCENE_MS)');
  });

  it('reuses the app’s talking-character overlay rather than its own', () => {
    const file = source(CUTSCENE);
    expect(file).toContain('CharacterSpeechOverlay');
    // The configuration that makes a walk-on overlay a centre-screen slam.
    expect(file).toContainSource('characterCentreRatio={0.5}');
    expect(file).toContainSource('hideCharacter');
    expect(file).toContainSource('instant');
    // No typewriter PROP: it spends the first tap finishing the line, and the
    // rule is that EVERY tap moves to a new one. (The word itself appears in
    // the comment explaining the omission, so match the prop, not the word.)
    expect(code(file)).not.toContain('typewriter');
  });

  it('shows four lines, so the fourth tap ends the cutscene', () => {
    const file = source(CUTSCENE);
    expect(file).toContainSource('const LINES_PER_RUN = 4;');
    expect(file).toContainSource('shuffled.slice(0, LINES_PER_RUN)');
  });

  it('reads its lines through the catalog, never from the content file', () => {
    // A key nothing requests is this codebase's most common defect: the six
    // locales would be at 100% coverage and the game would still speak English.
    const file = source(CUTSCENE);
    expect(file).toContainSource('t(`coach.speech.${proseSlug(line)}`)');
  });

  it('resolves the coach’s face once, not per expression', () => {
    const file = source(CUTSCENE);
    expect(file).toContainSource('resolveCoachPortraitId(coachPortraitId)');
    // The flap varies ONLY the expression on an already-resolved identity.
    expect(file).toMatchSource(
      /coach:\$\{portraitId\}:\$\{mouthOpen \? 'joy' : 'point'\}/,
    );
  });

  it('fixes the card positions before the first frame', () => {
    // Generated into a ref, never during render: a re-render that re-rolled
    // them would teleport every card that is mid-animation.
    const file = source(CUTSCENE);
    expect(file).toContainSource(
      'const cards = useRef<readonly CardSpot[] | null>(null);',
    );
    expect(file).toContainSource('if (cards.current === null) {');
  });

  it('keeps the +X cards out of the accessibility tree', () => {
    const file = source(CUTSCENE);
    expect(file).toContainSource('accessibilityElementsHidden');
    expect(file).toContainSource(
      'importantForAccessibility="no-hide-descendants"',
    );
    // Back and Escape come from the modal, not from a bare Pressable.
    expect(file).toContain('CrossPlatformModal');
    expect(file).toContainSource('handleAccessibilityEscape');
  });
});

describe('the half-time hand-over in MatchScreen', () => {
  it('releases the pause on every path, including a refused input', () => {
    // The refused-input path opens NO cutscene, so no `onDone` ever arrives.
    // Without its own release the match stays paused for good.
    const file = source(MATCH_SCREEN);
    expect(file).toContainSource('const releaseSpeechPause = () => {');
    expect(file).toContainSource(
      "automaticPauseReasonsRef.current.delete('halftime-speech');",
    );

    const answer = file.slice(
      file.indexOf('const answerSpeechPrompt = ('),
      file.indexOf('const openSpeechCutsceneAfterSheet'),
    );
    expect(answer.length).toBeGreaterThan(0);
    // Cancel, and confirm-but-refused, both release immediately.
    expect(answer.match(/releaseSpeechPause\(\)/g)?.length).toBe(2);
    expect(answer).toContainSource(
      'speechCutsceneWantedRef.current = recorded;',
    );
    // The confirmed-and-recorded path hands the release to the cutscene.
    expect(file).toContainSource('const finishSpeechCutscene = () => {');
  });

  it('opens the cutscene only after the sheet has gone', () => {
    // Otherwise the flash and the thunder start behind a modal that is still
    // dismissing itself.
    const file = source(MATCH_SCREEN);
    expect(file).toContainSource(
      'onAfterConfirmDismiss: openSpeechCutsceneAfterSheet,',
    );
  });

  it('never opens the cutscene for an input the engine refused', () => {
    const file = source(MATCH_SCREEN);
    const opener = file.slice(
      file.indexOf('const openSpeechCutsceneAfterSheet'),
      file.indexOf('const finishSpeechCutscene'),
    );
    expect(opener).toContainSource(
      'if (!speechCutsceneWantedRef.current) return;',
    );
  });
});

describe('the cutscene’s audio owner', () => {
  it('keeps stop and teardown as different things', () => {
    // `finish` silences; unmount releases. Collapsing them either leaks native
    // players or makes a second run of the cutscene silent.
    const file = source(AUDIO);
    expect(file).toContainSource(
      'export function stopCoachSpeechAudio(): void {',
    );
    expect(file).toContainSource(
      'export function teardownCoachSpeechAudio(): void {',
    );
    expect(file).toContainSource('stopCoachSpeechAudio();');
  });

  it('seeks the voice exactly once per line', () => {
    // iOS cancels a pending seek when the next arrives, so a voice re-seeked on
    // a timer plays only its first sound.
    const file = source(AUDIO);
    expect(file.match(/\.seekTo\(offset\)/g)?.length).toBe(1);
    // The mouth flap must never reach the audio module.
    const cutscene = source(CUTSCENE);
    const flap = cutscene.slice(
      cutscene.indexOf('const flap = reduceMotion'),
      cutscene.indexOf('const cap = setTimeout'),
    );
    expect(flap.length).toBeGreaterThan(0);
    expect(code(flap)).not.toContain('playCoachVoice');
  });

  it('hands the overlay ONE stable speak callback, not a fresh arrow', () => {
    // The bug this pins actually shipped in review and the test above missed
    // it, because the re-seek arrived through the overlay rather than from the
    // flap block. `CharacterSpeechOverlay` is not memoized and its announce
    // effect depends on `[lineIndex, onLineChange]`, so an inline arrow gets a
    // new identity on every 130ms flap render, re-fires that effect, and
    // re-seeks the voice roughly eight times a second.
    const cutscene = code(source(CUTSCENE));
    expect(cutscene).toContain('onLineChange={speakLine}');
    expect(cutscene).toMatchSource(
      /const speakLine = useRef\(\(\) => playCoachVoice\(VOICE_MS\)\)\.current;/,
    );
    expect(cutscene).not.toMatch(/onLineChange=\{\s*\(\)\s*=>/);

    // And the voice is started from exactly one place: the overlay's own
    // line-0 announcement. A second call in the mount effect would seek the
    // opening line twice.
    expect(cutscene.match(/playCoachVoice\(/g)?.length).toBe(1);

    // The dependency that makes this fragile, asserted where it is read, so
    // this test fails loudly if the overlay ever stops announcing on mount.
    const overlay = source('src/ui/CharacterSpeechOverlay.tsx');
    expect(overlay).toContainSource('onLineChange?.(lineIndex);');
    expect(overlay).toContainSource('}, [lineIndex, onLineChange]);');
  });

  it('is wired to the volume setting like every other audio owner', () => {
    expect(source('App.tsx')).toContainSource(
      'setCoachSpeechMasterVolume(devVolume);',
    );
  });
});
