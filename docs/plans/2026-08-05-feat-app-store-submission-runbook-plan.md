---
title: "release: Submit Hero Football Manager to the Apple App Store"
type: release
date: 2026-08-05
status: reviewed-and-revised-after-council-audit
owner: Joe
operator: Website-controlling LLM with Joe present
---

# Hero Football Manager — App Store submission runbook

## Outcome

Use this runbook to take **Hero Football Manager** from its current repository state to a truthful, complete App Store Connect submission and, after approval, a controlled public release.

This is written for an LLM operating Apple Developer and App Store Connect in a browser while Joe is present. It also includes the local Xcode work that cannot be completed on the website. It is current to **August 5, 2026**, but the operator must refresh Apple's official requirements on the day of execution.

Success means all of the following are true:

- the legal/commercial account is ready for a paid app;
- the selected release archive is current, signed, complete, and tested;
- every answer describes that archive rather than a roadmap or an old build;
- all required URLs, copy, screenshots, declarations, pricing, and review information are complete;
- no identity, legal, privacy, rights, tax, banking, territory, or age-rating fact is invented;
- Joe sees a redacted final readback and explicitly authorizes submission;
- App Store Connect confirms the resulting review status;
- if release is manual, Joe separately authorizes the public release after approval.

This runbook does **not** authorize the operator to accept a contract, make a legal attestation, enter or expose financial credentials, upload a build, create an immutable app record, submit for review, or release the app without the approval gate specified below.

## Operator rules: evidence first, never guess

### Field states

Keep an in-session evidence ledger. Give every field exactly one state:

- `VERIFIED_BUILD` — proved from the final archived binary or hands-on test of it.
- `VERIFIED_ACCOUNT` — read from the correct live Apple account and checked today.
- `VERIFIED_REPO` — proved from current source, but still subject to final-archive confirmation.
- `OWNER_CONFIRMED` — Joe supplied or explicitly confirmed it.
- `PROPOSED` — the LLM drafted a marketing or operational choice for Joe to approve.
- `BLOCKED` — required evidence or approval is missing. Do not enter a placeholder.
- `NOT_APPLICABLE` — verified absent from the release, with the reason recorded.

For each entry record: field, masked value or non-sensitive summary, source, date checked, confidence, whether Joe approved it, and the App Store Connect section where it belongs. Never put passwords, two-factor codes, full bank details, tax IDs, API keys, `.p8` contents, identity-document images, or other secrets in the ledger, repository, transcript, or screenshots.

### Evidence order

Before asking Joe a factual question, search in this order:

1. The **actual final release archive** and a clean installation of it.
2. The correct live **App Store Connect / Apple Developer account**.
3. Existing app records, especially **Liquid Calendar** and Joe's other prior app.
4. This repository and its current product documentation.
5. Public pages owned by the same verified developer, including the prior app's support/privacy site.
6. Current official Apple documentation.
7. Joe, only for facts still absent, stale, contradictory, legally personal, or inherently his decision.

Prior-app information is a clue, not automatic permission to reuse it. Reconfirm anything that may have changed. Never copy a prior app's app-specific privacy answers, age rating, encryption declaration, rights declaration, bundle ID, SKU, screenshots, keywords, description, or review notes.

### Browser safety and idempotency

- Joe signs in, handles password entry, two-factor authentication, identity checks, and any sensitive financial form directly.
- Confirm the active Apple team before reading or changing anything.
- Start read-only. Search for an existing app record and App ID before creating either.
- Before every consequential click, reread the visible app name, team, bundle ID, version, and current status.
- After a timeout, reload, or ambiguous click, inspect current state. Never click Create, Submit, or Release again merely because no success animation appeared.
- Use current official Apple documentation when a page presents a field not covered here. If it changes the answer or creates legal ambiguity, mark it `BLOCKED` and ask Joe.
- Keep personal values masked in summaries. It is acceptable to say “existing address ending in 12, last verified today”; do not repeat the complete value in chat.

### Explicit approval gates

Stop and obtain Joe's clear approval at each gate:

1. **Legal and financial gate:** agreements, tax, banking, DSA trader status, content-rights attestation, export classification, or public contact data.
2. **Immutable identity gate:** creating the App ID or App Store Connect app record, including final name, bundle ID, SKU, primary language, and owning team.
3. **Binary gate:** uploading a signed archive or replacing the selected build.
4. **Declaration gate:** publishing App Privacy, age rating, export compliance, content rights, accessibility claims, tax category, price, and territory choices.
5. **Submission gate:** clicking **Submit for Review**.
6. **Release gate:** clicking **Release This Version** after approval when manual release is selected.

Preparing drafts and navigating read-only pages are not authorization to cross these gates.

## Current project facts and unresolved items

The following table tells the operator what can be prefilled, what must be reverified, and what must not be invented.

| Field | Current evidence-backed position | State now | Required before entry |
|---|---|---:|---|
| Product | Cozy, lighthearted, single-player football club-management game with fictional superhero players, auto-played matches, live coaching, training, finances, facilities, promotion, and comic effects | `VERIFIED_REPO` | Verify final binary still matches |
| Platform | iOS app built with Expo/React Native | `VERIFIED_REPO` | Verify processed build metadata |
| Store name | `Hero Football Manager` is configured, but project docs call it a **working title** | `BLOCKED` | Joe approves final name after availability/rights check |
| Bundle ID | `com.tanglefast.herofootballmanager` | `VERIFIED_REPO` | Check correct Apple team, duplicate App ID/record, and final archive |
| Version | `1.0.0` | `VERIFIED_REPO` | Verify final archive and ASC version |
| Build number | Durable `expo.ios.buildNumber` is `1`; the local Release build reports `CFBundleVersion=1`, and no HFM app record exists in the signed-in ASC account | `VERIFIED_REPO` | Recheck Developer identifiers and confirm no prior upload before using build 1 for the signed archive |
| Minimum iOS | Today's ignored/generated native snapshot says iOS 16.4; the durable Expo source does not explicitly pin that value | `BLOCKED` | Regenerate with the approved release config, then verify the target and final archive before stating support |
| Devices | Joe chose one universal iPhone+iPad app | `OWNER_CONFIRMED` | Retain universal support only if the final iPad matrix and screenshot set pass |
| Orientation | iPhone is portrait-first. iPad supports all orientations and multitasking; widths below 1100pt use the mobile composition and wider landscape windows use the desktop composition | `VERIFIED_BUILD` for current local Release | Repeat portrait, both landscape directions, resizing/multitasking, and common-flow QA on the final archive |
| Language | Product plan says English-only at launch | `VERIFIED_REPO` | Confirm primary localization, proposed English (U.S.) |
| Business model | Paid once, everything included, no IAP or gacha; approximately US$0.99 is only a planning target | `VERIFIED_REPO` | Joe authorizes exact price point and base storefront |
| Accounts/login | No account or login found | `VERIFIED_REPO` | Verify final archive; then reviewer credentials are not applicable |
| Ads/IAP | No ads or in-app purchases found | `VERIFIED_REPO` | Verify dependencies and final archive |
| Network/cloud | Designed fully offline; no server, multiplayer, cloud save, or networking integration found | `VERIFIED_REPO` | Verify release network activity and SDK behavior |
| Data behavior | Current source/dependency audit found no developer or third-party data collection or tracking | `VERIFIED_REPO` | Archive/privacy-report/network audit before selecting “Data Not Collected” |
| Native privacy manifest | The regenerated local Release app declares no collected data/tracking and lists required reasons for User Defaults, file timestamps, system boot time, and disk space | `VERIFIED_BUILD` for current local Release | Inspect the final signed archive's combined privacy report and every bundled SDK |
| Local data | Player-entered name and career save remain in local SQLite; the user can reset/delete them | `VERIFIED_REPO` | Explain accurately in privacy policy |
| Save sharing | Export is user-initiated through the iOS share sheet, not automatic developer collection | `VERIFIED_REPO` | Verify final behavior and policy wording |
| Encryption | Config says the app does not use non-exempt encryption | `VERIFIED_REPO` | Inspect archive and all SDKs before answering export compliance |
| Game Center | No entitlement or integration found | `VERIFIED_REPO` | Verify archive; otherwise do not configure it |
| Notifications/permissions | No push, camera, location, contacts, microphone, tracking, or other purpose strings found | `VERIFIED_REPO` | Verify archive's entitlements and Info.plist |
| Fictional content | Players, clubs, and leagues are fictional/procedurally generated | `VERIFIED_REPO` | Check final screenshots and copy use only fictional data |
| App icon | Source and compiled device icons contain only fully opaque pixels; the generated 1024px App Store icon has no alpha channel and the local Release build passed Xcode validation | `VERIFIED_BUILD` for current local Release | Revalidate the final signed archive |
| Privacy URL | Liquid Calendar's saved privacy URL currently returns 404; no live HFM-specific policy exists | `BLOCKED` | Publish and approve a live HFM-specific URL |
| In-app privacy area | Privacy & Support is accessible from title Settings and in-career Settings, with local-data/export wording, version/build, support, and license notice | `VERIFIED_BUILD` | Add the exact live web-policy action once the HFM URL exists, then retest it online and offline |
| Support URL/contact | Liquid Calendar's support page works and publishes the same email now used by the in-game Email Support action, but it is app-specific | `PROPOSED` | Joe confirms the email and a live HFM-specific support URL is published |
| Copyright/legal owner | Liquid Calendar version metadata uses `2026 Otaku Games` | `VERIFIED_ACCOUNT` clue | Joe confirms the current rights-owner wording for this game |
| Age rating | Light comic fantasy sports contact plus mild fear/medical imagery exists; frequency is unmeasured | `BLOCKED` | Inspect final content and complete live questionnaire truthfully |
| Content rights | Joe confirmed all visual art is original/programmatically drawn and, on 2026-08-06, confirmed every supplied audio recording/cue is authorized for commercial/public App Store use; generated music/SFX are also documented in the repository | `OWNER_CONFIRMED` | Re-run the inventory against the final archive, retain notices and any private underlying evidence, then Joe approves the final content-rights declaration |
| Screenshots | Existing July captures are stale and include removed behavior; no iPad set exists | `BLOCKED` | Fresh final-build captures and Joe approval |
| Release archive | A fresh unsigned iPhone+iPad Release simulator app builds and launches with embedded JS; it is not uploadable | `BLOCKED` | Fresh signed `.xcarchive` from the approved final release commit, Organizer validation, and device install |

