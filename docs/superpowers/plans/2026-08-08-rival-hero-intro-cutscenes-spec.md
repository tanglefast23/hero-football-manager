# Spec — first-meeting rival hero intro cutscenes

Date: 2026-08-08
Status: revision 5 — owner-approved, implemented, and visually refined after Grok and repository-flow review
Builds on: `2026-08-08-special-heroes-spec.md`

## 1. The decision

The first time a career reaches Match Day against the club currently fielding one of the
five division-headline rival heroes, a short character cutscene plays **before** the
ordinary screen where the manager swaps starters and chooses Play or Quick Result.

The cutscene has two beats:

1. The rival hero is already standing in the lower centre of the scene. A card above them
   reveals their Super Power, animates in, holds, and animates away.
2. With the hero still in the same place, the normal in-game speech bubble appears and the
   hero delivers one funny, character-specific taunt.

The scene plays once per featured hero per career, not once per club or season. The rival
heroes can change host clubs between seasons, so a club-based flag would replay a hero the
player has already met and could suppress a hero they have not.

Each hero uses the owner-supplied 2048×2048 pixel-art backdrop listed below. The screen
keeps one typed, hero-keyed static asset lookup and uses solid black (`#000000`) only as a
defensive render fallback if an asset cannot load.

| Hero ID        | Bundled backdrop                                    |
| -------------- | --------------------------------------------------- |
| `special-f171` | `assets/images/rival-hero-intros/barry-allan.png`   |
| `special-f178` | `assets/images/rival-hero-intros/scott-somers.png`  |
| `special-f174` | `assets/images/rival-hero-intros/steve-rodgers.png` |
| `special-f176` | `assets/images/rival-hero-intros/bruno-bannor.png`  |
| `special-f168` | `assets/images/rival-hero-intros/bruce-wain.png`    |

## 2. The five featured rivals

These are the existing order-1 special rival in each division. Only these five receive
this scene; the other six placed specials and four scout-only specials do not.

| Division | Hero ID        | In-game name  | Look   | Role | Super Power    |
| -------- | -------------- | ------------- | ------ | ---- | -------------- |
| D5       | `special-f171` | Barry Allan   | `f171` | FWD  | Super Speed    |
| D4       | `special-f178` | Scott Somers  | `f178` | FWD  | Thunder Strike |
| D3       | `special-f174` | Steve Rodgers | `f174` | DEF  | Rally Cry      |
| D2       | `special-f176` | Bruno Bannor  | `f176` | DEF  | Super Strength |
| D1       | `special-f168` | Bruce Wain    | `f168` | DEF  | Shadow Mark    |

**Bruce Wain is the correct in-game spelling.** All five names are deliberate fictional
near-misses; the real superhero identities remain development references only.

## 3. Taunt choices

Exactly one line per hero ships in `content/rival-hero-intros.json`. The alternatives stay
in this design record rather than in the game data, so there is no hidden random choice and
no extra translation burden.

### Bruce Wain — choose one

1. "I studied every one of your tactics. Then I bought the stadium. Much quicker."
2. "My superpower is preparation. My backup superpower is an absurd transfer budget."
3. "The shadows belong to me. The floodlights do too—I paid for them."
4. "You brought a game plan? Cute. I brought twelve game plans and a private jet."
5. "I have a plan for every player on your team. I also have the receipts."

Selected: **2 — “My superpower is preparation. My backup superpower is an absurd transfer budget.”**

### Bruno Bannor — choose one

1. "Please don't make me angry. The groundskeeper just fixed the goalposts."
2. "I tried counting to ten. I got bored at three. BRUNO SMASH!"
3. "Your striker looks strong. Adorable."
4. "I came for football. The smashing is just cardio."
5. "If the ball goes flat, that means I passed it gently."

Selected: **1 — “Please don’t make me angry. The groundskeeper just fixed the goalposts.”**

### Steve Rodgers — choose one

