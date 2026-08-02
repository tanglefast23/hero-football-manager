# 02 — Core Loop & Season Structure

## The week: the game's heartbeat

Time advances in weeks. One button — **Advance Week** — is the game's primary CTA, always visible on Home. A week resolves in this order:

1. **Manage phase** (player-driven, untimed): spend the TP bank on instant drills, handle transfers/contracts, build facilities, respond to any event card.
2. **Match day** (if scheduled): pre-match screen (starting eleven, bench swaps, hero licenses — formation, Playstyle and Energy Use are live match controls, not pre-match ones) → Watch or Quick Result → post-match income statement (itemized, Kairosoft-style: tickets, sponsor fees, prize, minus wages).
3. **Week tick**: wages paid, the week's TP income banked, condition recovers, injuries count down, sponsor/fan numbers update, next event rolls. Training results are not settled here — drills resolve the moment they are tapped.
4. **Weekly Review**: a fast 2–4 second payoff shows the exact cash movement at the top, the TP the week just banked beneath it, and lists only applicable recovery, contract, event, or next-fixture updates. One tap finishes every animation immediately. On match weeks, player development is folded into the post-match statement instead of adding another screen.

Session math: a match week ≈ 3–6 minutes (watched) or ~90 seconds (simmed). Non-match weeks ≈ 30–90 seconds. The loop is playable one-handed in portrait.

## The season (~30 weeks)

| Phase | Weeks | What happens |
|---|---|---|
| Pre-season | 4 | Contract renewals, sponsor negotiations, friendlies, 1–2 scouting windows |
| League + Cup | 24 | 18 league matches (10-team division, home/away) + National Cup knockout rounds woven between; transfer window mid-season (2 weeks) |
| Post-season | 2 | Prize money, awards (Golden Boot, Hero of the Season), aging & retirements, promotion/relegation, season recap |

## The pyramid (long-term goal ladder)

- **D5 · District League → D4 · County League → D3 · Regional League → D2 · National Championship → D1 · Global League**: 10 teams each; top 2 promoted, bottom 2 relegated. Honest raw squad-strength bands are D5 **40–50**, D4 **90–102**, D3 **135–151**, D2 **178–203**, and D1 **223–248**. The ordinary-support anchors are 40/88/130/175/214, each club's DEF/MID/FWD specialist has an explicit 94/180/268/356/442 role focus, and goalkeeper REF is 80/153/228/303/376. The first D4 season deliberately installs two 39/40 whole-squad relegation strugglers so a promoted D5 champion that prepares can survive; it does not weaken D4's established middle/top or the D3 clubs coming down. A new club begins at 40 against the same authored opening sequence: 50 at home, 45 away, 46 at home, 43 away, then 42 at home. Each division up means better sponsors, bigger gates, stronger opponents — and more opposing heroes.
- **National Cup**: all-divisions knockout, entered every season. Its first settlement is around Week 10, after the opening league run. The draw freezes every entrant's division. A deterministic long-tailed performance model keeps same-division ties competitive while letting a lower club win roughly **5–10%** of one-division-gap ties and **1–2%** of two-plus-division gaps. Every player-controlled giant-killing gets Bert's post-result walk-on: enthusiastic for one division, full **GIANT-KILLERS!** treatment for two or more. AI-only upsets never interrupt the player.
- **Career victory**: win D1 · Global League to complete the main climb. Endless play continues afterward, and a score recap (Kairosoft-style) shows after Season 10 regardless of progress; nothing ends.

Promotion rewards are permanent: relegation changes the current opposition, not the club knowledge and infrastructure already earned.

| First reach | Permanent club rewards currently wired |
|---|---|
| D4 · County League | Recruitment fund · $15,000, tier 2 drills on sale, expanded international scouting, Level 2 coach access (Fame still required) |
| D3 · Regional League | Tier 3 drills on sale, Rumored Hero scouting, third Hero License, Level 3 coach access |
| D2 · National Championship | Tier 4 drills on sale, Level 3 facilities, Elite Prospect scouting, Level 4 coach access |
| D1 · Global League | Tier 5 drills on sale, fourth Hero License, Level 5 coach access |

Level 2 facilities are **not** a promotion reward: they are available from D5, because gating the club's main training accelerator behind the promotion it was needed to earn measured 0 promotions across 6 careers × 10 seasons. A drill tier reaching the shelf is likewise not the same as owning it — each path is bought separately (doc 05).

Opposing club strength scales with division and season count (slow, season-level scaling — never instant rubber-banding, and never "you won too big so they get stronger," which research showed players hate). At each season boundary every non-user rating grows by **3% on Cozy** or **4% on Chairman**, with deterministic per-player/per-stat stochastic rounding and difficulty caps (700/800). The same percentage applies to support players, specialists, and goalkeeper REF.

## Failure is soft, never fatal

The user should feel money pressure without fearing a game-over screen.

1. **Season 1 safety net**: the league covers 50% of your wage bill in Season 1 ("new club subsidy" — Game Dev Story's proven tutorial-protection pattern, halved rather than total so wages still teach).
2. **Negative balance** → board warning banner; transfers and construction locked.
3. **4 weeks negative** → one-time **emergency loan** (20,000, repaid at 10% interest over the next season).
4. **Still sinking** → board ultimatum: the board sets a cash target and a 4-week deadline. You choose what to sell — the board proposes 3–4 sale candidates, and you may mark **one player as protected** (your hero, your academy kid — untouchable). Miss the deadline and the board sells from the unprotected list itself, at a discount, with a fan/morale hit. The pressure is real; the heartbreak is never random. (An auto-sale of your favorite player would violate the cozy pillar harder than a game-over screen.)
5. There is no step 5. You can always limp on with youth players and rebuild.

## Difficulty settings

- **Cozy** (default): as above.
- **Chairman mode**: no Season-1 subsidy, one loan only, harsher sponsor objectives. For Kairosoft veterans who found Pocket League Story too easy (a common review complaint — we keep real money tension available).
