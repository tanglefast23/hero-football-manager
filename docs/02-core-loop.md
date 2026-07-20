# 02 — Core Loop & Season Structure

## The week: the game's heartbeat

Time advances in weeks. One button — **Advance Week** — is the game's primary CTA, always visible on Home. A week resolves in this order:

1. **Manage phase** (player-driven, untimed): set training plans, handle transfers/contracts, build facilities, respond to any event card.
2. **Match day** (if scheduled): pre-match screen (lineup, formation, tactic, hero power priorities) → Watch or Quick Result → post-match income statement (itemized, Kairosoft-style: tickets, sponsor fees, prize, minus wages).
3. **Week tick**: wages paid, training results applied, stamina recovers, injuries count down, sponsor/fan numbers update, next event rolls.
4. **Weekly Review**: a fast 2–4 second payoff shows the exact cash movement at the top, spotlights focused trainees and their stat gains in the center, and lists only applicable recovery, contract, event, or next-fixture updates. One tap finishes every animation immediately. On match weeks, player development is folded into the post-match statement instead of adding another screen.

Session math: a match week ≈ 3–6 minutes (watched) or ~90 seconds (simmed). Non-match weeks ≈ 30–90 seconds. The loop is playable one-handed in portrait.

## The season (~30 weeks)

| Phase | Weeks | What happens |
|---|---|---|
| Pre-season | 4 | Contract renewals, sponsor negotiations, friendlies (small income, safe TP), 1–2 scouting windows |
| League + Cup | 24 | 18 league matches (10-team division, home/away) + National Cup knockout rounds woven between; transfer window mid-season (2 weeks) |
| Post-season | 2 | Prize money, awards (Golden Boot, Hero of the Season), aging & retirements, promotion/relegation, season recap |

## The pyramid (long-term goal ladder)

- **D5 · District League → D4 · County League → D3 · Regional League → D2 · National Championship → D1 · Global League**: 10 teams each; top 2 promoted, bottom 2 relegated. Each division up means better sponsors, bigger gates, stronger opponents — and more opposing heroes. Global League clubs begin around 84–92 strength and can rise toward 92–99 across a long career; 100 remains exceptional rather than routine.
- **National Cup**: all-divisions knockout, entered every season. Giant-killing = big prize + fame spikes.
- **Career victory**: win D1 · Global League to complete the main climb. Endless play continues afterward, and a score recap (Kairosoft-style) shows after Season 10 regardless of progress; nothing ends.

Promotion rewards are permanent: relegation changes the current opposition, not the club knowledge and infrastructure already earned.

| First reach | Permanent club rewards currently wired |
|---|---|
| D4 · County League | Level 2 facilities, expanded international scouting, Level 2 coach access (Fame still required) |
| D3 · Regional League | Rumored Hero scouting, third Hero License, Level 3 coach access |
| D2 · National Championship | Level 3 facilities, Elite Prospect scouting, Level 4 coach access |
| D1 · Global League | Fourth Hero License, Level 5 coach access |

Opposing club strength scales with division and season count (slow, season-level scaling — never instant rubber-banding, and never "you won too big so they get stronger," which research showed players hate).

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
