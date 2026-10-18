# Recent form: rejected bug hypothesis

At S4 W7, body.innerText showed L after an opening home loss and an away win. Opus traced recentForm in application/view-models.ts and FormStrip.tsx against pinned 28386452. All played home and away fixtures are included. Wins draw a TrophyGlyph made of Views, with no text node; draws and losses draw letters. This is intentional and explains the text-only observation. The per-cell info label names the result. No fix or test is needed.

The earlier raw proof remains season-4-week-7-form-proof.json. Do not label it an omitted away win or stale result. This was a useful false alarm caught by independent source review. Opus used no browser, save mutation, server, fixture simulation, file edit, or memory write.
