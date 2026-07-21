# Power activation balance — Heat sources and graded auto-fire

**Status:** proposed 2026-07-21, from the M4 simulator gate.

## The problem, measured

24 matches per power, each on its designed carrier role, `FIRE_WHEN_READY`
(the policy Quick Result uses for both teams):

| Power | Carrier | Zones/match | Fires/match | Matches with a fire |
|---|---|---|---|---|
| Super Speed | FWD | 2.08 | 1.96 | 24/24 |
| Fire Torch | FWD | 2.25 | 2.04 | 24/24 |
| Thunder Strike | FWD | 2.17 | 1.83 | 24/24 |
| Blink Run | FWD | 2.13 | 1.83 | 24/24 |
| Phase Run | FWD | 2.04 | 1.88 | 24/24 |
| Magnet Touch | FWD | **4.13** | **0.00** | 0/24 |
| Elastic Keeper | GK | 0.54 | 0.17 | 4/24 |
| Future Sight | DEF | 0.46 | 0.08 | 2/24 |
| Super Strength | DEF | 0.46 | 0.00 | 0/24 |
| Web Trap | DEF | 0.46 | 0.00 | 0/24 |
| Portal Pass | MID | 0.00 | 0.00 | 0/24 |
| Decoy Double | MID | 0.00 | 0.00 | 0/24 |

Doc-04 targets ~2–3 zone entries per hero per match. Five powers hit it; seven do not.

## Two independent root causes

### 1. Heat is position-gated

`addGauge` only rewards a narrow set of actions:

| Action | Heat | Realistically earned by |
|---|---|---|
| Take a shot | 20 | Forwards |
| Win a tackle (slide or standing) | 12 | Defenders |
| Goalkeeper save | 12 | Keeper |
| Recover a loose ball | 8 | Anyone nearby |
| Attempt a tackle | 3 | Defenders |
| Receive a pass | 2 | Everyone |

There is **no Heat for making a pass**, only for receiving one. A midfielder's
entire job earns nothing, so he charges only by being passed to: roughly 20
receptions × 2 = ~42–47 Heat, permanently short of `ZONE_HEAT_THRESHOLD = 60`.

### 2. Target-requiring powers are excluded from the late-window fallback

`powers.ts` already has a fallback, but it is gated:

```ts
else if (p.powerState.remainingTicks <= 20 && !requiresTarget(p.def.power))
```

`requiresTarget` is true for exactly seven powers — Portal Pass, Magnet Touch,
Decoy Double, Future Sight, Super Strength, Web Trap, Elastic Keeper — which is
exactly the set that fails above. The five that work are the five that receive
the fallback. Their binary `inUsefulContext` check must be satisfied on some tick
inside the 70-tick window or the power never fires at all. Magnet Touch needs a
loose ball within 1800 units; loose balls are transient, so it converts none of
its 4.13 windows.

## Design

### Manual must stay at least as good as auto

Both keep the **same 7-second window**. Auto is never given longer to look.

| | Window | Timing | Strength |
|---|---|---|---|
| Manual | 7s | Player may hold out for the ideal moment | 100% |
| Auto | 7s | Fires at the first *acceptable* moment | 85% |
| Auto fallback | last ticks | Fires at whatever is available | lapse strength |

### Heat: each role's signature act is worth about a shot

| Role | Signature act | Now | Proposed |
|---|---|---|---|
| Forward | Shot | 20 | 20 (unchanged) |
| Midfielder | Interception | 0 | 12 |
| Midfielder | Key pass (leads to a shot) | 0 | 10 |
| Defender | Won tackle | 12 | 18 |
| Defender | Block / clearance | 0 | 8 |
| Keeper | Save | 12 | 20 |

Reward **scarce** actions, never frequent ones. A completed pass must stay at or
near zero: at 3 Heat a midfielder making 40 passes would earn 120 and out-charge
every striker.

### Auto-fire: graded quality with a last-second fallback

Replace the binary context test for auto with a score in `0..1`, and give each
power a bar. Fire on the first tick at or above the bar; otherwise fire on the
last ticks of the window if the power can act at all.

A **common** context takes a **high** bar (Magnet Touch sees loose balls often,
so it can be picky). A **rare** context takes a **low** bar (Elastic Keeper only
sees a shot every few minutes, so it takes what it gets).

Target-requiring powers may only use the fallback when a target actually
resolves. Web-trapping empty grass is not a fallback, it is a no-op.

## Acceptance

- Every power fires **1.5–2.5 times per match** on auto, averaged over ≥24 seeds.
- Manual strength stays 100% and auto 85%; the visible window stays 70 ticks.
- No power fires more often on auto than the count of zones it entered.
- A new harness assertion measures fires/match **per carrier role**. The existing
  test proves zone entry by force-setting `gauge = 199` on one synthetic striker,
  which is why this shipped unnoticed.

## Risk

Replay-affecting: `ENGINE_VERSION` bumps, goldens regenerate and are inspected
rather than blind-updated. Heat changes shift match balance, so the full balance
harness must pass before this lands.
