# Phase 4 — independent adversarial player report

## Phase 6 follow-up

- ADV-D02 passes on the matching final Release: the post-match metric is truthful `TP CHANGE`; a negative movement displayed a single U+2212 minus with no `+−` prefix, and every summary/ledger element remained separately reachable.
- ADV-D01 is dismissed on the matching final Release. At both system and maximum accessibility text sizes, a raw-coordinate tap inside the genuinely visible part of the Training Ground proposal opened Club/facilities and left the week unchanged. No inbox tap fired Advance Week.
- Final installed/built bundle SHA-256: `0de04295730521ae2d051e5b845a0d5481d87e7976702c5fda4520258bfc632e`.
- Detailed tap coordinates and screenshots are recorded in `../P6-device-recheck.md`, rows 11 and 12.

Date: 2026-07-21
Automation: Track B, real iOS Simulator input and screenshots
Required build: `HFM-AUDIT-1956074-ab6622e70934`, bundle `com.tanglefast.herofootballmanager`

## Evidence provenance and limitation

- This subagent created exactly one new iPhone 16 Pro / iOS 26.5 device: `HFM-P4-ADV-20260721-1843` (`38C91BDB-4DB5-495C-BE80-D4AEAB76119E`), booted it, installed the required Release app from `/tmp/hfm-audit-1956074-phase0-token/Build/Products/Release-iphonesimulator/HeroFootballManager.app`, and launched the bundle.
- Computer Use initialization then hung. The lead stopped further simulator actions. No player-flow screenshot is attributable to that new UDID, so **nothing is marked PASS on `38C91BDB-4DB5-495C-BE80-D4AEAB76119E`**.
- The evidence folder contains the retained screenshots from an earlier independent same-day adversarial run on dedicated device `HFM-adv-163455` (`1834D006-E9B9-44A3-BA20-B5EAEC60EB4B`). That run used a Release app with an embedded bundle, but its handoff identifies commit `124c056`, not the required build ID above. Its observations are therefore useful **candidate evidence for lead-device reproduction**, not strict final PASS evidence for this requested run.

## Completed attempts from the retained independent run

- **ADV-P01 — rapid Advance Week:** From Week 15 Home, tap Advance Week three times rapidly. One match-day docket appeared; no duplicate fixture or second transition was visible. Evidence: `ADV-01-w15-home.png`, `ADV-03-advweek-triple.png`. Relaunch: not exercised. **Candidate PASS; build identity mismatch.**
- **ADV-P02 — repeated Quick Result / dismissal:** Tap Quick Result three times, then tap Back to the Office three times. One 1–3 result was created and the next single Cup docket appeared. Evidence: `ADV-04-quickresult-triple.png`, `ADV-04b-postmatch.png`, `ADV-05-backtooffice-triple.png`. **Candidate PASS; build identity mismatch.**
- **ADV-P03 — repeated facility confirmation and tap-behind:** Select Fan Shop, place it, tap the construction action four/five times, then tap behind the notice. Only one Fan Shop and one busy works crew were visible; the modal blocked the background. Evidence: `ADV-08-fanshop-select.png` through `ADV-13-after-modal-close.png`. The screenshots do not expose the exact post-purchase cash balance, so duplicate **charging is NOT VERIFIED** even though duplicate construction was not visible.
- **ADV-P04 — force-close during week advance:** Force-close while advancing, relaunch, and continue. The title retained a save and reopened a coherent Week 2 Home state. Evidence: `ADV-14-kill-during-advance.png`, `ADV-15-w02-home.png`. **Candidate PASS; build identity mismatch.**
- **ADV-P05 — rapid coach hire:** Tap Hire as Head four times and the confirmation five times. One Anika Weber head coach welcome screen appeared with one $500 weekly wage. Evidence: `ADV-19-coach-list.png` through `ADV-21-hire-confirm-5tap.png`. Duplicate hire was not visible; relaunch and the next wage settlement were not exercised. **Candidate PASS; persistence NOT VERIFIED.**
- **ADV-P06 — missing transient fields:** Saves with missing onboarding, training-cap notice, and youth-intake transient data reached the title/Home state. Evidence: `ADV-22-no-onboarding-menu.png`, `ADV-23-no-onboarding-home.png`, `ADV-24-adv-no-trainingCapNotices.png`, `ADV-24-adv-no-youthIntake.png`. **Candidate PASS.** Removing required event arrays correctly failed soft instead of silently mutating the save.
- **ADV-P07 — corrupt/unsupported save fail-soft:** Retry and relaunch left a corrupt save unchanged and continued to show the precise recovery screen. A future schema reported that schema 2 was unsupported and schema 1 was supported. Evidence: `ADV-25-retry-once.png`, `ADV-26-relaunch-after-corrupt.png`, `ADV-27-future-schema.png`. **Candidate PASS.**
- **ADV-P08 — training limits and repeat-save guard:** Select three drills, try a fourth, assign one player, then tap Save Weekly Plan four times. The fourth drill was blocked with `A weekly plan can contain at most three focus drills`; one locked plan showed $1,500 and 37 TP. The later statement charged weekly focus training once at $1,500. Evidence: `ADV-34-three-drills.png` through `ADV-40-after-cup.png`. **Candidate PASS for the three-drill cap and one money charge; force-close persistence NOT VERIFIED.**

