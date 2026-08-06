# App Store release readiness — design lock

Date: 2026-08-05  
Status: Approved for implementation

## Goal

Remove the release blockers that are cheaper and safer to fix before the final
content freeze, without pretending the game is ready for its final archive or
App Store submission today.

## Device contract

Ship one universal iOS app for iPhone and iPad.

- iPhone is portrait-first and remains on the proven single-column layout.
- iPad supports all four orientations so Apple multitasking and Split View stay
  available.
- Layout follows the window width, not a separate device-specific UI fork:
  widths below 1100 points use the single-column composition; widths of 1100
  points or more use the existing desktop-style two-column composition.
- Therefore full-screen iPad portrait and narrow multitasking windows use the
  phone composition, while full-width modern iPads in landscape use the
  desktop-style layout.

This uses the responsive system already covered by `layout-mode.test.ts` and
keeps one set of screen behavior to maintain.

### Alternatives considered

1. **iPhone-only for launch.** Lowest screenshot and QA cost, but wastes the
   tablet layout already present and would require disabling existing support.
2. **A separate iPad/desktop screen tree.** More control, but duplicates UI
   behavior and creates a second release surface. Rejected in favor of the
   existing width-driven system.
3. **Universal adaptive app (chosen).** Uses existing code, handles Split View
   honestly, and gives landscape iPad the wide composition without a fork.

## Release-hardening contract

- Replace the hire-pitch placeholder with the shipped deterministic
  `PixelPortrait` paper-doll renderer.
- Native production builds always open the real game. QA flags remain usable in
  development and static web review builds, but cannot select a QA root on a
  native Release build.
- Add a player-visible Privacy & Support section in Settings only with verified
  owner-controlled destinations. Do not ship guessed URLs or private account
  data.
- Keep a rights ledger that separates repository-generated assets,
  third-party licensed components, and owner-confirmed work. Joe's 2026-08-06
  confirmation covers the current supplied recordings; a later unknown asset
  must not be silently marked cleared.
- Verify the generated iOS configuration and a local Release build on both an
  iPhone and an iPad simulator. Final archive, screenshots, and submission wait
  for the content freeze.

## Observable success

1. Generated iOS configuration declares iPad support, iPad multitasking
   orientations, and the intended iPhone orientation.
2. The obsolete hire screen and its temporary portrait implementation are not
   present in the release app.
3. A native Release build cannot enter a QA/harness root through an
   `EXPO_PUBLIC_*` flag.
4. Settings exposes working, accessible Privacy and Support actions using
   verified destinations, or the task is explicitly blocked on owner/account
   information rather than filled with invented data.
5. Asset provenance records the owner confirmation without inventing private
   underlying license evidence.
6. Focused tests, TypeScript, and local iPhone/iPad Release smoke checks pass,
   with anything not run labelled not verified.
