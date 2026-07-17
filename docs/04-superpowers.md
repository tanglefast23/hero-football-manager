# 04 — Superpowers

The signature system. Powers must feel **rare** (pillar 3), **spectacular** (comic FX), and **fair** (interruptible wind-ups, GK Resolve attrition, license slots).

## Hero License slots (field cap)

League lore: superpowered players require a registered Hero License, and licenses per match are capped.

| Club prestige | Heroes on the pitch |
|---|---|
| Start (Div 5) | 2 |
| Reach Div 3 | 3 |
| Reach Div 1 | 4 |
| Win Continental Hero Cup | 5 |

You may *own* any number of heroes (bench/rotate them), but only licensed slots play. This keeps matches readable, makes each fielded hero a real decision, and gives prestige a tangible reward.

## The Hero Gauge (activation)

- Fills 0–100 during matches from involvement: +8 per touch, +15 tackle won, +20 shot on target, +12 save (GK), +2/10s trickle. (First-pass numbers; balance harness will tune.)
- Every power declares a **useful context** in its content JSON — the situation where firing matters. M0 examples: Super Speed = "this hero has the ball, or it's loose nearby"; Super Strength = "an opposing carrier within range"; Fire Torch = "hero on the ball, or an opposing carrier close". The hero chip glows brighter in context, teaching the read.
- Full → 8s **fire window**: tap = **100%** effect aimed at the current play. Window lapses = auto-fire at **75%** at the next useful context (hard deadline +4s so it's never wasted forever). Per-hero pre-match toggle: **Save for my tap** (window behavior) / **Fire when ready** (AI fires at the next useful context at **85%**; if no context appears within the same 12s deadline, it fires at 75% rather than waste the charge). Attention ladder: your tap > hero instincts > lapse — watching earns an edge, simming stays respectable, and the "perfect moment" is a real, legible decision.
- Wind-up 1.5s, interruptible by a tackle (attacker keeps 50% gauge if interrupted).
- Uses per match: gauge refills after firing, so realistically 1–2 activations per hero per match at Power Lv1.

## Power catalog (12 at launch)

Effects are sim modifiers; every power has a listed counterplay. Duration/magnitude shown at Lv1 → Lv3 (upgraded with Hero Essence).

### Rare tier (common-ish: most awakenings)

| Power | Effect | Counterplay / risk |
|---|---|---|
| **Super Speed** | Sprint ×2.2 speed with ball, 4s → 6s | Interruptible wind-up; tires: −15 STA after |
| **Rocket Shot** | Next shot +40 → +60 power, long range unlocked | GK Resolve absorbs; misses waste it |
| **Sticky Feet** | TEC +30, can't be dispossessed, 5s → 8s | Can still be body-blocked; slow movement |
| **Iron Wall** | DEF zone: +35 DEF to self & nearest teammate, 8s → 12s | Only affects one flank |
| **Magnet Gloves** (GK) | Auto-catch next 1 → 2 on-target shots | Timed — smart AI waits it out |

### Epic tier

| Power | Effect | Counterplay / risk |
|---|---|---|
| **Super Strength** | Mega slide tackle: wins ball, launches carrier (out 8s) | 25% yellow card, 5% red — risk your player |
| **Fire Torch** | Flaming run 5s: defenders shy away (−25 DEF near); one marker "catches fire" and is out until the ref extinguishes them (~10s) | 15% yellow; ref extinguisher is a recurring gag beat |
| **Freeze Zone** | Opponents within radius move −50%, 4s → 6s | Doesn't affect GK |
| **Teleport Blink** | Instantly skip past one defender with ball | Once per fire; brief disorientation after (−TEC 3s) |
| **Hawk Eye** | 15s: all long passes perfect accuracy | Passive-looking; needs teammates making runs |

### Legendary tier (Hero Lab / world-class signings only)

| Power | Effect | Counterplay / risk |
|---|---|---|
| **Time Slow** | 4s bullet time: whole team acts at ×1.5 relative speed | Team-wide STA −10 after |
| **Giant GK** (GK) | Grow huge: +60 REF and full Resolve restore for one attack | Once per match regardless of gauge |

Power levels: Lv1 (as awakened) → Lv2 (+duration/magnitude) → Lv3 (+secondary effect, e.g. Fire Torch Lv3 ignites *two* markers). Upgrades cost Hero Essence (doc 06).

## Getting powers (three doors)

1. **Chance events** (primary, doc 07): risky event choices carry a small base awakening chance, plus a **pity counter** — each risky choice that doesn't awaken adds +6% to the next one (persists across events, resets on awakening), and taking risks raises how often mystery events appear. Season 1 additionally guarantees a second-hero opportunity chain (the license cap must have something to bite on). Net cadence target: **~1 awakening per 1.5–2 risk-taking seasons** — asserted in the balance harness, not hoped for. Key hook (user design): an awakened player's **wage stays locked until their contract expires** — awaken a player on a fresh 3-season deal and you've got a bargain hero; at renewal their agent knows what they're worth (×3–5 wage demand).
2. **Pre-powered signings**: rare scouted "hero" players (★ marked), fame-gated (start appearing at Div 3). Huge signing fee + hero wages from day one. The expensive-but-certain door.
3. **Hero Lab** (endgame facility): pay 15,000 + 3 HE per attempt on a chosen player; 10% awakening odds, +5% per failed attempt on that player (pity), 10% risk of a 4-week "lab accident" injury. Turns late-game cash piles into hero pipeline.

Which power a player awakens is weighted by their stats and body type (a PAC-heavy skinny winger leans Super Speed; a DEF-heavy muscular unit leans Super Strength/Iron Wall) — awakenings feel *fitting*, not random.

## Balance rails (design promises)

- Div 5–4 are winnable with zero heroes; heroes accelerate, never gate.
- Opposing hero density ramps: Div 5 ~10% of teams field one → Div 1 all field 2–3 → Hero Cup full squads.
- Hero wages + license caps + Essence scarcity are the three tuning valves; the season-simulation harness (doc 09) verifies "no-hero playthrough reaches Div 3 by season 4", "full-hero endgame team wins Hero Cup ~60% per season", and "risk-taking manager awakens ~1 hero per 1.5–2 seasons."
