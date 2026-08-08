---
title: "fix: Complete targeted career events in the game and Dev Harness"
type: fix
date: 2026-08-08
status: approved-for-implementation
supersedes: "The Phase 6 UI-complete claim in docs/superpowers/plans/2026-08-07-targeted-story-interruptions-plan.md"
---

# Complete targeted career events in the game and Dev Harness

## Outcome

Finish the targeted career-event feature end to end. The real game must let the manager
select the required player, coach, or facility, understand the possible benefit and risk,
see what actually happened, and continue a two-part story with the exact same target. The
visible Dev Harness must make all 54 events and the new interaction shapes easy to find and
must drive the same resolution rules as production.

This is a completion repair, not an event-engine rewrite. The catalog, save fields, domain
effect functions, and most view-model data already exist. The missing production UI wiring
and the stale visible Harness are why the feature looks absent.

## Observable success

- All 54 shipped career events remain reachable in the visible Dev Harness.
- The Harness has explicit, bookmarkable lanes for all events, player targets, coach
  targets, facility targets, and two-part stories while preserving every existing category
  deep link.
- In the real game, all 21 player-targeted, 9 coach-targeted, and 6 facility-targeted events
  can select only a valid target and can resolve without a hidden error.
- The goalkeeper-only event lists only goalkeepers; a specialty swap cannot target a coach
  who already owns that specialty; assistant-specific copy targets the assistant.
- Safe, risky-success, and risky-miss results truthfully describe the durable player,
  coach, facility, squad, money, TP, fan, and flag changes that landed.
- Player, coach, and facility sequels inherit and lock the exact original target. Part two
  is offered or kept only while that target remains in the shared legal candidate set;
  missing **or present-but-illegal** targets skip part two rather than being recast.
- Save/load preserves selected and locked targets, the resolved outcome, and every applied
  effect without rerolling or paying twice.
- The production store, visible Dev Harness, and headless long-career audit all call the
  same pure career-event resolver. No Harness keeps a private effect-mapping copy.

## Verified current state

| Surface | Current state | Practical effect |
|---|---|---|
| Catalog | 54 events: 21 player-targeted, 9 coach-targeted, 6 facility-targeted, 6 chain openers | The new content exists |
| Domain layer | Player/coach/facility selectors and permanent-effect functions exist in `src/game/career-events.ts` | Most low-level mechanics are already built |
| Production resolver | `src/application/store.ts::resolveContentEvent` guards and applies all three target kinds | Correct effects exist, but the resolver is private |
| Production screen | `StoryEventScreen` accepts and renders only player selection; choice gating checks only `needsPlayer` | Coach/facility cards can be offered but cannot be answered |
| App/store wiring | Only `selectEventPlayer` is exposed and passed from `App.tsx` | No production path can select a coach or facility |
| Target candidates | Facility filtering exists; goalkeeper and coach-specialty filtering do not | Invalid targets can be shown or selected |
| Outcome copy | New player effects are partly covered; coach/facility effects are omitted and targeted morale says “squad morale” | Benefits and risks can land without being explained |
| Chain carry | The store carries all three ids, but a missing carried target opens part two unlocked | A story can silently change subject between chapters |
| Persistence | Coach/facility fields survive only through Zod `.passthrough()` | They are preserved but not validated as save contracts |
| Visible Dev Harness | Category-only menu, “fifty” copy, player-only picker, no staff/facilities, copied legacy resolver, no target carry | It hides the new shapes and can show false results |
| Headless audit Harness | Separate from the visible Harness and already broader, but still owns resolution/target-selection logic | It can drift again and currently ignores the GK picker rule |
| Existing tests | Relevant suites pass while allowing coach/facility events to count as “blocked” | Green tests do not prove the feature works |

The original implementation plan marks Phase 6 as built, but commit `36d69ab1` did not
modify `StoryEventScreen.tsx`. Its Phase 9 referred to the headless long-career audit, not
the browser Dev Harness shown by the user.

