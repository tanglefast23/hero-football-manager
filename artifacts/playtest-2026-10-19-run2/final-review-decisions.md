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

## Post-run bug and design review — 2026-10-19

Muse's quota had reset. Grok, Opus and Muse all supplied read-only reviews in this later pass.

- Muse traced the web offscreen factory. The lead then reproduced 24 contexts and eight evictions with the real atlas builder. The CPU web surface produced identical pixels with no GL contexts. Muse found no blocker in the fix. The native path and cache image lifetimes remain unchanged.
- Opus verified the transferred-power fix across both sales, saves, seasons, Cup and market. It found one material omission: the seller cover check counted owned heroes that can lose a license. The lead excluded owned powers from durable seller cover and added active/pyramid refusal tests. These tests also start the next season and build the team.
- Opus rechecked that correction and found no blocker. Specials also stop counting as permanent seller cover because their host changes each season. Existing successful-purchase tests remain green.
- Grok found no blocking identity defect. Its useful missing cases became tests for a powered foreign arrival at a full D2 cap, sold-back native indices, a full D3 special host, eleven eligible starters, and a legacy power surviving the next season. All fourteen AI-transfer tests passed.
- Grok verified that the other report items do not justify new bug fixes. The four previously landed fixes remain present. The speculative emergency-youth collision has no demonstrated shipped path after the voluntary-license fix.
- Original powers already erased by old code cannot be recovered. Active legacy foreign-id powers keep their currently saved identity. Off-division records without a stored power cannot supply a lost original identity. Sold-back native heroes use the explicit ownership marker.
- The three design reviews are incorporated into the [approval plan](../../docs/superpowers/plans/2026-10-19-balance-and-design-follow-up.md). Tier 5 repricing and a TP bank cap were rejected. Exact scout dates, optional-trip wording, full-time shootout settlement, saved kicks, Green Bull measurement, and experiment-policy parity were accepted. Balance rules remain unchanged pending approval.

See [post-run fixes](bug-fix-follow-up.md) and their verification receipts. Historical playthrough observations above remain unchanged.
