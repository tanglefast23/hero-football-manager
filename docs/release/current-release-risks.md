# Current App Store release risks

Last checked: 2026-08-06

This is the short, active list of traps found while carrying out the App Store
readiness work. It is not a substitute for the full submission runbook.

## Must close before the final archive

1. **Publish Hero Football Manager-specific Privacy and Support pages.** The
   Privacy URL saved on Liquid Calendar currently returns a 404. Its working
   Support page is specific to Liquid Calendar, so neither destination can be
   copied into this game unchanged. Joe still needs to confirm whether Hero
   Football Manager should use the same already-public support email.
2. **Connect the exact live URLs inside Settings.** Do not ship guessed URLs or
   a placeholder. The App Store metadata and in-game Privacy action must open
   the same owner-controlled policy.
3. **Create the App Store Connect app record only after the immutable fields are
   approved.** No Hero Football Manager record exists in the signed-in account
   today. Final name, bundle ID, SKU, primary language, and owning team require
   Joe's approval at creation time.
4. **Make a signed archive from the final release commit.** The current local
   unsigned Release simulator build succeeds, contains its JS bundle, icons,
   privacy manifest, and iPhone+iPad metadata, but it is not an uploadable
   archive and the game is not content-frozen yet.
5. **Capture final screenshots from that archive.** Current screenshots are QA
   evidence only. Capture the required iPhone and 13-inch iPad sets after final
   copy, art, layout, and onboarding are frozen.
6. **Recheck Apple Business immediately before submission.** Free/Paid Apps,
   banking, tax, and compliance are Active today, but the displayed agreement
   term ends August 11, 2026.
7. **Complete the current age-rating questionnaire.** App Store Connect now
   calls out added social-media questions. The current offline single-player
   build appears to have no social media or user-generated content, but answers
   must be made from the final archive.

## Product and QA risks to decide explicitly

- **iPad contract:** iPad portrait and narrow multitasking windows now use the
  single-column phone composition. Full-width modern iPads in landscape use
  the two-column desktop composition. The final archive still needs rotation,
  resize, modal, scrolling, match, and touch-target QA across common flows.
- **Offline claim:** the Release app launches from its embedded JS bundle with
  no Metro server. A full host-network-disabled run remains to be performed on
  the final archive; do not disturb the Mac's network merely to simulate it.
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
  build number 1, portrait-first iPhone behavior, and the encryption setting.
- The local Release build passed Xcode's build validation and launched cleanly
  on both iPhone and iPad simulators.