## Provenance and dirty-work boundary

The current checkout is `codex/rival-hero-intros`, with unrelated uncommitted work in
`App.tsx`, `src/application/store.ts`, store tests, all seven locale files, the Dev Harness
registry, and other files. Its `HEAD`, `origin/main`, and merge base were all verified as
`b46a841de19deb509f33c2c5d805cd8bb4b014d1` before planning.

This was rechecked after Grok's first audit: the live checkout held 20 tracked modifications
and 18 untracked paths (including this plan). Grok's named-file evidence pack did not include
those working-tree changes and incorrectly described the tree as clean; the live Git evidence
is authoritative, so isolation remains mandatory.

Implementation must occur only after the Grok gate, in an isolated worktree created from
that exact `origin/main` SHA with the repository's required worktree-manager script. Do not
edit, stage, clean, stash, commit, or overwrite the rival-intro checkout. Do not commit,
push, open a PR, deploy, or publish this repair unless Joe asks separately.

## Locked scope decisions

- Preserve all 54 current events and their authored odds, rewards, trigger windows, rarity,
  art, and wording except for a genuinely incorrect target constraint or player-facing UI
  description required by this repair.
- Preserve the post-build narrowing of `volunteer-work-party` and `the-plaque` to the five
  training-building types. The older v6 spec's “any building” dispatch was not what shipped;
  restoring it would be a content/balance redesign, not a picker repair. Document the
  divergence rather than silently claiming the old wording is current.
- Encode the one event whose prose explicitly names a role,
  `assistant-takes-the-week`, as assistant-only. Other coach events continue to offer every
  employed, otherwise eligible coach; `back-one-drill` still requires both roles employed
  but asks the manager which one to back.
- Keep the same deterministic roll inputs and risky-choice counter. Harness steering may
  search for a real counter value, but may not force an outcome after the roll.
- Keep `src/game/` and the new shared flow pure and headless. No React, Expo, Skia,
  `Math.random`, or `Date.now` enters the event rules.
- No match-simulation change and no `ENGINE_VERSION` bump.
- No new screen, currency, dependency, event art, sound, haptic, or event-category enum.
- Reuse the existing reward art. New coach/facility result rows may use the existing
  progression/stat visual rather than creating artwork.

## Design

### 1. One target-candidate authority

Add `src/application/career-event-targets.ts`, a pure helper that receives a `GameState`
and a validated event and returns the legal player ids, coach roles, and facility ids.
Use it from offer eligibility, view-model construction, store selection, resolution
validation, and both Harnesses.

Rules:

- players belong to the user club and match `requiresPlayerRole` when present;
- coaches are currently employed, match `requiresCoachRole` when present, and are excluded
  if they already hold the specialty an outcome would add;
- `requiresBothCoaches` remains an offer-time prerequisite;
- facilities have an allowed type and are operational;
- a targeted event with no legal candidate does not enter the random deck;
- an invalid id/role supplied outside the UI is rejected before resolution, so the screen
  is not the only safety boundary.

Specialty filtering is deliberately **event-wide**, because the target is selected before
the manager selects a choice. If any authored outcome anywhere in the event carries
`coachSpecialty: S`, a coach who already holds `S` is ineligible for that event, including
its safe choice. Offer eligibility, picker options, store selection, resolution validation,
the visible Harness, and the headless audit all use that same rule. Content tests pin the
one-specialty-per-event assumption so this cannot become ambiguous if choices diverge later.

Pending-event reconciliation is mandatory, not merely a defensive screen state. Its order
is part of the contract:

1. Resolve the current event and remove target fields that do not belong to its target kind.
2. If the result is already resolved, preserve it for the result/continue screen. On
   Continue, offer its authored part two only if the exact carried target is still in the
   follow-up's shared legal candidate set; missing or present-but-illegal both skip with no
   follow-up effects, even when alternatives exist.
