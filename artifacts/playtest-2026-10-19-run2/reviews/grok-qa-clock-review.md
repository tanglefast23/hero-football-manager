# Grok review: QA worker clock

Reviewer: 8a7119e9-aa5a-4098-be71-e3809ad0e329. Read-only source review.

Verdict: sound. Each delay owns a static blob worker. Cleanup terminates the worker and revokes the URL before resolution. Worker errors and blocked construction retain the full page-clock delay. The 450 ms input guards remain unchanged. No game or engine source changed.

Accepted suggestions: execute the blob source in the VM test; verify a successful 1000 ms pause and cleanup; hold fallback timers to prove neither click nor tap completion bypasses its guard. These checks passed with npm run qa:tools:check.

Limits: worker timers may still be throttled in other browser versions. Fallback is silent. A worker that never messages or errors leaves the delay pending. The test proves scheduling and cleanup, not wall-clock behavior in Chrome. Four installed-helper live hops measured about 458–468 ms, and a rendered Home tab press took about 986 ms with identical career state before and after.

The live helper was replaced only after the previous tap and run job were idle. The career was not reloaded.