Durable repository anchors for these facts include `app.json`, `package.json`, `docs/01-vision.md`, `docs/08-ui-ux.md`, `docs/09-tech-stack.md`, and `README.md`. The local `ios/HeroFootballManager/Info.plist` and `ios/HeroFootballManager/PrivacyInfo.xcprivacy` are useful **today-only generated snapshots**, but the entire `ios/` directory is ignored and absent from a clean clone. They must never be cited as durable release configuration. Regenerated native files and the final archive control the submitted native answers.

### Live account reconnaissance completed August 5, 2026

The signed-in account was inspected read-only. No contract was accepted and no
record, declaration, upload, or account value was changed.

- No Hero Football Manager app record currently appears in App Store Connect.
- Free Apps and Paid Apps agreements show **Active**, with displayed terms
  ending August 11, 2026. Recheck for a renewal before submission.
- The configured bank account, all listed tax forms, DSA compliance, and the
  listed Canadian compliance entry show **Active**.
- Liquid Calendar supplies verified clues: copyright wording `2026 Otaku
  Games`, a working app-specific support page and public support email, no
  reviewer login, and a manual-release convention.
- Liquid Calendar's saved privacy URL returns a public 404. Do not copy it.
- App Store Connect currently highlights new social-media questions in the age
  rating section. The final questionnaire must explicitly cover them.
- App Store Connect has scheduled maintenance on August 8, 2026 at 6 a.m. PDT
  for up to two hours; avoid a critical delivery during that window.

Private account, address, tax, bank, phone, and review-contact values remain in
App Store Connect and must not be copied into this repository or runbook.

## Hard stops before submission work continues

Do not create or submit the app while any applicable item remains true:

- the Apple team or ownership is ambiguous;
- a matching App ID/app record exists on another team or duplicate status is unresolved;
- the paid agreement, tax, or banking state blocks a paid app;
- the final storefront name or immutable record fields are not approved;
- privacy/support URLs are absent, private, broken, generic to the wrong app, or misleading;
- the app lacks an accessible in-app privacy-policy link;
- visible placeholder content remains in any player-reachable release path;
- current iPad support is retained without iPad screenshots and portrait/landscape/multitasking QA;
- Mac or Vision Pro distribution remains enabled without hands-on testing;
- the final archive contains an asset not covered by the rights ledger or an applicable retained license/notice; Silkscreen has an included SIL Open Font License, and its notice obligations still need to be retained;
- the title has not had an availability and rights-risk check;
- App Privacy evidence conflicts with actual archive or network behavior;
- an included territory requires a game license/document Joe does not have;
- screenshots or metadata show stale, removed, debug, placeholder, or planned behavior;
- the archive is old, invalid, unsigned, built with QA flags, dependent on Metro, or built with an unsupported SDK;
- a required field is filled with a guess or placeholder;
- Joe has not approved the applicable legal/declaration/submission gate.

## Game changes and release-engineering work to code before submission

This is the separate implementation backlog Joe requested. It lists product/build changes revealed by the compliance review; it does **not** authorize implementing them in this planning turn. Recheck each item against the eventual release candidate and close it with observable evidence.

### P0 — Known release blockers

| ID | Change to make | Why it is required | Likely files/area | Done when |
|---|---|---|---|---|
| APPSTORE-P0-01 | Add an easily accessible **Privacy Policy** action inside the app, preferably in Settings, opening the exact public HTTPS policy used in App Store Connect. Include a graceful offline/error state. | Apple requires the policy URL in metadata and an easily accessible link in the app. The current Privacy & Support area has truthful local-data copy and an email-support action, but no final public privacy URL because an HFM-specific page is not live yet. | `src/ui/PrivacySupportPanel.tsx`, its caller/props, public URL config, focused tests | A clean Release/TestFlight install opens the correct public policy from Settings on iPhone and supported iPad layouts; VoiceOver identifies it as a link/button; a broken/offline open fails clearly |
| APPSTORE-P0-02 | Remove the obsolete hire-screen path or replace its explicitly temporary portrait with final art. | App Review requires a complete build with no placeholder content. | App navigation plus the hire-screen source/art path | **Closed on current `main` on 2026-08-06:** the dead `HirePitchScreen` and its placeholder art were removed. Reopen only if a player-reachable replacement introduces unfinished art |
| APPSTORE-P0-03 | Make a deliberate **device/orientation contract**. Either (A) fully support iPad and correct/test portrait, both landscapes, resizing, and multitasking, or (B) change the binary to iPhone-only before archiving. | Current config says portrait plus tablet support, while the generated native iPad target advertises all orientations and multitasking. Apple will review what the binary advertises. | `app.json`, Expo/native generation config, iOS target settings, layout hooks/screens | Final archive and processed build advertise only behavior the game passes; if universal, every common task passes the iPad matrix and 13-inch screenshots exist |
| APPSTORE-P0-04 | Guarantee that production archives cannot enter any `EXPO_PUBLIC_*` QA/harness route. Add a release-build assertion or equivalent build-time verification, and archive with all QA flags unset. | Several QA routes are controlled by public environment flags and are not all guarded by `__DEV__`. A wrong archive can launch review reels/harness UI. | `App.tsx` build-mode routing, release environment/build scripts, archive verification | **Closed in source on 2026-08-06:** native Release builds ignore QA roots and `release:check` rejects set QA flags. Recheck the final archive and prove it launches the normal game |
| APPSTORE-P0-05 | Maintain complete rights coverage for the shipped asset set. Joe has confirmed the current visual and supplied-audio assets for commercial/public App Store use; replace/remove any later asset that lacks coverage. | The final content-rights declaration must match the exact archive, including anything added after this review. | `assets/audio/`, current programmatic visual/icon sources, awakening/voice mappings, asset manifest/notices | **Closed for the current asset set on 2026-08-06.** Re-run the final archive inventory; the ledger covers every shipped asset and Joe approves the rights declaration |
| APPSTORE-P0-06 | Produce a fresh signed release archive from the approved commit using current Apple tooling, with the unique build number persisted in `expo.ios.buildNumber` and JS/assets embedded. | The only local Release app is stale; there is no current `.xcarchive`/`.ipa`. A debug app that depends on Metro cannot be submitted, and an ignored native build number can silently revert on regeneration. | `app.json`, iOS/Xcode/Expo build configuration, and release scripts | Regeneration preserves the chosen build number; Organizer validation passes; archive identity/privacy report are recorded; clean physical-device install launches and plays offline without Metro |

### P1 — Changes conditional on QA or a release decision

