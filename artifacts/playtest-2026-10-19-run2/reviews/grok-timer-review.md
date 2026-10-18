# Grok timer review

Reviewer: 8a7119e9-aa5a-4098-be71-e3809ad0e329. Read-only review.

+Showing 1 of 843 activities (limited to 1)

The MessageChannel pause is already in the QA helper, and the tool test already checks it. Keep that shape.

`scripts/qa/playtest-browser.js` posts a `MessageChannel` message, and the port handler is what calls `setTimeout`. Both 450 ms waits use that pause. `scripts/qa/test-playtest-tools.cjs` injects Node's `worker_threads.MessageChannel` and asserts `waits.length === 0` and `clicks === 0` on the same turn as `helper.tap('Go')`, before the await. The old `>= 450`, duplicate, and disabled checks are still there. I did not run the test.

The Squad delay is the pre-click pause. The log time 19:09:01.375 is written before that wait, and the requested delay is always 450 ms. The screen was Squad by 19:10:10.985. No `after` at 19:10:21 only means the post-click pause was still open. Drills existed by 19:10:58, so that tap had released its lock before then. The 19:11:10 finish time stays discarded.

A fresh timer firing in 334 ms while the chained 450 ms timers took a minute matches Chromium's nested-timer clamp. A covered window can do that while `document.visibilityState` stays `visible`. Starting the timer from the message handler breaks that chain.

Three limits remain. The Node test proves the timer is queued later. It does not prove Chrome will wait 450 ms. An occluded page can still align a fresh timer to about 1 second. The live page will not pick this up while `window.HFMPlaytest` is already installed, and the driver has a second copy on `Q.pause`. Leave the paused tap alone until it returns. Do not patch the global timer.

The Week 19 trip note is saved for the later report.
