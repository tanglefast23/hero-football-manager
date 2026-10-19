# Approved balance and design changes

Items 1–4 are implemented. Item 5's bounded initial study is complete. Commercial income and Cup catch-up values are unchanged.

## The Week 19 cost was not capped

The previous Week 19 trip set the TP bank to zero. Its cost was the whole bank. Green Bull's one-week figure is a minimum requirement, not a cap; Green Bull still spends the whole bank and cash.

The approved Week 19 rule charges `min(bank, weeklyAmbientTrainingPoints(state))`. With 200 TP saved and 24 TP weekly income, acceptance leaves 176 TP. A bank of 10 pays 10. An empty bank pays zero. The D5/D4 reward, 10-condition cost, decline option and management decision gate remain unchanged.

The muted browser fixture started with 200 TP and 10 TP weekly income. It quoted 10 TP, kept 190 TP, accepted the trip and returned Home with 190 TP. [Preview](trip-preview-proof.json), [accepted result](trip-accepted-proof.json), [image](trip-preview.png). Tests also cover smaller banks, zero, repeated acceptance, player gains and unchanged Green Bull spending.

This preserves savings; it does not retune the large squad reward. A 16-player fixture receives 112 raw stat points in D5 or 224 in D4. Many are role-irrelevant. Those totals are not match-strength or win estimates. [Value comparison](trip-value.json).

## Scout dates and Cup results

Scout options show the absolute return season/week and whether a valid signing window remains before report expiry. Preview and purchase share the mission proposal; browsing spends no IDs or RNG. Report expiry stays unchanged.

The browser showed a Season 2 Week 19 return before payment. Confirmation repeated that date and warned that no usable window remained. Accepting sent `scout-1` with the same date and charged $4,750. [Warning](scout-warning-proof.json), [purchased mission](scout-purchased-proof.json). Tests cover all 110 unlocked option combinations and W4/W5, W18/W19 and season boundaries.

Rival-only Cup ties show advancement and the winner instead of presenting their abstract 1–0 score as played goals. The user's played score remains. [Browser proof](cup-winners-proof.json). Existing Cup data is unchanged.

## Training tiers

Buying a higher tier preserves every cheaper tier on that path. The confirmation card shows the selected tier's TP, ordinary gain, condition and affordable count. SUPER remains a separate chance. Tier 4's TP efficiency and Tier 5's gain per action/condition remain unchanged.

With Tier 4 finishing owned and only 11 TP, the browser opened Tier 2. It quoted 11 TP, +5 base plus +1 youth and condition 100→92. Choosing Tier 4 showed insufficient TP. Tier 2 ran and left zero TP and 92 condition. Shooting rose 17→26 because this seeded drill rolled SUPER. [Preview](training-tier-preview-proof.json), [result](training-tier-result-proof.json), [phone-sized image](training-tier-picker.png).

Two Tier 2 runs quoted 22 TP and condition 100→84. Both ran, leaving 8 of 30 TP and 84 condition. [Repeat preview](training-tier-repeat-preview-proof.json), [result](training-tier-repeat-result-proof.json). Vietnamese labels and costs also rendered without raw translation keys. [Proof](training-tier-vietnamese-proof.json).

The lead fixed integration issues found during verification: lower tiers must open when the owned tier is unaffordable; plural copy needs `n`; radio buttons need `checked`; the narrow tier group must wrap into two columns.

## Saved skill-based shootouts

User Cup draws resolve from the players and keeper on the pitch at full time, with live condition. Opening team attributes retain the match's Cup lift and morale/form once. Active powers, Heat and the temporary half-time speech boost are excluded. Takers follow effective shooting order, keeper last, with equal-sized lists and no repeats until everyone has kicked.

The resolver uses a dedicated seed, best-of-five early stops and paired sudden death. Kicks, tally and winner are saved on the Cup fixture. Quick and watched settlement use this result; the animation and bracket read it. Old fixtures keep their winner without an invented tally. Legacy non-production callers without full-time squads retain their old rule and record no kicks.

The muted browser rendered a real resolver sequence from a synthetic full-time roster, then completed it. This was presentation verification, not a played career match. [Presentation proof](penalty-presentation-proof.json), [image](penalty-presentation.png), [completion](penalty-completed-proof.json). Store and codec tests verify both production paths and reload.

