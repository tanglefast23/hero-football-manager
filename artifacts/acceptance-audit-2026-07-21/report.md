# Hero Football Manager — Player-Facing Acceptance Audit

Audit date: 2026-07-21
Lead device: `HFM-audit-20260721-161945` (`308D7A7F-8375-418A-B7FC-56C2D59DEA63`)
Phase 0–4 lead build: `HFM-AUDIT-1956074-ab6622e70934`
Phase 0–4 Release bundle SHA-256: `ab6622e7093422867103d1d6e07d9c799254ee5dc73e2874cba4575452a16155`
Phase 5 replacement build: `HFM-P5-124c056-74a98908e28a`
Phase 5 embedded bundle SHA-256: `74a98908e28a107b7af72f059432e44007baf153346929a88f8b57f608bc5603`
Phase 6 follow-up build: `HFM-P6-124c056-ad87d3b73ee2`
Phase 6 embedded bundle SHA-256: `ad87d3b73ee2795567c3eb2a2db1bc42d49ff9f6f193fd51338500f48b691f7c`
Final post-fix build: `HFM-P6-POSTFIX-124c056-0de042957305`
Final installed/built bundle SHA-256: `0de04295730521ae2d051e5b845a0d5481d87e7976702c5fda4520258bfc632e`
Automation: final recheck used `xcodebuildmcp` 2.6.2 runtime accessibility snapshots plus its bundled coordinate-tap tool on the dedicated lead simulator.

## Release verdict

**READY for the audited Release scope.** All five audit phases were executed. The season-transition blocker passes a real transition, force-close, relaunch, and Season 2 resume. All 13 post-fix acceptance rows pass on the dedicated simulator, including the adversarial inbox tap, signed TP movement, separate League/Cup gates, Awakening presentation, and 48/48 facility cells. The final Release bundle hash matches the installed bundle exactly. Synthesized VoiceOver speech, physical haptics, and rows explicitly outside this acceptance scope still require real hardware or later milestone testing; the simulator accessibility tree verifies the audited names, roles, grouping, and reachability.

## Phase 0 — build truth

- State captured before testing: HEAD `1956074f2e10f582b3d96bb96c225a8bf1767a3f`, branch `main`, with the shared dirty tree recorded separately in the command log.
- A uniquely named iPhone 16 Pro / iOS 26.5 simulator was created and addressed only by UDID.
- Screen Recording and Accessibility were both proven by reading and tapping the real Simulator UI.
- `xcodebuildmcp` capability spike: `npx --no-install xcodebuildmcp --help` exited `1` because package `xcodebuildmcp@2.6.2` was missing. Track B was therefore required.
- Current-build proof: a temporary visible token `PHASE0-1956074-161945` was built and photographed, then reverted and rebuilt. The final build shows `HEROES START HERE` and contains a self-contained Release `main.jsbundle`; no Metro server is involved.
- During the audit another shared session advanced `main` to `124c056`. All Phase 0–3 device rows remain tied to the proven build ID above. A Phase 5 rebuild must receive a new ID.

Evidence:

- `evidence/PH0-BUILD-TOKEN.png`
- `evidence/PH0-BUILD-FINAL.png`

## Phase 1 — shipped surface and roadmap boundary

The wired player surface includes title/new game/continue, character creation, title and in-career settings, Bert guidance, five management tabs, training and staff, facilities and finances, youth/scouting/transfers, five divisions and National Cup, watched and quick-result matches, post-match/weekly/season reviews, events, awakenings, retirement/legacy, promotion/relegation, and D1 completion.

Roadmap status:

- M2 is documented as code complete, but explicitly not a substitute for owner acceptance (`docs/10-roadmap.md`, M2).
- M3 has an owner gate accepted, with missing breadth folded into M4 (`docs/10-roadmap.md`, M3).
- M4 content and polish are present in the build but the roadmap does not mark the milestone accepted. Every M4 row still requires this audit.
- M5 TestFlight, store listing, privacy labels, and launch are **NOT IMPLEMENTED** (`docs/10-roadmap.md`, M5).
- Android, PC/Steam, New Game+, async friend leagues, localization, and expansion packs are **NOT IMPLEMENTED** post-launch candidates (`docs/10-roadmap.md`, post-launch candidates).
- Construction cancellation has no player control and no documented shipped promise; it is **NOT IMPLEMENTED**, not counted as a defect.

## Phase 2 — seeded boundary boot matrix

All files were generated through production game/application code, serialized through the real codec, written to SQLite as `TEXT`, launched, tapped through Story → Continue, and photographed. Automated generation/validation: `src/audit/__tests__/generate-acceptance-seeds.test.ts`.

Provenance for every Phase 2 row: lead device `308D7A7F-8375-418A-B7FC-56C2D59DEA63`, build `HFM-AUDIT-1956074-ab6622e70934`, Track B Computer Use. Each PASS below is based on the stated taps and a visible on-device result, not seed generation alone.

