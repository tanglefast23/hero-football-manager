import { readFileSync } from 'fs';
import { join } from 'path';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('column and personality explanations', () => {
  it('reaches a touch screen, not just a pointer', () => {
    const tip = read('src/ui/components/InfoTip.tsx');

    // Hover never fires on a phone, so the same sentence has three ways in.
    expect(tip).toContain('onPointerEnter');
    expect(tip).toContain('onLongPress={showForTouch}');
    expect(tip).toContain('accessibilityHint={text}');
    // RN suppresses onPress once onLongPress fires, so a short hold delay would
    // steal taps from the sort the header exists to do.
    expect(tip).toContain('const TOUCH_HOLD_MS = 500;');
    // Nothing dismisses a touch tip, so it dismisses itself.
    expect(tip).toContain('const TOUCH_TIP_LINGER_MS = 4000;');
    expect(tip).toContain('linger.current = setTimeout(() => setShown(false), TOUCH_TIP_LINGER_MS);');
    expect(tip).toContain('useEffect(() => clearLinger, [clearLinger]);');
    // The bubble must never sit between the pointer and the control it describes.
    expect(tip).toContain('pointerEvents="none"');
  });

  it('sizes the bubble for the screen it is on', () => {
    const tip = read('src/ui/components/InfoTip.tsx');

    // A 208px bubble hung off a 64px column runs off a phone screen.
    expect(tip).toContain('const NARROW_SCREEN_MAX_WIDTH = 600;');
    expect(tip).toContain('width - NARROW_SCREEN_GUTTER * 2');
    // 13px is a desktop hover size; a phone gets a readable one.
    expect(tip).toContain('textNarrow: { fontSize: 15');
    expect(tip).toContain('bubbleNarrow:');
  });

  it('explains every sortable roster column and the personality', () => {
    const screen = read('src/ui/screens/SquadTrainingScreen.tsx');

    expect(screen).toContain('const COLUMN_EXPLAINER');
    for (const key of ['player:', 'role:', 'overall:', 'potential:', 'condition:']) {
      expect(screen).toContain(key);
    }
    // The personality copy is derived from market.ts, not invented: every entry
    // names a pitch card it loves or hates, or a real renewal multiplier.
    expect(screen).toContain('const PERSONALITY_EXPLAINER');
    expect(screen).toContain('Renews for about 10% less.');
    expect(screen).toContain('renew for about 20% more');
    expect(screen).toContain('personalityExplainer(selectedPlayer.personality)');
  });

  it('keeps the renewal percentages honest against the market rules', () => {
    const market = read('src/game/market.ts');

    // GREEDY 120 and LOYAL 90 are what the tip promises the manager.
    expect(market).toContain("player.personality === 'GREEDY' ? 120 : player.personality === 'LOYAL' ? 90 : 100");
  });
});

describe('starting eleven team sheet', () => {
  it('shows a face and a whole name where there is room for them', () => {
    const screen = read('src/ui/screens/FixtureMatchDayScreen.tsx');

    expect(screen).toContain('const PITCH_PORTRAIT_SCALE = 3;');
    expect(screen).toContain('scale={PITCH_PORTRAIT_SCALE}');
    // Wide cells are twice as wide and spell the name out over two lines; the
    // phone grid still clips, because 56px cannot hold "Dario Flint".
    expect(screen).toContain("numberOfLines={wide ? 2 : 1}");
    expect(screen).toContain("wide ? 'w-28 items-center border-2 border-transparent p-2' : 'w-16 items-center border-2 border-transparent p-1'");
    // No portrait on the phone: eleven Skia canvases are not worth the frame.
    expect(screen).toContain('{wide ? (');
  });

  it('scales the portrait on whole pixels only', () => {
    const portrait = read('src/ui/components/PixelPortrait.tsx');

    // A fractional scale lands the grid off the device pixel and smears a
    // 1-bit face, so the prop is rounded before it reaches the canvas.
    expect(portrait).toContain('const pixel = Math.max(1, Math.round(scale));');
    expect(portrait).toContain('height={pixel}');
    expect(portrait).not.toContain('height={PIXEL_PORTRAIT_SCALE}');
  });
});

describe('quick train', () => {
  it('makes each attribute box its own train button', () => {
    const screen = read('src/ui/screens/SquadTrainingScreen.tsx');
    const modal = read('src/ui/TrainingDrillModal.tsx');

    // The box names the drill it buys, so the decision is made before the tap.
    expect(screen).toContain('statOptions?.find(candidate => candidate.shortCode === attribute.label)');
    expect(screen).toContain('onTrainAttribute(option.pathId)');
    expect(screen).toContain('+{option.gain} · {option.tpCost} TP');
    // Both entry points propose; neither spends on the first tap.
    expect(modal).toContain('setPendingConfirm(option);');
    expect(modal).toContain('const chosen = pendingConfirm;');
    expect(modal).toContain('onTrainDrill(playerId, chosen.pathId);');
    // Quick Train opens straight onto that drill's confirmation.
    expect(modal).toContain('if (quickTrainPathId === undefined) return;');
  });

  it('teaches the shortcut in week 6, once', () => {
    const screen = read('src/ui/screens/SquadTrainingScreen.tsx');
    const app = read('App.tsx');
    const guide = read('src/game/assistant-guide.ts');

    expect(guide).toContain("'quick-train-seen': 'guide:bert:quick-train-seen'");
    expect(app).toContain('const QUICK_TRAIN_LESSON_WEEK = 6;');
    expect(app).toContain("!hasAssistantGuideMilestone(store.career, 'quick-train-seen')");
    // The lesson needs a grid to point at, so it selects someone first.
    expect(screen).toContain('if (!guideQuickTrain || selectedPlayerId !== undefined) return;');
    expect(screen).toContain('label="Quick Train"');
    expect(screen).toContain('detail="Select a player and tap the attribute you want to train."');
    // Doing the thing retires the lesson.
    expect(screen).toContain('onQuickTrainShown?.();');
  });
});