3. For an unresolved event, classify **carried-only first** from the validated incoming
   `nextEventId` graph plus `milestone-hat-trick`, before considering any unlocked re-pick.
   If its inherited target is legal, force the matching lock back on. If it is absent or
   illegal, dismiss/skip the card with no effects even when alternatives exist. Return from
   reconciliation here; a carried-only event never reaches unlocked re-pick logic.
4. For any other unresolved card whose saved lock is true, preserve it only while its target
   is legal; otherwise dismiss/skip with no effects even when alternatives exist. Never
   unlock and recast a locked card.
5. Only for an ordinary unresolved **unlocked** card: keep a legal selection; clear an
   illegal selection and let the manager choose again when legal candidates remain; or
   dismiss with no effects when the legal candidate set is empty.

Put this in one shared pending-target reconciliation helper. Run it from the existing
`reconcileLoadedCareer` path, every restore path, every store transition that is about to set
`screen: 'event'`, and `chooseEvent` immediately before resolution. A transition sets the
event screen only if reconciliation leaves a pending event. If a pre-resolve check clears an
illegal unlocked selection while other candidates remain, apply no effects, persist the
cleared selection, keep the event open, and tell the manager to choose again. If it finds
zero candidates, apply no effects, dismiss the event, persist that state, and resume the
normal phase.

The shared resolver still rejects an invalid target when called directly, so a bypass cannot
apply an effect to the wrong subject. The production store catches that specific rejection,
runs the same reconciliation, and never leaves the rejected state as the only way forward.
As a final fail-soft, the UI's empty state includes a localized “Return to the office” action
backed by `skipUnavailableEvent`; the store action rechecks that the candidate set is truly
empty before dismissing, so it cannot be used to skip a valid event.

Add the optional typed `requiresCoachRole: 'HEAD' | 'ASSISTANT'` trigger in
`src/content/schemas.ts` and set it only on `assistant-takes-the-week`. Add content-gate
coverage so future role-specific prose cannot silently target the wrong staff slot.
Build the carried-only event set from the validated incoming `nextEventId` graph rather than
maintaining a second handwritten sequel list; keep the existing target-kind-match gate, and
add the one explicit carried milestone id whose source is the milestone queue instead of an
event outcome.

### 2. One pure resolution and continuation path

Extract the current private production resolver into
`src/application/career-event-flow.ts`. It accepts state, validated content, choice id, and
copy function; it retains the exact production roll stream, counter updates, effect caps,
cash ledger behavior, milestone handling, and persisted presentation fields.

The module also owns a pure resolved-event continuation helper. It dismisses the opener,
checks the authored follow-up, carries the selected target, and offers part two only when
the exact target is still valid. It returns enough information for the store to choose the
next screen without putting navigation or persistence into the pure module.

Call this module from:

- `src/application/store.ts` for the real game;
- the visible career-events Dev Harness after it finds a real risky-counter value;
- `src/audit/club-business-long-career-harness.ts` for headless career simulation.

This deliberately replaces both Harness mirrors. The current browser copy ignores effect
types used by 42 of 54 events; keeping three copies would preserve the root cause.

### 3. One production target-picker interaction

Extend `StoryEventScreenProps` with exact-id callbacks for coach and facility selection.
Use one local picker discriminator (`player | coach | facility | null`) so opening one list
closes the others, and reset it when the event id or resolved state changes.

The existing player card stays visually authoritative. Coach and facility cards follow its
interaction and accessibility pattern:

- selected, unlocked target: button that opens/closes its eligible list;
- selected, locked target: visible read-only card with “chosen earlier” wording;
- unresolved required target: dashed choose card;
- choices: disabled, visually disabled, and accessibility-disabled until every required
  target is valid;
- every row: static minimum touch height, selected state, descriptive label, and exact-id
  callback;
- defensive empty state: explain that no eligible target is available, keep choices
  disabled, and expose the guarded “Return to the office” action above; normal
  offer/reconciliation rules should make this unreachable, but rendering it cannot soft-lock.