In 10,000 pure shootout seeds, equal sides won 49.75% with 75.01% kick conversion. A side with shooting and reflexes 200 against 100 won 90.05%. This confirms that the change strongly rewards a stronger squad in a drawn tie. It does not estimate regulation Cup difficulty. [Calibration](penalty-calibration.json).

The match engine stays m2.9 and save schema stays 6. The new Cup field is optional. Regulation replay behavior and RNG are unchanged.

## Commercial and Cup measurements

Sixteen production Quick careers ran for three seasons. They used two seeds, Cozy/Chairman, balanced/stack investment and Green Bull use/non-use policies. The probe passed. Each arm played 54 league fixtures. The careers played D5 and D4; none played a D3 season. [Full study](measurement-report.md), [commercial receipt](commercial-income.json), [Cup receipt](cup-catchup.json).

Green Bull had zero offers, so use/non-use outcomes duplicate each other. Across four distinct seed/difficulty pairs, stack cash was higher once, lower once and tied twice. No Shop was built. Only two arms built a second Stand. This does not test mature commercial dominance or justify an income cut.

All 48 Week 19 decisions were accepted. They charged 42–44 TP and preserved 190–1,014 TP compared with the former whole-bank rule. The original cost was recorded, not charged.

The Cup study recorded 52 trials, including paired gaps of 10, 20 and 40. The lift narrowed winning margins but did not change the paired regulation winners. These were scaled opening opponents, with two distinct fixture seeds. They were not late-career Semi-finalists. The 96 career Cup matches reached only Play-in and Round of 32, so they supplied no late-round lift sample.

The recommendation is no numerical change: keep commercial bonuses and SF 25% / Final 50% catch-up. A longer late-career cohort is needed before proposing tuning. No income, catch-up or Green Bull price change was applied.

The [raw commercial receipt](commercial-income.raw.json) is preserved. The normalized file corrects 48 metric labels from `cashPerStarterFee` to `cashPerStarterValuation`. This is a valuation proxy, not an offered fee. No numeric value changed. [Validation](measurement-validation.json).

## Green Bull cash capacity

The 16 three-season career arms reached D4 but did not play a D3 season. They supplied no late Green Bull spending sample. A separate production-action check used a copy of the real Season 6 closing checkpoint. It supplied controlled future training opportunities, with no matches or settlements. The source checkpoint's bytes remained unchanged.

The first purchase spent $50,000 and drained all 116 controlled TP. The 17-player squad gained 238 stored stat points. This is a raw stat total, not a win estimate. The unchanged cost ladder could spend $1,925,000 on 11 purchases from the closing $2,101,097, leaving $176,097. This cash-capacity check excludes future income and every other bill. It does not claim that 11 trips are an optimal strategy or that a real season would follow that cash path. [Receipt](green-bull-sink.json).

The check first failed because the probe imported the weekly TP function from the wrong module. That setup error was corrected. The production-action check then passed.

## Verification surface and limits

The browser pane used a separate temporary QA export and isolated origin on port 52307. It remained muted. Phone layout used 390×844; the trip image used 900×600. These are browser components, not physical iPhone or Steam playthrough claims. No existing career save or six-season run result was changed.

The normal web export passed. The hidden, muted Electron check returned `ok: true`, with `hfm:` protocol, isolation, rendering, window fit and music range checks. Release preflight found no QA flags. The QA page was replaced with `about:blank`, the tab closed and the Python server on port 52307 stopped. Joe's phone Metro was untouched.

The full run passed 525 suites and found three stale source-contract assertions in two suites. The assertions still named the old training calls. After updating them for the chosen tier, both suites passed all 25 tests. The measurement seed-identity guard also passed. Combined results now cover 527 passing suites and 5,090 passing tests, with one suite/test skipped and no unresolved failure. This combines the full run and focused reruns; it is not a second clean full-suite run. [Core verification receipt](verification-core.json).

The final focused run passed 38 suites and 365 tests. The final TypeScript and scoped formatting checks passed. The completed full run and focused checks were reused for Git finalization; the finalizer did not rerun the full suite.

TypeScript, normal web export, first-load size budgets, desktop check and release preflight passed. The initial web payload was 846,515 gzip bytes against an 880,000-byte budget, with no QA or Skia body markers.

Independent implementation and receipt review: [reviewer decisions](reviewer-decisions.md). No Vercel, EAS, App Store or Steam publication is part of this change.
