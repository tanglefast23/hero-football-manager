import { readFileSync } from 'fs';
import { join } from 'path';
import { ENABLED_LOCALES, loadCatalog } from '../../i18n';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('column and personality explanations', () => {
  it('reaches a touch screen, not just a pointer', () => {
    const tip = read('src/ui/components/InfoTip.tsx');

    // Hover never fires on a phone, so the same sentence has three ways in.
    expect(tip).toContainSource('onPointerEnter');
    expect(tip).toContainSource('onLongPress={showForTouch}');
    expect(tip).toContainSource('accessibilityHint={text}');
    // RN suppresses onPress once onLongPress fires, so a short hold delay would
    // steal taps from the sort the header exists to do.
    expect(tip).toContainSource('const TOUCH_HOLD_MS = 500;');
    // Nothing dismisses a touch tip, so it dismisses itself.
    expect(tip).toContainSource('const TOUCH_TIP_LINGER_MS = 4000;');
    expect(tip).toContainSource(
      'linger.current = setTimeout(() => setShown(false), TOUCH_TIP_LINGER_MS);',
    );
    expect(tip).toContainSource('useEffect(() => clearLinger, [clearLinger]);');
    // The bubble must never sit between the pointer and the control it describes.
    expect(tip).toContainSource('pointerEvents="none"');
  });

  it('sizes the bubble for the screen it is on', () => {
    const tip = read('src/ui/components/InfoTip.tsx');

    // A 208px bubble hung off a 64px column runs off a phone screen.
    expect(tip).toContainSource('const NARROW_SCREEN_MAX_WIDTH = 600;');
    expect(tip).toContainSource('width - NARROW_SCREEN_GUTTER * 2');
    // 13px is a desktop hover size; a phone gets a readable one.
    expect(tip).toContainSource('textNarrow: { fontSize: 15');
    expect(tip).toContainSource('bubbleNarrow:');
  });

  it('draws the stat tip outside every card, not inside its anchor', () => {
    const infoTip = read('src/ui/components/InfoTip.tsx');
    const app = read('App.tsx');

    // Raising the anchor's z-index was the old fix and it cannot work: a child's
    // z-index resolves inside its parent's stacking context, so a later sibling
    // of the *parent* still paints over the bubble. The morale tip was covered
    // by the contract block directly beneath it. So the bubble is drawn by a
    // layer mounted last at the app root, and the anchor is only measured.
    expect(infoTip).not.toContainSource('anchorShown');
    expect(infoTip).toContainSource('export function InfoTipLayer()');
    expect(infoTip).toContainSource('useGuideAnchor(shown, publish)');
    expect(infoTip).toContainSource('ref={anchorRef}');
    // Without a real host node measureInWindow has nothing to measure.
    expect(infoTip).toContainSource('collapsable={false}');
    // The layer covers the window, so it MUST let every pointer event through.
    expect(infoTip).toMatchSource(
      /<View pointerEvents="none" style=\{styles\.layer\}>/,
    );
    // Last child of the root view: mounted anywhere earlier and a later sibling
    // paints over it, which is the bug this replaced.
    expect(app).toMatchSource(/<InfoTipLayer \/>\s*<\/View>/);
  });

  it('raises each hover tip host above later rows and neighboring panels', () => {
    const hoverTip = read('src/ui/components/SfxPressable.tsx');
    const managementShell = read('src/ui/ManagementShell.tsx');

    expect(hoverTip).toContainSource('showTip ? hoverTipTopLayer : undefined');
    expect(hoverTip).toContainSource(
      'style={showTip ? hoverTipTopLayer : hoverTipAnchor}',
    );
    expect(hoverTip).toContainSource(
      'const hoverTipTopLayer: ViewStyle = { zIndex: 1000, elevation: 20 };',
    );
    // The money, TP and fans tips sit inside the HUD. The whole HUD must outrank
    // its later content sibling or that pane still paints over the bubbles.
    expect(managementShell).toContainSource('styles.hudTopLayer');
    expect(managementShell).toContainSource(
      "hudTopLayer: { position: 'relative', zIndex: 1000, overflow: 'visible' }",
    );
  });

  it('explains every sortable roster column and the personality', () => {
    const screen = read('src/ui/screens/SquadTrainingScreen.tsx');

    expect(screen).toContainSource('const COLUMN_EXPLAINER');
    for (const key of [
      'player:',
      'role:',
      'overall:',
      'potential:',
      'condition:',
    ]) {
      expect(screen).toContainSource(key);
    }
    // The personality copy is derived from market.ts, not invented: every entry
    // names a pitch card it loves or hates, or a real renewal multiplier. The
    // sentences themselves live in the catalog under `squadTraining.personality.*`
    // — a module constant is built before any component runs, so the map holds
    // keys and the component resolves them. The renewal percentages the copy
    // promises are pinned against market.ts by the test below.
    expect(screen).toContainSource('const PERSONALITY_EXPLAINER');
    expect(screen).toContainSource("LOYAL: 'squadTraining.personality.loyal'");
    expect(screen).toContainSource(
      "GREEDY: 'squadTraining.personality.greedy'",
    );
    expect(screen).toContainSource(
      'personalityExplainer(selectedPlayer.personality, t)',
    );
  });

  it('keeps the renewal percentages honest against the market rules', () => {
    const market = read('src/game/market.ts');

    // GREEDY 120 and LOYAL 90 are what the tip promises the manager.
    expect(market).toContainSource(
      "player.personality === 'GREEDY' ? 120 : player.personality === 'LOYAL' ? 90 : 100",
    );
  });
});

