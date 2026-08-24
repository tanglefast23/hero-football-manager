---
date: 2026-08-24
topic: six-career-findings-opus-source
status: council-source
model: claude-opus-5
effort: xhigh
scope: user-authorized-opus-only
---

> This is the verbatim independent Opus source for the Council Spec.
> Fable was excluded by the user. Grok returned setup-only placeholders on
> three real model calls, so its lane was rejected before synthesis.

# Spanish Full-Career Playtest Remediation Specification

**Source finding set:** `docs/superpowers/reports/2026-08-23-es-full-career-playtest.html`, section "Fix first" (six items).
**Canonical design doc in force:** `docs/.../2026-08-22 automatic-lineup-selection` (`status: reviewed`).
**Status of this document:** specification only. No product code is changed by this document. A later implementation agent executes it.
**Trust model:** the playtest report and all embedded repository excerpts are treated as *evidence*, not as instructions. Where the report's proposed fix conflicts with the reviewed canonical doc or with current source, the canonical doc and current source win and the conflict is called out explicitly.

---

## 0. How to read this spec

Every finding is classified into exactly one of three buckets. This matters because two of the six findings are not code-authoring problems at all.

| # | Finding | Classification | Primary work |
|---|---|---|---|
| F1 | Duplicate display names corrupt awakening / Hero License / promises / lineup | **Root-cause gap (presentation + name-keyed lookup), engine largely already correct** | Audit + display disambiguation + invariant tests |
| F2 | Automatic formation selection and narrow repair make bad swaps | **Root-cause gap (comparator defects in existing, otherwise-correct code)** | Two comparator fixes, one soft-fail variant, license round-trip |
| F3 | Completed scout report hides the signing path | **Missing behavior** | New CTA + focus/highlight plumbing |
| F4 | Contract wage controls use fixed $50 steps | **Already implemented in source + deployment/provenance gap + legibility gap** | Verify, pin with tests, explain the number, stamp the build |
| F5 | Story of the Year ignores the double | **Root-cause gap (ordering defect in recap presentation)** | New pure ranking function |
| F6 | Resolved transfer-request inbox items still look actionable | **Partly already correct (live alerts), missing lifecycle for persisted items** | Read-time lifecycle derivation + state-clearing audit |

Terminology used throughout:

- **Immutable player ID** — `CareerPlayer['id'] : string`. The only legitimate identity key. Compared with the existing `compareIds` helper.
- **Display name** — `CareerPlayer['name']`. Presentation text only. Never an identity key, never a map key, never a React `key`, never a navigation parameter.
- **Active squad** — every player with `clubId === state.userClubId` currently on the books, including bench, injured, on leave, and unlicensed heroes.

---

## 1. Goals

1. Make immutable player IDs the sole identity currency across awakening, Hero License selection, contract promises, lineup slots, inbox items, and market navigation, and make duplicate display names harmless.
2. Make automatic formation selection and narrow lineup repair obey the reviewed canonical contract, including conditioned ranking, licensed-hero tie-breaks, natural-role-first filling, and never putting an outfielder in goal.
3. Give every completed scouting report one exact, discoverable CTA — **"Sign the player"** — that opens Deals and selects and visibly highlights the same player by immutable ID on phone, tablet, and desktop, without skipping the transfer-fee or contract-negotiation steps.
4. Establish with evidence whether the 5%-of-ask wage step is already shipped, pin it with tests, explain the step number in the UI, and close the provenance gap that let a stale build be reported as a code defect.
5. Rank the season Story of the Year so an unbeaten league title, and a league-plus-Hero-Cup double, outrank routine resolved events.
6. Give inbox items an explicit lifecycle so a resolved transfer request stops presenting as actionable, and audit every engine transition that must clear the underlying flag.
7. Preserve, without exception: pure deterministic TypeScript in the engine, save compatibility with existing careers, all seven shipped locales, accessibility, responsive layout, current replay determinism, and current balance.

## 2. Non-goals

