// Polish-audit RAF frametime recorder.
//
// Injected into the running web build (chrome-devtools evaluate_script or a browser-pane
// javascript_tool call). A page that is document.hidden freezes RAF and would fake a perfect
// frame record — so hidden frames are counted, and a record with hiddenFrames > 0 is VOID.
//
// Usage: inject this file's contents, play the scenario for >= 20s, then call
// window.__rafReport() and save the returned JSON.
// Spec: docs/superpowers/plans/2026-08-06-polish-audit-spec.md §7.1
(() => {
  if (window.__rafRecorder) return 'already-running';
  const rec = { deltas: [], hiddenFrames: 0, start: performance.now(), stop: false };
  window.__rafRecorder = rec;
  let last = performance.now();
  function frame(t) {
    if (rec.stop) return;
    if (document.hidden) rec.hiddenFrames += 1;
    rec.deltas.push(t - last);
    last = t;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__rafReport = () => {
    rec.stop = true;
    const d = [...rec.deltas].sort((a, b) => a - b);
    if (d.length === 0) return { frames: 0, hiddenFrames: rec.hiddenFrames };
    const q = (p) => d[Math.min(d.length - 1, Math.floor(p * d.length))];
    const sum = d.reduce((a, b) => a + b, 0);
    return {
      frames: d.length,
      hiddenFrames: rec.hiddenFrames,
      wallMs: Math.round(performance.now() - rec.start),
      meanMs: +(sum / d.length).toFixed(2),
      p95Ms: +q(0.95).toFixed(2),
      p99Ms: +q(0.99).toFixed(2),
      over33ms: d.filter((x) => x > 33).length,
      over50ms: d.filter((x) => x > 50).length,
      longestMs: +d[d.length - 1].toFixed(1),
    };
  };
  return 'recording';
})();