| ID | Change/test branch | Trigger for coding | Smallest acceptable outcome |
|---|---|---|---|
| APPSTORE-P1-01 | Add an in-app **About / Support / Legal** area with Support, Privacy, app version/build, and open-source notices. | Privacy link is already P0. Add the rest when Joe wants an obvious support route or license notices require display. Silkscreen ships under SIL OFL 1.1; retain its notice rather than treating the font as unlicensed. | One simple Settings subpage using Joe-approved public URLs and bundled notices; no broad website framework |
| APPSTORE-P1-02 | Fix iPad layouts, touch targets, modal sizes, scrolling, safe areas, rotation state, and match rendering. | Any common task fails if Joe keeps iPad support. | Surgical screen/layout fixes until the entire supported iPad matrix passes; otherwise choose iPhone-only before archive |
| APPSTORE-P1-03 | Opt out of Apple-silicon Mac and/or Vision Pro, or fix their input/layout/audio behavior. | These storefronts default on and hands-on QA fails or is not performed. | Prefer the App Store Connect opt-out when those platforms are not an intended 1.0 feature; code only if Joe deliberately supports them |
| APPSTORE-P1-04 | Repair accessibility gaps before claiming a nutrition-label feature. | VoiceOver, Voice Control, Larger Text, contrast/non-color, or Reduce Motion common-task audit fails and Joe still wants the claim. | Fix the specific failed flow and rerun all common tasks; otherwise leave the optional claim unselected |
| APPSTORE-P1-05 | Correct privacy manifest, required-reason API, permission strings, SDK configuration, or disclosures. | Xcode archive privacy report/validation or runtime network audit conflicts with today's no-collection/no-tracking evidence. | Product behavior, manifest, public policy, and App Privacy answer all agree; never add a reason/disclosure merely to silence a warning |
| APPSTORE-P1-06 | Make the clean-install reviewer route faster or clearer. | Measured time/taps to first match and first visible power are unreasonable or reviewers cannot find them from notes. | Improve normal onboarding/navigation; do not ship a secret review account, hidden dev harness, or misleading shortcut |
| APPSTORE-P1-07 | Eliminate any production path that visibly falls back to placeholder rectangles/art when assets fail. | Release stress/error testing reaches renderer fallbacks or missing assets. | Assets load reliably; failure is handled as a deliberate player-facing error/recovery state rather than shippable filler art |
| APPSTORE-P1-08 | Make the compiled App Store icon reliably opaque and final across regeneration. | Archive validation shows alpha, wrong artwork, or generated/native icon drift. | Final asset catalog contains the approved 1024×1024 opaque icon and Organizer accepts it |
| APPSTORE-P1-09 | Adjust age-sensitive content only as a product choice, not to game the questionnaire. | Joe decides a lower audience rating is important after seeing the honest result. | Deliberately change/remove the relevant repeated violence/fear/substance imagery, then rerun the complete content audit; otherwise keep the content and accept the truthful rating |
| APPSTORE-P1-10 | Correct or remove the durable `ITSAppUsesNonExemptEncryption=false` source value before native generation. | The technical dependency review or Joe's approved export classification does not support that declaration. | `app.json`, regenerated Info.plist, archive, and App Store Connect/documentation path all represent the same approved classification; use a fresh higher build if any archived value changes |

### P2 — Release automation worth adding after blockers

- Add a repeatable local release check that prints only non-sensitive facts: commit SHA, version/build, bundle ID, Xcode/SDK, device families, orientations, QA-flag state, privacy manifest presence, icon dimensions/alpha, and archive validation result.
- Add focused tests for the Privacy/Support actions and for release-mode routing when every QA flag is absent/present.
- Add a store-media capture checklist or script that validates dimensions, opacity, current behavior, and archive/build provenance without bundling the dev harness into Release.
- Keep a non-secret rights/notices manifest in the repo so future submissions and updates do not repeat this archaeology.

### Compliance features the game does **not** currently need

Do not add scope merely because these fields exist in App Store Connect. Based on the current offline paid-once release, no code is presently indicated for:

- Sign in with Apple, login, guest accounts, or server-side account deletion;
- App Tracking Transparency or an IDFA permission prompt;
- StoreKit, Restore Purchases, subscriptions, loot boxes, or IAP review UI;
- Game Center achievements/leaderboards;
- push notifications;
- chat, user-generated-content moderation, social login, or web browsing;
- a Kids Category parental gate;
- ads, analytics, crash-reporting, cloud saves, or a backend.

If any of those features is later added, stop and redo privacy, permissions, age rating, review access, entitlements, screenshots/copy, and applicable Apple policy work from the actual new build.

## End-to-end execution

### Phase 0 — Refresh the rules on execution day

Before entering App Store Connect, open and date-stamp these official pages:

