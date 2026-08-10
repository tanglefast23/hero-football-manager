# 02 — Core Loop & Season Structure

## The week: the game's heartbeat

Time advances in weeks. One button — **Advance Week** — is the game's primary CTA, always visible on Home. A week resolves in this order:

1. **Manage phase** (player-driven, untimed): spend the TP bank on instant drills, handle transfers/contracts, build facilities, respond to any event card.
2. **Match day** (if scheduled): pre-match screen (starting eleven, bench swaps, hero licenses — formation, Playstyle and Energy Use are live match controls, not pre-match ones) → Watch or Quick Result → the post-match **Financial Report** (itemized, Kairosoft-style: tickets, sponsor fees, prize, minus wages — revealed row by row as slot reels).
3. **Week tick**: wages paid, the week's TP income banked, condition recovers, injuries count down, sponsor/fan numbers update, next event rolls. Training results are not settled here — drills resolve the moment they are tapped.
4. **Weekly Review**: a fast 2–4 second payoff shows the exact cash movement at the top, the TP the week just banked beneath it, and lists only applicable recovery, contract, event, or next-fixture updates. One tap finishes every animation immediately. On match weeks, player development is folded into the post-match statement instead of adding another screen.

Session math: a match week ≈ 3–6 minutes (watched) or ~90 seconds (simmed). Non-match weeks ≈ 30–90 seconds. The loop is playable one-handed in portrait.

## The season (~30 weeks)

| Phase | Weeks | What happens |
|---|---|---|
| Pre-season | 4 | Contract renewals, sponsor negotiations, friendlies, 1–2 scouting windows |
| League + Cup | 26 | 18 league matches (10-team division, home/away) + Hero Cup knockout rounds woven between; transfer window mid-season (2 weeks) |
| Post-season | — | Prize money, awards (Golden Boot, Hero of the Season), aging & retirements, promotion/relegation, season recap |

The last league round is pinned to **Week 30**, so every season ends on a match and the post-season settles the moment the manager walks off that pitch. It has no weeks of its own: the season used to finish in Week 28 and leave two dead weeks the manager still had to advance through.

## The pyramid (long-term goal ladder)

- **D5 · District League → D4 · County League → D3 · Regional League → D2 · National League → D1 · Global League**: 10 teams each; top 2 promoted, bottom 2 relegated. Honest raw squad-strength bands are D5 **40–50**, D4 **55–63**, D3 **67–75**, D2 **80–90**, and D1 **107–120** — each promotion step sized to what one season of growth can hold (`src/game/pyramid.ts` is the source of truth). The ordinary-support anchors are 40/54/65/77/103, each club's DEF/MID/FWD specialist has an explicit 94/111/133/159/212 role focus, and goalkeeper REF is 80/94/113/135/180. A new club begins at 40 against the same authored opening sequence: 50 at home, 45 away, 46 at home, 43 away, then 42 at home. Each division up means better sponsors, bigger gates, stronger opponents — and more opposing heroes.
- **Hero Cup**: all-divisions knockout, entered every season. Its first settlement is around Week 10, after the opening league run. The draw freezes every entrant's division. A deterministic long-tailed performance model keeps same-division ties competitive while letting a lower club win roughly **5–10%** of one-division-gap ties and **1–2%** of two-plus-division gaps. Every player-controlled giant-killing gets Bert's post-result walk-on: enthusiastic for one division, full **GIANT-KILLERS!** treatment for two or more. AI-only upsets never interrupt the player.
- **Career victory**: win D1 · Global League **and** the Hero Cup to complete the main climb. Either order; whichever trophy completes the pair plays the true ending. The Cup was added as a second requirement because a ladder can be ground out — by the time a club reaches D1 it already controls the result — and a knockout cannot, so the climb ends on something the manager has to actually win. It is also what gives the D1 plateau a purpose: before this, a club that took D1 replayed it with nothing left to chase. Each half on its own gets its own screen, pointing at the other one. Endless play continues afterward; nothing ends. The career's record is kept in the Hall of Fame, captured at the moment the climb completes and opened from Settings.

Promotion rewards are permanent: relegation changes the current opposition, not the club knowledge and infrastructure already earned.

| First reach | Permanent club rewards currently wired |
|---|---|
| D4 · County League | Recruitment fund · $15,000, tier 2 drills on sale, expanded international scouting, Level 2 coach access (Fame still required) |
| D3 · Regional League | Tier 3 drills on sale, Rumored Hero scouting, third Hero License, Level 3 coach access |
| D2 · National League | Tier 4 drills on sale, Level 3 facilities, Elite Prospect scouting, Level 4 coach access |
| D1 · Global League | Tier 5 drills on sale, fourth Hero License, Level 5 coach access |

The first reach of each higher division also adds **500 fans** to the club's existing supporter total. It never replaces the total with a division floor, never removes fans after relegation, and does not pay the same division step twice after re-promotion.

Level 2 facilities are **not** a promotion reward: they are available from D5, because gating the club's main training accelerator behind the promotion it was needed to earn measured 0 promotions across 6 careers × 10 seasons. A drill tier reaching the shelf is likewise not the same as owning it — each path is bought separately (doc 05).

Opposing club strength scales with division and season count (slow, season-level scaling — never instant rubber-banding, and never "you won too big so they get stronger," which research showed players hate). At each season boundary every non-user rating grows by **3% on Cozy** or **4% on Chairman**, with deterministic per-player/per-stat stochastic rounding and difficulty caps (700/800). The same percentage applies to support players, specialists, and goalkeeper REF.

## Failure is soft, never fatal

The user should feel money pressure without fearing a game-over screen.

1. **Season 1 safety net**: the league covers 50% of your wage bill in Season 1 ("new club subsidy" — Game Dev Story's proven tutorial-protection pattern, halved rather than total so wages still teach).
2. **Negative balance** → board warning banner; transfers and construction locked.
3. **4 weeks negative** (2 on Chairman) → one-time **emergency loan**, sized at max(20,000 — 10,000 on Chairman — or the deficit + 15,000) so it always clears the hole with a Stadium Stand's worth of cash left over; repaid at 10% interest over the next season.
4. **Still sinking** → board ultimatum: the board sets a cash target and a 4-week deadline. You choose what to sell — the board proposes 3–4 sale candidates, and you may mark **one player as protected** (your hero, your academy kid — untouchable). Miss the deadline and the board sells from the unprotected list itself, at a discount, with a fan/morale hit. The pressure is real; the heartbreak is never random. (An auto-sale of your favorite player would violate the cozy pillar harder than a game-over screen.)
5. There is no step 5. You can always limp on with youth players and rebuild.

## Difficulty settings

- **Chairman mode** (default): a harder game, not just a leaner budget — Season-1 subsidy cut to 40% (vs 50%), sponsor income at 80%, a half-size 10,000 emergency loan base, the board steps in after 2 negative weeks (vs 4), rivals grow 4%/season with an 800 attribute cap (vs 3%/700), the balance may sink to a −30,000 floor (vs −15,000) before board rescues clamp it, and harsher sponsor objectives (`chairmanDelta` in `content/sponsors.json`). For Kairosoft veterans who found Pocket League Story too easy (a common review complaint — we keep real money tension available).
- **Cozy**: the lower-pressure alternative that uses the safety net above.