| Flow ID | Starting save/state | Expected | Actual | Evidence | Result |
|---|---|---|---|---|---|
| P2-01 | Fresh Cozy | Character creation / Cozy | Character creation / Cozy | `PH2-fresh-cozy.png` | PASS |
| P2-02 | Fresh Chairman | Character creation / Chairman | Character creation / **Cozy** | `PH2-fresh-chairman.png` | **FAIL** |
| P2-03 | First-match onboarding | Management + opening Bert briefing | Bert briefing over management | `PH2-onboarding-first-match.png` | PASS |
| P2-04 | Collapse boundary | Awakening beat 1 | Awakening beat 1 | `PH2-onboarding-collapse.png` | PASS |
| P2-05 | Reveal boundary | Awakening beat 1 | Awakening beat 1 | `PH2-onboarding-reveal.png` | PASS |
| P2-06 | Completed onboarding | Week 1 Home | Week 1 Home | `PH2-onboarding-complete.png` | PASS |
| P2-07 | Week 2 | Week 2 Home | Week 2 Home | `PH2-week-2.png` | PASS |
| P2-08 | Week 3 | Week 3 + youth inbox | Week 3 + youth inbox | `PH2-week-3.png` | PASS |
| P2-09 | Week 5 | Week 5 + Cup inbox | Week 5 + Cup inbox | `PH2-week-5.png` | PASS |
| P2-10 | Week 15 | Week 15 + scouting inbox | Week 15 + scouting inbox | `PH2-week-15.png` | PASS |
| P2-11 | Week 17 window | Week 17 Home | Week 17 Home | `PH2-transfer-window-week-17.png` | PASS |
| P2-12 | Week 18 window | Week 18 Home | Week 18 Home | `PH2-transfer-window-week-18.png` | PASS |
| P2-13 | Match week | Match-day docket | Match-day docket | `PH2-match-week.png` | PASS |
| P2-14 | Full roster | Home / 17 of 17 | Home / 17 of 17 | `P3-FULL-ROSTER-BLOCKED.png` | PASS |
| P2-15 | One slot free | Home / 16 of 17 | Home / 16 of 17 | `P3-TRANSFER-SIGNED.png` | PASS |
| P2-16 | Zero TP | Home / TP 0 | Home / TP 0 | `PH2-zero-tp.png` | PASS |
| P2-17 | Zero money | Home / $0 | Home / $0 | `PH2-zero-money.png` | PASS |
| P2-18 | Negative cash | Home / −$750 warning | Home / −$750 warning | `PH2-negative-cash.png` | PASS |
| P2-19 | Emergency loan active | Home | Home | `PH2-emergency-loan-active.png` | PASS |
| P2-20 | Board ultimatum | Home + protection candidates | Home + 4-week deadline and candidates | `PH2-board-ultimatum.png` | PASS |
| P2-20A | Board deadline | Home + 1-week forced-sale deadline | Home + 1-week forced-sale deadline | `P3-BOARD-FORCED-SALE.png` | PASS |
| P2-21 | Injured squad | Home + injury alert | Ed Stone OUT · 3 weeks | `PH2-injured-squad.png` | PASS |
| P2-22 | Capped players | Home | Home | `PH2-capped-players.png` | PASS |
| P2-23 | Active construction | Home | Home | `PH2-active-construction.png` | PASS |
| P2-24 | Active scout mission | Home | Home | `PH2-active-scout-mission.png` | PASS |
| P2-25 | Pending negotiation | Home + scout report inbox | Scout report inbox | `PH2-pending-negotiation.png` | PASS |
| P2-25A | Pending story event | Giant Spider story event | Giant Spider story event | `P3-EVENT-CHOICES.png` | PASS |
| P2-26 | Season end | Season review | Safe Season 1 review | `PH2-season-end.png` | PASS |
| P2-27 | Promotion | Championship celebration | Championship celebration | `PH2-promotion.png` | PASS |
| P2-28 | Relegation | Relegation review | D4 → D5 relegation review | `PH2-relegation.png` | PASS |
| P2-29 | Late career | Season 9 Week 15 Home | Season 9 Week 15 Home | `PH2-late-career-season.png` | PASS |
| P2-30 | Retirement/legacy | Legacy choice + Bert guide | Legacy choice + Bert guide | `PH2-retirement-legacy.png` | PASS |
| P2-31 | Completed career | D1 championship celebration | Season 5 championship celebration | `PH2-completed-career.png` | PASS |
| P2-32 | Migrated save | Week 6 Home | Week 6 Home | `PH2-migrated-save.png` | PASS |

## Phase 3 — observed player interactions

Provenance for every Phase 3 row unless the row itself says it was not reached: lead device `308D7A7F-8375-418A-B7FC-56C2D59DEA63`, build `HFM-AUDIT-1956074-ab6622e70934`, Track B Computer Use. Phase 5 fix verification uses replacement build `HFM-P5-124c056-74a98908e28a` and is reported separately; it does not rewrite the historical result of any Phase 3 row.

