# Bug, efficiency, and polish audit — 2026-10-30

## Scope and baseline

- Source: `370776ba`, clean `main` at audit start.
- Reviewed boundaries: boot and preferences, career/replay/backup persistence, save queues, management actions, training and gift loading, rival preloading, match controls/rendering, audio lifecycle, localization, dialogs, desktop shell, release configuration, and dependency advisories.
- Automated coverage: the ordinary Jest suites, excluding the documented balance/soak/large seed rails; TypeScript; web first-load budget; release and dependency compatibility; QA tools; audio asset levels; hidden/muted Electron check.
- UI surface: isolated headless Chromium, launched with `--mute-audio`; fresh origin `http://127.0.0.1:4187`; 900×600 desktop and phone-sized checks. The browser pane has no supported pre-navigation mute control, so the muted headless process supplies that guarantee.
- No simulation/economy tuning, supplied-art edits, physical-phone operations, OTA publication, or public deployment.
- A broad audit is bounded evidence, not a claim that every possible career or device is bug-free.

## Findings sent to Sol

| ID | Impact | Finding and proof | Status |
| --- | --- | --- | --- |
| F1 | Medium, efficiency | `src/ui/use-rival-preload.ts`: the timer fallback always reports 6 ms remaining. With the 3 ms static floor, one callback drains all work. With the 6 ms watched floor, it never runs a tick. New scheduler tests reproduce 100 bursts instead of a bounded slice, and 0 watched bursts. | Confirmed by Sol; fixed with regression coverage |
| F2 | Medium, audio/polish | `src/render/coach-speech-audio.ts`: thunder/gospel call `play()` after pending seeks without checking stop, teardown, or suspension. Starts also ignore global suspension. Four tests reproduce late playback after finish/suspend/teardown and starts while hidden. | Confirmed by Sol; fixed with regression coverage |
| F3 | Medium, save recovery | `src/persistence/career-repository.ts`: `delete()` calls the strict raw-export decoder before deletion. Invalid `schema_version` or a non-text payload prevents discarding the corrupt row. With a healthy backup, the UI refuses file-reset fallback, leaving Start Fresh ineffective; without one, fallback needlessly resets settings too. Two tests reproduce repository refusal. | Confirmed by Sol; fixed with regression coverage |
| F4 | Medium, resilience/polish | `LazyTrainingDrillModal.tsx` and `LazyPlayerGiftCelebration.tsx` cache rejected preload promises forever and export uncaught optional warmups. A transient sprite download error poisons the first actual opening. Four tests reproduce uncaught preload rejection and failure to retry. This claim concerns app-owned warmup caches, not recovery of Skia's own failed WASM initializer. | Confirmed by Sol; fixed with regression coverage |
| F5 | Dependency security | Root `npm audit` reports 20 affected packages: 5 high, 4 moderate, 11 low; desktop reports zero. Leaf advisories concern node-forge, image-size, postcss-selector-parser, uuid, Zod 3, and deepmerge. Verify compatible fixes before changes; do not force an Expo downgrade or an unchecked major override. | Confirmed by Sol; compatible fixes applied; residual toolchain advisories remain |

Reproduction receipts: `/tmp/hfm-audit-repros-before.log` (8 failed, 29 passed) and `/tmp/hfm-audit-lazy-before.log` (4 failed).

## Evidence and exclusions

- Passed before fixes: TypeScript, release preflight, Expo dependency compatibility, QA helper checks, web export, first-load budget, muted Electron checks, and all 98 referenced audio assets within level/peak limits.
- First load before fixes: 3,596,557 raw bytes; 875,218 gzip bytes. No QA bodies or Skia renderer bodies in the title bundle.
- Existing save lineage guards, preference write serialization, top-modal Escape handling, formation-aware transfer replacement, and deterministic game/sim boundaries were present. No speculative rewrites proposed.
- Final local checks and browser receipts are recorded below. Grok review and Git publication follow these checks.
- Physical-device performance, battery use, subjective audio listening, and a new native archive remain outside the evidence collected here.

## Dependency sources

