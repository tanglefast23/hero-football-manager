# Current App Store release risks

Source, App Store Connect API, public App Store label, and public policy checked:
2026-09-24. The signed-in App Privacy form was not inspected.

This is the short, active list of traps found while carrying out the App Store
readiness work. It is not a substitute for the full submission runbook.

## Open release checks

1. ~~**Publish Hero Football Manager-specific Privacy and Support pages.**~~
   **Closed 2026-08-17.** Both are live over public HTTPS and saved in App Store
   Connect, and both returned HTTP 200 on recheck:
   `https://tanglefast23.github.io/hero-football-manager-legal/privacy.html` and
   `.../support.html`.
2. ~~**Connect the exact live URLs inside Settings.**~~ **Closed 2026-08-17.**
   `PRIVACY_POLICY_URL` in `src/release/support.ts` is the single source, the
   Privacy & Support panel opens it from a Read privacy policy action, and
   `src/ui/__tests__/privacy-support.test.ts` asserts the constant still equals
   the App Store Connect value so the two halves cannot drift apart.
3. ~~**Create the App Store Connect app record.**~~ **Closed.** The record
   exists: Apple ID `6799600157`, bundle ID `com.tanglefast.herofootballmanager`,
   SKU `com.tanglefast.hero-football-manager`, primary language English (U.S.).
4. ~~**Accept the updated Apple Developer Program agreement.**~~ **Closed
   2026-08-22.** Joe accepted it. The warning disappeared from both Apple
   Developer and App Store Connect after reload.
5. **Confirm the source commit of selected build `3`.** The older unsigned
   simulator build passed `release:inspect`, but it does not identify the signed
   build now selected in App Store Connect. Any replacement needs its own signed
   archive from a final green commit.
6. **Test the selected build `3` on iPhone and iPad.** On 2026-09-24, the App
   Store Connect API reported version `1.0.0` as `READY_FOR_SALE`, downloadable,
   and using build `3`. The signed archive's source commit and physical-device
   results have not been verified here.
