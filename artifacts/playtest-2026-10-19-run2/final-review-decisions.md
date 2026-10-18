# Review decisions

Lead: c9061292-5986-4d58-8753-3b12fcfa6919.

## Suggestions applied during the work

| Suggestion | Decision | Reason and proof |
| --- | --- | --- |
| Skip unlicensed powered AI players | Accepted before this career | Closes the earlier Sol Reed team-builder crash. The old stopped-run result remains unchanged. |
| Sort named team-sheet rows by actual engine position | Accepted in de80d170 | Tests and separate rendered cases verify 3-4-3 and 4-3-3 order. No engine anchors changed. |
| Preserve valid manual XI positions at season start | Accepted in de80d170 | Store tests and Opus's real-save check keep Ace in slot 10. |
| Refuse voluntary license removal without cover | Accepted with an atomic exchange | A refusal alone would break the real Ken-to-Kai rotation. Final-set repair allows that rotation without minting a player. |
| Make repeated exchange dispatch harmless | Accepted in de80d170 | Prevents the second dispatch from turning the incoming hero off. |
| Expose one accessible Continue after the trip | Accepted in de80d170 | The separate browser case had one target and returned Home. |
| Use a worker clock for occluded-pane input guards | Accepted in ee2ee7a3 | Actual delay probes, an actual tab tap, and worker/fallback tests passed. No page clock was patched. |
| Keep buying keeper REF beyond a supposed 150 cap | Accepted as a correction, then retargeted | There is no 150 wall. Later raw REF 321–361 had small marginal gains, so the fixed weekly keeper reservation stopped. |
| Prefer Ace technique and Kai shooting in D2 | Accepted as the later training direction | REF 4/PAC 4 purchases and Ace's five PAC drills remain actual costs. The final report makes no claim about review delivery time. |
| Treat the missing away win as a Home bug | Rejected | The win was a trophy graphic with a correct Won accessibility label. |
| Treat every AI Cup 1–0 as a match-engine failure | Rejected | Rival Cup ties intentionally use a winner formula. User Cup ties and rival league fixtures use the real engine. |
| Patch atlas graphics from the eviction warning | Deferred | The allocation path is a suspect. No live offscreen-context count established the cause. |
| Preserve AI player power identity through seasons | Open follow-up | Ken/Hugo's live power swap is confirmed. The full fix spans saved pyramid data and three derivation sites, with a balance check. |
| Pick the best retirement replacement automatically | Deferred | The shared repair rule affects the balance harness. The current rule chooses the first same-role player. |

## Final report review

Grok and Opus received separate read-only report review tasks. Muse was provider-quota-blocked and supplied no review.

### Opus

The [final review summary](reviews/opus-final-report-review.md) records all twelve requested corrections.

- Accepted the shootout correction after reading both production functions. The report now separates regulation score, seeded winner, and scripted tally. It also adds the shootout rule as a product question.
- Accepted the recovery order, pinned-server PID/path, collision note, expanded incident log, CI annotation, before/after identity links, queue wording, second sale path, and Cup-stat-line wording.
- The linked decisions file now exists. The claim that the report is committed is conditional on completing the final Git workflow before publication.
- Added independent read-only checks for fees, two watched-screen transitions, and weekly TP 57/58. The S6 action-log gap remains explicit.
- Opus verified the four landed fixes, both successful CI runs, all six season totals, Hall of Fame, true-ending flag, and the checked source facts.

### Grok

The [final review summary](reviews/grok-final-report-review.md) records its material findings.

- Removed the purchase-versus-review timing claim. Saves establish purchase weeks, not when a review reached the lead. The final report simply states that the purchases were broader than the recommendation.
- Accepted the penalty-score distinction. It was already corrected after Opus's review.
- The linked decisions file now exists and will be committed with the report.
- Replaced the broad word gifts with paid player requests, but rejected the inference that there was no such cost. The weekly ledger omits these one-off charges. The actual cash transactions record $91,882, including $86,112 in Season 6. player-requests.ts charges cash before recording each transaction. The method proof now includes those rows.
- Added the exact warning/loan sequence: Season 2 Week 15 ended at -$569; Week 16 paid $15,000 even after other income recovered the balance. This remains a reserve mistake, not a stand-price bug.
- Clarified that sequential Tier 3 and Tier 4 fees are the required unlock gate. They are not a double-charge defect.
- Grok checked the results, fees, facilities, licenses, Eli's retained status, scout timing, tier returns, and the 57/58 TP formula. It read the prior test receipts without rerunning them.