1. "I can do this all match. Your stamina bar cannot."
2. "Team, assemble! Yes, even the substitute keeper."
3. "My rally cry has three words: PASS. TO. STEVE."
4. "I brought the shield. You should have brought shin pads."
5. "I believe in freedom, teamwork, and winning every fifty-fifty."

Selected: **2 — “Team, assemble! Yes, even the substitute keeper.”**

### Scott Somers — choose one

1. "The visor stays on. Your clean sheet probably won't."
2. "I only need one look at goal. Good thing this visor keeps it focused."
3. "My shooting coach said 'keep your eyes on the ball.' I may have overdone it."
4. "Red means stop. Unless it's coming from my visor—then it means duck."
5. "I lead from the front. Mostly because nobody stands in front of the visor."

Selected: **3 — “My shooting coach said ‘keep your eyes on the ball.’ I may have overdone it.”**

### Barry Allan — choose one

1. "I'll be in your box before this speech bubble disappears."
2. "Don't blink. Actually, blink—my highlight reel needs drama."
3. "I ordered the halftime snacks. They arrived yesterday."
4. "Your defence has pace. I have somewhere else to be."
5. "The good news: this match will be over quickly. For me."

Selected: **1 — “I’ll be in your box before this speech bubble disappears.”**

## 4. Exact player experience

### 4.1 Entry

- Match Day is reached through any real route: league, National Cup, onboarding, a shared
  league-and-Cup week, or a restored save already at Match Day.
- “The live fixture” always means the exact fixture `activeCareerMatchday` will hand to
  Play or Quick Result. Its existing contract is league first on a double-header week. Once
  that league match is settled, the same career remains on Match Day for the Cup fixture;
  the intro rule re-evaluates against that Cup opponent before the second team sheet opens.
- If a featured rival intro is pending, it replaces the ordinary Match Day screen. The
  lineup screen does not mount behind it and cannot receive an accidental tap.
- The existing menu music continues. There is no new music switch, voice clip, or SFX.
- The hero sprite is visible immediately on its stationary canonical frame, centred
  horizontally and grounded near the bottom. `PlayerRunSprite` has no front-facing frame,
  and this feature does not authorize new sprite art. The hero does not walk on or change
  position between beats.
- Barry Allan is the guaranteed opponent in the career's first match, while that onboarding
  match deliberately suppresses every power for both clubs. The owner-approved policy is to
  keep this first-meeting cutscene and treat its Super Speed card as a character/power
  teaser; Barry still cannot fire it in that one tutorial match.

### 4.2 Power reveal beat

- A bold localized pixel-comic banner reading `DIVISION RIVAL` sits above the character and
  remains visible through both the power and speech beats. It is scene identity, not a
  third timed beat and not part of the power card.
- The production hero look is rendered with `PlayerRunSprite`; no portrait substitute or
  hand-built harness art is allowed.
- The production power presentation supplies the localized name, glyph, and canonical
  power colour. The card says `SUPER POWER`, shows the glyph and power name, and names the
  hero. It never says `POWER COMPLETE`.
- The card sits above the hero without covering their face. It scales/fades upward into
  place over about 240 ms, holds for about 1.4 seconds, and scales/fades away over about
  300 ms. The speech bubble starts only after the card is gone.
- Tapping during this beat skips the remaining hold and takes the same short exit into the
  speech beat. Repeated taps cannot skip the taunt before it appears.
- With VoiceOver, TalkBack, or another screen reader enabled, the card does **not** time
  out. It remains until the player activates it, so focus cannot be stolen while the power
  announcement is still being read.
- If the app backgrounds during the power beat, its timer and exit are cancelled. Returning
  to the active app restarts that power reveal from the beginning rather than landing on a
  speech beat whose card the player never saw. Backgrounding during speech may finish the
  visual typewriter, but never completes or dismisses the taunt.

### 4.3 Speech beat

- The same mounted hero remains in the same place; there is no one-frame disappearance or
  sprite reset between the card and bubble.
- The existing `CharacterSpeechOverlay` treatment draws the hero name as the heading and
  the selected taunt as one bubble. Its default placement remains unchanged everywhere
  else; this scene opts into a new centre-position parameter.