| Flow ID | Feature/flow | Starting state | Exact player actions | Expected | Actual | Evidence | Relaunch | Automated coverage | Result |
|---|---|---|---|---|---|---|---|---|---|
| P3-SET-01 | Settings and persistence | Season-end save | Open settings; change volume, motion, haptics, text size, contrast, kit safety, cut-ins, HUD side; force-close; reopen title settings | Every value changes and persists | All values changed and persisted; restored to defaults afterward | `P3-SETTINGS-CHANGED.png` | PASS | preferences, text-scale, volume, haptics tests | PASS |
| P3-SET-02 | Glossary | Settings | Open Glossary | Definitions and back path reachable | Full handbook opened with search and definitions; back returned to Settings | device observation | N/A | glossary content tests | PASS |
| P3-TITLE-01 | Continue and replace-save guard | Existing save | Story; Start Over; inspect warning; cancel; Continue | Destructive replace requires confirmation; cancel retains save; Continue resumes exact state | Warning names career/replay erasure; cancel retained save; Continue resumed Season 1 review | device observation | PASS | store/repository tests | PASS |
| P3-SEASON-01 | Start next season | Safe Season 1 review | Tap Begin the next season; observe Season 2; force-close; Continue | Season 2 saves and resumes | Save error: `onboarding.firstFixtureId first fixture does not exist`; relaunch returned to Season 1 | `P3-SEASON-TRANSITION-SAVE-FAIL.png` | **FAIL** | existing tests missed serialization boundary | **FAIL** |
| P3-NAV-01 | Five-tab navigation | Week 15 | Tap Squad, Club, Market, League, Home | Each exact destination reachable | All five destinations reached | device observation | Pending | view-model tests | PASS |
| P3-SQUAD-01 | Player file | Week 15 Squad | Open Audit Rookie | Full identity, stats/caps, power, contract reachable | File showed rating 50, B−/83, six attributes/caps, Super Speed, $180 wage | `P3-SQUAD-PLAYER.png` | N/A | squad view-model tests | PASS |
| P3-SQUAD-02 | Training plan | Week 15 Squad | Assign Audit Rookie; scroll to drills | Player assignment toggles; drills reachable | Assignment changed to 1; all six drills, their Money/TP costs, plan totals, and save control were reachable | device observation | Pending | training tests | PASS |
| P3-CLUB-01 | Facility build | Week 15 Club | Pick Training Pitch; choose grid cell (1,1); close confirmation | Spend $8,000 once; one-week construction; all new projects blocked | $45,000 → $37,000; ledger −$8,000; one-week works order; all build controls disabled while crew busy | device observation | Pending | facility tests | PASS |
| P3-MATCH-01 | Starting XI | Match day | Select Dario Flint; replace with Zip Vela | Same-role bench option enabled; lineup persists | Zip became starting FWD; other roles clearly blocked | device observation | Pending | lineup tests | PASS |
| P3-MATCH-02 | Quick Result and post-match | Match day | Tap Quick Result; Continue; inspect summary/development | Result, ledger, rewards, facility completion, development shown | 0–1 loss; net −$337; +14 TP; Training Pitch complete; 15 players STA +1 | `P3-QUICK-RESULT.png` | Pending | parity, settlement, development tests | PASS |
| P3-WEEK-01 | Weekly review | Week 16 | Advance Week; wait for training transition | Exact resource movement and development summary | $35,163 → $35,276 (+$113); 44 → 49 TP (+5); 15 players STA +1 | `P3-WEEKLY-REVIEW-LOCKED.png` | Pending | weekly-review tests | PASS |
| P3-INBOX-01 | Coach CTA and hire | Home | Open coach inbox; finish Bert page; hire Imani; confirm | Exact Coaches desk; wage disclosure; persistent hire | Correct desk/candidate; $500 weekly wage; hired confirmation | device observation | Pending | coach guide/staff tests | PASS |
| P3-INBOX-02 | Cup CTA | Home | Open Cup inbox; finish Bert page | Exact League/Cup subsection highlighted | Scrolled directly to highlighted National Cup road | `P3-INBOX-CUP-CTA.png` | N/A | concierge/navigation tests | PASS |
| P3-SCOUT-01 | Start scout mission | Scout desk | Send Local scout | Charge $1,500 once; show due time; block second mission | $36,663 → $35,163; 3 weeks left; both mission controls disabled | device observation | Pending | market/scout tests | PASS |
| P3-INBOX-03 | Completed scout objective | Home after mission started | Open unchanged “Send your first scout” inbox; finish Bert page | Completed objective disappears or routes to useful status | Inbox remained and highlighted the already-disabled “Scout Sent” control | `P3-STALE-SCOUT-INBOX.png` | Pending | missing regression | **FAIL** |
| P3-LEAGUE-01 | League, fixtures, Cup, ladder preview | Week 16 League | Open League; select D1 preview; inspect fixtures/Cup | Current D5 data remains truthful; D1 is preview only | D1 explicitly said preview; D5 table/18 fixtures and Cup road remained | device observation | N/A | league truthfulness tests | PASS |
| P3-WATCH-01 | Watched match live tactics | Match day | Watch; pause/resume; switch formation, playstyle, energy; queue same-role substitute; resume; force-close | Clock pauses; changes apply; substitution consumes one; safe relaunch | Clock stopped/resumed; 4-4-2 → 3-4-3; Balanced → Attack; Balanced → All Out; Zip replaced Audit Rookie and substitutions 3 → 2; relaunch returned to the match-day docket | `P3-WATCHED-LIVE-CONTROLS.png` | PASS | watched-match/control tests | PASS |
| P3-WATCH-02 | Watched-match Zone window and manual power | Watched match | Poll the short Zone window; tap “Activate Audit Rookie's super speed” immediately | Manual activation is clearly tappable and consumes the power | Activation appeared at 48′; the real control was tapped before expiry; the Zone action ran and the activation control cleared | `P3-WATCHED-ZONE-WINDOW.png`, `P3-WATCHED-MANUAL-POWER.png` | N/A | Zone/power tests | PASS |
| P3-WATCH-03 | Watched-match settlement | Watched Cup match | Let match finish; inspect post-match statement; quick-result second same-week fixture; force-close | Result and exact resource changes settle once and survive relaunch | 2–0 watched win; statement showed tickets +$1,200, wages −$3,074, subsidy +$1,537, Cup win +$2,000, net +$1,663, +36 TP; relaunch resumed Week 6 | `P3-WATCHED-POSTMATCH.png` | PASS | settlement/idempotency tests | PASS |
| P3-YOUTH-01 | Youth intake signing | Week 3 youth inbox | Follow Bert CTA; inspect player/fee/wage; sign; force-close; reopen Youth desk | One immediate signing; fee once; roster and inbox persist | Nico Moss signed for $500; cash $45,000 → $44,500; roster 15 → 16; inbox stayed cleared after relaunch | `P3-YOUTH-SIGNED.png` | PASS | youth/repository tests | PASS |
| P3-TRANSFER-01 | Full-roster transfer block | 17 of 17 + active negotiation | Offer $168 in round 2 | Signing is blocked with clear reason; no cash/player change | Explicit “the 17-player roster is full”; remained in negotiation; cash unchanged | `P3-FULL-ROSTER-BLOCKED.png` | N/A | transfer/roster-cap tests | PASS |
| P3-TRANSFER-02 | Negotiation pitches and signing | 16 of 17 + active negotiation | Use Flattery at $118; use Straight Talk at $168; submit; force-close | Pitch cards are single-use; accepted signing charges fee once and persists | Flattery disabled after use; first offer rejected; second accepted; Luca Bay joined; cash $48,500 → $40,213, exactly the $8,287 fee; roster 16 → 17 after relaunch | `P3-TRANSFER-SIGNED.png` | PASS | negotiation/persistence tests | PASS |
| P3-TRANSFER-03 | List, receive bids, sell | 17 of 17 after signing | List reserve; inspect three bids; accept best | No automatic sale; best bid can be accepted; cash/roster update exactly | Three bids appeared; accepted Harbor Comets $5,919; cash $40,213 → $46,132; roster 17 → 16 | `P3-TRANSFER-BIDS.png`, `P3-PLAYER-SOLD.png` | Pending | transfer-bid tests | PASS |
| P3-EVENT-01 | Rare event outcome and reload | Pending Giant Spider event | Inspect risky/guaranteed choices; choose risky; Continue; force-close | Choice resolves once; outcome cannot reroll on relaunch | 35% risky choice failed deterministically; continued to Week 7 match day; relaunch did not repeat/reroll the event | `P3-EVENT-CHOICES.png` | PASS | event/idempotency tests | PASS |
| P3-AWAKE-01 | Awakening sequence and Bert handoff | Reveal-boundary save | Complete all three timed beats; continue through Bert's three pages; force-close/relaunch | Reveal is readable; completion persists; manager handoff resumes | Sequence completed and Home resumed after relaunch; power/title readable, but player name, flavor copy, and final CTA were near-black on the dark reveal card | `P3-AWAKENING-REVEAL.png` | PASS | awakening/onboarding tests | **FAIL** |
| P3-CREATE-01 | Character creation controls | Fresh Cozy | Tap skin, hair, kit accent; select Chairman then Cozy; increase/decrease every visible stat; enter a name; finish | Every independent control changes; valid form creates one player | Appearance counters changed 3→4, 3→4, 1→2; difficulty radios switched; all twelve stat controls responded; “Audit Taps” created exactly once | device observation | PASS — interrupted signing resumed at Bert, not duplicate creation | creation/codec tests | PASS |
| P3-GUIDE-01 | Bert early dismissal and drag gesture | Fresh-career Bert page 1 | Invoke exposed Cancel action; attempt downward drag | Documented dismissal rule is observable and does not corrupt prerequisites | Cancel did not dismiss; the drag was interrupted when another Simulator window took physical focus | device observation | NOT VERIFIED — shared physical mouse contention | guide-sequence tests | NOT VERIFIED |
| P3-TRAIN-01 | Zero-TP drill block | TP 0 | Open Squad; inspect all drills | Every unaffordable drill is disabled with clear cost/reason | All six drills were disabled; each exposed Money and TP costs | `P3-ZERO-TP-BLOCKED.png` | N/A | training-cost tests | PASS |
| P3-TRAIN-02 | Capped-player block | Ed Stone at 99/99 for every stat | Assign Ed; select Sprints; try to save | No charge or plan save; explicit cap reason | Save was blocked with “Ed Stone is already at their PAC maximum for Sprints. Pick another player.” | `P3-CAPPED-TRAINING-BLOCKED.png` | N/A | cap/training tests | PASS |
| P3-TRAIN-03 | Injured player | Ed Stone OUT 3 weeks | Open Squad and inspect status/assignment | Injury is clear; invalid lineup action blocks with reason | Player card/status showed OUT · 3 WEEKS; direct match-day lineup rejection was not reached from this seed | device observation | N/A | lineup injury tests | NOT VERIFIED |
| P3-FIN-01 | Zero/negative cash gates | $0 and −$750 saves | Open Club; inspect every build item; follow board warning CTA | Spending locks with exact shortfall; warning lands on accounts | All twelve build choices disabled with exact amounts needed; warning opened Accounts Office showing balance/forecast and locked grounds | device observation | N/A | finance/facility tests | PASS |
| P3-FIN-02 | Emergency loan disclosure | Loan-active save | Open Home warning and club ledger | Active loan amount/repayment is clearly visible | Save booted at $3,250 and kept financial locks. The three-item Home scheduler displaced the warning, and the inspected ledger view did not expose the loan terms, so the intended disclosure path was not actually reached. | device observation | N/A | financial-safety tests | NOT VERIFIED |
| P3-BOARD-01 | Protection and forced sale | 4-week ultimatum, then 1-week deadline | Protect Sol; force-close/relaunch; load deadline; protect Sol; advance; resolve event; finish review; force-close/relaunch | Protection persists; another player sells once; exact money/replacement/penalties persist | Sol stayed protected; Mae Thorn sold for $4,181; cash −$4,000→$644; Kai Ash promoted; −50 fans/−8 morale; aftermath survived relaunch without duplication | `P3-BOARD-FORCED-SALE.png` | PASS | board-ultimatum tests | PASS |
| P3-LEGACY-01 | Retirement legacy | Pending Ari Legend legacy | Finish Bert guide; choose Mentor a prospect; open Squad; force-close/relaunch | One final choice, one reward, no repeat | Remy Legend joined; roster 15→16; relaunch resumed Home and the choice did not repeat | device observation | PASS | legacy tests | PASS |
| P3-SEASON-02 | Promotion review | D5 championship | Skip celebration; inspect review/rewards | Promotion and permanent unlocks are clear | Promoted to D4; Level 2 facilities, international scouting, and Level 2 coaches listed as permanent unlocks | device observation | N/A | pyramid/season tests | PASS |
| P3-SEASON-03 | Relegation review | D4 last place | Inspect review | Drop and endless continuation are unambiguous | Review said D4→D5 and “the endless career continues” | device observation | N/A | pyramid/season tests | PASS |
| P3-SEASON-04 | D1 championship | D1 championship | Skip celebration; inspect review/continuation | Completion acknowledges title and permits continuation | Review said “CHAMPIONS · THE CLUB OWNS THE COUNTRY” and offered Begin the next season | device observation | N/A | full-career tests | PASS |
| P3-PERSIST-01 | Corrupted save | `state_json='not-json'` TEXT | Launch; inspect recovery | Fail soft without deleting or overwriting | “WE COULD NOT OPEN YOUR CLUB”; precise corrupt-JSON detail; Retry offered | `P3-CORRUPT-SAVE-FAIL-SOFT.png` | N/A | repository/codec tests | PASS |
| P3-PERSIST-02 | Unsupported schema | Valid JSON + row schema 999 | Launch; inspect recovery | Fail soft and name supported version | Recovery said schema 999 unsupported and build supports schema 1; Retry offered | device observation | N/A | repository/codec tests | PASS |
| P3-PERSIST-03 | Migrated save | Missing newer transient onboarding fields | Launch and Continue | Migration fills safe defaults and reaches career | Week 6 Home loaded normally | `PH2-migrated-save.png` | PASS | migration tests | PASS |
| P3-MATCH-04 | Scorebar speed/auto/settings | Watched match | Activate collapsed scorebar element; attempt nested controls | Pause, speed, auto-power, and settings are individually reachable | AX activation reached pause/resume only; speed, manual/auto, and live settings had no independent accessible elements, and coordinate input was unsafe while another Simulator session repeatedly stole focus | device observation | N/A | match-settings tests | NOT VERIFIED |
| P3-AUDIO-01 | Music, SFX, haptics, loop seams | Title/management/match/overlays | Listen/feel with Reduce Motion off/on | Correct cues, loops, and physical feedback | Simulator screenshots/accessibility cannot prove audible loop seams or hardware haptics; no approved audio-capture or physical-device channel was available | — | N/A | audio routing tests only | NOT VERIFIED |
| P3-POLISH-01 | Count-up and Reduce Motion | Weekly review/settings | Observe cash count-up; enable Reduce Motion in settings | Default animates; Reduce Motion jumps to final values | Default cash visibly counted from −$4,000 toward $644; setting persisted, but the same settlement was not replayed under Reduce Motion | `P3-BOARD-FORCED-SALE.png` | N/A | preference/animation tests | NOT VERIFIED |
| P3-CLUB-02 | Construction cancellation | Active construction | Inspect project controls | Only if shipped: cancel safely | No cancellation control or shipped promise exists | device observation | N/A | N/A | NOT IMPLEMENTED |
| P3-CLUB-03 | Every adjacency pair and upgrades | Club grounds | Attempt all three documented pairs and Level 2 upgrades | Pair bonuses and upgrade effects appear exactly | One build/placement/completion flow passed, but the full adjacency/upgrade matrix was not completed on device | — | N/A | facility/adjacency tests | NOT VERIFIED |
| P3-COACH-02 | Dismissal, assistant unlock, facility requirement | Staff/grounds | Hire/dismiss head coach; build Coaching Office; hire assistant | Wages, limits, dismissal, and facility gate persist | First head-coach hire/wage passed; dismissal, office completion, and assistant hire were not completed on device | — | N/A | coach/facility tests | NOT VERIFIED |
| P3-MARKET-04 | Registration closed | Outside Week 17–18 | Attempt transfer registration | Buying is blocked with clear closed-window reason | No dedicated closed-window negotiation was completed on device | — | N/A | transfer-window tests | NOT VERIFIED |
| P3-CONTRACT-01 | Renewal and hero wage | Renewal boundary | Open/resolve contract action | Wage and renewal terms change exactly once | No dedicated renewal-boundary save was exercised on device | — | N/A | contract tests | NOT VERIFIED |
| P3-CAREER-10 | Season-10 score recap | Season 10 end | Finish season and inspect recap | Score recap is reachable, truthful, and persistent | No Season-10 completion save was generated during this pass | — | N/A | season-recap tests | NOT VERIFIED |

