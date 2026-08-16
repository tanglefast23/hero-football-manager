# Luna Audit

## Scope

This note records findings from the visible English optimal-career playtest that reached the end of Season 1 in D5 and promotion to D4. It is a playtest note, not a code audit.

## Run result

- Division: D5, District League
- Record: 13 wins, 3 draws, 2 losses
- Finish: 2nd place, promoted to D4
- Goals: 60 for, 28 against
- Closing cash shown by the season review: $37,022
- Cup: Round of 32
- D5 final: Bramble Rovers won 7–1 away at Ferrous United
- Week 28: Bramble Rovers won 5–3 at home against Moonlight Town

## Findings from this run

### Contract tutorial still blocks the negotiation control

When the jojo renewal screen opened, Bert appeared with three consecutive speech bubbles. The first bubble covered the negotiation area. The negotiation button became usable only after dismissing every bubble.

This is still a player-facing interruption. The tutorial should not cover the action needed to resolve the contract. A short reminder above or beside the controls would be safer.

### D5 condition recovery is generous

Jojo reached 76% condition after two focused drills in Week 27. The next week restored him to 100% before the next match. Match-day starters also entered at 100% in the observed D5 fixtures.

This is acceptable for a light D5 schedule, but it creates little reason to rotate players. The denser D3 schedule remains the important test. Do not change D5 recovery based on this run alone.

### Training choices felt clear and useful

Jojo already had 101 SHO and 94 TEC, so the run moved training into PAS, PAC, and STA. The player reached 63 PAC and 54 STA by the final week. The compressed high attributes made spreading drills feel correct.

The training modal correctly showed the TP cost, condition result, injury risk, and SUPER chance before confirmation.

### D5 opponent spread supported promotion

Thunder Borough finished first on 49 points. Bramble Rovers finished second on 42. Ferrous United finished third on 38. The top three were competitive without blocking promotion.

The bottom club finished on 5 points with a −32 goal difference. This is a wide spread, but it also gave the run reachable wins. Recheck the lower-end floor in repeat D4 seasons rather than changing D5 from this sample.

### Economy was tight early and generous after promotion

At Week 26 the club had $15,443 and weekly costs of $2,657 before income. The weekly report showed an exact movement to $13,714. A home win later produced a positive match statement, and promotion rewards raised the closing balance to $37,022.

The D5 economy made spending decisions meaningful late in the season. The D4 recruitment fund and promotion cash may make the next opening easier than the D5 close. Track whether D4 upgrades, wages, scouting, and transfers absorb that reserve.

### Hero renewal created a real tradeoff

Jojo's wage request rose from $153 to $945 after awakening and promotion. A three-round negotiation settled at $734 per week for three seasons with a Starter promise and a Trophy promise card.

The wage jump is large, but the club could afford it after promotion. Check whether multiple awakened renewals can be sustained together in D4.

### No new copy leak appeared in English

The observed English screens used readable copy for drills, financial reports, promotion, awards, and powers. This run cannot validate non-English translations.

### No cash-report mismatch appeared in this run

The observed weekly reports matched the visible cash movement. This does not clear the previously logged mismatch; it only means the issue did not reproduce here.

### Confirmed blocker: a transfer can create an unlicensed starter

In Season 5, D4, Week 4, the club signed Dara Lane after selling Ivo Reed. The transfer negotiation attached a `Starter` promise even though no Hero License was available. The transfer screen showed the new player with two seasons and a Starter promise, but did not ask which licensed player should lose the license.

When Week 5 advanced to the first match, the career stopped with: `Hero youth-s3-2 must be licensed or benched`. This left the saved career unable to launch the match. The existing renewal flow already explains that a Starter promise needs a free Hero License, so this is a transfer-negotiation gap rather than a general promise rule.

#### Required behavior

When a new player is hired into a Starter promise and no Hero License is free:

1. Ask immediately which currently licensed player should lose the license.
2. Exclude licensed players who have a Starter promise from that choice.
3. Remove the selected player's license and move that player to the bench immediately.
4. Give the new player the license and put the new player into the vacated starting slot.
5. If every licensed player is protected by a Starter promise, disable the Starter promise option. Do not create an invalid unlicensed starter.
6. If the negotiation is cancelled or fails, leave licenses, promises, and the starting eleven unchanged.
7. A legacy invalid state must fail soft. It must repair the lineup or show a clear action, not block match launch with a technical error.

#### Acceptance checks

- A free license lets the signed player become a Starter immediately.
- With no free license, the prompt lists only reclaimable license holders.
- The displaced player is benched before the next match, and the new player starts.
- Protected Starter promise holders cannot be displaced.
- With no reclaimable holder, Starter is visibly disabled and no Starter promise is saved.
- Transfer cancellation leaves the prior lineup and promises intact.
- Loading an older invalid save cannot strand the career at match launch.

## Suggestions

1. Move Bert's contract guidance away from the negotiation controls, or show it once in a non-blocking hint.
2. Use D3's denser schedule to measure whether full weekly recovery still removes rotation decisions.
3. Track total awakened wages after each promotion. One renewal was affordable; a full hero core may not be.
4. Recheck the D4 opening market and scouting pool. This run ended before testing those choices.
5. Keep the D5 opponent spread for now. The run reached promotion without a runaway title race.

## Not tested in this run

- D4 through D1 progression
- Hero Cup win and D1 league win
- Green Bull and D3 condition pressure
- Scouting filters, report expiry, and selling in the final transfer week
- Non-English translations and formatting
- Multi-tab saves, OPFS recovery, and WebGL longevity