## Candidate defects requiring lead-device reproduction

### ADV-D01 — visible inbox card can trigger Advance Week where it sits under the pinned bar

Severity candidate: P1/P2 depending reproducibility.

Reproduction:

1. Load the Week 2 Home state with the `Training Ground proposal` inbox card.
2. Scroll until the lower part of that visible card lies beneath the pinned `Advance Week` bar.
3. Tap the visible lower portion of the inbox card, intending to open it.

Expected: open the Training Ground proposal, or prevent the obscured area from appearing tappable.
Actual: the app immediately opened `Week 2 complete`, settling money and advancing the career. The retained run captured this twice.
Evidence: `ADV-16-w02-home-bottom.png`, `ADV-17-tap-inbox-under-bar.png`, `ADV-17b-repro.png`.

Lead action: reproduce on the lead device before confirmation; verify whether the tap coordinate is genuinely within a still-visible part of the inbox card and whether the same geometry occurs at all text sizes.

### ADV-D02 — negative TP is formatted as a positive-prefixed negative number

Severity candidate: P2 copy/feedback.

Reproduction:

1. Save a 37-TP weekly training plan for one player.
2. Resolve a match in the settlement week where match TP does not cover the training cost.
3. Read the post-match `TP EARNED` value.

Expected: a truthful signed value such as `−23 TP`, or separate `TP earned` and `Training cost` values.
Actual: the post-match screen displayed `TP EARNED +−23`. It appeared in two separate settlements; the later weekly review showed the underlying negative movement correctly.
Evidence: `ADV-40-after-cup.png`, `ADV-42-tp-earned-repro.png`, `ADV-43-tp-earned-repro2.png`.

Lead action: reproduce once on the lead device and confirm whether this field represents net TP or earned TP before choosing copy.

## Not verified in this independent pass

- Full-roster, zero-money, and outside-registration-window purchase attempts.
- Capped or injured player training, insufficient TP, and double-spend across force-close.
- Negotiation interruption, stale scout inbox, sale/bid interruption, and youth double-signing.
- Facility invalid/occupied/overlapping/edge placements, adjacency pairs, upgrades, cancellation, and construction force-close persistence.
- Staff dismissal, assistant hiring after Coaching Office, and staff wage persistence.
- Tutorial drag-dismiss, early dismissal rules, out-of-order Bert/inbox sequences, and taps during tutorial transitions.
- Match scorebar speed, auto-power, settings, live-match force-close, event interruption, season transition interruption, emergency loan disclosure, negative cash, board sale, legacy, contracts, and Season 10.
- Audio, SFX, haptics, loop seams, and Reduce Motion behavior.

## Independent verdict

The retained run found strong candidate evidence for two player-facing defects and encouraging guards against repeated Advance, Quick Result, coach hire, facility creation, and training-plan submission. Because the newly required UDID did not complete any player flow and the retained screenshots are from a different documented build identity, this Phase 4 run is **INCOMPLETE / NOT VERIFIED** under the strict acceptance contract. Reproduce `ADV-D01` and `ADV-D02` on the lead device; do not promote the candidate PASS rows without matching-build evidence.