Coach details: name, role, level, both specialty labels, total training contribution,
weekly TP, Motivator contribution, and every earned boost including Motivator.

Facility details: name, level, operational status, current production effect, and every
non-zero durable event bonus phrased as the output it changes.

### 4. Truthful pre-choice and result copy

Complete `eventRewardItems` and the consequence-hint path for:

- targeted player morale versus squad morale;
- injury healing, session-based attributes, loyalty, condition, and fame;
- every coach boost facet and specialty replacement;
- every facility TP, training, recovery, and income bonus.

Positive rows state the gain. Negative rows describe the setback (“training output fell
5%”, “two weeks out”) rather than claiming “No bonus earned.” “No bonus” remains only for
an authored miss that truly changes nothing. Resolve the selected target from state where
the effect's meaning depends on the target type.

Add only the required UI, result, empty-state, and accessibility keys to all seven locale
catalogs. Event prose remains under its existing English-fallback policy.

### 5. A discoverable, honest visible Harness

Keep existing category case ids and add stable cases:

- `all` — all 54 in authored order;
- `target-player` — all 21, including the GK-only card;
- `target-coach` — all 9, including head/assistant and specialty filtering;
- `target-facility` — all 6, spanning TP, training, recovery, and income buildings;
- `two-part` — all 6 chain openers, including player, coach, facility, and untargeted carry.

Derive counts and notes from the catalog; remove every hard-coded “fifty.” Preserve current
category URLs and update the entry summary to make the new lanes obvious in the menu.

Move testable Harness logic to a React-free module as required by the Harness contract.
Derive QA states from the real seeded career, then add the smallest valid deterministic
staff/facility setup through existing domain constructors/helpers. The fixture must contain
both coach roles and operational representatives of every facility effect family, and tests
must prove each event has at least one legal target.

Pass the id/role clicked by `StoryEventScreen` directly to the real selectors. Do not cycle
to a different candidate. To show risky success or miss, search only
`eventClock.riskyChoices`, place that real persisted count on the state, then call the shared
production resolver. Safe choices ignore the steering control.

“Outcome exists” means an authored risky choice has that indexed outcome with positive
weight; it does not mean the search happened to find it. Search candidate counters in
ascending order from 0 through the existing `RISK_SEARCH_LIMIT` of 512 and use the first
match. If no counter produces the authored branch within that deterministic bound, return
an explicit “unreachable under the current RNG contract” error and fail the Harness test;
never hang, silently substitute an outcome, or mutate any input besides `riskyChoices`.

Use the shared continuation helper so target carry, lock, missing-or-illegal target behavior,
and untargeted chains match production. Extend the visible STATE receipt to compare what
actually landed: player morale/injury/attributes/loyalty/condition/fame, squad morale,
coach specialties and all boost facets, facility boost facets, money, TP, fans, flags, and
follow-up id.

## Implementation phases

### Phase 0 — Isolate and record the baseline

- [ ] Create the managed isolated worktree from verified `origin/main` SHA `b46a841d…`.
- [ ] Copy this reviewed plan and its Grok audit into that worktree without touching the
  rival-intro checkout.
- [ ] Record current targeted Jest results, typecheck, catalog counts, and the long-career
  probe before changing code. A passing result is baseline evidence, not proof the target
  paths work.
- [ ] Confirm the new branch/worktree has no unrelated diff.

### Phase 1 — Pin target rules and persistence with failing tests

Files:

- `src/application/career-event-targets.ts` (new)
- `src/application/event-selection.ts`
- `src/application/view-models.ts`
- `src/content/schemas.ts`
- `content/events.json`
- `src/persistence/game-state-codec.ts`
- focused tests under `src/content/__tests__`, `src/application/__tests__`,
  `src/game/__tests__`, and `src/persistence/__tests__`

Work:

- [ ] Add failing tests for GK filtering and invalid non-GK selection.
- [ ] Add failing tests for no-coach, both-coach, assistant-only, all-coaches-already-hold-
  specialty, no-operational-facility, wrong-facility-type, and under-construction cases.