- [node-forge signature validation advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv).
- [image-size parser advisory](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq).
- [PostCSS selector parser advisory](https://github.com/advisories/GHSA-rj75-hqrm-r3gf).
- [deepmerge prototype poisoning advisory](https://github.com/advisories/GHSA-gcqx-w48m-w2h4).

Registry and advisory checks are dated to this audit. Sol checked the official node-forge changelog and published RSA implementation. Version 1.4.1 fixes the signature issue; 1.4.2 also repairs Buffer compatibility. The older advisory page metadata was stale.

## Sol verification and implementation

Sol independently reproduced F1–F4: 12 failing tests and 29 passing tests. It also exercised real SQLite column constraints and verified dependency manifests. No production code was changed before that review.

- F1: use a real elapsed budget capped at 6 ms. A timeout owes one eight-tick burst, even during a watched match. Native idle cancellation remains covered. This bounds scheduler work; it is not a physical-device FPS measurement.
- F2: thunder and gospel now invalidate pending seeks on stop, finish, teardown, and newer starts. All speech checks global suspension before playback. Sol found the same start-after-suspension gap in Bert voice; that sibling path now checks before start and after seek. Positive playback tests prevent a silent-everywhere false fix.
- F3: discard reads raw SQLite columns without applying the export decoder. It extracts a readable career seed when possible, then removes live save, backup, and their known replays in one transaction. Preferences and unrelated replays remain. Genuine read errors still abort. Regression rows now use SQLite-storable schema 0, text schema, and blob payloads.
- F4: rejected app-owned warmup promises are cleared. Optional warmups handle failure; the actual lazy loader still reports errors. Successful concurrent requests share one load. Recovery is proven for failed warmup before first opening; it does not reset React.lazy after an actual rendered rejection or Skia's own failed initializer.
- F5: lockfile updates node-forge to 1.4.2, postcss-selector-parser to 6.1.5, Expo config-plugins to 57.0.11 with its supported xcode 4 migration, and the Metro family to 0.84.5. Metro is deduplicated with Expo's already-pinned version; image-size and uuid 7 are removed. No package manifest override or native dependency version changed. Expo CLI Zod 3 and deepmerge have no supported patched versions established; they remain explicit toolchain limitations.

The Metro family required rebuilding only its lockfile records in an isolated temporary directory, because npm update retained the cyclic exact-version records. The generated lock was inspected and then installed normally. The lockfile is an intentional dependency byproduct; exported web files remain ignored.

Initial fix checks: 58 focused tests passed. The first TypeScript pass found a test mock's DOM type intersection; the mock type was corrected. Final local checks and Grok reconciliation are recorded below. Git publication is reported separately after remote verification.

## Final local verification

- Corrected broad Jest selection: **505 suites, 4,910 tests, 3 snapshots passed** in 206.641 seconds. It excludes audit probes, balance and soak suites, plus the documented large seed/render rails. The initial broad filter mistakenly included the mini balance suite; it passed before that run was stopped and the filter corrected. No balance tuning or engine-version change was made.
- TypeScript and the full formatting check passed. Expo native-config introspection also passed with the correct bundle ID, update project, and fingerprint policy; this is not a native build. Release preflight, Expo compatibility, QA helper validation, final normal web export, and hidden/muted Electron checks passed. The audio asset files are unchanged; the earlier 98-asset level check passed.
- Final title budget: 3,597,075 raw bytes and 875,477 gzip bytes, below 3,600,000 / 880,000 limits. No QA or Skia renderer bodies entered the title bundle.
- Fresh root dependency audit: **14 affected packages: 3 high, 11 low**, down from 20. These propagate from the remaining Expo CLI Zod 3 and deepmerge advisories. Desktop audit: **zero**. This is not a security-clean claim. The root application uses patched Zod 4; unsafe cross-major toolchain overrides were not applied.

Browser receipts use headless Chromium with process-level `--mute-audio`. The normal build ran at 390×844 after the initial 900×600 title/settings checks.

- Created and resumed an isolated career: seed 382086235, Season 1, Week 1. No completed fixtures or season progress are claimed.
- Opened the real training controls, ran Sprints 1, and saw +3 PAC. TP decreased from 12 to 5. The normal lazy drill surface loaded and the save persisted.
- Gave Audit Rook a gift through the real Player File button. The celebration rendered, funds fell from 53,000 to 52,388, and morale rose by 20. The checkpoint validator accepted all ten teams and engine m2.9.
- Cycled English, Spanish, Brazilian Portuguese, French, Indonesian, German, and Vietnamese title screens. Every catalog rendered, with no page-level horizontal overflow or application error. This is title-screen coverage, not an all-screen translation audit.
- Rendered the real coach speech cutscene in the isolated developer harness and observed normal completion. Audio cancellation and suspension behavior is proven by player-state tests, without audible playback.
- Applied synthetic schema-0 corruption only to this test career, with its checkpoint saved first. The real recovery screen offered the healthy backup. Its two-tap Start Fresh flow returned to the title; SQL inspection found zero live rows, zero backup rows, and byte-identical preferences. The first inspection connection reused Expo's cached handle and caused a test-induced SQLite error 21 after closing it. A fresh reload and an explicitly separate inspection connection removed that test artifact; the actual recovery flow then passed.

Receipts: `/tmp/hfm-audit-tests-after-filtered.log`, `/tmp/hfm-audit-languages.json`, `/tmp/hfm-audit-after-gift.json`, `/tmp/hfm-audit-checkpoint-validation.log`, and `/tmp/hfm-audit-corrupt-save-recovery.json`. Screenshots: `/tmp/hfm-audit-training-after.png`, `/tmp/hfm-audit-gift-after.png`, `/tmp/hfm-audit-speech-playing.png`. Temporary receipts are local evidence, not committed game assets.

## Grok review and reconciliation

Grok 4.6 completed one read-only review at xhigh. It found one medium issue: pressing Export on a row rejected by the raw decoder set the discard gate permanently, so Start Fresh stayed blocked until another boot attempt. It found no further proven defect in scheduler bounds, speech cancellation/suspension, lazy warmup recovery, or the dependency updates.

Confirmed locally: three realistic malformed-row tests failed before the follow-up fix. The store now releases the discard gate when the raw reader raises CorruptCareerSaveError. Unlike moving the gate after the awaited read, this preserves protection while a readable export is still pending. A failed share still blocks deletion, and a previous successful export remains valid.

Follow-up validation: ten focused store recovery tests passed, including the three reproductions, the pending-read guard, failed-share protection, and successful-export retries. TypeScript, normal web export, first-load budget, and muted Electron checks passed again. The final commit gate repeats the broad non-balance selection plus these focused store recovery tests. No second Grok run was requested or performed.

The rebuilt browser flow also passed: a synthetic malformed live row plus healthy backup was exported unsuccessfully, then discarded through the two visible confirmation taps. The title returned, both save generations were absent, and preferences were unchanged. Receipt: `/tmp/hfm-audit-export-then-delete-ui.json`. All test pages were blanked and closed, and only this audit's servers were stopped.

The browser check also caught obsolete export-error copy claiming deletion always stayed blocked. The seven catalogs now state only that export failed and the save is unchanged; the existing unfinished-export message still explains actual blocked deletion.

After the copy correction, all 38 catalog/resolver/gate checks, the normal export, title budget, and muted Electron check passed. Final cleanup found no Hero Football Manager listener; no physical device or simulator was used. All changed files belong to this audit, and main is the only local branch.
