---
date: 2026-07-24
topic: cap-free-player-development
---

# Cap-Free Player Development

## What We're Building

Remove every player-specific attribute ceiling and let career ratings grow to a universal 999 safety maximum. A drill keeps adding real stat points throughout a long career, so a favorite player can continue growing well beyond 99.

Weekly progress combines three player identities: the existing archetype bonus, a small +5% natural-position bonus on three role-specific attributes, and a visible Potential grade from E− through A+. Potential starts at +0% for E− and rises by one percentage point per grade step to +14% for A+.

## Why This Approach

Raw ratings remain the numbers the player sees, with a universal 999 safety ceiling that ordinary careers are tuned never to reach. Match calculations convert them to a bounded effective scale: 1–99 is unchanged, while growth above 99 has diminishing match impact and reaches an effective rating of 140 at raw 999. This keeps probabilities, movement speed, fatigue, and shooting stable without hiding continued development.

## Key Decisions

- Potential grades: E− 0%, E 1%, E+ 2%, D− 3%, through A+ 14%.
- Position bonus: +5% to FWD PAC/SHO/TEC, MID PAS/TEC/STA, DEF PAS/DEF/STA, and GK DEF/STA/REF.
- Bonuses: archetype, position, Potential, and coach percentages add together before one deterministic growth calculation; age and facilities remain structural multipliers.
- Every earned whole stat point is permanent and visible. Fractional percentage bonuses bank deterministically until they produce another point.
- Match scale: raw 1–99 is unchanged; raw values above 99 convert to diminishing effective strength, reaching 140 at raw 999.
- Every stat retains a real match advantage: PAC changes movement, STA changes energy drain, SHO/REF oppose one another at goal, PAS/DEF govern passes and interceptions, and TEC/DEF govern dribbles and tackles.
- STA has a 65% drain floor. A 999-STA player lasts much longer than a peer but still tires, preserving Energy Use and substitutions.
- PAC is tuned relative to each division: a normally trained star should be roughly 25% faster than typical same-division opposition before promotion. About 38% is the normal-career soft target; the rare 999 endpoint is limited to 60% above typical D1 pace from training alone.
- Superpowers resolve after ordinary stat scaling and are exceptions to every training/match cap. They may temporarily exceed movement, contest, fatigue, shooting, defending, or goalkeeping limits without writing saved ratings above 999.
- Talent curve: D5 recruitment is concentrated in E grades, then rises by division; A grades begin in D1.
- Save compatibility: existing 1–5 Potential tiers deterministically map to the new letter grades; legacy ceiling fields remain readable but no longer stop training.
- Balance probe: three starters train their natural-position skills every week under fast and slow promotion schedules, with the maximum licensed hero count, youth and scout hires in every division, and deterministic multi-seed match samples.
- Ceiling feedback: reaching 999 creates a one-shot alert, disables that stat's training option, and blocks another wasted week until the repeating assignment is changed.

## Validation Target

The long-career probe must show all three trained starters growing beyond 99, a 25–30% PAC edge on the one-season promotion path, deliberate two-season specialization remaining near the 38% soft target, improving youth/scout Potential by division, and competitive—not automatic—results against each division's midpoint opponent. Separate unit contracts pin raw 999 to the 60% trained-only endpoint versus typical D1 pace and prove Super Speed can exceed it.