- [ ] Implement the shared candidate helper and route offer/view-model/store validation
  through it.
- [ ] Explicitly parse `selectedCoachRole`, `coachLocked`, `selectedFacilityId`, and
  `facilityLocked` in the pending-event save schema, but keep these newly explicit optional
  fields fail-soft: an unknown role, empty/invalid id value, or malformed lock parses as
  absent rather than rejecting the entire save. Semantic validity against the current club
  and event is handled only after parsing by the reconciliation matrix.
- [ ] Add round trips for unselected, selected, resolved safe, risky win, risky miss, locked
  part two, and invalid/stale target recovery.
- [ ] Pin the persistence/reconciliation matrix: valid selected and locked targets round-trip
  unchanged; an unlocked illegal id is cleared; an unresolved event with no candidates is
  dismissed without effects; a locked target that is missing or illegal is skipped even
  when alternative candidates exist; a malformed/missing lock on a targeted sequel with a
  valid inherited target is re-derived and remains locked; an already-resolved result
  remains viewable but cannot chain when its carried target is missing or present-but-illegal;
  untargeted chains remain unchanged.
- [ ] Correct continuation tests so a missing or present-but-illegal player, coach, or
  facility skips the sequel even with alternatives; only an exact still-legal target carries
  and locks; untargeted chains still open.
- [ ] Add stale-save tests where a locked target is still present but illegal while another
  candidate is legal, and where a targeted sequel's malformed/missing lock is re-derived
  from the incoming content graph around the same valid inherited target. Cross malformed
  or absent lock with an illegal inherited target plus alternatives, and with a fully absent
  inherited target, proving carried-only classification runs before unlocked re-pick.

Phase 1 is green when invalid targets cannot enter, be selected, resolve, or survive load as
a dead locked card, while valid old saves still parse unchanged.

### Phase 2 — Share the production event flow

Files:

- `src/application/career-event-flow.ts` (new)
- `src/application/store.ts`
- `src/audit/club-business-long-career-harness.ts`
- `src/ui/dev-harness/entries/career-events-controller.ts` (new React-free logic)
- focused resolver, store, audit, and Harness tests

Work:

- [ ] Characterize the current production resolver with deterministic snapshots for each
  effect family before moving it.
- [ ] Extract resolution and continuation without changing RNG inputs or outcome order.
- [ ] Replace the store's private resolver and both Harness copies with the shared path.
- [ ] Make the headless audit select through the shared candidate rules, including GK-only.
- [ ] Prove identical seed + state + selected target + choice + risky counter produces an
  identical serialized state before/after extraction.
- [ ] Prove a reload cannot reroll or double-apply any target effect.

Phase 2 is green when there is one effect mapping and one follow-up path in the repository,
and the pre-change deterministic fixtures remain byte-identical.

### Phase 3 — Wire and render the real game

Files:

- `src/application/store.ts`
- `App.tsx`
- `src/ui/screens/StoryEventScreen.tsx`
- `src/application/view-models.ts`
- `src/ui/models.ts`
- `content/i18n/en.json`, `es.json`, `pt-BR.json`, `fr.json`, `id.json`, `de.json`, `vi.json`
- relevant UI/store/i18n tests

Work:

- [ ] Add save-queuing `selectEventCoach(role)` and
  `selectEventFacility(buildingId)` store actions and pass them from `App.tsx`.
- [ ] Add guarded `skipUnavailableEvent` wiring for the otherwise-unreachable zero-candidate
  empty state; it must recheck the shared candidate set and refuse to skip a valid card.
- [ ] Add player/coach/facility picker rendering, one-picker state, locked cards, empty
  states, and combined choice gating.
- [ ] Populate missing coach Motivator earned copy, facility operational status, and
  facility earned bonuses in the view model.
- [ ] Complete hints and reward rows for every effect family and distinguish target morale
  from squad morale.
- [ ] Add all new chrome/accessibility/result keys to seven locales and run the existing
  i18n coverage/shape gates.