## Phase 4 — independent adversarial audit

Exactly one adversarial subagent was assigned the required fresh-device pass. It created `HFM-P4-ADV-20260721-1843` (`38C91BDB-4DB5-495C-BE80-D4AEAB76119E`), installed and launched the exact Phase 0 Release, and then hit a Computer Use initialization hang before completing a player flow. Accordingly, no strict PASS is attributed to that new device.

The subagent also preserved 55 screenshots from an earlier same-day independent run on `HFM-adv-163455`. That run used an embedded Release bundle but was documented against commit `124c056`, not the frozen Phase 0 build. Its repeated-tap, force-close, corrupt-save, facility, coach, and training observations are retained as candidate evidence only. Full details and evidence provenance are in `adversarial/adversarial-report.md`.

Two candidate defects require lead-device reproduction before confirmation:

| ID | Candidate | Evidence | Status |
|---|---|---|---|
| ADV-D01 | The visible lower portion of the Week 2 Training Ground inbox card may sit under the pinned Advance Week bar; tapping it advanced the week instead of opening the inbox. | `adversarial/evidence/ADV-16-w02-home-bottom.png`, `ADV-17-tap-inbox-under-bar.png`, `ADV-17b-repro.png` | NOT VERIFIED on matching lead build/device |
| ADV-D02 | A negative net training-point movement was rendered as `TP EARNED +−23` in two retained settlements. | `adversarial/evidence/ADV-40-after-cup.png`, `ADV-42-tp-earned-repro.png`, `ADV-43-tp-earned-repro2.png` | FIXED IN CODE in Phase 6; matching-build device recheck pending |

