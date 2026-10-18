Showing 1 of 358 activities (limited to 1)

`npm run qa:tools:check` passed. The bridge exposure is sound. `--simulate` can still report a match the game would not play, and a no-career checkpoint is parsed as the wrapper.

The bridge stays closed unless the platform is web, `qaRootRoutesEnabled(false, …)` is true, the desktop-shell check passes, and the query is `qa=playtest`. `read()` returns a codec clone and no store actions. `careerIsPersisted` uses the same reference check as the store. The App effect passes `useM1Store.getState` and `Platform.OS`. The helper refuses missing, duplicate, and disabled controls, waits at least 450 ms, and exports logs only in the page. That matches the confirmation-sheet focus delay and `useTapGuard`.

Three problems:

- `scripts/qa/check-career.cjs` simulates any scheduled user fixture `activeCareerMatchday` returns, including during `manage`. Quick Result and Watch both require the matchday screen and go through `currentMatchday`. That function calls `withoutPowers` when `isFirstOnboardingFixture` is true. The checker never does, so an opening-match score can include powers the real match removes. The tools check builds a normal launch career, not that onboarding fixture, so it does not catch this.
- With `--simulate` and no active fixture, `checkCareer` throws after a good lineup check. `main` drops that result and exits 1.
- A bridge checkpoint with `career: null` falls through `??` to the whole wrapper. The codec then rejects the title screen or a serialization failure as a corrupt save. The printed `engineVersion` is always the running code. The checkpoint's own engine version is never compared.

The doc is right that a drawn Cup is not given a winner and that a watched energy setting is not replayed. A LAN host is also closed: `localReview` allows only `localhost`, `127.0.0.1`, `[::1]`, and `file:`. The helper still tells you to add `?qa=playtest`.
