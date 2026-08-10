---
title: "fix: Make Financial Report amounts usable with PWA screen readers"
type: fix
date: 2026-08-09
audit: AUD-019
---

# Fix Financial Report web accessibility

## Overview

The PWA Financial Report exposes the invisible sizing text and every `0–9`
digit in each animated reel to browser accessibility trees. A screen reader
therefore announces a row amount, repeats the sizing amount, and then reads the
reel tracks as long digit sequences. The report is difficult to understand and
use on web.

The fix will keep the slot-reel animation visual, hide every visual amount layer
from the web accessibility tree, and expose exactly one stable semantic final
amount for each row. The existing native VoiceOver path will remain unchanged
until it is verified on an iPhone.

## Evidence

- `src/ui/components/FinancialStatement.tsx:170` uses the statement as a tap
  target and supplies row-level React Native accessibility labels.
- `src/ui/components/FinancialStatement.tsx:276` sets `accessibilityRole="text"`
  on a generic React Native `View`; Chrome does not use that label reliably.
- `src/ui/components/SlotAmount.tsx:241` renders invisible sizing text and a
  visual reel containing two complete `0–9` tracks plus a closing zero.
- `importantForAccessibility` and `accessibilityElementsHidden` protect native
  accessibility, but the live PWA accessibility snapshot showed that they did
  not hide the reel descendants on React Native Web.

## Proposed solution

### 1. Give `SlotAmount` one web semantic value

- Calculate the semantic value from `finalValue`, not the animated `value`.
- On web only, render one visually hidden `Text` node containing the formatted
  final amount.
- Keep the node stable during pending, spinning, and settled phases so screen
  readers do not announce animation frames or intermediate multipliers.
- Do not add a second semantic amount at the statement-row level.

### 2. Hide every visual amount layer on web

- Add explicit web `aria-hidden={true}` to the visual amount wrapper in both
  render branches:
  - reduced-motion or pending text;
  - animated sizing text, static punctuation, and reel tracks.
- Retain `importantForAccessibility="no-hide-descendants"` and
  `accessibilityElementsHidden` on native visual wrappers.
- Keep the visible label, bonus badges, and row ordering unchanged.

### 3. Preserve a clear row reading order

- On web, let the visible row label remain ordinary semantic text, followed by
  the single hidden final amount from `SlotAmount`.
- Do not rely on `accessibilityLabel` on a generic web `View` to replace its
  descendants.
- Keep the existing composed row and net labels for native VoiceOver. This plan
  does not claim native VoiceOver is fixed or broken without device evidence.

### 4. Keep animation controls usable

- Keep tap-to-land behavior for sighted pointer and touch users.
- Use the existing named Continue button as the keyboard and screen-reader way
  to finish the statement animation; its first activation already lands all
  running reels and its second activation closes the report.
- Do not turn the entire statement into one web button because that would wrap
  the report's semantic rows inside a composite control and make reading worse.

## File changes

- `src/ui/components/SlotAmount.tsx`
  - add web-only semantic final-value output;
  - add explicit web `aria-hidden` protection to all visual amount layers;
  - retain the native accessibility properties.
- `src/ui/components/FinancialStatement.tsx`
  - make row-level accessibility composition platform-aware if required so web
    reads label then amount without duplicate labels;
  - do not change statement timing or amounts.
- `src/ui/__tests__/financial-statement-web-accessibility.test.ts`
  - add source/contract tests for exactly one semantic amount and explicit web
    hiding in both SlotAmount branches.
- Browser verification on `#/dev/financial-report/baseline`
  - inspect the Chrome accessibility tree at pending, spinning, and settled
    states;
  - confirm each line is read once and no reel digit track is present.

## Acceptance criteria

- [ ] Each Financial Report line exposes one label and one final amount on web.
- [ ] The net line exposes one label and one final amount on web.
- [ ] No hidden sizing amount appears in the PWA accessibility tree.
- [ ] No `0123456789` reel track or repeated individual reel digits appear in
      the PWA accessibility tree.
- [ ] Pending, spinning, settled, surge, and Reduce Motion states keep the same
      semantic final amount.
- [ ] The Continue button remains named and lands the active statement before
      closing it.
- [ ] Slot animation, visual layout, money signs, commas, surge styling, sound,
      and timing do not change.
- [ ] Existing native accessibility properties remain in place.
- [ ] Focused tests and `npx tsc --noEmit` pass.
- [ ] A fresh web export passes the existing PWA audit.

## Risks and mitigations

- **Duplicate amount announcements:** do not keep both a web row label that
  contains the amount and a semantic SlotAmount value. Verify the live tree.
- **Semantic text becomes visually visible:** use one tested screen-reader-only
  style and capture a screenshot at phone and tablet widths.
- **Web props alter native behavior:** gate `aria-hidden` and the semantic node
  with `Platform.OS === 'web'`; retain the native props and run typecheck.
- **Final value is announced too early:** this is intentional. Animated reel
  frames are presentation, while the saved financial result is already final.

## Non-goals

- Do not change financial calculations, statement sequencing, or reel timing.
- Do not redesign the Financial Report.
- Do not claim native VoiceOver verification without a physical-device test.
- Do not add Export Save or another persistence feature.

## Verification commands

```sh
npx jest --runInBand --runTestsByPath \
  src/ui/__tests__/financial-statement-web-accessibility.test.ts \
  src/ui/__tests__/acceptance-audit-regressions.test.ts \
  src/ui/__tests__/statement-facility-badges.test.ts
npx tsc --noEmit
npm run export:web
npm run qa:ipad
```

## Review gate

Before implementation, run the repository's read-only Grok 4.5 audit against
this plan and the two affected components. Codex must verify each Grok claim
locally. Implementation begins only after that reconciliation.