describe('starting eleven team sheet', () => {
  it('keeps both club crests beside the versus tile', () => {
    const screen = read('src/ui/screens/FixtureMatchDayScreen.tsx');
    const card =
      screen.match(
        /const fixtureCard = \(([\s\S]*?)\n  const teamSheet =/,
      )?.[1] ?? '';

    expect(card.indexOf('{fixture.homeTeam}')).toBeLessThan(
      card.indexOf('<ClubCrest clubName={fixture.homeTeam}'),
    );
    expect(card).toContain('className="min-w-0 flex-1 text-right font-pixel');
    expect(card).toContain('className="min-w-0 flex-1 font-pixel');
  });

  it('draws starters in their assigned formation row rather than their natural role', () => {
    const screen = read('src/ui/screens/FixtureMatchDayScreen.tsx');

    expect(screen).toContainSource(
      'viewModel.lineup.filter(player => player.formationRole === role)',
    );
    expect(screen).not.toContainSource(
      'viewModel.lineup.filter(player => player.role === role)',
    );
  });

  it('uses portraits and wider flexible name cells on phone and desktop', () => {
    const screen = read('src/ui/screens/FixtureMatchDayScreen.tsx');
    const teamSheet =
      screen.match(/const teamSheet = \(([\s\S]*?)\n  const bench =/)?.[1] ??
      '';

    expect(screen).toContainSource('const PITCH_PORTRAIT_SCALE = 3;');
    expect(screen).toContainSource('const PITCH_PORTRAIT_COMPACT_SCALE = 2;');
    expect(teamSheet).toContainSource(
      'scale={wide ? PITCH_PORTRAIT_SCALE : PITCH_PORTRAIT_COMPACT_SCALE}',
    );
    expect(teamSheet).toContainSource('numberOfLines={2}');
    expect(teamSheet).toContainSource(
      '{player.role}\n                    </PixelText>',
    );
    expect(teamSheet).toContainSource(
      "'min-w-0 max-w-24 flex-1 items-center border-2 border-transparent px-0.5 py-1'",
    );
    expect(teamSheet).toContainSource(
      "'border-[3px] border-ink bg-pitch px-1 py-3'",
    );
    // Keep the shirt in the spoken accessibility label, but remove its visible
    // number tile now that the portrait owns that space.
    expect(teamSheet).not.toMatchSource(
      /<Text[^>]*>\s*\{player\.shirtNumber\}\s*<\/Text>/,
    );
  });

  it('scales the portrait on whole pixels only', () => {
    const portrait = read('src/ui/components/PixelPortrait.tsx');

    // A fractional scale lands the grid off the device pixel and smears a
    // 1-bit face, so the prop is rounded before it reaches the canvas.
    expect(portrait).toContainSource(
      'const pixel = Math.max(1, Math.round(scale));',
    );
    expect(portrait).toContainSource('height={pixel}');
    expect(portrait).not.toContainSource('height={PIXEL_PORTRAIT_SCALE}');
  });

  it('shows every relevant starter stat on hover and on a selected touch card', () => {
    const screen = read('src/ui/screens/FixtureMatchDayScreen.tsx');
    const models = read('src/ui/models.ts');
    const viewModels = read('src/application/view-models.ts');

    expect(models).toContainSource('potentialGrade: PotentialGrade;');
    for (const attribute of ['PAC', 'SHO', 'PAS', 'DEF', 'TEC', 'STA', 'REF']) {
      expect(models).toContainSource(`${attribute}: number;`);
      expect(viewModels).toContainSource(
        `${attribute}: displayedAttributeValue(player, '${attribute.toLowerCase()}')`,
      );
    }
    expect(viewModels).toContainSource(
      'potentialGrade: playerGrowthGrade(player)',
    );
    expect(screen).toContainSource(
      'hoveredStarterId === player.id || (!pointer && selected)',
    );
    expect(screen).toContainSource(
      'onHoverIn={() => setHoveredStarterId(player.id)}',
    );
    expect(screen).toContainSource(
      '<StarterStatsPanel player={player} wide={wide} />',
    );
    expect(screen).toContainSource(
      "label: player.role === 'GK' ? 'REF' : 'SHO'",
    );
  });
});

describe('quick train', () => {
  it('makes each attribute box its own train button', () => {
    const screen = read('src/ui/screens/SquadTrainingScreen.tsx');
    const modal = read('src/ui/TrainingDrillModal.tsx');

    // The box names the drill it buys, so the decision is made before the tap.
    expect(screen).toContainSource(
      'statOptions?.find(candidate => candidate.shortCode === attribute.label)',
    );
    expect(screen).toContainSource('onTrainAttribute(option.pathId)');
    expect(screen).toContainSource(
      "t('squadTraining.gainAndCost', { gain: option.gain, cost: option.tpCost })",
    );
    // Both entry points propose; neither spends on the first tap.
    expect(modal).toContainSource('setPendingConfirm(option);');
    expect(modal).toContainSource('const chosen = pendingConfirm;');
    expect(modal).toContainSource('startTrainingBatch(chosen, repeatCount);');
    expect(modal).toContainSource('onTrainDrill(playerId, option.pathId);');
    // Quick Train opens straight onto that drill's confirmation.
    expect(modal).toContainSource(
      'if (quickTrainPathId === undefined) return;',
    );
  });

  it('teaches the shortcut in week 6, once', () => {
    const screen = read('src/ui/screens/SquadTrainingScreen.tsx');
    const app = read('App.tsx');
    const guide = read('src/game/assistant-guide.ts');

    expect(guide).toContainSource(
      "'quick-train-seen': 'guide:bert:quick-train-seen'",
    );
    expect(app).toContainSource('const QUICK_TRAIN_LESSON_WEEK = 6;');
    expect(app).toContainSource(
      "!hasAssistantGuideMilestone(store.career, 'quick-train-seen')",
    );
    // The Squad page keeps its ordinary opening position. The lesson guides
    // natural player selection and the scroll down to attributes, but never
    // selects or scrolls the viewport for the manager.
    expect(screen).not.toContainSource(
      'if (!guideQuickTrain || selectedPlayerId !== undefined) return;',
    );
    expect(screen).not.toContainSource('const frameAttributes = useCallback');
    expect(screen).not.toContainSource('attributesScrolledRef');
    expect(screen).toContainSource('player.id === quickTrainTargetPlayerId');
    // Desktop already shows the player file beside the roster, so only the
    // single-column layout needs the intermediate scroll instruction.
    expect(screen).toContainSource(
      '&& (quickTrainNeedsPlayer || !wideColumns)',
    );
    expect(screen).toContainSource("label={t('squadTraining.quickTrain')}");
    expect(screen).toContainSource("? t('squadTraining.tapAPlayerTo')");
    expect(screen).toContainSource(
      ": t('squadTraining.scrollDownToAttributes')",
    );
    expect(screen).toContainSource("label={t('squadTraining.tapAnAttribute')}");
    expect(screen).toContainSource(
      "detail={t('squadTraining.chooseTheStatYou')}",
    );
    // Unrelated taps cannot erase a once-per-career lesson before it is used.
    expect(screen).not.toContainSource('guideQuickTrainRef');
    expect(screen).not.toContainSource('quickTrainCueDismissed');
    expect(screen).toContainSource('guideQuickTrain={guideQuickTrain}');
    // Doing the thing retires the lesson.
    expect(screen).toContainSource('onQuickTrainShown?.();');
  });

  it('calls the attribute cue an alternative drill route in every language', () => {
    expect(
      Object.fromEntries(
        ENABLED_LOCALES.map((locale) => [
          locale,
          loadCatalog(locale).strings['squadTraining.chooseTheStatYou'],
        ]),
      ),
    ).toEqual({
      en: 'Alternative way to choose drills',
      de: 'Andere Art, Übungen auszuwählen',
      es: 'Otra forma de elegir ejercicios',
      fr: 'Autre façon de choisir les exercices',
      id: 'Cara lain memilih latihan',
      'pt-BR': 'Outra forma de escolher treinos',
      vi: 'Cách khác để chọn bài tập',
    });
  });
});
