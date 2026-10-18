# Rival intro frame stall — Opus

Read-only narrow review. No edits, match simulation, browser use, or server changes.

At real S3W16 the Scott Somers intro entered power-exit. Its card stayed at opacity1 and repeated inputs did nothing. A fresh requestAnimationFrame promise received no frame within15seconds. A screenshot returned "tab has not painted yet". The document still reported visible and focused. A1pixel background viewport resize immediately released the animation into speech; restoring1200x700 preserved the career. No reload, state edit, or match reroll occurred.

Source mechanism: RivalHeroIntroScreen starts a150ms reduced-motion Animated.timing and only enters speech in its finished callback. React Native Web uses its JS animation driver, which needs requestAnimationFrame. With no frames the animation cannot finish. The power-exit guard deliberately ignores extra inputs. The first resumed frame finishes the elapsed animation.

Disposition: classify this as a browser-pane environment incident, not an unresponsive button or a confirmed player-facing blocker. Normal visible windows resume frames. Do not change the renderer or game solely for this. Optional future hardening could allow another press during power-exit or add a bounded fallback. No hardening was applied.

QA recovery: stop repeated inputs. Probe frames. If the pane gets no frames, resize its background viewport by1pixel and restore it. Resume the same fixture.
