---
date: 2026-07-19
topic: reserved-settings-header-slot
---

# Reserved Settings Header Slot

## What We're Building

Replace the floating top-left settings trigger with one shared 44×44 settings button reserved inside the top-right header area of every playable screen. The title landing page keeps its existing large Settings entry and does not gain the small header button. In watched matches, the settings button replaces the development grid toggle exactly in the existing right-hand control cluster.

## Why This Approach

An app-level absolute button cannot guarantee that it will avoid screen content. Giving each screen's real header a shared `SettingsButton` reserves layout space, keeps the touch target and visual size consistent, and allows match chrome to use the same control with a dark surface. One controlled settings modal remains mounted at the app root so behavior and preference state stay unified.

## Key Decisions

- Button size is always 44×44 points, with the existing beveled pixel-control treatment.
- The button is the rightmost item in each screen header.
- Existing right-side stamps, dates, and resource chips move beside or below it instead of being covered.
- The watched-match grid debug trigger is removed from the visible UI.
- Opening settings pauses a watched match through the existing external-pause path.
- The title landing page and the settings page itself do not show the small header trigger.

## Open Questions

- None.

## Next Steps

Implement the shared button, convert the root overlay to a controlled modal, wire each screen header, and verify layout/type/tests/bundle.
