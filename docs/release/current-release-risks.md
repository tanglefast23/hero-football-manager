# Current App Store release risks

Last checked: 2026-08-25

This is the short, active list of traps found while carrying out the App Store
readiness work. It is not a substitute for the full submission runbook.

## Must close before the final archive

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
5. **Make a signed archive from the final green release commit.** The regenerated
   unsigned Release simulator app builds and passes `release:inspect`, but it is
   not uploadable.
6. **Upload and test build `2`.** App Store Connect already contains valid build
   `1`, but no build is attached to version `1.0.0`. Source now reserves build
   `2`. Upload it, wait for processing, and run physical iPhone/iPad TestFlight
   QA before selecting it for the version.
7. ~~**Approve the current screenshot sets.**~~ **Closed 2026-08-25.** App Store
   Connect has ten iPhone and ten iPad screenshots. Joe approved retaining them
   because the player-visible game is materially unchanged and the existing set
   required substantial work. Before submission, confirm the processed build
   still matches them materially; recapture only if that check finds real drift.

## Rechecked 2026-08-25

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
- Paid Apps and Free Apps agreements are Active. Content Rights is saved. App
  Privacy is published as Data Not Collected with the live HFM privacy URL.
- Current ratings are 9+ in 172 regions, 12+ in Vietnam and Brazil, and ALL in
  Korea.
- Steam remains post-launch scope. There is no desktop wrapper, Steamworks
  integration, App ID, or depot in this repository.
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
- **Still open in App Store Connect:** upload and test build `2`, then select it.
  The existing screenshot sets are owner-approved for retention. Content Rights
  is saved, and App Privacy is published as Data Not Collected.
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
- The durable iOS config now records universal tablet support, multitasking,
  build number 2, portrait-first iPhone behavior, and the encryption setting.
- The local Release build passed Xcode's build validation and launched cleanly
  on both iPhone and iPad simulators.