7. ~~**Correct the published App Privacy label.**~~ **Closed 2026-09-24.** The
   [public App Store page](https://apps.apple.com/us/app/hero-football-manager/id6799600157)
   lists Device ID, Crash Data, and Other Diagnostic Data as linked to the user
   for App Functionality. This matches `app.json` and the
   [public policy](https://tanglefast23.github.io/hero-football-manager-legal/privacy.html).
   The signed-in App Privacy form was not inspected; check it before a future
   submission if these practices change.
8. ~~**Approve the current screenshot sets.**~~ **Closed 2026-08-25.** App Store
   Connect has ten iPhone and ten iPad screenshots. Joe approved retaining them
   because the player-visible game is materially unchanged and the existing set
   required substantial work. Before submission, confirm the processed build
   still matches them materially; recapture only if that check finds real drift.
9. **Keep the iOS hotfix source on build `3`'s runtime.** This checkout resolves
   to fingerprint runtime `fe66531874db8294c4ddc0259d95a28a7a906296`.
   A clean install at `d255bfda` resolves to `4e13cc16040713b5be8f6884fc75eef780b010bc`.
   The installed build-3 QA simulator app embeds that same fingerprint. A local
   `release/1.0.x` branch points to the matching source. The selected signed
   App Store archive still needs its own runtime check before a production OTA.
   A current-main OTA would miss this build-3 runtime; merging to `main` alone
   sends nothing to devices.
10. **Keep the native dependency gate explicit.** `expo.install.exclude` now
    pins four Expo packages to the current lockfile instead of letting a newer
    patch recommendation fail CI. Reassess and update them together with the
    next native build. Do not use that exclusion as proof of binary compatibility.

## Desktop release risk

The current desktop pack is unsigned. [Steamworks requires new macOS apps to
be notarized](https://partner.steamgames.com/doc/store/application/platforms).
Sign and notarize the Mac app before a Mac depot upload, or launch Windows
first. No Steam upload has been verified here.

## Historical snapshot: 2026-08-25 (superseded where noted)

- `npx expo prebuild --platform ios --clean` removed the stale background-audio
  declaration. The rebuilt Release app has no `UIBackgroundModes` key.
- The unsigned Release simulator build succeeded. `release:inspect` found the
  privacy manifest, both Silkscreen fonts, their OFL notice, and the correct
  no-non-exempt-encryption declaration.
- The built app reports all seven locales and contains 93 audio files. The four
  newly reviewed supplied match cues are recorded in the asset-rights ledger.
- The French copy gate, the five formatting failures, the match-day save lock,
  and boosted coach-effect labels are fixed in the 2026-08-22 release change.
  Local focused tests, TypeScript, formatting, release checks, and the web
  first-load budget pass.
- The App Store Connect API reports version `1.0.0` in Prepare for Submission,
  one valid uploaded build numbered `1`, no selected build, and complete sets of
  ten iPhone plus ten iPad screenshots.
- Exact-commit CI passed 516 suites, 4,941 tests, and the unsigned native iOS
  Release build for merged PR #225. The signed archive and physical-device pass
  remain separate gates.
- Paid Apps and Free Apps agreements were Active. Content Rights was saved.
  App Privacy was then published as Data Not Collected; that answer is not
  suitable for build `3` and must be checked in App Store Connect.
- Current ratings are 9+ in 172 regions, 12+ in Vietnam and Brazil, and ALL in
  Korea.
- The `desktop/` Electron wrapper now exists. No Steamworks integration, App ID,
  or depot is verified here.
- Post-match/week-review resume and live iPad transition performance remain
  measured follow-up items. They are not proven release regressions.

## Found 2026-08-17

- **The binary advertised English only, and now does not.** `ios/` was generated
  in July, before `CFBundleLocalizations` was added to `app.json`, and `ios/` is
  gitignored — so nothing caught it. The built app carried no
  `CFBundleLocalizations` key and zero `.lproj` folders, which would have listed
  one language on the App Store product page. `npx expo prebuild --platform ios
  --clean` fixed it; the rebuilt app now reports all seven locales. **Re-verify
  this on the final archive**, because any future regeneration gap reintroduces
  it silently.
- **App Store Connect state is well ahead of the August 9 snapshot.** Already
  saved: name, subtitle `Build a Superpowered Club`, categories Games /
  Sports / Simulation, keywords, promotional text, description, review notes,
  review contact, copyright `2026 Otaku Games`, age rating 9+ (12+ Vietnam and
  Brazil, ALL Korea), DSA trader status, tax category, US base storefront,
  173 of 175 territories, Mac **off**, Apple Vision Pro **off**, Public
  distribution, **Sign-in required: No**, and **Manually release this version**.
- **At this 2026-08-25 snapshot:** upload and test build `2`, then select it.
  The existing screenshot sets are owner-approved for retention. Content Rights
  was saved, and App Privacy was published as Data Not Collected. The current
  build target and privacy requirement are in the active list above.
- **Apple School Manager education discount is off.** Mac and Apple Vision Pro
  availability are also off.
- **Versions align:** App Store Connect and `app.json` both read `1.0.0`.

## Signed archive: dry run passed 2026-08-17

The whole archive → export → validate path was proved end to end on the current
`main`. Apple's servers returned **VERIFY SUCCEEDED with no errors** for the
exported IPA. One defect had to be fixed to get there, and it will come back.

**`expo prebuild` leaves the Xcode project with no development team.** A bare
archive fails with `Signing for "HeroFootballManager" requires a development
team`. `ios/` is generated and gitignored, so the team is lost on every
regeneration. Supply it on the command line:

```
source ~/.claude/secrets.env
xcodebuild -workspace ios/HeroFootballManager.xcworkspace \
  -scheme HeroFootballManager -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath ios/archive/HeroFootballManager.xcarchive \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$ASC_PRIVATE_KEY_PATH" \
  -authenticationKeyID "$ASC_KEY_ID" \
  -authenticationKeyIssuerID "$ASC_ISSUER_ID" \
  DEVELOPMENT_TEAM=647S42DUW3 CODE_SIGN_STYLE=Automatic archive
```

Then export with an `ExportOptions.plist` using `method: app-store-connect`,
`teamID: 647S42DUW3`, `signingStyle: automatic`, and the same three
authentication flags. Validate without uploading:

```
xcrun altool --validate-app -f <ipa> -t ios --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID"
```

Notes worth keeping:

- The **archive** signs with Apple Development; the **export** re-signs with
  `Apple Distribution: Joseph Anh Hai Vu (647S42DUW3)`. Checking the archive's
  identity alone looks wrong and is not. Verify the IPA instead: the embedded
  profile should be `iOS Team Store Provisioning Profile` with **no**
  `ProvisionedDevices` key.
- The distribution certificate is **not** in the login keychain. Xcode fetches
  the existing *Distribution Managed* certificate during export. No new
  certificate was created by this dry run, so no certificate slot was spent.
- The App Store Connect API key drives `-allowProvisioningUpdates`. Its key id,
  issuer id, and path live in `~/.claude/secrets.env` — reference them as
  `$ASC_*`, never inline the values.
- The dry-run archive and IPA sit in `ios/archive/` (gitignored). They are build
  1 from an unfrozen commit — throw them away and archive again from the frozen
  release commit.

## Product and QA risks to decide explicitly

- **iPad contract:** iPad portrait and narrow multitasking windows now use the
  single-column phone composition. Full-width modern iPads in landscape use
  the two-column desktop composition. The final archive still needs rotation,
  resize, modal, scrolling, match, and touch-target QA across common flows.
- **Offline claim:** the Release app launches from its embedded JS bundle with
  no Metro server. A full host-network-disabled run remains to be performed on
  the final archive; do not disturb the Mac's network merely to simulate it.
- ~~**Named special heroes.**~~ **Closed by owner decision 2026-08-25.** Keep
  the 15 deliberate near-miss name, power, and look combinations. Joe accepts
  the residual App Review/IP risk and cites established near-miss-name practice
  in management games. This records a product/risk decision, not legal clearance.
  Do not silently rename the roster; reopen only for new legal or Apple evidence.
- **Build-tool advisories:** `npm audit` reports 19 transitive build-tool issues
  (7 high, 12 moderate, 0 critical). No runtime path was found. Do not run a
  blind audit fix; any intentional package/lockfile change must precede freeze
  and repeat the Expo, full-suite, native-generation, and Release-build gates.
- **Mac and Apple Vision Pro availability:** opt out in App Store Connect unless
  Joe deliberately chooses and tests those storefronts.

## Already closed in this readiness pass

- **No schema-1 migration for public 1.0.** Those saves came from obsolete
  development/internal TestFlight builds, not public App Store customers. Old
  testers may reset or reinstall and start fresh; no save needs to be moved or
  migrated elsewhere.
- Joe confirmed on 2026-08-06 that “Spirit of the Dead,” Bert voice, the
  button/body-fall recordings, awakening/celebration cues, and every other
  supplied audio file are cleared for commercial/public App Store use. The
  rights ledger records that owner confirmation.
- The dead hire-pitch screen and its temporary portrait were removed from the
  current release source instead of carrying obsolete placeholder art forward.
- Native Release builds cannot select root QA/harness routes, and the release
  check rejects QA environment flags.
- The durable iOS config records universal tablet support, multitasking,
  portrait-first iPhone behavior, and the encryption setting. The source build
  number is now `3`.
- The local Release build passed Xcode's build validation and launched cleanly
  on both iPhone and iPad simulators.