## Independent supplied-audit verification

The separately supplied `FINDINGS-lead.md` was independently checked against its screenshots, current source, product documents, and focused tests. The full classification and rationale are in `independent-findings-verification.md`.

- Confirmed from source/evidence: F-D01–F-D05 and F-D09–F-D13, with the report’s noted scope corrections.
- Runtime-only conflicts: F-D06 (some grid-cell roles) and F-D07 (noninteractive ledger-row roles). Phase 6 applies safe structural fixes, but VoiceOver acceptance remains pending.
- Contradicted as a missing-state defect: F-D08. The informational difficulty label already included the selected value; Phase 6 adds an explicit text role as semantic polish.
- Owner decision completed for F-D14: every home Cup tie earns its own clearly labelled gate receipt, in addition to any same-week home League gate. Phase 6 implements the rule with double-header balance coverage.
- Confirmed carried claim: the story starts at **15/17**, then reaches 16 through Youth and 17 through the first scout signing. The old Week-one sentence saying 16 players/one opening was stale.
- Confirmed documentation drift: README said replay engine `m1.10` while shipped code is `m1.11`.

## Phase 5 — regression-first fixes

### Red proof before implementation

Three focused suites were added or extended before implementation. Their first run failed as intended: **3 suites failed; 11 tests failed and 5 passed**. Failures captured the stale 16-player opening copy, lost Chairman selection, season-history codec rejection, unretired scout objective, overlay/accessibility contracts, current-week copy, and README version drift.

