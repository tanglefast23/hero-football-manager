# 02 — Core Loop & Season Structure

## The week: the game's heartbeat

Time advances in weeks. One button — **Advance Week** — is the game's primary CTA, always visible on Home. A week resolves in this order:

1. **Manage phase** (player-driven, untimed): set training plans, handle transfers/contracts, build facilities, respond to any event card.
2. **Match day** (if scheduled): pre-match screen (lineup, formation, tactic, hero power priorities) → Watch or Quick Result → post-match income statement (itemized, Kairosoft-style: tickets, sponsor fees, prize, minus wages).
3. **Week tick**: wages paid, training results applied, stamina recovers, injuries count down, sponsor/fan numbers update, next event rolls.

Session math: a match week ≈ 3–6 minutes (watched) or ~90 seconds (simmed). Non-match weeks ≈ 30–90 seconds. The loop is playable one-handed in portrait.

## The season (~30 weeks)

| Phase | Weeks | What happens |
|---|---|---|
| Pre-season | 4 | Contract renewals, sponsor negotiations, friendlies (small income, safe TP), 1–2 scouting windows |
| League + Cup | 24 | 18 league matches (10-team division, home/away) + National Cup knockout rounds woven between; transfer window mid-season (2 weeks) |
| Post-season | 2 | Prize money, awards (Golden Boot, Hero of the Season), aging & retirements, promotion/relegation, season recap |

## The pyramid (long-term goal ladder)

- **Division 5 → Division 1**: 10 teams each; top 2 promoted, bottom 2 relegated. Each division up means better sponsors, bigger gates, stronger opponents — and more opposing heroes.
- **National Cup**: all-divisions knockout, entered every season. Giant-killing = big prize + fame spikes.
- **Continental Hero Cup**: unlocked while in Division 1. Opponents field full hero squads.
- **World Club Crown**: one-off final vs. the world champion after winning the Hero Cup. Winning it = "you've won the game."
- **After the Crown**: endless play continues. A score recap (Kairosoft-style) shows after Season 10 regardless of progress; nothing ends.

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