- The taunt uses the existing typewriter treatment. The first tap while text is typing
  reveals the whole line. A later tap closes the scene. Reduced Motion shows the whole
  line immediately, so one tap closes it.
- The completion flag is written only when the player finishes this speech beat. Closing
  the app during the card or speech leaves it unseen, so it replays on the next load of
  that same eligible Match Day.
- This is a blocking story beat. It exposes no in-game Back, rail, calendar, or Settings
  control. Hardware Back and the accessibility escape gesture follow the same safe advance
  rule as a tap: card → speech, typing → full line, full line → finish. An operating-system
  close or process kill merely cancels it and writes no flag.

### 4.4 Handoff and ordering

Match Day owns one derived blocking-presentation slot, not a collection of independent
overlays. After completion, the app stays on the same persisted Match Day and re-evaluates
that slot. The next visible item is:

1. any still-pending featured rival intro (only possible in malformed or future data),
2. the existing large National Cup mismatch warning from Bert,
3. the existing low-condition starter warning,
4. the ordinary starter-swap / Play / Quick Result screen.

No two blocking character scenes may mount or overlap. Only the active slot's completion
action can advance the sequence; none of those completion actions starts the match.
Entry to and exit from the rival intro are hard cuts through the app's whole-screen
transition. The normal dissolve deliberately keeps the outgoing screen mounted over a
tappable incoming screen; using it here would make the lineup interactive while the rival
was still visibly talking.

## 5. Trigger and once-per-career contract

The pure game rule derives a pending intro from the current career:

1. `activeCareerMatchday(state)` must return a live league or Cup fixture.
2. Resolve the opponent club from that fixture and `state.userClubId`.
3. Find a player whose `clubId` is that live opponent and whose stable ID is one of the
   five featured hero IDs in §2.
4. Suppress a hero whose flag already exists:
   `story:rival-hero-intro:<heroId>`.
5. If abnormal data puts more than one unseen featured hero on the opponent, use the fixed
   career-progression order D5 → D1 and re-evaluate after each completion. Normal authored
   careers always have one.

Consequences:

- The first league or Cup meeting qualifies; whichever is encountered first wins.
- A hero changing host clubs does not replay.
- A hero bought by the user does not trigger, because they are no longer on the opponent.
- A hero on an unrelated club does not trigger.
- Being on the opponent roster is sufficient. It need not be re-proven through the lineup;
  the authored special is already the club's highest-rated player, and the owner's rule is
  about facing the team that has them.
- Old saves need no migration. They lack the new flag and show the scene at their next
  eligible meeting.
- Completion carries the hero ID the mounted screen expected. It is idempotent when that
  hero is already complete, and otherwise only marks the same hero still returned by the
  pending selector. A stale duplicate from hero A can never consume hero B if malformed or
  future data chains two scenes. The scene is keyed by hero ID so its local power/speech
  phase resets between them.

The scene is derived while the persisted application screen remains `matchday`; it is not
a new saved `M1Screen`. This covers every current and future route into Match Day in one
place and preserves the existing audio theme.

`watchMatch`, `quickResult`, and the Match Day path through `setActiveTab` independently
refuse to proceed while an intro is pending. The visible buttons are absent during the
scene, but the store guards protect against a stale callback, double-tap, hardware/a11y
dismissal, or future alternate entry. This also means an interrupted intro cannot lose
eligibility through ordinary play: the same saved Match Day and opponent remain current
until the scene is finished. No second “armed but unfinished” save marker is needed.

## 6. Content and localization

The selected English taunts are authored as typed content rather than executable UI copy:

```json
{
  "schemaVersion": 1,
  "intros": [{ "heroId": "special-f171", "taunt": "..." }]
}
```

The schema requires exactly one non-empty taunt for each of the five known IDs, rejects
duplicates and unknown IDs, and caps a line at 160 characters so it stays a single compact
speech beat. A cross-catalog test proves each ID is still the order-1 placed special and
that its canonical look and power resolve.