### Changes applied

No replay behavior or RNG consumption changed. `ENGINE_VERSION` remains `m1.11`; no golden snapshot was regenerated.

- Completed onboarding history can retain its old first-fixture ID after a season refresh, while a live first-match stage still rejects a missing fixture. This is the smallest fix for the Season 1 → Season 2 save blocker.
- Character creation now initializes from the persisted Cozy/Chairman choice.
- Starting a scout mission, or having reports, retires the completed “Send your first scout” Bert objective.
- The opening brief now says **“Fifteen players. Two open shirts. Zero heroes.”** Canonical player/economy docs now distinguish the generated 16-player club roster from the story’s deliberate 15/17 start.
- Success/info notices auto-dismiss after four seconds; errors remain sticky; spoken punctuation no longer doubles the final stop.
- Facility confirmation and build-card accessible names now include their visible action, footprint, build time, costs, and actual blocker; `Need …` is spoken only for a real shortfall.
- Guided tabs and guided training/facility targets reserve space for Bert’s visual cue, and the parent tab’s accessible name contains Bert’s instruction.
- Watch Match and Save Weekly Plan accessible names contain their visible labels.
- The current-week fixture card truthfully says to use Advance Week below instead of implying the card itself advances.
- The awakening final card now receives its authored panel styling at runtime and exposes player, power, story, license, and action in its accessible name.
- The post-match backdrop is separated from the content, so the statement is no longer one full-screen “Close” control; ledger rows expose explicit text labels.
- README and the adjacent engine comment now describe `m1.11` without changing the engine version.

Files changed by the Phase 5 fix batch:

- Save/application behavior: `src/persistence/game-state-codec.ts`, `src/application/assistant-guide.ts`, `App.tsx`.
- Player-facing screens: `src/ui/screens/CharacterCreationScreen.tsx`, `NewGameWelcomeScreen.tsx`, `AwakeningCutsceneScreen.tsx`, `ClubHomeScreen.tsx`, `ClubFinancesScreen.tsx`, `FixtureMatchDayScreen.tsx`, `SquadTrainingScreen.tsx`.
- Shared UI: `src/ui/FacilityProjectNotice.tsx`, `src/ui/ManagementShell.tsx`, `src/ui/PostMatchSummaryModal.tsx`.
- Regression coverage: `src/persistence/__tests__/onboarding-history-codec.test.ts`, `src/application/__tests__/story-recruitment-progression.test.ts`, `src/ui/__tests__/acceptance-audit-regressions.test.ts`, `src/ui/__tests__/first-training-guidance.test.ts`.
- Canon/docs: `README.md`, `docs/05-players-training-coaches.md`, `docs/06-economy.md`, and the version comment only in `src/sim/match.ts`.
- Audit-only artifacts: `src/audit/__tests__/generate-acceptance-seeds.test.ts` and `artifacts/acceptance-audit-2026-07-21/`.

Held out of the fix batch:

- F-D06 and F-D07: source and runtime-role claims conflict; require lead-device VoiceOver reproduction first.
- F-D08: contradicted; no defect fix warranted.
- F-D14: requires an owner economy decision and balance review.
- ADV-D01 and ADV-D02: retained mismatched-build evidence is not enough to promote or patch them safely.

### Automated verification after fixes

- `npx tsc --noEmit`: PASS, exit 0.
- Focused regression group: **3 suites / 16 tests passed**.
- All UI suites: **26 suites / 75 tests passed**.
- Adjacent application, persistence, guide, and full-career group: **7 suites / 72 tests passed**.
- `git diff --check`: PASS.
- Fresh local iOS Release build: PASS (`** BUILD SUCCEEDED **`), installed and launched on the lead simulator with an embedded Hermes `main.jsbundle`; evidence `evidence/P5-FRESH-RELEASE-LAUNCH.png`.
- Full post-fix Jest suite: PASS — **156 suites / 1024 tests / 3 snapshots**, exit 0, 1742.822 seconds.

Passing automation is supporting evidence only and does not upgrade unobserved device rows to PASS.

## Phase 6 — approved economy rule and remaining safe fixes

The owner approved the recommended Cup economy rule: **every home Cup match earns a separately labelled gate receipt in addition to any home League gate in the same week**.

### Red proof and changes

The new focused regression run failed before implementation as intended: **3 suites failed; 7 tests failed and 12 passed**. It captured the missing Cup gate, the `+−23` TP formatter, and the absent accessibility structure.