1. [Apple Upcoming Requirements](https://developer.apple.com/news/upcoming-requirements/)
2. [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
3. [App Store Connect release notes](https://developer.apple.com/help/app-store-connect/release-notes/)
4. [Required, localizable, and editable properties](https://developer.apple.com/help/app-store-connect/reference/app-information/required-localizable-and-editable-properties/)
5. [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
6. [Age-rating values and definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/)
7. [App Privacy details](https://developer.apple.com/app-store/app-privacy-details/)
8. [App information and territory-specific fields](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/)

As of this plan:

- uploads have required **Xcode 26 or later and the iOS 26 SDK** since April 28, 2026;
- Apple's updated age-rating questionnaire has been required since January 31, 2026, with 4+, 9+, 13+, 16+, 18+, or Unrated results;
- Unrated apps cannot be published;
- screenshots require the current highest supported iPhone set and, when iPad is supported, the current highest iPad set;
- App Privacy, required-reason API, third-party SDK, DSA, and territory rules remain separate declarations.

If a current official page conflicts with this document, use the current official rule, record the link and date, and explain the change to Joe before proceeding.

### Phase 1 — Sign in and perform read-only account reconnaissance

1. Joe signs in to Apple Developer and App Store Connect and completes 2FA privately. Do not assume the first team/provider shown is the correct one.
2. Enumerate **every team/provider Joe can access** in the App Store Connect team switcher and the Apple Developer account's Membership/People views. Record only masked team names, provider identifiers, role/access scope, and membership state.
3. On **each accessible team/provider**, search both App Store Connect Apps and Certificates, Identifiers & Profiles before selecting the HFM owner. This cross-team pass is mandatory because Liquid Calendar or an old HFM identifier may be under a different provider.
4. For each team, search the **Apps** list for:
    - Liquid Calendar;
    - Joe's other prior app;
    - Hero Football Manager;
    - `com.tanglefast.herofootballmanager` where searchable;
    - removed, rejected, or draft records as well as live ones.
5. On each Developer Program team, search App IDs for `com.tanglefast.herofootballmanager`.
6. If Liquid Calendar and the other prior app are not found after every accessible team/provider is checked, mark prior-record reconnaissance `BLOCKED` and ask Joe which Apple Account or team hosted them. Do not silently skip the lookup or start asking him to re-enter reusable facts.
7. Only after that inventory, record the proposed HFM owning team in masked form and ask Joe to confirm it.
8. Confirm the operator's role on that team can create/manage apps. If not, have the Account Holder/Admin change access; do not work around permissions.
9. Check Developer Program membership status and expiration on the intended team.
10. In **Business / Agreements**, inspect the latest agreement statuses and open any `Pending User Info`, `Active (Pending User)`, or equivalent row to identify the missing category.
11. For this paid app, verify the Account Holder has accepted the **Paid Apps Agreement** and that every live required information section it shows—such as Contact Info, Banking, or Tax—is complete. Apple may change the labels; do not invent a fixed list of contact roles.
12. Record Tax and Banking only as `complete`, `action required`, or the displayed status—not the underlying personal data.
13. Inspect current **EU Digital Services Act trader** status and verification state.
14. Record the public developer/seller name exactly as Apple displays it. Do not invent a company name or try to change an immutable developer name.
15. If a matching App Store record exists, verify team, app owner, bundle ID, SKU, platform, version, and status, then resume that record. Do not create another.
16. If a matching App ID exists on the correct team, verify it is explicit and has only needed capabilities. Reuse it.
17. If either exists on a different team or ownership is ambiguous, stop for Joe to resolve it.

#### What to recover from Liquid Calendar and the other prior app

Inspect before interviewing Joe:

| Candidate fact | Where to look | Reuse rule |
|---|---|---|
| Legal seller/entity and account type | Account, Membership, Agreements | Treat live account as authoritative; Joe confirms if action required |
| Public developer name | Existing public app / account | Record exactly; it may be immutable |
| Review contact name/email/phone | Prior version's App Review Information | Reuse only after masked confirmation that it is current |
| Support email and support-page convention | Prior listing and live support page | Use only if it genuinely supports HFM |
| Privacy-domain convention | Prior listing and live policy | Create/update an HFM-specific policy; do not copy prior privacy claims blindly |
| Marketing domain | Prior listing | Optional; verify ownership and relevance |
| Copyright-owner wording | Prior listing | Joe confirms current rights owner and year |
| Primary language/localization convention | Prior listing | Clue only; HFM's launch plan currently says English-only |
| Price base region and territory convention | Pricing/Availability | Clue only; Joe authorizes HFM choices |
| Manual/automatic release convention | Prior release settings | Clue only; Joe chooses for this release |
| DSA/account compliance status | Account compliance | Use current account state, never an old screenshot |

Do **not** recover passwords, credentials, tax identifiers, bank numbers, identity documents, or API key bodies. If any private value must be entered, hand control to Joe for that field.

### Phase 2 — Interview Joe only for unresolved facts and decisions

After Phase 1, show Joe a short masked summary of what was found and ask only the unresolved questions. Do not ask him to retype a complete address/contact if the account already contains it; ask whether the masked existing value is still current.

Ask in this order because later work depends on earlier answers:

#### 2A. Account, identity, and legal authority

1. “I am on Apple team **[masked team]**, showing seller/developer **[displayed name]**. Is this the team that should own the game?”
2. “The stored review/support contacts appear current/stale/missing. May I reuse the verified current values, or will you update them privately?”
3. “Apple currently shows your DSA status as **[status]**. Do you legally determine that you are a trader or non-trader for this release?” Explain that a trader's verified address, phone, and email can be public on EU storefronts. The LLM must not make the legal determination.
4. If agreements, tax, or banking need action: ask Joe to complete and attest to them privately. Never suggest tax residence, entity type, treaty claim, W-8/W-9 answer, tax ID, bank country, routing data, or account holder.

#### 2B. Product identity and supported devices

5. “The configured name is **Hero Football Manager**, but the project still calls it a working title. Is that the final storefront name after the availability/rights check?”
6. “Should version 1.0 support iPad? Keeping it requires fresh 13-inch iPad screenshots plus portrait, both landscapes, resizing, and multitasking QA. Otherwise the binary must be made iPhone-only before archive.”
7. “Should the iPhone/iPad app be offered on Apple-silicon Macs or Apple Vision Pro?” Recommend opting out unless Joe authorizes testing and the final build passes there.
8. “Is English (U.S.) the intended primary language and the only launch localization?”

#### 2C. Commercial launch decisions

9. “What exact paid price point and base storefront do you authorize?” Show the current price-point UI; do not convert the approximate `$0.99` planning note into a final instruction.
10. “Which storefronts should be included?” Explicitly surface the China mainland and Vietnam license gates before offering “all.”
11. “Do you have the required game-publishing documents for China mainland or Vietnam?” If no, exclude those storefronts.
12. “For first release, do you want manual, automatic, or scheduled release after approval?” Recommend manual release for control, but require Joe's decision.
13. “Do you want a preorder?” Treat no preorder as the simple path unless Joe explicitly wants one.
14. Confirm Public App Store distribution. Do not select private/custom distribution for a consumer game without an explicit change in intent.

#### 2D. Public identity, support, and rights

15. “Which live HFM privacy-policy URL and support URL should be used?” If prior infrastructure exists, propose an HFM-specific page on it; Joe confirms ownership and public contact details.
16. “What rights-owner wording should follow the year in the copyright field?” Use `2026 [confirmed person or entity]`; Apple supplies the © symbol.
17. Joe confirmed on 2026-08-06 that every current visual asset and supplied audio recording/cue—including “Spirit of the Dead,” Bert voice, button/body-fall recordings, and awakening/celebration cues—is authorized for commercial/public App Store use. Reconfirm only if the final archive contains a new or changed asset. Silkscreen has an included SIL OFL 1.1 license; retain its required notice.
18. “Has the final game name been checked for App Store availability and material trademark conflict?” A search is risk screening, not legal clearance.

#### 2E. Release behavior and declarations

19. “Is the feature set frozen, and which exact commit should become the release candidate?”
20. “Does any release-time service, SDK configuration, crash reporter, analytics system, ad system, server, or partner transmit data in a way the repo cannot show?”
21. “Is the game directed specifically to children or intended for Apple's Kids Category?” Do not infer this from its art style. Do not select Made for Kids without deliberate owner intent and a full Kids compliance review.
22. After the content audit, show Joe the proposed age-rating answers and ask him to approve their factual frequency/intensity.
23. After the source/dependency encryption audit but **before archive**, show Joe the proposed export classification and ask him to approve it; change the durable source declaration first if needed.
24. After the archive audit, show Joe the proposed privacy, content-rights, accessibility, and territory declarations, confirm the embedded export value still matches the earlier approval, and ask for renewed export approval if evidence changed.
25. After capture, ask Joe to approve the exact screenshots, optional preview, listing copy, category, tags, price, territories, and release mode.

Any unanswered required item stays `BLOCKED`.

### Phase 3 — Resolve binary-readiness blockers before store entry

Treat this phase as a release gate, not a paperwork exercise.

1. Freeze the intended release commit and record its Git SHA.
2. Resolve the **working-title decision** before creating the app record or final icon/copy.
3. Add a public privacy-policy link inside the app in an easily accessible location, such as Settings. Verify the link opens the exact HTTPS policy submitted to Apple.
4. Add an equally practical support/contact path if the app experience needs it; at minimum the submitted Support URL must expose real contact information.
5. Replace, remove, or deliberately finish every visible placeholder. The obsolete hire screen and its temporary chibi were removed on current `main`; recheck every remaining player-reachable path after content freeze.
6. Complete an asset-rights ledger for code, title, fonts, music, sound effects, voices, artwork, icons, screenshots, and any AI-generated material. Record source, owner/licensor, commercial-use scope, attribution requirement, and evidence location without committing private contracts.
7. Replace or remove any asset whose commercial rights cannot be proven.
8. Search the release UI and content for placeholder, beta, demo-only, test, coming-soon, invalid link, and incomplete-content language. Distinguish normal gameplay demonstrations from an unfinished demo product.
9. Decide iPhone-only versus universal support. If universal, repair any configuration conflict and pass the iPad matrix below. If iPhone-only, make the binary change before the archive and confirm the processed build no longer advertises iPad.
10. Decide Mac and Vision Pro availability. If either remains enabled, include hands-on testing there; otherwise plan to opt out in Pricing and Availability.
11. Confirm the release app embeds its JavaScript bundle and launches without Metro. A debug phone build that fetches JavaScript from the Mac is not submission evidence.
12. Ensure all `EXPO_PUBLIC_*` QA/dev-harness flags are unset for archive. Launch the archived app to prove it opens the normal production flow.
13. Confirm developer menus, harness controls, debug overlays, placeholder fallbacks, and private test deep links cannot appear in normal Release use.
14. Ensure every user-visible URL is final and works over public HTTPS without login.
15. Finish all items in the roadmap that are actual launch blockers; do not advertise unimplemented roadmap features.

#### Required functional QA on the release candidate

Test a clean install and an upgraded/reinstalled path as applicable:

- first launch, character creation, onboarding, first home screen;
- week advance, first match, second match/first visible hero power, pause/resume, formation, playstyle, substitution, and Energy Use;
- Quick Result parity at a practical smoke-test level;
- training, facilities, finances, hiring/transfers/contracts, events, league/cup progress, save/load, restart, import, and user-directed export;
- offline launch and continued play in airplane mode;
- background/foreground, interruption, low-memory relaunch, and device restart;
- silent switch, volume, haptics, and no unintended background audio;
- broken-link and error-state handling;
- no crashes, hangs, clipped blocking copy, hidden required controls, or placeholder visuals;
- privacy/support link access from a fresh install;
- exact taps and elapsed time from a clean install to the first match and first visible hero power for reviewer notes.

Test on at least one current physical iPhone using the archived/TestFlight build, not Metro. If iPad remains supported, test a current physical iPad or equivalent release/TestFlight installation in:

- portrait;
- landscape left and right;
- rotation during ordinary screens and a live match;
- every supported multitasking/resizable width;
- external keyboard/pointer only if the product claims support;
- fresh install, save/relaunch, and all common tasks;
- legible layout with no inaccessible or off-screen controls.

Do not claim that simulator screenshots prove physical-device release behavior.

#### Accessibility audit

The repo includes Reduce Motion, text-size choices, high contrast, color-safe kits, haptics control, power-label choices, and match-information positioning. These controls do not automatically prove an App Store accessibility nutrition-label claim.

For every claim under consideration, test **all common tasks** on every supported device family. In particular, separately verify VoiceOver, Voice Control, Larger Text, sufficient contrast, differentiation without color alone, and Reduce Motion. Publish only claims that pass end-to-end. If Apple's label remains optional and a claim is unproven, leave it unclaimed rather than guessing.

### Phase 4 — Publish and verify the required web pages

Before metadata entry, make these public, mobile-readable, and reachable without authentication:

#### Privacy policy — required

The HFM policy must accurately cover the final archive, including:

- developer/rights-owner identity and a contact method approved by Joe;
- effective date;
- the fact that gameplay, created-player name, settings, and saves are stored on device if final verification supports it;
- what “no data collected” means and whether any SDK/partner receives data;
- the user-initiated save export/share-sheet behavior;
- local deletion/reset behavior;
- children/age treatment appropriate to the final audience decision;
- policy-change and contact process.

The same URL must be entered in App Store Connect and linked inside the app. A Liquid Calendar policy may supply the domain/layout only if it is updated to cover this game; do not submit a policy describing the wrong product.

#### Support page — required

The Support URL must lead to real support/contact information and should identify Hero Football Manager. Include the contact channel Joe approves, expected support scope, privacy-policy link, and basic troubleshooting. Verify the contact inbox is monitored. Do not expose a home address unless legally required and consciously approved.

#### Marketing page — optional

Use only if a polished HFM page exists. It must match the current binary and use licensed assets. Otherwise leave the optional Marketing URL blank.

Test every page on phone and desktop, check HTTPS, redirects, spelling, contact links, and the absence of unpublished personal data.

### Phase 5 — Clear account, agreement, tax, banking, and compliance prerequisites

1. Confirm active Developer Program membership.
2. Confirm the latest applicable agreements are accepted.
3. Because this is paid, confirm the **Paid Apps Agreement** is active.
4. Open its detail and verify every required information block shown by the live UI is complete. If a Contact Info block or named contacts appear, recover current entries from the account/prior apps, show only masked values, and have Joe confirm or update them privately. Do not assume Council-suggested job titles are still current if Apple does not display them.
5. Confirm banking is active and the exact payee matches Apple's requirements.
6. Confirm required tax forms show complete. Apple requires US tax documentation for developers entering the paid agreement; the exact W-8/W-9 and other country forms depend on Joe's legal facts and must be completed by Joe.
7. Resolve account warnings before depending on a launch date; review can outpace banking/tax verification.
8. Complete the DSA trader/non-trader declaration even if the initial storefront plan excludes the EU. If a trader distributes in the EU, verify the contact/address evidence and make Joe aware those details will be public on EU product pages.
9. Complete Korea, Brazil, DAC7, ITA, MRDP, SERR, Decree 810, or other compliance modules only when the current account and selected territories say they apply. Joe handles legal facts and attestations.

Do not select a tax category casually. Show Joe Apple's current descriptions and the existing account convention. Retain the default App Store software treatment unless a more specific current category clearly fits and Joe approves it.

### Phase 6 — Confirm or register the App ID

1. Search the correct Apple team for `com.tanglefast.herofootballmanager`.
2. If it exists, verify it is an explicit App ID owned by the intended team.
3. Compare enabled services/capabilities with the final Xcode target and entitlements. For the current product, no Game Center, push, Sign in with Apple, Associated Domains, iCloud, or other optional capability should be enabled unless the final binary genuinely uses it.
4. If capabilities change, update signing/provisioning and create a new archive.
5. If the App ID does not exist, prepare its description and exact bundle ID, show Joe the immutable identity, obtain the immutable identity gate approval, then register it.
6. If the identifier exists on another team or conflicts, stop. Do not alter the bundle ID or create a duplicate without Joe deciding ownership/migration consequences.

### Phase 7 — Create or resume the App Store Connect app record

Search again before Create. If no matching record exists and Joe approves, use:

| Create New App field | Planned value/source | Rule |
|---|---|---|
| Platforms | iOS | Final binary is an iOS/iPadOS app |
| Name | `[JOE-APPROVED FINAL NAME]` | 2–30 characters; working title is not approval |
| Primary language | Proposed English (U.S.) | Confirm before create; becomes fallback localization |
| Bundle ID | `com.tanglefast.herofootballmanager` after final verification | Choose the registered explicit ID; becomes locked to the record/build |
| SKU | `[APPROVED INTERNAL SKU]` | Inspect prior convention; otherwise propose a non-sensitive stable SKU. It is immutable and not customer-facing |
| User Access | Existing team convention / Joe's decision | Restrict only if the team needs it |

Before clicking **Create**, read these five values back to Joe and obtain approval. If Create times out, search for the record and Apple ID before trying again.

After creation:

- record the Apple-generated numeric Apple ID;
- confirm the developer/seller name displayed is the expected immutable account identity;
- confirm bundle ID, SKU, primary language, and platform;
- do not create iAP, subscriptions, Game Center, App Clip, In-App Events, custom product pages, or alternate distribution unless a verified release feature requires them.

### Phase 8 — Build, archive, validate, and upload

This phase leaves the website and uses local Xcode or Transporter. A browser-controlling LLM must not pretend it uploaded a build when no archive exists.

1. Confirm the approved release commit and clean intended source scope.
2. Use **Xcode 26 or later with the iOS 26 SDK or later**, rechecking Apple's current requirement that day. Record the installed Expo/React Native, Xcode, and SDK versions.
3. Before investing in record-dependent media or declaring the binary ready, prove the installed Expo/React Native stack can perform the approved clean native-generation and local Release-build path with that Apple toolchain. If it fails from a real compatibility issue, resolve or upgrade from official migration evidence and rerun; do not presume either compatibility or incompatibility from version numbers alone.
4. Complete the technical encryption review and obtain Joe's export-declaration approval **before native generation/archive**. The durable `app.json` currently writes `ITSAppUsesNonExemptEncryption=false` into the binary, which can bypass App Store Connect's repeated questionnaire. Keep `false` only if the evidence and Joe-approved classification support “no non-exempt encryption.” Otherwise change or remove the source key as Apple's current path requires, regenerate, and be prepared to answer questions/provide documentation.
5. Set marketing version `1.0.0` unless Joe intentionally changes it.
6. Inspect App Store Connect for existing builds and choose a unique monotonically higher build number. Never assume `1` is unused.
7. Write the chosen value as a string to durable `expo.ios.buildNumber` in `app.json` before native generation. Verify `npx expo config` reports it, regeneration preserves it, and the archive's `CFBundleVersion` matches. Do not edit only the ignored generated Info.plist.
8. Regenerate native files if that is the project's approved Expo workflow, then reapply/verify intended signing, bundle, privacy, permission, orientation, device-family, deployment-target, version, build-number, and encryption settings.
9. Ensure Release embeds JS/assets and uses no Metro, dev server, QA flag, test API, secret, debug menu, staging URL, or harness entry.
10. Run the full relevant TypeScript/Jest checks and a local Release build. Resolve failures; do not label partial focused tests as full release verification.
11. Archive the correct generic iOS device target with the intended Apple team and distribution signing.
12. In Organizer, **Validate App**. Resolve errors and investigate warnings.
13. Inspect the archive, not just source:
    - bundle ID, display name, version, build number, deployment target;
    - iPhone/iPad device families and orientations;
    - included icon and launch assets;
    - embedded JS/assets and production configuration;
    - entitlements and capabilities;
    - Info.plist permission-purpose strings;
    - `ITSAppUsesNonExemptEncryption`;
    - privacy manifests and Xcode privacy report;
    - signed third-party SDK requirements, including Hermes/React Native dependencies;
    - absence of dev/harness artifacts and unexpected network endpoints.
14. Install an archived/TestFlight-equivalent build and repeat the critical clean-install, offline, reviewer-path, and device-family smoke tests.
15. Present the archive identity, validation result, test evidence, and unresolved warnings to Joe. Obtain the binary gate approval.
16. Upload through Xcode Organizer or Transporter.
17. Wait for processing and inspect Apple email/status. Do not immediately upload a duplicate if processing is slow.

#### Upload recovery branches

| Result | Action |
|---|---|
| Processing normally | Wait; continue only when build metadata is visible |
| Missing Compliance | If Apple asks despite the embedded key, stop and complete the current export path from archive evidence with renewed declaration approval; do not assume every build will display this prompt |
| Duplicate build number | Increment build number, create a fresh archive, validate, and upload |
| Invalid Binary | Read Apple's exact error, correct the binary/signing/configuration, increment build, and reupload |
| Processing failed/stuck | Check App Store Connect and email, wait a reasonable period, use Apple status/support if needed; do not create another app record |
| Warning | Determine whether it is rejection-risk or informational; fix applicable binary/metadata issues rather than dismissing blindly |
| Wrong bundle/team/version | Stop; do not work around it with a duplicate record. Correct ownership/configuration with Joe |

When processing completes, compare Apple's displayed bundle ID, version, build, SDK, device support, entitlements, and encryption state with the ledger before selecting it.

### Phase 9 — Create the screenshot and preview package

Do not reuse the July audit images. They predate current behavior, use a non-current size, include a removed manual-power interaction, and have no iPad set.

#### Required Apple format

- Supply **1–10** screenshots per required device set and localization. For a strong first release, target 6–8 truthful screens, but quality is more important than filling all ten slots.
- Use `.jpg`, `.jpeg`, or `.png` with **no alpha/transparency**.
- With current iPhone support, provide one accepted 6.9-inch portrait set at:
  - `1260 × 2736`, or
  - `1290 × 2796`, or
  - `1320 × 2868`.
- If no 6.9-inch set is supplied, Apple currently requires an accepted 6.5-inch set such as `1284 × 2778` or `1242 × 2688`; prefer the current 6.9-inch set.
- Verified directly against Apple's live table on August 5, 2026: Apple classifies `1260 × 2736`, `1290 × 2796`, and `1320 × 2868` as accepted **6.9-inch** portrait sizes, and marks the 6.5-inch set required only when a 6.9-inch set is not provided. Do not “correct” these values from memory or a device-name assumption.
- If iPad support remains, provide a 13-inch portrait set at:
  - `2064 × 2752`, or
  - `2048 × 2732`.
- Reverse dimensions are accepted for landscape. Use the orientation the actual release UI supports and that the screenshot truthfully depicts.
- Recheck Apple's specification immediately before capture/upload.

All screenshot text and imagery must be suitable for a 4+ public product page even if the app receives a higher age rating. Use fictional names/data and only licensed assets. Do not show another platform, a debug/harness control, a title/splash-only experience, a fake feature, a removed manual hero tap, a personal notification, or Joe's private data.

#### Capture workflow

1. Decide device families first; do not capture iPad if the binary will be iPhone-only, and do not omit it if the binary supports iPad.
2. Use the final Release UI. A deterministic dev harness may stage a legitimate game state only if all harness controls/flags are absent from the captured experience and the same state is reproducible in the release build.
3. Create a clean fictional career/save specifically for store media; record the seed/state provenance.
4. Capture native-resolution clean images from a current simulator/device configuration that matches the uploaded set.
5. If adding marketing captions or device frames, keep the underlying app use truthful, current, readable, and dominant. Do not make unsupported superlative or price claims.
6. Validate dimensions, color, opacity, cropping, safe areas, typography, spelling, and sequence.
7. Compare every screen with the selected archive and remove anything stale.
8. Show Joe the exact ordered iPhone and iPad sets. Do not upload until he approves them.

#### Proposed truthful storyboard for Joe to approve

The first three screenshots should communicate the core game without relying on a splash screen:

1. Live watched match with a clearly visible automatic superhero power and accurate match HUD.
2. Club-management home showing the weekly decisions and cozy pixel presentation.
3. Squad/player development showing meaningful stats, training, or hero growth.
4. Facilities or club finances showing long-term management.
5. A fictional event/player request with a real choice.
6. League/Cup progression, promotion, award, or Hall of Fame celebration that genuinely exists in version 1.0.

Possible caption themes such as “Build your club,” “Watch heroes unleash powers,” and “Climb the divisions” are `PROPOSED`; verify the exact feature and get Joe's copy approval. Never use “Kairosoft-style,” another game/developer name, real clubs, or trademark stuffing in public copy.

#### Optional app preview

Skip the preview for the simplest first submission unless Joe wants and approves a polished one. If used, current Apple limits are up to three per device size/language, **15–30 seconds**, at most **500 MB** and **30 fps**, in an accepted H.264 or ProRes container/resolution. It must predominantly show real captured app use. Uploading a preview creates extra review and localization work.

### Phase 10 — Draft and approve store metadata

Draft from the final binary, then show Joe a character/byte-counted packet before entry.

| Field | Current Apple limit/status | HFM instruction |
|---|---:|---|
| App name | Required, 2–30 characters | Joe-approved final name; configured name is still provisional |
| Subtitle | Optional, max 30 characters | Draft a clear differentiator; no unverifiable claims |
| Promotional text | Optional, max 170 characters | Can be changed without a new version; omit if it adds no value |
| Description | Required, max 4,000 characters, plain text | Explain paid/offline club management and actual launch features only |
| Keywords | Required, max 100 **bytes**; each over 2 characters | Comma-separated, no duplicates, competitor names, app/company name, or trademark stuffing |
| Support URL | Required | Live HFM page with real support contact |
| Marketing URL | Optional | Use only if a current HFM page exists |
| Privacy Policy URL | Required for iOS | Exact policy linked inside the release app |
| Copyright | Required | `2026 [JOE-CONFIRMED RIGHTS OWNER]`; do not add © yourself |
| Primary category | Required | Proposed `Games`; verify current UI |
| Game subcategories | One or two when Games is primary | Proposed `Sports` and `Simulation`, ordered after Joe reviews fit |
| Secondary category | Optional | Leave blank unless another category genuinely improves accuracy |
| What's New | Not needed for first version | Required for future updates, not version 1.0 |

Copy rules:

- describe the current release, not planned powers, platforms, online services, or future features;
- make the first lines useful because they appear before expansion;
- do not say “free,” `$0.99`, “sale,” or use territory-specific price claims in metadata;
- do not mention Apple competitors, internal inspirations, review status, beta/testing, or ranking claims;
- avoid real football league/club/player names and unlicensed marks;
- proofread on phone and desktop;
- use English-only metadata if that is the confirmed launch scope; every added localization needs accurate copy and an appropriate screenshot set/process.

After metadata is entered, inspect Apple's suggested App Tags (currently surfaced to U.S. customers) and deselect any inaccurate tag. Do not accept a generated tag merely because Apple suggested it.

### Phase 11 — Complete App Information and compliance declarations

#### 11A. Content rights

Inventory the final archive and media package before answering. Confirm rights for the app name, code, fonts, music, SFX, voices, art, icons, screenshots, copy, and any brand/real-world reference. If the app contains third-party content, use Apple's truthful “rights secured” path and retain evidence. If rights cannot be established, remove/replace the content and upload a new build before attesting.

Apple's standard EULA applies automatically. Use a custom EULA only if Joe supplies a lawyer-approved agreement and deliberately chooses the additional maintenance/territory work.

#### 11B. Age rating

Use the current questionnaire and definitions. Audit the release visually, not just by keyword. Record actual frequency and intensity across onboarding, ordinary matches, powers, events, injuries, celebrations, and repeat play.

| Questionnaire area | Current release evidence | Entry rule |
|---|---|---|
| Cartoon/fantasy violence | Stylized tackles, knockdowns, flattening, fire/thunder, freezing, webbing/cocoon effects | Observe frequency in representative sessions; likely non-zero. Never minimize to obtain a lower rating |
| Realistic/prolonged graphic violence | No blood, gore, death, or realistic violence found | Verify final visuals before `None` |
| Guns/weapons | None found | Verify final powers/art |
| Horror/fear | Giant spider, abandoned lab, haunted scoreboard, ghost/death-themed awakening language played comedically | Inspect final art/audio and choose None/Infrequent/Frequent from live definitions |
| Medical treatment | Limping/collapse, CPR, defibrillator-like magical recovery, injuries | Follow current questionnaire wording and context definitions |
| Gambling/simulated gambling | No player wagering, casino, gacha, loot box, or real-money gambling found; isolated lottery/betting jokes exist | Do not classify ordinary RNG, soccer competition, or a dialogue joke as simulated gambling without Apple's definition; inspect exact UI |
| Contests | Sports competition exists but no real prize contest found | Apply Apple's displayed definition; do not infer solely from matches |
| Alcohol/drugs/tobacco | Ambiguous “strong drink,” energy drink, night-out/can imagery; no explicit substance found | Visually inspect and resolve rather than keyword-guessing |
| Profanity/crude humor | None found | Full content scan and playthrough |
| Sexual content/nudity | None found | Verify final art/text |
| UGC/chat/social/unrestricted web | None found | Verify final archive and links are not unrestricted browsing |
| Advertising | None found | Verify final dependencies/config |
| Loot boxes | None; no IAP/gacha | Verify release economy |
| Parental controls/age assurance | None found | Answer current capability question factually |

Do not select Made for Kids or the Kids Category merely because the art is friendly. Joe must deliberately choose that audience and accept the stricter permanent obligations. A voluntary age-rating override may raise but never lower Apple's calculated result. Show Joe the complete answer matrix and resulting regional ratings before saving.

#### 11C. App Privacy

This declaration is separate from the privacy manifest.

1. Inventory every data type leaving the device from app code and each SDK in the final archive.
2. Inspect dependencies, production configuration, the Xcode privacy report, runtime network traffic, and any external partner Joe identifies.
3. Determine whether data is linked to identity or used for tracking using Apple's current definitions.
4. User-directed save export through the system share sheet is not developer collection if neither the developer nor an SDK receives it; describe it accurately in the policy.
5. If final evidence still shows no data transmitted to Joe or third parties, the proposed answer is **No, this app does not collect data**.
6. If any archive/network evidence conflicts, stop, fix the product/policy or disclose the actual data; never preserve the desired answer over evidence.
7. Publish the App Privacy answers only after Joe approves the evidence summary.

With no account, in-app account deletion is `NOT_APPLICABLE`; verify the final app does not silently create a guest/server account. With no cross-company tracking, ATT and `NSUserTrackingUsageDescription` are `NOT_APPLICABLE`; verify first.

#### 11D. Privacy manifest and required-reason APIs

Inspect the archive's combined privacy report. Today's **ignored/generated local snapshot** declares no collected data/tracking and reason categories for UserDefaults, file timestamps, system boot time, and disk space; this is an expectation to investigate, not durable configuration or proof that the reasons are valid for the submitted archive. Regenerate, then verify actual usage and every bundled SDK, including Hermes. Fix invalid/missing manifests or signatures; never add a reason only to pass validation when the behavior does not match it.

#### 11E. Encryption/export compliance

Inspect app and dependency code **before the archive is created**. The durable `app.json` currently writes `ITSAppUsesNonExemptEncryption=false` into Info.plist. That binary declaration can let App Store Connect bypass repeated encryption questions, so a later `Missing Compliance` prompt is not guaranteed and must not be the first approval gate.

Treat `false` as a proposed classification only if the release uses no non-exempt encryption. Encryption supplied solely by Apple's operating system generally follows the exempt/no-documentation path; non-Apple standard or proprietary encryption can trigger U.S. and/or French documentation. Present the technical evidence to Joe and obtain his declaration approval before archive. If the approved answer is not represented by `false`, change or remove the source key as Apple's current flow requires, regenerate native files, and produce a fresh higher-numbered archive. Upload documents only if Apple's current questions require them. Do not answer “No” merely because the visible game appears offline.

#### 11F. Accessibility nutrition labels

Apple's current page describes these labels as voluntary “to start,” but recheck on execution day. If still optional, enter only features that passed the common-task audit. It is more accurate to leave an unverified feature unclaimed than to advertise partial support. Store settings controls are evidence to test, not proof by themselves.

### Phase 12 — Set pricing, availability, devices, and territories

1. Set Public App Store distribution after Joe confirms.
2. Select Joe's approved base storefront and paid price point. Verify localized proceeds/prices before saving.
3. Select the current tax category only after Joe approves the displayed definition.
4. Select territories one by one or from a reviewed list; do not blindly choose all.
5. Set release method: manual, automatic, or scheduled. For a first launch, manual is the recommended control point but is not permission to choose it for Joe.
6. Set preorder only if Joe deliberately chose and prepared it.
7. Decide whether to offer Apple School Manager volume pricing/discount based on Joe's commercial choice.
8. If iPad remains in the processed build, confirm iPad is intended and its screenshots/QA are complete.
9. Apple currently makes compatible iPhone/iPad apps available on Apple-silicon Macs and Apple Vision Pro by default. Keep each enabled only after hands-on testing; otherwise opt out before submission.

#### Territory gates

- **European Union:** DSA trader/non-trader status must be declared. If trader and distributing in the EU, verified public address/PO box, phone, and email are required; Joe makes the legal determination and approves publication.
- **China mainland:** a game requires NPPA approval information and supporting ISBN approval/response documentation/business-license information, with other ICP requirements where applicable. Exclude mainland China unless Joe has a compliant publishing path and documents.
- **Vietnam:** Apple states games distributed in Vietnam must be licensed. Exclude Vietnam unless Joe has the required game-publishing license/compliant local path. Joe's current physical location does not establish distribution rights.
- **Republic of Korea:** complete a Rating Classification Number only when Apple's current criteria/UI say it applies, such as the listed high-intensity content categories; do not invent a number.
- **Japan / Trade Representative field:** Apple's current public required-properties table does not identify a Japan-specific Trade Representative submission field. Do not invent one from a reviewer claim. If the live account/app UI nevertheless presents **Trade Representative Contact Information**, recover the existing verified value from the account or a prior app, have Joe confirm it privately, and complete it only when the live UI marks it applicable.
- **Brazil and other tax/compliance regions:** complete requested account forms from Joe's legal facts; never infer CNPJ/CPF, treaty, or residence answers.

Save a redacted exact territory list in the ledger so “all except X” cannot silently drift.

### Phase 13 — Complete the version page and App Review packet

On the iOS version 1.0 page:

1. Upload the Joe-approved iPhone screenshots.
2. If the selected build supports iPad, upload the approved 13-inch iPad set.
3. Upload an app preview only if approved and valid.
4. Enter approved promotional text, description, keywords, Support URL, optional Marketing URL, and copyright.
5. Confirm Privacy Policy URL under App Information/App Privacy as shown in the current UI.
6. Choose the exact processed build and verify its version/build/device metadata again.
7. Leave IAP/subscriptions absent because the current paid-once game has none; if the final binary changes, stop and create a separate StoreKit review plan.
8. Leave Game Center, App Clip, In-App Events, routing coverage, custom product pages, and other optional services unconfigured unless the archive actually implements them.

#### App Review Information

Required fields:

- review contact first/last name;
- monitored email;
- reachable phone including country code;
- sign-in requirement and demo credentials, if any;
- review notes, up to Apple's current limit (currently 4,000 bytes);
- optional attachment only when it helps review a non-obvious feature.

For the current verified design, **Sign-in required = No** and demo credentials are not applicable, but reverify the archive before entry.

Create final review notes only after a clean-install timing test. A safe evidence-backed structure is:

> Hero Football Manager is a paid, single-player, offline club-management game. The submitted build has no account/login, ads, in-app purchases, tracking, analytics, or cloud service [retain only facts verified from the archive]. All clubs and players are fictional. Progress is stored on device; Export Save opens the iOS share sheet only at the user's request. To reach the first watched match from a clean install: [exact verified taps and approximate time]. To see the first hero power: [exact verified path; current design introduces it in Match 2/Week 4]. [Explain any non-obvious control, permission, or reviewer attachment.]

Do not paste roadmap claims into review notes. If the reviewer path is slow or unreliable, improve the release experience or provide a truthful review aid; do not ship a secret dev harness or claim a path that was not tested.

### Phase 14 — Pre-submission readback and approval

Before **Add for Review**, verify:

- all required app-level and version-level fields show complete;
- the correct team, app, bundle ID, version, and processed build are selected;
- screenshots match that build and appear in the intended order on iPhone/iPad;
- URLs open publicly and match the in-app links;
- name/subtitle/description/keywords/copyright are approved and within limits;
- categories/tags are accurate;
- price, base storefront, tax category, territories, device availability, and release method match Joe's decision;
- DSA and territory-specific compliance is complete;
- age rating, App Privacy, rights, export, and accessibility declarations match the evidence ledger;
- review contact is reachable and notes describe a tested route;
- there are no placeholder values, stale warnings, Missing Compliance prompts, or unreviewed agreements.

Then create a **redacted submission readback** for Joe:

| Section | Include in readback |
|---|---|
| Identity | Team/displayed seller, app name, Apple ID, bundle ID, version/build, primary language |
| Product page | Subtitle, first description lines, keywords byte count, categories, screenshot thumbnails/order, URLs |
| Commercial | Price/base storefront, exact territory summary, distribution/release method, Mac/Vision/iPad status |
| Declarations | Result/summary of age rating, privacy, rights, encryption, accessibility, DSA, licenses—no personal details |
| Review | Masked contact, login/no-login, review-note text, selected build |
| Evidence | Archive SHA/date, validation result, device QA, URL checks, open risks |

`Add for Review` may be used to assemble a draft submission. Reopen **Draft Submissions** and inspect exactly what was added. Then stop and ask:

> “The redacted readback above matches the draft submission. Do you explicitly authorize me to click Submit for Review for Hero Football Manager version [version] build [build]?”

Only a clear yes authorizes **Submit for Review**. After clicking once, wait and confirm the resulting App Store Connect status; do not report success merely because the click occurred.

### Phase 15 — Monitor review and handle outcomes

Record status transitions such as Ready for Review, Waiting for Review, In Review, Pending Developer Release, Processing for Distribution, Pending Apple Release, Ready for Distribution, Metadata Rejected, Rejected, or Invalid Binary. Use Apple's current status reference rather than guessing what a label means.

- If Apple asks a question, answer directly and factually in App Review communication. Get Joe's approval for legal/business claims.
- For **metadata-only rejection**, correct the exact metadata plus any directly related inconsistency; reuse the build when Apple permits.
- For **binary rejection**, diagnose/fix, increment the build number, create and test a new archive, upload, select it, refresh affected declarations/screenshots, obtain renewed submission approval, and resubmit.
- For **rights/privacy/age/encryption concerns**, do not argue from desired positioning; produce evidence or change the app/declaration.
- Never create a second app record as a rejection workaround.
- If Joe withdraws the submission, record why and confirm current state before resuming.

### Phase 16 — Release and post-launch verification

If manual release was selected, approval does not authorize public release. Show Joe the approved version/build, storefront list, price, and any App Review conditions, then obtain the separate release gate approval before clicking **Release This Version**.

After Apple shows distribution ready and propagation completes:

1. Open the public product page in intended storefronts.
2. Verify seller/developer name, app name, icon, screenshots, copy, age rating, privacy label, price, devices, and territories.
3. Open privacy, support, and marketing links from the product page and from inside the installed app.
4. Perform a real paid purchase/install check on an eligible account/device; TestFlight does not test retail payment.
5. Launch offline, create/save/relaunch, and verify the public build is the intended version/build.
6. Confirm Mac/Vision/iPad availability matches the approved plan.
7. Confirm support contact receives a test message.
8. Record the live URL and release date without storing receipts or personal purchase data.
9. Monitor App Review messages/crashes/support for the first release window.

Storefront propagation can take time; distinguish “released in App Store Connect” from “visible and purchasable in every intended storefront.”

## Joe's personal deliverables and decisions

The LLM should recover everything possible first. Joe still must personally provide, confirm, approve, or perform the following where not already current in the account:

### Private/legal/financial — Joe enters these directly

- Apple sign-in, 2FA, identity verification, and correct team selection.
- Agreement acceptance and Account Holder actions.
- Legal seller/entity confirmation and current address/contact confirmation, including any live Paid Apps Agreement or Trade Representative contact block Apple actually presents.
- Tax forms, tax residence/entity type/identifiers/attestations.
- Banking/payee details and verification.
- DSA trader legal determination and approval of public EU contact details.
- Any China, Vietnam, Korea, Brazil, or other required legal documents.

### Product and commercial decisions

- Final store name and acknowledgement of availability/rights risk.
- Keep/remove iPad support; keep/opt out of Mac and Vision Pro.
- Exact paid price point, base storefront, tax category approval, territories, preorder, and release method.
- Final primary language/localizations.
- Public versus any alternative distribution method.

### Public contact and rights

- HFM-specific privacy-policy URL and approval of its contents.
- HFM-specific Support URL, monitored support email/contact, and optional Marketing URL.
- Copyright rights-owner wording.
- Commercial rights evidence or replacement decision for music, recordings, art, AI-generated assets, title, icon, and screenshots, plus retention of applicable open-source/font notices.

### Product-page and declaration approvals

- Final subtitle, promotional text, description, keywords, categories, and tags.
- Final iPhone screenshots and, if supported, iPad screenshots. The LLM may capture/process them if authorized, but Joe approves the exact upload set.
- Optional 15–30 second preview video if chosen.
- Factual frequency/intensity decisions that remain ambiguous in the live age questionnaire.
- Approval of the evidence-backed App Privacy, content-rights, accessibility, DSA, tax-category, and territory declarations.
- Export/encryption declaration approval **before** the source value is baked into the release archive, and renewed approval if the value or documentation path changes.
- Review contact and final review notes.

### Explicit actions/authorizations

- Approve immutable App ID/app-record creation.
- Approve release archive upload.
- Approve `Submit for Review` after redacted readback.
- Respond to legal/business reviewer questions.
- Approve manual public release after Apple approval.

## Completion record

The operator should finish with this non-sensitive checklist:

- [ ] Requirements rechecked on execution date
- [ ] Every accessible Apple team/provider inventoried; correct team and existing records verified
- [ ] Prior Liquid Calendar/other app records inspected before interview
- [ ] Agreements/tax/banking/DSA ready for paid distribution
- [ ] Final name, bundle ID, SKU, language, and ownership approved
- [ ] Privacy/support pages live; privacy policy linked inside app
- [ ] Placeholder content resolved
- [x] Asset rights ledger complete for the current asset set; rerun the archive inventory after content freeze
- [ ] iPhone/iPad/Mac/Vision support decisions reflected in binary and availability
- [ ] Unique `expo.ios.buildNumber` persisted in source and verified as `CFBundleVersion`
- [ ] Export classification approved before archive; embedded Info.plist value verified
- [ ] Fresh release archive built with currently accepted Xcode/iOS SDK
- [ ] Full tests, archive validation, offline/reviewer-path/device QA recorded
- [ ] Privacy report, SDK manifests, entitlements, permissions, encryption inspected
- [ ] Build uploaded, processed, and identity reverified
- [ ] Current iPhone screenshots approved; iPad set approved if applicable
- [ ] Metadata and tags approved and within limits
- [ ] Age rating, rights, privacy, encryption, accessibility, and territory answers approved
- [ ] Price, tax category, storefronts, release method, and defaults approved
- [ ] Review contact/notes and selected build verified
- [ ] Redacted draft readback approved
- [ ] Submission status confirmed after authorized submit
- [ ] Review monitored and any response approved
- [ ] Manual release separately authorized if applicable
- [ ] Live product page, paid purchase/install, links, build, and storefronts verified

## Council Audit disposition

Council Audit completed on August 5, 2026 against a byte-identical isolated copy of this plan and the committed repository, using **Claude Fable 5 (xhigh)**, **Claude Opus 5 (xhigh)**, and **Grok 4.5 (high)** concurrently. Codex then independently checked each proposed finding against the live official documentation and current local evidence; no finding was adopted merely because reviewers agreed.

| Council issue | Review support | Verified disposition |
|---|---:|---|
| Search all accessible Apple teams/providers before concluding Liquid Calendar or an HFM record is absent | Opus + Grok | **Accepted.** Phase 1 now requires a cross-team/provider inventory and blocks for Joe only after every accessible location is searched. |
| Generated/ignored `ios/` facts were labeled too strongly | Fable + Grok | **Accepted.** Deployment target, iPad native orientations, privacy manifest, generated build number, and native icon result are explicitly today-only snapshots pending regeneration/archive proof. |
| Export approval occurred too late even though `ITSAppUsesNonExemptEncryption=false` is baked into the binary | Opus | **Accepted on official evidence.** The declaration gate now occurs before archive, with a fresh-archive branch if the answer changes. |
| Build number could revert because only the ignored generated project supplied `1` | Opus | **Accepted on official Expo evidence.** The chosen value must be written to `expo.ios.buildNumber` and verified through regeneration and `CFBundleVersion`. |
| Paid Apps Agreement might still need contact information | Opus | **Partially accepted.** The operator must open all missing-information blocks and complete any live Contact Info section, but must not invent a fixed role list Apple does not currently publish there. |
| `1260 × 2736` is not a 6.9-inch size, or a 6.5-inch set is always mandatory | Fable + Opus + Grok | **Rejected.** Apple's live screenshot table explicitly lists all three plan sizes under 6.9-inch and says 6.5-inch is required only when 6.9-inch screenshots are absent. Phase 9 remains correct and now records that verification. |
| Japan always requires Trade Representative Contact Information | Grok | **Not established.** Apple's current required-properties table does not identify that Japan-specific requirement. The runbook handles the field only if the live account/app UI presents it. |
| Expo SDK 57 is already an App Store blocker with Xcode 26 | Grok | **Not established.** No compatibility failure was demonstrated. Phase 8 now requires an early clean generation/Release-build proof and an evidence-based upgrade only if that proof fails. |

## Primary official references

- [App Store Connect workflow](https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-workflow)
- [Create an app record](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/)
- [Register an App ID](https://developer.apple.com/help/account/identifiers/register-an-app-id/)
- [App information reference](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/)
- [Platform-version fields and limits](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information)
- [Required properties](https://developer.apple.com/help/app-store-connect/reference/app-information/required-localizable-and-editable-properties/)
- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
- [App preview specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/app-preview-specifications)
- [Set an age rating](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating)
- [Age-rating definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/)
- [Manage App Privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)
- [Privacy-label definitions](https://developer.apple.com/app-store/app-privacy-details/)
- [Required-reason APIs](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api)
- [Third-party SDK requirements](https://developer.apple.com/support/third-party-SDK-requirements/)
- [Export compliance overview](https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance)
- [`ITSAppUsesNonExemptEncryption` Info.plist key](https://developer.apple.com/documentation/bundleresources/information-property-list/itsappusesnonexemptencryption)
- [Agreements](https://developer.apple.com/help/app-store-connect/manage-agreements/sign-and-update-agreements/)
- [Agreement statuses and missing information](https://developer.apple.com/help/app-store-connect/manage-agreements/view-agreements-status/)
- [Tax information](https://developer.apple.com/help/app-store-connect/manage-tax-information/provide-tax-information)
- [Banking information](https://developer.apple.com/help/app-store-connect/manage-banking-information/enter-banking-information)
- [DSA trader requirements](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements)
- [Pricing](https://developer.apple.com/help/app-store-connect/manage-app-pricing/set-a-price)
- [Availability](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-for-your-app-on-the-app-store)
- [Mac availability](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-of-iphone-and-ipad-apps-on-macs-with-apple-silicon)
- [Vision Pro availability](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-of-iphone-and-ipad-apps-on-apple-vision-pro)
- [Upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/)
- [Choose a build](https://developer.apple.com/help/app-store-connect/manage-builds/choose-a-build-to-submit)
- [Submit an app](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app)
- [Submission statuses](https://developer.apple.com/help/app-store-connect/reference/app-information/app-and-submission-statuses)
- [Release options](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/select-an-app-store-version-release-option/)
- [Expo iOS `buildNumber` configuration](https://docs.expo.dev/versions/latest/config/app/#buildnumber)

## Plan acceptance criteria

This runbook is ready to hand to the website-controlling LLM only when:

- a reviewer can follow it without inventing a legal, identity, privacy, rights, age, pricing, territory, or account answer;
- it identifies every current repository blocker separately from App Store Connect paperwork;
- it distinguishes repo evidence from final-archive evidence;
- it includes the complete browser → Xcode/archive/upload → browser flow;
- it recovers prior-app/account facts before interviewing Joe;
- it makes Joe's personal deliverables and explicit approval gates obvious;
- its screenshot package matches current Apple device requirements;
- its failure branches avoid duplicate records, duplicate submissions, and false completion claims;
- all Council Audit findings are either corrected or documented with evidence-based disposition.