- [ ] Add source/component contract coverage for visual disabled state, static touch
  heights, exact callback values, read-only locks, and picker reset on event change.
- [ ] Add store coverage for every route that can enter `screen: 'event'`: desk open,
  weekly settlement, restore/resume, and authored continuation. Each route reconciles first
  and falls back to the normal phase when no pending event survives.
- [ ] Prove a rejected invalid-target resolve applies no effects, then either clears the
  selection for a valid re-pick or dismisses a zero-candidate event; prove the guarded empty-
  state action refuses to skip an event that still has a legal candidate.

Phase 3 is green when the production screen can complete one event of every target kind,
all target information required by the approved spec is visible, and no result hides a
real penalty behind “No bonus.”

### Phase 4 — Rebuild the visible career-events Harness around production behavior

Files:

- `src/ui/dev-harness/entries/career-events.tsx`
- `src/ui/dev-harness/entries/career-events-controller.ts`
- `src/ui/dev-harness/entries/__tests__/career-events.test.ts`
- `src/ui/dev-harness/registry.ts` only if its displayed metadata requires an update

Work:

- [ ] Add the five interaction lanes while preserving category cases and deep links.
- [ ] Build and assert the deterministic QA-ready target fixture.
- [ ] Wire exact player id, coach role, and facility id callbacks.
- [ ] Keep real success/miss steering, but hand final resolution to the shared production
  function.
- [ ] Keep the search deterministic and bounded to counters 0…512, define branch existence
  from positive authored weight, and fail explicitly if an authored branch is unreachable
  under that bound.
- [ ] Hand continuation to the shared production function so all target locks are real.
- [ ] Expand the STATE receipt for every durable effect family.
- [ ] Replace permissive “blocked is acceptable” assertions with proof that all 54 events
  resolve safe, risky-success, and risky-miss whenever those outcomes exist.
- [ ] Assert all 54 are reachable through category cases and through `all`; every targeted
  event appears in its interaction lane; every chain opener appears in `two-part`.

Phase 4 is green when the visible Harness is a truthful review surface for the shipped game,
not a second event engine.

### Phase 5 — Regression, live QA, and documentation

Docs:

- `docs/07-events.md` — 54-event count, target triggers, target/chain behavior, and visible
  Harness lanes;
- `README.md` — concise decision-log correction and current Harness discovery note;
- `docs/superpowers/plans/2026-08-07-targeted-story-interruptions-plan.md` — append a
  correction that Phase 6 was partial and distinguish the headless audit from the visible
  Dev Harness;
- this plan — mark completed items and record verification evidence.

Checks, in order:

1. Focused target/content/persistence/resolver/store/Harness Jest suites.
2. `npx tsc --noEmit`.
3. Seven-locale i18n gates.
4. Full `npx jest`.
5. `npm run test:probe -- src/audit/__tests__/club-business-long-career-probe.test.ts`,
   reporting baseline and after results.
6. A fresh isolated Dev Harness web build/server on an unused port. Immediately mute the
   page, then smoke exact deep links for `target-player`, `target-coach`,
   `target-facility`, and `two-part`.
7. In the browser, exercise this matrix and inspect the before/after STATE receipt:

   | Target | Safe | Risk win | Risk loss | Locked sequel | Missing/illegal target | Reload |
   |---|---:|---:|---:|---:|---:|---:|
   | Player, including GK | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
   | Coach, including assistant/specialty | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
   | Facility, across four output families | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

8. If a local simulator or connected debug phone is available without rebuilding native
   code, resolve one player, coach, and facility event by touch, check locked part two, and
   run a screen-reader/large-text pass. Otherwise mark native touch/accessibility as
   **NOT VERIFIED** rather than claiming the browser proves it.
9. Close only the preview tab/server and simulator started for this repair. Do not stop the
   user's existing Harness or another session's Metro process.

## Acceptance criteria