Phase 6 then applied the smallest safe changes:

- Weekly statements now identify `League home gate` and `National Cup [round] home gate` separately. A deterministic double-home test proves both amounts enter the same cash balance exactly once; away Cup ties receive no Cup gate.
- The post-match net resource metric is now `TP change`, with `+23`, `0`, or `−23` formatting and negative visual tone. It no longer claims negative net movement was “earned.”
- Noninteractive Accounts Office ledger rows are native accessible text rows; only rows with a real callback render as buttons.
- During facility placement, all 48 grid cells are explicitly exposed while the overlapping building-control layer is hidden from the accessibility tree. This is the source-level fix for F-D06, but real VoiceOver enumeration remains required.
- Career difficulty now explicitly uses an informational text role. This is optional semantic polish; the original missing-state allegation remains contradicted because the accessible name already included Cozy/Chairman.
- No layout change was made for ADV-D01. The retained screenshots show the inbox card well above the pinned Advance Week bar and do not establish that the tap coordinate was inside a visible card area. A matching-build tap reproduction is required before changing navigation geometry.
- Canonical economy documentation now states the approved League/Cup gate rule.

No replay behavior or RNG consumption changed. `ENGINE_VERSION` remains `m1.11`; no golden snapshot was regenerated.

### Phase 6 verification

- Focused implementation group: **5 suites / 69 tests passed**.
- All UI suites: **26 suites / 80 tests passed**.
- Cup, career, full-career, headless, and balance group: **8 suites / 74 tests passed**.
- `npx tsc --noEmit`: PASS, exit 0.
- `git diff --check`: PASS.
- Fresh local iOS Release: PASS (`** BUILD SUCCEEDED **`). Embedded `main.jsbundle` SHA-256 is `ad87d3b73ee2795567c3eb2a2db1bc42d49ff9f6f193fd51338500f48b691f7c`.
- Installed and launched on lead UDID `308D7A7F-8375-418A-B7FC-56C2D59DEA63`; the title reached a usable Story/Settings screen. Evidence: `evidence/P6-CUP-GATE-RELEASE-HOME.png`.
- Computer Use was retried twice, including after bringing Simulator to the front. Both state reads failed with `Computer Use server error -10005: timeoutReached`. Interactive and VoiceOver rows remain **NOT VERIFIED**.
- Independent operator handoff: `P6-LLM-SIMULATOR-HANDOFF.md` freezes the build/hash/device and defines 13 exact post-fix checks and their evidence contract.
- Complete Phase 6 Jest suite: PASS — **156 suites / 1,031 tests / 3 snapshots**, exit 0, 736.598 seconds.

## Defect disposition

| Defect | Severity | Phase 5 disposition |
|---|---|---|
| Season transition loses progress | Release blocker | FIXED IN CODE; focused codec/career checks PASS; fresh Release build/launch PASS; interactive device repro BLOCKED |
| Chairman resumes as Cozy | High | FIXED IN CODE; regression PASS; fresh Release build/launch PASS; interactive device repro BLOCKED |
| Completed scout objective remains actionable | Medium | FIXED IN CODE; progression regression PASS; fresh Release build/launch PASS; interactive device repro BLOCKED |
| Awakening final reveal loses its panel styling/accessible content | Medium | FIXED IN CODE; UI regression PASS; fresh Release build/launch PASS; visual/VoiceOver repro BLOCKED |
| Stale opening roster count | Medium | FIXED IN COPY/DOCS; regression PASS; fresh Release build/launch PASS; interactive visual repro BLOCKED |
| F-D01–F-D05, F-D09–F-D13 | Mixed accessibility/polish | FIXED IN CODE except held runtime conflicts noted above; automated contracts PASS; fresh Release build/launch PASS; interactive device repro BLOCKED |
| F-D06, F-D07 | Runtime accessibility candidates | HELD — NOT VERIFIED |
| ADV-D01, ADV-D02 | Adversarial candidates | HELD — NOT VERIFIED |

Phase 6 follow-up disposition:

| Defect | Phase 6 disposition |
|---|---|
| F-D06 facility placement roles | SAFE STRUCTURAL FIX APPLIED; automated contract PASS; VoiceOver enumeration NOT VERIFIED |
| F-D07 ledger disabled-button semantics | SAFE STRUCTURAL FIX APPLIED; automated contract PASS; VoiceOver announcement NOT VERIFIED |
| F-D08 difficulty role | OPTIONAL TEXT-ROLE POLISH APPLIED; original missing-state claim remains CONTRADICTED |
| ADV-D01 inbox/Advance overlap | NOT PATCHED; retained screenshots do not substantiate overlap; matching-build tap reproduction required |
| ADV-D02 `TP EARNED +−23` | FIXED as truthful `TP CHANGE −23`; formatter regression PASS; device reproduction NOT VERIFIED |
| F-D14 Cup receipts | OWNER RULE APPROVED AND IMPLEMENTED; deterministic home/away and double-header cash tests PASS; device statement NOT VERIFIED |

## Remaining release gates

- Reproduce the original Season 1 → Season 2 failure on the fresh Phase 5 Release, force-close, and prove that Season 2 resumes.
- Recheck the Chairman, scout-objective, awakening, opening-roster, toast, facility-label, guided-tab, current-week, and post-match changes on that same build.
- Reproduce or dismiss ADV-D01, visually confirm ADV-D02 and F-D14, and complete the F-D06/F-D07 VoiceOver checks on the lead device.
- The following acceptance rows remain **NOT VERIFIED**: Bert drag-dismiss under uncontended input; individual scorebar speed/auto/settings accessibility; audio loop seams and physical haptics; Reduce Motion settlement parity; direct injured-lineup rejection; every facility adjacency/upgrade; staff dismissal/assistant; closed-window negotiation; contract renewal/hero wage; Season-10 recap; emergency-loan disclosure through its intended warning path.
- Construction cancellation, M5/TestFlight/store/release work, Android/PC, New Game+, friend leagues, localization, and expansion content remain **NOT IMPLEMENTED** rather than defects in this build.