`contentStrings()` flattens each line to
`rivalHeroIntro.<heroId>.taunt`. At runtime `copyOrEnglish` returns a translated line when
present and the authored English otherwise. Because every existing content source is at a
100% localization high-water mark, the five selected lines are translated into all six
enabled non-English locales in the same change; the new source joins the same 100% gate.

Short UI chrome and accessibility text live in `content/i18n/en.json` and have exact key
parity in all enabled locales. Hero names remain untranslated proper nouns. Existing power
names are reused, not duplicated.

## 7. Implementation surface

### Pure game ring

- `src/game/rival-hero-intro.ts`
  - identifies the five eligible order-1 placed heroes,
  - derives the pending hero from the live opponent,
  - formats/checks the stable flag,
  - marks the currently pending intro complete without mutation or duplication.
- Export the rule through `src/game/index.ts`.

This reads no clock or RNG, consumes no match RNG, changes no simulation output, and does
not require an `ENGINE_VERSION` bump or replay snapshot update.

### Content/application seam

- `content/rival-hero-intros.json`
- `src/content/schemas.ts` and `src/content/load.ts`
- `src/i18n/content-strings.ts` and locale catalogs/gates
- A small presentation builder joins the pending canonical hero with its selected localized
  taunt. The hero name/look/role/power always come from `SPECIAL_HERO_ROSTER`; the content
  file is not allowed to duplicate them.
- `src/application/store.ts` owns completion/persistence and the Play/Quick Result guards.

### UI and app integration

- `src/ui/RivalHeroIntroScreen.tsx` owns the two-beat presentation, bundled hero-specific
  backdrop lookup, and black render fallback.
- `src/ui/CharacterSpeechOverlay.tsx` gains one optional, default-preserving character
  centre ratio; all existing call sites retain today's four-fifths placement.
- `App.tsx` derives the pending intro once, places this screen before normal Match Day,
  suppresses concurrent Bert/condition overlays until it is complete, and uses the light
  status-bar treatment over the dark illustrated stage. Other story/modals that can legally coexist at Match Day
  are deferred behind the same slot; global safety surfaces such as a save-failure warning
  keep their existing priority.

## 8. Layout, art, motion, and accessibility

- The five supplied backdrops are bundled without smoothing and use one shared responsive
  composition per orientation. Portrait uses a `1.08` square zoom; short/wide layouts use
  `1.35`. Both are centred horizontally, anchored to the bottom, and place the hero at the
  same normalized stage mark (`x 0.50`, `y 0.88`) for all five scenes. This keeps the
  environment readable, shows substantially more backdrop than the former cover crop, and
  puts Bruce on the foreground cave stair. The hero sprite, banner, card decoration, power
  colour, type, and speech bubble remain on the existing art system. Solid black is only a
  safe missing-asset fallback.
- The scene must fit a narrow 320-point portrait viewport and short landscape/desktop
  viewport without clipping the card, hero, bubble, or bubble tail.
- Hero scaling remains an integer so pixel edges stay hard.
- Reduced Motion preserves both semantic beats but removes translation, overshoot, and
  spring movement: static card, short readable hold/fade, then fully revealed speech.
- The power card is one accessible button whose label includes hero name and localized
  power name, with a hint that tapping continues to the taunt. Screen-reader use disables
  its timer and requires explicit activation.
- The speech beat becomes the modal accessibility focus and announces the full taunt. It
  uses the existing “show full line” / “tap anywhere to finish” hints. Focus moves to the
  active card/bubble target on iOS, Android, and web rather than relying on platform luck.
- The `DIVISION RIVAL` banner is localized and included in the active beat's accessible
  name without becoming a second focus target.
- Decorative backdrop/card rails/shadows and the duplicate visual sprite are hidden from
  the accessibility tree. There is one meaningful focus target per beat.
- No SFX table entry is added and no haptic is introduced.

## 9. Dev Harness

Add one `Rivals` entry at `src/ui/dev-harness/entries/rival-hero-intro.tsx`, registered in
the normal registry, with five stable production-backed cases:

- `#/dev/rival-hero-intro/barry-allan`
- `#/dev/rival-hero-intro/scott-somers`
- `#/dev/rival-hero-intro/steve-rodgers`
- `#/dev/rival-hero-intro/bruno-bannor`
- `#/dev/rival-hero-intro/bruce-wain`

Each case renders the production screen with the real canonical hero, power presentation,
look, and validated taunt. It may not hand-build a look or power card. Entry-owned controls
provide Replay and a Full Motion / Reduced Motion toggle without multiplying the five menu
cases. Harness controls use static `minHeight` and add no audio.

## 10. Acceptance criteria

1. The five names, looks, roles, powers, and division mappings exactly match §2.
2. Bruce is spelled **Wain** everywhere player-facing.
3. The scene appears before the lineup/Play/Quick Result screen on the first eligible
   league or Cup meeting in a career.
4. It triggers from the hero's current opponent-club membership, not division or club ID.
5. It does not trigger for a featured hero owned by the user or sitting at another club.
6. Completing a hero's speech writes exactly one hero-specific event flag.
7. That hero never replays in the same career, even after a season or host-club change.
8. Interrupting before completion writes no flag and the scene returns on reload.
9. Old saves show the scene at the next eligible meeting without migration.
10. Play, Quick Result, Match Day Back, hardware Back, and accessibility escape cannot
    bypass a pending intro or consume its flag without reaching the completed taunt.
11. The hero is visible immediately and remains mounted, centred, and near the bottom
    through the power and speech beats.
12. The localized Super Power card appears above the hero, animates in, holds, completely
    leaves, and only then reveals the speech bubble.
13. The selected one-line taunt uses the normal speech bubble and typewriter/tap behavior.
14. Reduced Motion preserves both pieces of information without spatial animation.
15. Each hero uses the correct bundled 2048-square backdrop through one typed mapping and
    the same responsive zoom/anchor/hero coordinates as the other four; solid black remains
    only as the safe render fallback.
16. A pending rival scene prevents Cup mismatch Bert and low-condition warnings from
    overlapping it; those resume in the defined order afterward.
17. The existing menu audio continues and no new SFX/haptic is added.
18. No `src/sim` behavior, RNG use, replay output, or `ENGINE_VERSION` changes.
19. All five production-backed scenes are bookmarkable and replayable in the Dev Harness.
20. Focused tests, TypeScript, the full test suite, static export, and visual checks on
    portrait plus short/wide layouts pass before handoff.
21. On a league-and-Cup double-header, the rule evaluates the same league-first active
    fixture as Play/Quick Result, then re-evaluates against the Cup opponent after league
    settlement.
22. A screen reader prevents timed power-card dismissal and receives one stable focus
    target for each beat.
23. Under the approved Barry teaser policy, his intro still opens before the first onboarding
    match, while that match remains powerless and its results/onboarding balance are
    unchanged.
24. Entry and handoff are hard cuts: the lineup is never tappable while any pixel of the
    rival scene remains visible.
25. Backgrounding during the power beat restarts that beat on resume and never skips unseen
    information or writes completion.
26. A stale duplicate completion naming hero A cannot mark a different currently pending
    hero B.
27. A localized `DIVISION RIVAL` banner remains above the hero through the power and speech
    beats without adding a third focus stop or timed phase.

## 11. Explicit non-goals

- New or replacement backdrop art beyond the five supplied assets.
- Intro scenes for the other ten named specials.
- Random or branching dialogue.
- Voice acting, new music, new SFX, or new haptics.
- A new persisted screen type or save migration.
- Any match-engine, balance, power-behaviour, roster-placement, or transfer change.

## 12. Resolved owner decisions

- The five selected taunts are recorded in §3.
- Barry uses the teaser policy: his cutscene plays before the first onboarding match while
  that one match remains powerless for both clubs.
- The five supplied 2048×2048 images are the production backdrops in §1.
- Every scene carries the localized `DIVISION RIVAL` banner described in §4.2.