- [ ] Catalog counts are exactly 54 / 21 player / 9 coach / 6 facility / 6 chain openers.
- [ ] Existing category bookmarks still resolve; the five new interaction bookmarks cold
  load directly.
- [ ] Every target picker shows only legal candidates and the mutation layer rejects an
  illegal id even if called directly.
- [ ] The manager cannot choose while a required target is absent; disabled styling and
  accessibility state agree with actual behavior.
- [ ] Coach/facility cards show current value plus prior earned boosts; locked cards remain
  visible and cannot open.
- [ ] Pre-choice hints and result rows cover every authored effect type; real losses never
  appear as “nothing happened.”
- [ ] Exact target carries and locks into part two for player, coach, and facility only while
  it remains in the shared legal candidate set; missing or present-but-illegal skips part
  two even with alternatives; untargeted follow-ups are unchanged.
- [ ] Valid selected and locked target fields are explicitly parsed and survive save/load;
  malformed optional coach/facility target fields fail soft to absent and reach semantic
  reconciliation instead of rejecting the whole save.
- [ ] Persistence recovery is explicit: valid fields round-trip unchanged; unlocked invalid
  selections clear; unresolved zero-candidate cards dismiss without effects; locked missing-
  or-illegal targets skip even with alternatives; carried-only targeted events re-derive a
  missing/malformed lock when their inherited target remains legal; resolved outcomes remain
  viewable; untargeted chains are unchanged.
- [ ] No production load, restore, render, or resolve path can strand the manager on a
  required-target card with no legal action.
- [ ] Every store transition into `screen: 'event'` reconciles first; a direct invalid-target
  resolution applies no effects and deterministically clears/retries or dismisses, while the
  guarded empty-state action cannot skip a valid event.
- [ ] A locked present-but-illegal target is skipped rather than recast, and a valid carried
  target cannot become editable merely because its saved lock field was malformed or absent.
- [ ] One shared pure module owns event resolution and follow-up continuation; neither
  Harness duplicates effect arithmetic.
- [ ] Same inputs produce byte-identical serialized results and safe choices do not consume
  risky RNG history.
- [ ] Focused tests, typecheck, i18n gates, full suite, and long-career probe pass.
- [ ] Browser QA covers all three target kinds and targeted part twos with the page muted.
- [ ] No unrelated rival-intro file or diff is changed, staged, committed, or overwritten.

## Risks and controls

| Risk | Control |
|---|---|
| Moving the resolver accidentally changes RNG consumption | Characterization fixtures and byte-identical serialization before UI work |
| Shared application imports create an architecture cycle | Keep target/flow modules pure; dependency direction is content/game → application consumers; `src/game` imports no application code |
| A Harness-only rich fixture proves an impossible production state | Derive from a real seeded career, use domain constructors, validate candidate eligibility, and separately run a real-game flow |
| Existing deep links break when cases change | Keep category ids unchanged and add, never rename, interaction ids |
| Locale work obscures functional failures | Land English keys with focused UI tests, then complete the same key set across all seven catalogs and run gates |
| Target vanishes or becomes illegal in a stale save | Reconcile unlocked invalid selections; skip any missing/illegal locked target even if alternatives exist; re-derive carried locks from authored follow-up semantics; keep a guarded UI escape |
| A risky branch cannot be found by Harness steering | Define existence from positive authored weight, search only counters 0…512 in ascending order, and fail explicitly as an RNG-contract defect |
| Facility v6 wording is mistaken for current scope | Document that the shipped five-training-building narrowing remains intentional in this repair |
| Dirty rival-intro work is overwritten | Managed isolated worktree at the verified common SHA; no stash, clean, merge, or edits in the live checkout |

## Definition of done

The feature is done when a player can encounter and complete every targeted event in the
actual game, the Dev Harness clearly exposes and truthfully resolves the same events, every
part two preserves its subject, all durable changes are visible and survive reload, and the
full verification record is green or explicitly marks unavailable native QA as not
verified. A passing test suite without those live paths is not sufficient.