## Command and observed-output ledger

This is the concise command ledger; screenshot-producing taps and accessibility reads are documented in their flow rows and evidence files.

| Command/check | Real observed output |
|---|---|
| `git rev-parse HEAD`, branch/status/diff capture | Phase 0 frozen at `1956074f2e10f582b3d96bb96c225a8bf1767a3f`, `main`, dirty shared tree retained; shared HEAD later moved to `124c056e89c17ee16fef13765ca9fe60c101dc03`. |
| `npx --no-install xcodebuildmcp --help` | Exit 1; package `xcodebuildmcp@2.6.2` missing. Track B selected. |
| `npx jest src/audit/__tests__/generate-acceptance-seeds.test.ts --runInBand` | PASS: 1 suite / 1 test; 34 codec-validated seed saves generated. |
| Initial `npx tsc --noEmit` | PASS, exit 0, no output. |
| Initial `npx jest --runInBand` | PASS: 154 suites / 1012 tests / 3 snapshots, exit 0, 668.336 seconds. |
| Phase 5 focused regression run before implementation | Expected RED: 3 suites failed; 11 tests failed / 5 passed. |
| Phase 5 focused regression rerun | PASS: 3 suites / 16 tests. |
| All UI suites after fixes | PASS: 26 suites / 75 tests. |
| Adjacent application/persistence/guide/full-career group | PASS: 7 suites / 72 tests, 139.138 seconds. |
| Post-fix `npx tsc --noEmit` | PASS, exit 0. |
| `git diff --check` | PASS, no output. |
| `xcodebuild -workspace ios/HeroFootballManager.xcworkspace -scheme HeroFootballManager -configuration Release … build` | Exit 0; `** BUILD SUCCEEDED **`; embedded bundle built at `/tmp/hfm-audit-phase5-124c056/Build/Products/Release-iphonesimulator/HeroFootballManager.app`. |
| SHA-256 of Phase 5 embedded `main.jsbundle` | `74a98908e28a107b7af72f059432e44007baf153346929a88f8b57f608bc5603`. |
| `xcrun simctl install` and `launch` on lead UDID | Install exit 0; launch returned `com.tanglefast.herofootballmanager: 65999`; title screenshot captured. |
| Phase 5 Computer Use state read | `Computer Use server error -10005: timeoutReached`; interactive post-fix taps remain NOT VERIFIED. |
| Full post-fix `npx jest --runInBand` | PASS: 156 suites / 1024 tests / 3 snapshots, exit 0, 1742.822 seconds. |
| Phase 6 focused run before implementation | Expected RED: 3 suites failed; 7 tests failed / 12 passed. |
| Phase 6 focused implementation group | PASS: 5 suites / 69 tests. |
| Phase 6 all UI suites | PASS: 26 suites / 80 tests. |
| Phase 6 Cup/career/headless/balance group | PASS: 8 suites / 74 tests. |
| Phase 6 `npx tsc --noEmit` | PASS, exit 0. |
| Phase 6 local Release build | Exit 0; `** BUILD SUCCEEDED **`; app built at `/tmp/hfm-audit-cup-gates-20260721/Build/Products/Release-iphonesimulator/HeroFootballManager.app`. |
| SHA-256 of Phase 6 embedded `main.jsbundle` | `ad87d3b73ee2795567c3eb2a2db1bc42d49ff9f6f193fd51338500f48b691f7c`. |
| Phase 6 install and launch on lead UDID | Install exit 0; launch returned `com.tanglefast.herofootballmanager: 87641`; usable title screenshot captured. |
| Phase 6 Computer Use retries | Two reads failed with `Computer Use server error -10005: timeoutReached`, including after Simulator was brought to the front. |
| Full Phase 6 `npx jest --runInBand` | PASS: 156 suites / 1,031 tests / 3 snapshots, exit 0, 736.598 seconds. |

## Final post-fix simulator closeout

This section supersedes the earlier Phase 5/6 statements that interactive proof was blocked.

- Final Release build and installed bundle match at SHA-256 `0de04295730521ae2d051e5b845a0d5481d87e7976702c5fda4520258bfc632e`.
- Season 1 → Season 2 completed, survived force-close, and resumed at Season 2 Week 1.
- Chairman, completed scout objective, 15-of-17 opening copy, notice behavior, guided tab/current-week copy, ledger semantics, match-summary reachability, and signed TP movement pass.
- Awakening now has a readable inset hero panel and complete AX name. Evidence: `evidence/P6-POSTFIX-R4-AWAKENING-FINAL.png`.
- Facility placement exposes exactly 48 AX buttons with a completed Gym present, including `Blocked at column 1, row 1`. Evidence: `evidence/P6-POSTFIX-R7-48-WITH-OCCUPIED.png`.
- The largest iOS accessibility text category keeps Home, the pinned Advance action, five tabs, and both team names usable. Evidence: `evidence/P6-POSTFIX-LARGE-TEXT-LAYOUT.png`.
- ADV-D01 is dismissed on the matching build: taps in the genuinely exposed inbox-card area navigate to the proposal and do not advance the week at either tested text size.
- F-D14 implements the owner-approved rule: every home Cup tie earns its own labelled gate in addition to same-week home League income; the matching statement showed both gates exactly once and kept the Cup prize separate.
- Final regression group: **34 suites / 161 tests passed**; TypeScript and whitespace checks pass; fresh local iOS Release build passes.

The detailed 13-row evidence and the physical-VoiceOver limitation are in `P6-device-recheck.md`. Final verdict: **READY for the audited Release scope**.