- No balance changes. Wage-step arithmetic, cup prize money, promise economics, scouting costs, hero limits, condition curves, and difficulty deltas are untouched.
- No new runtime dependencies, no new state-management library, no navigation library swap.
- No tactical chemistry model, no power-specific combat value, no change to manual-swap freedom between outfield positions, no automatic weekly replacement of a legal manager-picked XI (all four restated from the canonical doc's Non-goals).
- No renaming of existing players in existing saves, and no save-schema version bump.
- No changes to the concurrent unrelated worktree edits: `src/game/weekly-settlement-awards.ts` (cup Final prize), `src/ui/PlayerRequestDecisionCard.tsx` (non-money downside panel), `src/i18n/__tests__/use-copy.test.ts`, `src/ui/__tests__/player-feedback-contracts.test.ts`, `src/game/__tests__/weekly-settlement-awards.test.ts`, and the seven `content/i18n/*.json` diffs. If those land first, this work rebases onto them; if they land after, this work must not have touched the same hunks. New i18n keys from this spec are appended, never interleaved into their edited hunks.
- No product-code edits proposed *now*.

---

## 3. Current evidence

### 3.1 Engine identity is already ID-based

`playersById` calls `assertUniqueIds(players.map(p => p.id), 'Player')` and keys by ID. `selectLicensedHeroes` validates `assertUniqueIds(selectedIds, 'Selected player')`, resolves each selection through `roster.get(id)`, throws `Unknown player ID: ${id}` for misses, and returns `{ ...player, licensed: selected.has(player.id) }`. `repairLineupForInjuries` builds `new Map(roster.map(p => [p.id, p]))` and operates on `lineup.playerIds`. `homeProductAlerts` keys alerts `injury-${player.id}` and `transfer-request-${player.id}`.

**Conclusion:** the reported corruption (a newly awakened midfielder named Cal Moss causing the elite forward Cal Moss to be treated as unlicensed and benched, with only one Cal Moss visible in the license list) cannot originate in these functions. It originates upstream in a **presentation or selection layer that collapses two players into one row**, or in a call site that resolves a player from a name. F1 is therefore an audit-and-disambiguation task, not an engine rewrite.

**Determinism smell found in evidence:** `homeProductAlerts` sorts injuries with `left.name.localeCompare(right.name)`. `localeCompare` is locale-sensitive and returns `0` for identical names, so ordering of same-named players is unstable and accent ordering can vary by host ICU data. In scope for F1 as a one-line deterministic tiebreak.

### 3.2 Automatic selection is implemented but has two comparator defects

`arrangeCareerLineupForFormation` already implements the canonical procedure's shape: it filters `remaining` to available, licensed-if-powered players; preserves current starters per role via `starterSlot`; reserves promise holders (`GUARANTEED_STARTER` / `CAPTAINCY`) ordered by `agreedSeason` then `compareIds`; fills natural-role slots via `rankedForRole` using `conditionedRatingD64(roleOverall(...), condition ?? 100)` then `licensed` then `compareIds`; and runs outfield fallback that skips `slot === 0` and excludes `role === 'GK'`.

Two defects are visible in the excerpt:

**D-1 (retention phase uses unconditioned rating).** The starter-retention sort is
`Number(hasStarterPromise(right)) - Number(hasStarterPromise(left)) || roleOverall(role, right.attrs) - roleOverall(role, left.attrs) || starterSlot.get(left.id)! - starterSlot.get(right.id)!`.
It uses raw `roleOverall`, while every other phase uses `conditionedRatingD64`. The finding requires surplus starters to be dropped "lowest conditioned overall first". A tired 78 is retained over a fresh 76 today; the fill phases then disagree with the retention phase about who is better.

**D-2 (repair phase actively prefers unlicensed candidates).** In `repairLineupForInjuries` the replacement comparator is role penalty, then `if (left.licensed !== right.licensed) return left.licensed ? 1 : -1;`, then rating, then `compareIds`. That sorts **licensed players last** before rating is ever consulted. A rated-44 unlicensed defender therefore beats a rated-81 licensed hero defender — precisely the canonical doc's headline symptom ("Licensed hero Bo Hedges, rated 81, benched for a rated-44 defender"). The hero cap is already enforced independently by the candidate filter `(!candidate.licensed || licensedCount < heroLimit)`, so the license inversion is redundant headroom-hoarding, not a safety rail. The same comparator also uses raw `roleOverall`, not conditioned rating.

**D-3 (hard throw on a thin squad).** `arrangeCareerLineupForFormation` ends with `throw new Error('the squad cannot fill the selected formation')`. The canonical doc requires: "automatic selection is rejected and the current lineup stays unchanged." A thrown error is not a rejection unless every caller catches it. The repair path already models the correct shape with the `repairCareerLineupForInjuries` / `tryRepairCareerLineupForInjuries` pair; arrange has no `try` sibling.

**D-4 (license benching leaves no way back).** In repair, `if (!unlicensedHero && !claimedSlots.has(slot))` means a starter benched *solely* for losing a license gets **no** `returnLineupSlot`. The in-code rationale is that holding the shirt would "promise a comeback nothing will trigger" — but a license change is exactly one of the events that re-enters this function (the comment itself lists "the match-day toggle, a reclaim for a new signing"). This is the mechanical reason the report says "the lineup still needed a manual swap" after the permit was bought.

### 3.3 Scout report cards offer no signing path

The market screen's report card renders a `Pressable` keyed `report.playerId`, with an action row containing at most two `SmallAction`s: the detailed-report purchase (`report.detailedReportLabel`, gated on `report.detailedReportAvailable`) and `t('market.dismissReport')`. There is no navigation-to-Deals affordance. Separately, `TransferDesk` already implements a *focus* concept via `guideFocus`, resolving `guidedListing` for `'transfer-list'` and `'transfer-bid'`, and keys listings `${listing.direction}-${listing.playerId}`. The BUY branch already shows `t('market.feeFirstPlayerTerms')` as the blocked/explainer line — the fee-then-terms sequence exists and must not be bypassed.

### 3.4 The wage step is already 5% of the ask

Current source:

```ts
/** Five percent of the original ask, rounded to $10, with the old $50 floor. */
export function contractWageStep(weeklyAsk: number): number {
  assertPositiveSafeInteger(weeklyAsk, 'weekly contract ask');
  return Math.max(50, Math.round(weeklyAsk / 200) * 10);
}
```

`weeklyAsk / 200 * 10 === weeklyAsk / 20 === 5%`, rounded to the nearest $10, floored at $50. `marketNegotiationViewModel` already computes `const wageStep = contractWageStep(negotiation.weeklyAsk)` from the **original** ask, which is fixed for the negotiation's lifetime — so the step is already stable across rounds and across a save/reload. `openingContractOffer` already quantises the opening bid to `wageStep`.

Derived table (the discriminator for triage):

| Weekly ask | 5% | Rounded to $10 | Step after $50 floor |
|---|---|---|---|
| $400 | $20 | $20 | **$50** (floor) |
| $1,000 | $50 | $50 | **$50** |
| $1,100 | $55 | $60 | **$60** |
| $2,000 | $100 | $100 | **$100** |
| $8,000 | $400 | $400 | **$400** |
| $12,345 | $617.25 | $620 | **$620** |

**Conclusion:** "$50 buttons in a Season 9 negotiation" is consistent with *correct current code* if that negotiation's ask was ≤ $1,000, and is otherwise proof the deployed build predates `contractWageStep`. The report's own wording — "The requested percentage behavior is not in this deployed build" — supports the stale-build reading. F4 is a provenance + legibility task.

### 3.5 The recap prefers any event over any trophy

The recap builder sets `memorableEventId` from `state.resolvedEventHistory?.filter(e => e.season === state.season).at(-1)?.eventId` — the **most recent resolved event of the season**, with no notion of significance. The consuming UI then does:

```
memorableEvent defined                       -> event title
else if won > 0 && drawn === 0 && lost === 0 -> t('seasonEnd.perfectLeagueSeason')
else if finalPosition === 1                  -> t('seasonEnd.leagueTitle')
else                                         -> undefined
```

Two defects: (a) the event branch is unconditionally first, so a routine player request ("Lo ha pedido por escrito", the last resolved event of the season) always outranks a treble; (b) the unbeaten branch requires `drawn === 0`, so an unbeaten season *with draws* — the ES career finished on 48 points, which necessarily includes draws unless every match was won — falls through to the plain league-title branch and then loses to the event anyway.

### 3.6 Live transfer-request alerts are already correct; persisted items are not

`homeProductAlerts` is documented as "Live, uncapped product alerts before Bert's weekly desk scheduler" and derives `transferRequests` from `roster.filter(p => p.transferRequested === true)` every render. That path self-heals. `renewContract` sets `transferRequested: false` on renewal. The report's stale Ty Brooks item therefore lives in the **persisted assistant inbox / weekly desk**, which stores messages and has dismissal helpers (`isAssistantInboxProductDismissedForCurrentWeek`, `isAssistantInboxProductPermanentlyDismissed`) but no *resolution* concept. F6 adds resolution, and audits the flag-clearing transitions other than renewal.

---

## 4. Architecture boundaries and invariants

1. **Engine (`src/game/**`)** stays pure: no `Date.now()`, no `Math.random()`, no `Intl`/`localeCompare` in any ordering that feeds simulation or persisted state, no I/O. Every new comparator ends in `compareIds`.
2. **View-models** are pure functions `(state | source, t: CopyFn) => ViewModel`. All new decision logic (name disambiguation, story ranking, inbox lifecycle, market focus resolution) lands here or in the engine — **never** inside a component body. Components stay declarative renderers of view-model fields.
3. **Components (`src/ui/**`)** may read `useCopy()` and layout primitives. They must not compute rankings, resolve identity, or branch on locale.
4. **Copy** goes through `t(key, params)` / `copyFor(locale)`. No literal user-facing English in components.
5. **Determinism budget.** Any change to a comparator that feeds `buildCareerTeamDef` changes match inputs and therefore replayed results for identical seeds. Comparator changes in F2 are deliberate and require golden-fixture review (§13.5). No other section may alter simulation inputs.
6. **Save boundary.** `GameState` is the persisted shape. This spec adds **no required field and no version bump**. One optional field is *reused* (`returnLineupSlot`) with widened semantics that older saves read as absent.
7. **Ephemeral UI state** (which player Deals should highlight) lives in navigation/screen state, never in `GameState`, so it cannot corrupt a save and cannot desync a replay.

---

## 5. F1 — Immutable identity and duplicate display names

### 5.1 Contract

- **I-1.** Awakening, Hero License grant/revoke, contract promises, lineup slots, inbox items, market focus, and every navigation parameter identify a player by `player.id` only.
- **I-2.** `player.name` is display text. It is never a `Map`/`Set` key, never a React `key`, never compared for identity, never used to look a player up.
- **I-3.** When two or more active-squad players share a normalized display name, every user-visible list that can show both renders a deterministic disambiguating tag.
- **I-4.** Player generation avoids creating an intra-club duplicate when it can, **without consuming extra RNG draws**.
- **I-5.** Existing saves are never rewritten. Disambiguation is derived at render time.

### 5.2 Audit (mandatory first step)

Grep the whole repository for name-keyed identity and fix every hit. Non-exhaustive patterns:

```
key={ ... \.name
new Map( ... \.name
new Set( ... \.name
\.find\((\w+) => \1\.name ===
\.filter\((\w+) => \1\.name ===
\.indexOf\( ... \.name
playerName:.*=>.*find      # resolving back from a display name
localeCompare\(            # in any engine or ordering path
```

Special attention, in this order: the Hero License picker view-model and its selection handler (the report saw **one** Cal Moss row where two players existed — a name-keyed `Map`/dedupe/`key` collapse is the most probable cause and the most probable source of the wrong-player license write); the awakening ceremony view-model; the lineup swap picker; `restoreCareerContractPromiseLineup` call sites; and story/event token substitution.

Record every hit and its fix in the PR body. If the license picker turns out to dedupe by name, that single fix closes the reported corruption; the rest of F1 makes recurrence impossible and makes the squad readable.

### 5.3 Deterministic disambiguation algorithm

New pure helper, placed beside existing roster helpers (module that already exports `rosterForClub`, or a new `src/game/player-display-name.ts`):

```ts
export function normalizeDisplayName(name: string): string {
  return name.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Immutable-ID-keyed display names for one club's active squad. */
export function squadDisplayNames(
  roster: readonly CareerPlayer[],
  t: CopyFn,
): ReadonlyMap<string, string>;
```

Procedure:

1. Group roster by `normalizeDisplayName(player.name)`.
2. Group size 1 → the plain `player.name`.
3. Group size > 1 → **Tier A (role tag)**: partition the group by `player.role`. Every partition of size 1 renders `t('player.nameWithTag', { name, tag: t('role.' + player.role) })`.
4. Partitions still larger than 1 → **Tier B (shirt number)**: if every member has a defined `shirtNumber` and all are distinct within the partition, render `t('player.nameWithTag', { name, tag: t('player.shirtTag', { number }) })`.
5. Otherwise → **Tier C (stable ID tag)**: `tag = idTag(player.id)`, where `idTag` is `hashString('name-tag:' + id)` rendered base36, upper-cased, first 2 characters. On collision inside the partition, extend to 3, then 4 characters; the loop terminates because IDs are unique. Tier C is chosen over an ordinal ("II") deliberately: an ordinal changes when a squadmate is sold, and a name that shifts under the manager is worse than an opaque but stable tag.
6. The map is keyed by `player.id`. Ordering never depends on `name`.

`hashString` already exists (used for the seeded agent line) and is deterministic; reuse it rather than adding a hash.

### 5.4 Where disambiguated names are used

Any surface that can show two active-squad members at once, or that identifies a squad member for a consequential decision: Hero License picker, lineup XI and bench, formation screen, squad list, contract promise UI, awakening ceremony, transfer/sale listings for owned players, inbox items naming a squad member, the "still waiting" request alert, and the injury/transfer-request alerts.

Not used: match commentary and narrative prose (a tag mid-sentence reads badly); the scouting report card for a **non-squad** player, unless that report's player collides with an active-squad name, in which case the report card uses the tag too so the two cannot be confused when the Deals highlight lands.

### 5.5 Generation-side collision avoidance (RNG-safe)

Where a new player's name is drawn from a pool by a seeded index:

```
i = <existing seeded draw, unchanged>
for k in 0 .. pool.length - 1:
  candidate = pool[(i + k) % pool.length]
  if normalizeDisplayName(candidate) not in destinationClubNormalizedNames:
    use candidate; break
else:
  use pool[i]        // accept the collision; §5.3 handles display
```

Rotating the index consumes **zero** additional RNG draws, so every non-colliding seed produces byte-identical output to today and replay/seed stability is preserved.

Apply to: signings that mint a player, youth intake, and `createEmergencyYouthReplacement`. Do **not** apply to awakening (awakening never renames).

### 5.6 Old saves

No migration. A save already containing two Cal Mosses renders `Cal Moss (FWD)` and `Cal Moss (MID)` on first load. Persisted `name` values are never rewritten. If an old save has a persisted name-keyed artifact (e.g. a stored selection recorded by name), the reader resolves it to an ID once at read time by *exact* name match; ambiguous matches resolve to **no** selection rather than a guess, and the UI shows the picker unselected.

### 5.7 Edge cases

- Same name, same role, no shirt numbers → Tier C tag on both.
- Three or more sharing a name across two roles → Tier A splits by role; the two-member role partition falls to Tier B/C.
- A duplicate resolves when one player is sold → the survivor silently returns to a plain name. Acceptable and expected.
- Names differing only by accent or case (`José` / `Jose`) → **not** duplicates. Normalization is NFC + trim + whitespace collapse + `toLowerCase()`; it does not strip diacritics. Non-locale-aware `toLowerCase()` is used deliberately for determinism.
- Empty or whitespace-only name in a corrupt old save → treated as its own group; render the raw stored value; never crash.

---

## 6. F2 — Automatic formation selection and narrow lineup repair

The canonical doc is authoritative. Note the divergence to record in the PR: the report says "Remove only surplus starters, lowest **overall** first"; the finding brief and this spec require **lowest conditioned overall** first, consistent with the canonical doc's conditioned ranking throughout.

### 6.1 Fixes

**Fix 2A — retention ranks by conditioned rating (D-1).** In `arrangeCareerLineupForFormation`, the per-role retention comparator becomes:

```
hasStarterPromise desc
  || conditionedRatingD64(roleOverall(role, attrs), condition ?? 100) desc
  || licensed desc                      // licensed hero wins the exact tie
  || starterSlot.get(id) asc            // slots are unique; terminal
```

Semantics unchanged otherwise: `.slice(0, slots.length)` retains the top N legal same-role starters; the surplus stay in `remaining` and remain eligible for the promise pass, the natural-role pass, and — because the fallback comparator already prefers `starterSlot.has(id)` — for out-of-role fallback ahead of bench players.

**Fix 2B — repair stops punishing licensed heroes (D-2).** In `repairLineupForInjuries`, the replacement comparator becomes:

```
rolePenalty asc                          // targetRole match first
  || conditionedRatingD64(roleOverall(targetRole, attrs), condition ?? 100) desc
  || licensed desc                       // licensed hero wins the exact tie
  || compareIds asc
```

with `targetRole = slot === 0 ? 'GK' : starter.role`. The candidate filter is unchanged — `!selected.has(id) && isAvailableForSelection(c) && !(c.power !== undefined && !c.licensed) && (!c.licensed || licensedCount < heroLimit) && (slot === 0 ? c.role === 'GK' : c.role !== 'GK')` — so the hero cap, the GK boundary, the one-slot-per-player rule, and the unlicensed-hero exclusion all remain enforced exactly as today. Deleting the license inversion is safe precisely because the cap is a filter, not a tiebreak.

Consequence to document in code: a licensed hero filling an early broken slot may consume the last cap headroom, so a later broken slot takes an unlicensed replacement. That is correct — the cap is a cap — and it is deterministic because slots are repaired in ascending order.

**Fix 2C — arrange fails soft (D-3).** Add, mirroring the existing repair pair:

```ts
export function tryArrangeCareerLineupForFormation(
  state: GameState,
  formation: FormationId,
): GameState | undefined;
```

Both functions share one private implementation. `tryArrange…` returns `undefined` when any slot is unfillable (no available goalkeeper for slot 0, or an outfield slot with no legal candidate). `arrangeCareerLineupForFormation` keeps its current throwing signature for existing callers. Every UI entry point (formation picker, new-season rebuild) switches to `tryArrange…` and renders `t('lineup.cannotFillFormation')` on `undefined`, leaving the lineup untouched.

Arrange **never** mints emergency youth. Per the canonical doc, emergency relief belongs only to the repair path ("A thin squad must still fail soft through the existing emergency-youth path *where that path already applies*"), because a formation choice is a manager preference, not an unavoidable outage.

**Fix 2D — Hero License round-trip (D-4).** When repair benches a starter *solely* because they became an unlicensed hero, record `returnLineupSlot` for them exactly as it is recorded for injuries — i.e. drop the `!unlicensedHero &&` guard on the `claimedSlots` branch. The existing fulfilment loop at the top of `repairLineupForInjuries` already skips a pending claimant while `player.power !== undefined && !player.licensed`, and already restores them (respecting `heroLimit`) once licensed and available, so no new machinery is needed. Guard rails:

- The claim is cleared when the manager manually swaps another player into that slot (the swap path must delete any `returnLineupSlot` equal to the target slot).
- The claim is cleared at season rollover, so a permanently unlicensed hero cannot hold a shirt forever.
- The existing `claimedSlots` first-come rule is unchanged; a second claimant for a taken slot simply gets none.

This is what makes "buy the sixth permit → the forward starts again" work without a manual swap, which is the exact residual complaint in the report.

**Fix 2E — deterministic alert ordering.** Replace `left.name.localeCompare(right.name)` in `homeProductAlerts` injury sorting with `compareIds(left.id, right.id)`. Low risk, removes the last locale-sensitive ordering in the evidence.

### 6.2 Preserved behavior (do not change)

- Promise reservation order: `agreedSeason` ascending, then `compareIds`; promises never place a player out of role; a newer promise stays unhonoured when all same-role slots are reserved by older promises.
- Fallback excludes goalkeepers and promise holders, prefers previous starters, then conditioned rating for the vacant slot's role, then licensed, then `compareIds`.
- `restoreCareerContractPromiseLineup` then `buildCareerTeamDef` validation at the end of arrange.
- `assertManagementChoicePhase(state, 'the lineup')`.
- Narrow repair never replaces legal manager-picked starters.
- Weekly settlement never rebuilds a legal manager-picked XI.

### 6.3 Edge cases

| Case | Required behavior |
|---|---|
| No available GK at all | `tryArrange…` → `undefined`, lineup unchanged, `t('lineup.cannotFillFormation')`. Repair → emergency GK youth for the user club via the existing relief path; `undefined` for `tryRepair…`. Never an outfielder in goal. |
| Formation has fewer slots of a role than current starters | Surplus dropped lowest-conditioned first; survivors keep shirts. |
| Formation has more slots of a role than natural-role players | Natural pool exhausts, then one fallback outfielder per empty slot. |
| Promise holder injured / away / unlicensed | Skipped this run; promise stays active; honoured automatically on return. |
| Two promise holders, one same-role slot | Older `agreedSeason` starts; newer stays unhonoured; lineup stays legal and role-correct. |
| Awakening mid-season | Player becomes an unlicensed hero → repair benches them **and** records `returnLineupSlot` (2D) → licensing restores the shirt. |
| Leave request / drill that would break the XI | Unchanged: callers keep using `tryRepairCareerLineupForInjuries` and decline rather than conjuring relief. |
| Condition inverts raw ratings | The fresher, weaker player is the correct pick everywhere, retention included (2A). |
| Repeated arrange from identical state | Byte-identical eleven and slot order. |

---

## 7. F3 — "Sign the player" on completed scout reports

### 7.1 Exact decisions (fixed, not open for reinterpretation)

- The CTA label is **"Sign the player"** (`market.signThePlayer`), localized in all seven locales. The report's suggested "Go to Deals" is superseded.
- Pressing it opens **Deals**, selects the same player **by immutable ID**, and shows a visible highlight.
- It **does not** bypass the transfer-fee step or the contract-negotiation step. It is pure navigation plus focus. It never submits a bid, never opens a negotiation, never moves money.

### 7.2 View-model changes (pure layer)

Scout report entries gain:

```ts
readonly signAvailable: boolean;
readonly signBlockedReason?: string;   // localized, present iff !signAvailable
```

`signAvailable` is true when a Deals listing exists for `report.playerId` with `direction === 'BUY'`. Otherwise `signBlockedReason` is `market.signUnavailableGone` (player no longer purchasable — signed elsewhere, retired). A closed transfer window does **not** block the CTA: navigation still happens and the listing's own `blockedReason` explains the block, so the manager reads one authoritative reason rather than a second-hand one.

Transfer listings gain:

```ts
readonly focused: boolean;   // true iff listing.playerId === focusPlayerId
```

The market view-model builder accepts an optional `focusPlayerId?: string` and sets `focused` accordingly. Matching is `===` on the immutable ID. Never on name, never on the `${direction}-${playerId}` composite key.

### 7.3 Navigation and focus lifecycle

- Screen props gain `onSignScoutedPlayer(playerId: string): void`. The host sets ephemeral navigation state `{ tab: 'market', section: 'transfers', focusPlayerId }` and, on phone/tablet, switches the market section to the transfer desk.
- `focusPlayerId` is **not** persisted in `GameState`. It survives an in-session tab switch and is cleared when: the manager acts on that listing (opens fee or terms), the manager leaves the market screen, the listing disappears from the view-model, or a different focus is set.
- Reuse the existing `guideFocus` pattern in `TransferDesk` rather than inventing a second mechanism; `guideFocus` resolves a *listing*, `focusPlayerId` resolves a *player*, and both funnel into the same `focused` flag and the same highlight styling.

### 7.4 Highlight and scroll

- Highlight = the existing attention treatment already used for guided listings (heavier border + tone shift), plus a `StatusChip` reading `t('market.fromYourScoutReport')` inside the focused listing's header. It must be visible without color alone (border weight change carries it).
- Scroll-into-view: the focused listing reports its offset via `onLayout`; the transfer desk scroll view scrolls to that offset once per focus change. Guard against repeated scrolling on re-render by keying the effect on `focusPlayerId`.
- **Phone (≈390 pt):** single column; CTA navigates to the Deals section; listing scrolled to the top third of the viewport; highlight visible.
- **Tablet (≈834 pt):** same navigation; if the market screen already shows both panes, no navigation occurs, only focus + scroll.
- **Desktop (≥1280 pt):** if Deals is already visible in a second pane, the CTA sets focus and scrolls without a tab change; the highlight is identical.

All three read the same `focused` boolean from the same view-model. Layout may differ; identity and highlight logic may not fork.

### 7.5 Card layout

Add the CTA to the existing action row, which currently holds the detailed-report and dismiss `SmallAction`s. "Sign the player" is the **primary** action and renders first in the row (leading), with dismiss last, so discard is no longer the visually dominant option. The row already uses `flex-row flex-wrap gap-2` and wraps to a second line at narrow widths without truncation. The CTA sits inside the card's outer `Pressable`, so its handler must call `event.stopPropagation()` before dispatching — the same pattern the dismiss and detailed-report handlers already use.

### 7.6 Edge cases

- Report exists, player already signed by the user's club → CTA hidden; the card shows `t('market.alreadyAtYourClub')`.
- Report exists, player gone from the market → CTA rendered disabled with `signBlockedReason`.
- Transfer window closed → CTA navigates; the listing's existing `blockedReason` explains the block. No duplicate messaging on the card.
- Two reports for two different players sharing a display name → both CTAs work; the focus is by ID; both cards show the disambiguating tag per §5.4.
- Report dismissed while focus is active → focus clears with the listing.
- Focus set for a player who is not in `viewModel.transfers` → no highlight, no crash, no scroll.

---

## 8. F4 — Contract wage step: verification, legibility, provenance

### 8.1 Verification (do this before writing any code)

1. Confirm `contractWageStep` is exported and matches §3.4 in `HEAD`.
2. Confirm `marketNegotiationViewModel` derives `wageStep` from `negotiation.weeklyAsk` (the original ask), not from the current offer.
3. Confirm the negotiation panel component consumes `viewModel.wageStep` and contains **no literal `50`** in its increment/decrement handlers. This is the one plausible remaining code defect: a correct view-model paired with a hard-coded control. If a literal is found, that — not `contractWageStep` — is the fix.
4. Reproduce with a Season-9-scale ask. If the ask was ≤ $1,000, the $50 buttons were correct behavior and the report's diagnosis is wrong; record that. If the ask was, say, $8,000 and the buttons still read $50, the deployed build predates `contractWageStep` and the fix is a release, not a patch.

### 8.2 Legibility (the actual UI change)

Add a caption beside the wage stepper: `t('negotiation.stepExplainer', { step })` → *"Each press changes the wage by {step} — 5% of the original ask."* This makes the step self-explaining, so a future playtest reports "the step is $50 because the ask is $900" instead of "the step is broken". The caption uses the body face, not the pixel face (a sentence explaining a number must stay readable in every locale — the same rule the codebase already applies to `aboveHundredNote`).

### 8.3 Edge-case rules to pin (behavior unchanged; now specified and tested)

- Step is derived once per negotiation from the immutable original ask; it does not drift with offers, rounds, term, perk, mood, or pitch leverage, and survives save/reload.
- Floor: `$50`. Rounding: nearest `$10`. Both retained exactly — changing either moves negotiation outcomes and is a balance change.
- Ask below $1,000: the floor makes the step exceed 5%. Accepted and documented.
- Ask of $1 (corrupt/old save): `Math.round(1/200)*10 === 0`, floored to `$50`, i.e. the step exceeds the ask. Decrementing must clamp the offer at `Math.max(1, offer - step)` so the wage never reaches zero or negative. `assertPositiveSafeInteger` already rejects a non-positive ask upstream.
- Increment has no new cap; existing affordability messaging is unchanged.
- `openingContractOffer` keeps `Math.max(wageStep, Math.ceil(weeklyAsk / 2), opening)` — the insult floor is applied last, on purpose.

### 8.4 Provenance gap (recommended, small, in scope for this finding)

Playtest reports must be attributable to a build. Add a build stamp — version, short commit SHA, build timestamp — rendered in Settings/About and included in the playtest report template. Without it, every future report costs a triage cycle like this one. Flagged as recommended rather than mandatory; if the team declines, the mitigation is that every report must name the commit it exercised.

---

## 9. F5 — Story of the Year ranking

### 9.1 New pure function

Placed with the season-recap view-model:

```ts
export type SeasonStory =
  | { readonly kind: 'UNBEATEN_DOUBLE' }
  | { readonly kind: 'DOUBLE' }
  | { readonly kind: 'PERFECT_SEASON' }
  | { readonly kind: 'UNBEATEN_TITLE' }
  | { readonly kind: 'TITLE' }
  | { readonly kind: 'CUP' }
  | { readonly kind: 'PROMOTION' }
  | { readonly kind: 'EVENT'; readonly eventId: string }
  | { readonly kind: 'NONE' };

export function seasonStoryOfTheYear(recap: SeasonRecap): SeasonStory;
```

Rank order — **first match wins**, evaluated top to bottom:

1. `UNBEATEN_DOUBLE` — `lost === 0 && played > 0 && finalPosition === 1 && wonNationalCup`
2. `DOUBLE` — `finalPosition === 1 && wonNationalCup`
3. `PERFECT_SEASON` — `played > 0 && won === played`
4. `UNBEATEN_TITLE` — `lost === 0 && played > 0 && finalPosition === 1`
5. `TITLE` — `finalPosition === 1`
6. `CUP` — `wonNationalCup`
7. `PROMOTION` — the recap's promotion indicator, if one exists
8. `EVENT` — `memorableEventId !== undefined`
9. `NONE`

`wonNationalCup` is read from the fields `cupResult(state)` already spreads into the recap. **Do not** infer it from copy strings.

The unbeaten tiers require only `lost === 0` — draws are allowed. This is the specific correction for the ES career: 48 points with draws is unbeaten and must rank above a resolved player request.

### 9.2 Rendering

The recap UI replaces its inline ladder with `seasonStoryOfTheYear(recap)` and maps `kind` to copy:

| kind | key |
|---|---|
| UNBEATEN_DOUBLE | `seasonEnd.story.unbeatenDouble` |
| DOUBLE | `seasonEnd.story.double` |
| PERFECT_SEASON | `seasonEnd.perfectLeagueSeason` *(existing key, reused)* |
| UNBEATEN_TITLE | `seasonEnd.story.unbeatenTitle` |
| TITLE | `seasonEnd.leagueTitle` *(existing key, reused)* |
| CUP | `seasonEnd.story.cupWin` |
| PROMOTION | existing promotion key if one exists, else `seasonEnd.story.promotion` |
| EVENT | `copyOrEnglish(t, 'event.' + id + '.title', event.title)` *(existing mechanism, unchanged)* |
| NONE | no story line rendered |

### 9.3 Save compatibility and edge cases

- `memorableEventId` continues to be written by the recap builder exactly as today. No save change. Old saves gain the better story immediately because ranking happens at read time.
- `memorableEventId` present but the event is missing from content (removed event, old save) → the EVENT tier is skipped, not crashed; fall through to `NONE`.
- `played === 0` (abandoned/partial season) → unbeaten and perfect tiers cannot match (`played > 0` guard); a title without matches still yields `TITLE`.
- Cup won while relegated → `CUP`. Correct: the trophy is the story.
- This is presentation only. No award money, no fan delta, no reputation, no persisted field changes.

---

## 10. F6 — Inbox lifecycle for resolved transfer requests

### 10.1 Lifecycle

```
OPEN      -> actionable; CTAs live; counts toward the unread badge
RESOLVED  -> visible, muted, NOT actionable; carries a localized resolution line;
             excluded from unread/urgent counts
ARCHIVED  -> hidden from the primary list (kept in history if a history view exists)
```

Transitions are **derived at read time** from live state, never stored. This is what makes old saves self-heal without a migration.

### 10.2 Derivation

```ts
export type InboxItemLifecycle =
  | { readonly status: 'OPEN' }
  | { readonly status: 'RESOLVED'; readonly reasonKey: string; readonly params?: CopyParams }
  | { readonly status: 'ARCHIVED' };

export function inboxItemLifecycle(
  state: GameState,
  item: InboxItem,
): InboxItemLifecycle;
```

For a transfer-request item carrying `playerId`:

1. Player not on the user roster → `RESOLVED`, `inbox.resolved.playerLeft`.
2. `player.transferRequested !== true` → `RESOLVED`, `inbox.resolved.requestSettled`.
3. Otherwise → `OPEN`.
4. A `RESOLVED` item whose issue week is more than `INBOX_RESOLVED_VISIBLE_WEEKS = 2` **absolute game weeks** old → `ARCHIVED`. Age is computed from persisted absolute week indices, never from wall-clock time.

Generalize the same three-state shape to other resolvable item kinds as they are encountered; only transfer-request items are required by this finding.

### 10.3 Rendering rules for RESOLVED

- Every action button is removed. At most one neutral "dismiss/file" control remains, reusing the existing dismissal helpers (`isAssistantInboxProductDismissedForCurrentWeek`, `isAssistantInboxProductPermanentlyDismissed`) rather than a new mechanism.
- Tone drops from `urgent` to neutral/muted.
- A resolution line renders under the title, e.g. *"Resolved — Ty Brooks is staying."*
- The item's `accessibilityLabel` is prefixed with `t('inbox.resolvedTag')` so a screen-reader user learns the state before the content.
- Excluded from unread badges, from urgent counts, and from any "needs your attention" summary.

### 10.4 State-clearing audit (engine side)

`transferRequested` must be `false` after every one of these transitions. `renewContract` already does it (`transferRequested: false`). Verify and, where missing, fix:

- Contract renewal ✅ (confirmed in evidence)
- Player sold / transfer out completed
- Transfer request granted (player listed and moved on)
- Player retired
- Player released
- Any board-forced sale

A **refused** request leaves `transferRequested === true` and the item correctly stays `OPEN`. Do not add request expiry — that would be a balance change.

### 10.5 Edge cases

- Player sold, then a same-named player signed → the item resolves via `playerId`, not name (F1 dependency).
- Two simultaneous requests → two items, keyed `transfer-request-${player.id}`, resolving independently.
- Save reloaded mid-week → lifecycle recomputes identically; it is a pure function of `state` and the item.
- Old save with an already-stale item → renders `RESOLVED` (or `ARCHIVED` if aged out) on first load, with no migration.
- Live `homeProductAlerts` are already correct and need no lifecycle; add a regression test so they stay that way.

---

## 11. Data and save changes

| Change | Kind | Save impact |
|---|---|---|
| `squadDisplayNames` | Derived at render | None |
| Generation collision avoidance | Pure index rotation, zero extra RNG draws | None for existing saves |
| Comparator fixes (2A, 2B) | Pure ordering | None to shape; **changes future simulation outcomes** (§13.5) |
| `tryArrangeCareerLineupForFormation` | New export | None |
| `returnLineupSlot` for license benching (2D) | **Reuses an existing optional field**, widened semantics | Absent in old saves = today's behavior |
| `signAvailable` / `signBlockedReason` / `focused` | View-model only | None |
| `focusPlayerId` | Ephemeral navigation state | Never persisted |
| `seasonStoryOfTheYear` | Derived from existing recap fields | None; `memorableEventId` still written |
| `inboxItemLifecycle` | Derived at read time | None |

**No schema version bump. No required new persisted field. No name rewriting, ever.** A save written before this work loads and plays; a save written after loads in an older build, because nothing new is required to be present.

---

## 12. Localization

All seven shipped locales — `en`, `es`, `pt-BR`, `fr`, `de`, `id`, `vi` — receive every new key in the same change. `copyFor(locale)('missing.key')` returns the key itself, so a missing translation ships as a visible raw key; the sweep test in §13.3 makes that impossible to merge.

| Key | English source |
|---|---|
| `player.nameWithTag` | `{name} ({tag})` |
| `player.shirtTag` | `#{number}` |
| `role.GK` / `role.DEF` / `role.MID` / `role.FWD` | `GK` / `DEF` / `MID` / `FWD` *(reuse existing keys if present — check before adding)* |
| `market.signThePlayer` | `Sign the player` |
| `market.a11y.signThePlayerFor` | `Sign {player} — opens Deals` |
| `market.fromYourScoutReport` | `From your scout report` |
| `market.a11y.highlightedTarget` | `{player} is highlighted in Deals.` |
| `market.signUnavailableGone` | `This player is no longer on the market.` |
| `market.alreadyAtYourClub` | `Already at your club.` |
| `negotiation.stepExplainer` | `Each press changes the wage by {step} — 5% of the original ask.` |
| `seasonEnd.story.unbeatenDouble` | `Unbeaten league title and Hero Cup` |
| `seasonEnd.story.double` | `League title and Hero Cup` |
| `seasonEnd.story.unbeatenTitle` | `Unbeaten league title` |
| `seasonEnd.story.cupWin` | `Hero Cup champions` |
| `seasonEnd.story.promotion` | `Promoted` |
| `inbox.resolvedTag` | `Resolved` |
| `inbox.resolved.requestSettled` | `{player} is staying. The request is settled.` |
| `inbox.resolved.playerLeft` | `{player} has left the club.` |
| `lineup.cannotFillFormation` | `Your squad cannot fill that formation. The lineup is unchanged.` |

Translation notes for translators: `{tag}` is a short role abbreviation or shirt number and must stay inside the parentheses; `Sign the player` is a navigation action, not a confirmation of a completed signing, and must not translate as "signed"; `Hero Cup` is the existing product name for the national cup and must match the term already used in each locale's cup copy.

Layout: `market.signThePlayer` is longer in `de` and `pt-BR`. The action row already uses `flex-wrap`, so it wraps rather than truncating. Do not add `numberOfLines={1}` to the CTA.

Glyph hazard: the codebase has documented cases where `★` and similar glyphs are missing from Silkscreen and flip the typeface mid-string. Do not place any non-ASCII glyph inside a `font-pixel` string in the new CTA, chip, or caption.

---

## 13. Tests

Existing conventions to follow: unit tests in `src/game/__tests__/`, `src/ui/__tests__/`, `src/i18n/__tests__/`; `describe` / `test` / `expect`; the **source-contract** harness (`source('src/ui/X.tsx')` + `toContainSource(...)`) for structural guarantees a rendering test cannot express.

### 13.1 Identity (F1)

`src/game/__tests__/player-identity.test.ts`
- Two players named `Cal Moss` (FWD + MID): licensing the FWD by ID leaves the MID unlicensed and vice versa; `selectLicensedHeroes` throws on an unknown ID.
- Awakening the MID does not change the FWD's `licensed`, `contractPromise`, or lineup slot.
- `squadDisplayNames` → `Cal Moss (FWD)` and `Cal Moss (MID)`; same name + same role + distinct shirt numbers → `#9` / `#11`; same name + same role + no shirt numbers → distinct stable ID tags; the same roster twice → identical output.
- `José` vs `Jose` are not duplicates; `  Cal   Moss ` and `Cal Moss` are.
- Generation: a club already holding the drawn name receives the next non-colliding pool entry; a non-colliding seed produces byte-identical output to the pre-change implementation (RNG-consumption regression test).

`src/ui/__tests__/identity-contracts.test.ts` (source-contract)
- No `key={` expression containing `.name` in `src/ui/**`.
- No `find`/`filter` predicate comparing `.name ===` for player identity in `src/ui/**` or `src/game/**`.
- No `localeCompare` in `src/game/**`.

### 13.2 Lineup (F2)

`src/game/__tests__/career-lineup-selection.test.ts` — implements the canonical doc's acceptance list verbatim, plus:
- An 81-rated licensed hero defender is chosen over a 44-rated unlicensed defender by narrow repair (direct regression for D-2).
- Retention drops the **lowest conditioned** surplus starter, not the lowest raw-overall one (D-1): a 78-rated starter at 40 condition is dropped ahead of a 76-rated starter at 100.
- A licensed hero wins an exact conditioned-rating tie in both retention and repair.
- A forward never occupies a defender slot while any available defender is unselected.
- `tryArrangeCareerLineupForFormation` returns `undefined` with no available GK, and `state.lineups` is untouched (D-3).
- Repair with no available GK still mints emergency GK youth for the user club and never returns an outfielder in slot 0.
- A starter benched for losing a license receives `returnLineupSlot` and is restored on re-licensing without a manual swap (D-4); a manual swap into that slot clears the claim; season rollover clears the claim.
- Injured, away, and unlicensed powered players are excluded from every pool.
- Promises never create an out-of-role starter; two promise holders and one slot → older `agreedSeason` starts.
- No player is assigned to two slots.
- Running arrange twice from identical state produces identical `playerIds`.

### 13.3 Market CTA + copy (F3, F4)

`src/ui/__tests__/market-scout-cta.test.ts` (source-contract + view-model)
- The report card renders `t('market.signThePlayer')` and calls `onSignScoutedPlayer(report.playerId)` with `event.stopPropagation()`.
- The CTA handler contains no call to any bid-submission or negotiation-opening action (bypass guard).
- `focusPlayerId` sets `focused: true` on exactly the listing whose `playerId` matches; a name match alone never sets it.
- `signAvailable === false` with a localized `signBlockedReason` when no BUY listing exists.
- Negotiation panel source references `wageStep` and contains no literal `50` in the stepper handlers.

`src/game/__tests__/contract-wage-step.test.ts`
- Pin the §3.4 table exactly: `400→50`, `1_000→50`, `1_100→60`, `2_000→100`, `8_000→400`, `12_345→620`.
- The step is invariant across rounds, offers, terms, perks, and a serialize/deserialize round trip.
- Decrement clamps at `1` when the step exceeds the ask.

`src/i18n/__tests__/use-copy.test.ts` — append (do not disturb the concurrent hunks): every new key from §12 resolves to a non-key string in all seven `LOCALES`, and `player.nameWithTag` renders its `{name}`/`{tag}` params in each.

### 13.4 Story and inbox (F5, F6)

`src/game/__tests__/season-story.test.ts`
- Unbeaten (with draws) + title + cup, `memorableEventId` present → `UNBEATEN_DOUBLE` (direct regression for the ES report).
- Title + cup, one loss → `DOUBLE`.
- `won === played` → `PERFECT_SEASON`.
- Title only, event present → `TITLE`, not `EVENT`.
- No trophy, event present → `EVENT`.
- Event id absent from content → falls through to `NONE`, no throw.
- `played === 0` → no unbeaten/perfect tier.

`src/game/__tests__/inbox-lifecycle.test.ts`
- `transferRequested` cleared → `RESOLVED` with `inbox.resolved.requestSettled`.
- Player off the roster → `RESOLVED` with `inbox.resolved.playerLeft`.
- Resolved more than two weeks ago → `ARCHIVED`.
- Still requesting → `OPEN`.
- `homeProductAlerts` emits no `transfer-request-*` alert once the flag clears.
- Every transition in §10.4 leaves `transferRequested === false`.

### 13.5 Golden / replay re-baseline (mandatory for F2)

Fixes 2A and 2B change automatic-selection outputs and therefore any golden fixture that pins a lineup, a match result, or a season table. The implementer must: run the full golden suite, list every changed fixture in the PR, confirm each diff traces to the intended comparator change (conditioned ranking and/or a licensed hero correctly starting), and re-baseline only those. **A golden diff that cannot be explained by 2A or 2B blocks the merge.** Seed-in → seed-out determinism itself must remain intact: the same seed must still produce one stable result across repeated runs.

---

## 14. Accessibility

- The CTA is `accessibilityRole="button"` with `accessibilityLabel={t('market.a11y.signThePlayerFor', { player: disambiguatedName })}`.
- The focused listing announces via a rendered status chip and an `accessibilityLabel` prefix (`market.a11y.highlightedTarget`); highlight is never conveyed by color alone — border weight carries it.
- Disabled CTAs expose `accessibilityState={{ disabled: true }}` and include the blocked reason in the label, so the reason is never visual-only.
- All new tap targets meet the existing minimum touch-target size; the CTA is not smaller than the adjacent dismiss action.
- Disambiguating tags are inside the accessible name (`Cal Moss (FWD)`), so a screen-reader user distinguishes the two players.
- Resolved inbox items announce their state first via `inbox.resolvedTag`.
- The wage-step caption is real text (body face), not an image or a tooltip-only affordance, and is included in the stepper's accessible description.
- Text scaling: the CTA row wraps; the wage caption wraps; neither is clipped at large font scales.

## 15. Acceptance criteria

**F1** — Awakening a same-named player never changes another player's license, promise, or lineup slot. The Hero License list shows one row per player, never one row per name. Two same-named squad members are distinguishable in every list that can show both. Repeated renders of the same roster produce identical names. No save is rewritten. No `localeCompare` remains in engine ordering.

**F2** — All twelve canonical acceptance boxes pass. Surplus starters are removed lowest-**conditioned**-overall first. A licensed hero is never benched for a materially weaker unlicensed player. No outfielder is ever the automatic goalkeeper. A squad that cannot fill a formation leaves the lineup unchanged and shows `lineup.cannotFillFormation` instead of throwing. Buying a permit for a license-benched starter restores their shirt without a manual swap.

**F3** — Every completed report shows exactly one "Sign the player" CTA in all seven locales. Pressing it opens Deals and highlights that player by immutable ID on phone, tablet, and desktop. The highlight is visible without color perception. The fee step and the contract-negotiation step both still occur; no money moves and no negotiation opens from the CTA itself. Reports for unavailable players show a disabled CTA with a localized reason.

**F4** — The PR states, with evidence, whether the reported build was stale. `contractWageStep` behavior is pinned by the §13.3 table. The step is stable for a whole negotiation and across reload. The step number is explained in the UI in all seven locales. No wage arithmetic changed.

**F5** — An unbeaten league title plus Hero Cup outranks every routine event. Unbeaten counts draws. A title alone outranks a routine event. The ES Season 9 recap no longer names a player request as the story of the year. No persisted recap field changed.

**F6** — A resolved transfer request is visibly resolved, exposes no actionable control, and does not count toward unread or urgent counts. Every transition in §10.4 clears the flag. Old saves resolve stale items on first load with no migration.

**Cross-cutting** — No new dependency. No save version bump. All seven locales complete. Golden diffs all explained by 2A/2B. The concurrent worktree files are untouched by this work.

## 16. Rollout order

Six sequential PRs. Each is independently revertible and ships green.

1. **PR-0 — Wage-step triage and provenance (F4).** Verification per §8.1, the §13.3 pin tests, the step-explainer caption + copy, and the build stamp. Cheapest PR, and its finding may turn out to require no behavior change at all — establish that before anyone rewrites arithmetic.
2. **PR-1 — Identity foundation (F1).** Audit fixes, `squadDisplayNames`, generation collision avoidance, the `localeCompare` removal, identity + source-contract tests. Everything downstream depends on ID-keyed identity being trustworthy.
3. **PR-2 — Lineup correctness (F2).** Fixes 2A–2E plus the golden re-baseline. Largest blast radius; lands with identity already solid and alone in its PR so golden diffs are unambiguous.
4. **PR-3 — Scout CTA and Deals focus (F3).** Depends on PR-1 for ID-keyed focus and disambiguated names.
5. **PR-4 — Inbox lifecycle (F6).** Depends on PR-1 for ID-keyed resolution.
6. **PR-5 — Story of the Year (F5).** Independent; last because it is the lowest-severity finding and purely presentational.

Gate between PR-2 and PR-3: a full ES career smoke run must be clean before UI work stacks on top of a comparator change.

## 17. Runtime QA

**Locale sweep.** Every new surface visited in all seven locales at default and largest text scale; no raw keys, no clipping, no mid-word font fallback.

**Device matrix.** Phone ≈390 pt, tablet ≈834 pt, desktop ≥1280 pt. For each: report card CTA visible without horizontal scroll; navigation lands on Deals; the correct listing is highlighted and scrolled into view; the highlight survives a rotation.

**Scripted Spanish full-career run (the finding-for-finding replay):**
1. Sign or promote a player whose name duplicates an existing squad member; awaken one of them. Confirm the other keeps their license, promise, and shirt. Confirm the license list shows both rows, distinguishable. *(F1)*
2. Change formation with a full squad, with an injury-thinned squad, and with zero available goalkeepers. Confirm preserved starters, correct surplus removal, and a soft rejection in the third case. *(F2)*
3. Let a starter awaken mid-season; buy a permit; confirm they return to their slot with no manual swap. *(F2/D-4)*
4. Complete a scout report; press "Sign the player"; confirm Deals opens with that exact player highlighted; complete the fee step and the contract step and confirm neither was skipped. *(F3)*
5. Open a negotiation with an ask above $1,100 and confirm the step exceeds $50 and matches the caption; step to the wage floor and confirm the clamp; reload mid-negotiation and confirm the step is unchanged. *(F4)*
6. Finish a season unbeaten with draws, winning the league and the Hero Cup, with a resolved player request late in the season. Confirm the story reads as the double. *(F5)*
7. Trigger a transfer request, renew the player's contract, and confirm the inbox item becomes non-actionable and leaves the urgent count; advance two weeks and confirm it archives. *(F6)*

**Save compatibility.** Load a pre-change ES career save: it opens, plays, and shows resolved inbox items and improved story ranking immediately, with no crash and no renamed players. Save in the new build, load in the previous build: it still opens.

**Determinism.** Run the same seed twice end-to-end; the final table, the automatic XI, and slot order must match byte for byte.

## 18. Risks

| Risk | Mitigation |
|---|---|
| Comparator fixes shift historical golden fixtures | Isolated PR-2, explained-diff rule, no other change in the same PR |
| License headroom consumed by an early repaired slot | Documented, deterministic, cap still enforced by the existing filter; covered by test |
| Generation collision avoidance changes name-pinning goldens | Zero-extra-RNG design keeps non-colliding seeds identical; only colliding cases change, and those are re-baselined deliberately |
| `returnLineupSlot` reuse holds a shirt for a never-licensed hero | Cleared on manual swap into the slot and at season rollover |
| Scroll-into-view fires repeatedly on re-render | Effect keyed on `focusPlayerId`; covered by test |
| A locale ships with a raw key | `LOCALES` sweep test blocks merge |
| Wage step "fix" is written for a non-bug | PR-0 verification gate runs before any arithmetic is touched |

## 19. Explicitly out of scope

The concurrent worktree changes (cup Final prize `25_000 → 100_000`, the non-money downside warning panel in `PlayerRequestDecisionCard`, and their i18n and test additions) are unrelated work and are not part of this specification. Do not modify, revert, extend, or rebase-squash them. New i18n keys are appended to each locale file rather than inserted into their edited regions to keep merges clean.
