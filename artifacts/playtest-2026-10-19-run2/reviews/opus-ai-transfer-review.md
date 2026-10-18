# AI buyer review — Opus

Read-only review of pinned 28386452 and the real Season 3 Week 2 checkpoint. No fixture simulation. Input unchanged.

## Actual sale

Ken Ash joined Sable Dragons (d4-club-01) for $48,135. He retains ICE_RINK, is unlicensed, fit, and paid $800 weekly. The buyer already has two licensed heroes, matching the current cap. Ken's attribute total (365) is below its other midfielders (410–602). The production team builder excludes him from both XI and bench; licensing him would only put him on the bench.

This observed sale does not show a lost strong starter. The buyer is full and Ken is weak for it.

## Source findings for the final report

1. Every sale clears the player's license. No in-season AI action grants a license. Even a strong purchased hero at a club with free capacity cannot play until the season boundary. This is a policy gap, not observed harm in this sale.
2. The pyramid season sync does not preserve powers. The next season assigns generated powers by squad order. A sold player's old global list position comes before the buyer's original squad. Ken is therefore first in its eligible queue.
3. In an in-memory transition with an arbitrary table order, Ken became RALLY_CRY in Division 3. This is a counterfactual source check, not an actual played Season 4 result. In Division 4's one-generated-hero case, the same queue could remove Hugo York's power. In Division 5 Ken would become ordinary.
4. AI wage cash deductions were not proved by a narrow source search. Treat this as uncertain.

## Disposition

Keep these separate from de80d170. Verify the actual Season 4 identity if Sable remains in the active division. Do not change pyramid data or opponent balance during the pinned playthrough. Consider preserving bought-player identity and defining AI licensing policy together after the run. Appending a sold player could close queue jumping alone, but would still lose the power.
