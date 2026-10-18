// Browser console helper for this audit. Mutations use rendered game controls.
// qaRead only reads the store; no career state or match result is injected.
(() => {
  const exports = [...__r.getModules().values()].map(m => m.publicModule?.exports).filter(Boolean);
  const game = exports.find(e => e.useM1Store).useM1Store;
  window.qaRead = () => game.getState();
  window.qaLib = {};
  for (const e of exports) for (const key of ['TRAINING_PATHS', 'instantTrainingPreview', 'resolveTrainingDrillForPath', 'weeklyAmbientTrainingPoints', 'greenBullTrainingOffer', 'buildSeasonRecap', 'pendingTrainingPriorityHolder', 'FACILITY_CATALOG', 'midseasonTrainingStatus']) {
    if (e[key] !== undefined) qaLib[key] = e[key];
  }
  window.qaLog = [];
  window.qaWeekly = [];
  window.qaSeasons = [];
  window.qaFindings = [];
  window.qaPause = (ms = 90) => new Promise(resolve => setTimeout(resolve, ms));
  window.qaButtons = () => [...document.querySelectorAll('button,[role="button"],[role="switch"],[role="tab"],[role="radio"]')];
  window.qaLabel = e => e.getAttribute('aria-label') || e.textContent.trim();
  window.qaHas = label => qaButtons().some(e => qaLabel(e) === label);
  window.qaClick = label => {
    const e = qaButtons().find(e => qaLabel(e) === label);
    if (!e) throw Error('Missing control: ' + label);
    if (e.disabled || e.getAttribute('aria-disabled') === 'true') throw Error('Disabled control: ' + label);
    const c = qaRead().career;
    qaLog.push({ action: label, season: c?.season, week: c?.week, screen: qaRead().screen, time: new Date().toISOString() });
    e.click();
  };
  window.qaClearUI = async (except = '') => {
    for (let i = 0; i < 25; i++) {
      const e = qaButtons().find(e => { const l = qaLabel(e); return l !== except && (l === 'Let them build. Close construction confirmation' || l === 'Close coach confirmation and return home' || l === 'I was angry, but I understand why you needed me here.' || l.startsWith('Bert Rudge:') || /\bsays?:/.test(l)); });
      if (!e) return;
      qaClick(qaLabel(e));
      await qaPause(110);
    }
  };
  window.qaBert = qaClearUI;
  window.qaTap = async label => {
    await qaClearUI(label);
    // The shared confirmation sheet deliberately guards commits for 400 ms.
    if (['Request bids', 'Accept bid', 'Sign player', 'Hire coach', 'Approve upgrade', 'Sign deal', 'Buy upgrade'].includes(label)) await qaPause(430);
    qaClick(label);
    await qaPause();
  };
  window.qaPrefix = prefix => { const e = qaButtons().find(e => qaLabel(e).startsWith(prefix)); if (!e) throw Error('Missing prefix: ' + prefix); return qaLabel(e); };
  window.qaTapPrefix = async prefix => { await qaClearUI(); await qaTap(qaPrefix(prefix)); };
  window.qaState = () => {
    const s = qaRead(), c = s.career, club = c.clubs.find(x => x.id === c.userClubId);
    return { screen: s.screen, tab: s.activeTab, seed: c.careerSeed, season: c.season, week: c.week, division: c.m2.pyramid.divisions.find(d => d.clubs.some(x => x.id === c.userClubId)).level, cash: club.cash, fans: club.fans, tp: c.trainingPoints, formation: c.lineups.find(l => l.clubId === c.userClubId).formation, project: c.facilities.grid.construction, head: c.market.headCoach?.name, assistant: c.market.assistantCoach?.name, error: s.error };
  };
  window.qaRecord = () => {
    const c = qaRead().career;
    const row = { ...qaState(), time: new Date().toISOString(), recap: qaLib.buildSeasonRecap(c), drills: c.totalInstantDrills ?? 0, roster: c.players.filter(p => p.clubId === c.userClubId), facilities: c.facilities.grid.buildings, ownedTrainingTiers: c.ownedTrainingTiers, playerRequests: c.playerRequests };
    qaWeekly.push(row);
    return row;
  };
  window.qaBrief = () => { const s = qaState(), r = qaLib.buildSeasonRecap(qaRead().career); return { ...s, position: r.finalPosition, record: [r.won, r.drawn, r.lost], goals: [r.goalsFor, r.goalsAgainst], cup: r.cupResult }; };
  window.qaWeights = { GK: { ref: .76, pac: .12, pas: .08, sta: .04 }, DEF: { def: .48, pac: .18, pas: .14, tec: .1, sta: .1 }, MID: { pas: .33, tec: .27, pac: .18, def: .12, sta: .1 }, FWD: { sho: .4, tec: .24, pac: .18, pas: .1, sta: .08 } };
  window.qaValue = p => Object.entries(qaWeights[p.role]).reduce((sum, [a, w]) => sum + w * Math.log(Math.max(1, p.attrs[a])), 0) + Math.log(.9 + (p.morale ?? 50) * .002) + Math.log(.7 + .3 * (p.condition ?? 100) / 100) + (p.power && p.licensed ? .07 : 0);
  window.qaDesired = c => {
    const lineup = c.lineups.find(l => l.clubId === c.userClubId), shape = (lineup.formation ?? '4-4-2').split('-').map(Number), counts = { GK: 1, DEF: shape[0], MID: shape[1], FWD: shape[2] };
    return new Set(Object.keys(counts).flatMap(role => c.players.filter(p => p.clubId === c.userClubId && p.role === role && !p.injuryWeeks && !p.awayWeeks && (!p.power || p.licensed)).sort((a, b) => qaValue(b) - qaValue(a)).slice(0, counts[role]).map(p => p.id)));
  };
  window.qaDrillsTab = async () => { await qaTap('Squad tab'); if (qaHas('Drills tab')) await qaTap('Drills tab'); };
  window.qaTrain = async (name, attribute) => {
    await qaDrillsTab();
    await qaTap('Train ' + name + ' now');
    await qaTapPrefix('Train ' + attribute + ',');
    const confirm = qaButtons().find(e => /^Run .+ for \d+ training points$/.test(qaLabel(e)));
    if (!confirm) throw Error('Missing drill confirmation');
    await qaTap(qaLabel(confirm));
    for (let i = 0; i < 8; i++) { const e = qaButtons().find(e => qaLabel(e).includes('Tap to continue.')); if (!e) break; await qaTap(qaLabel(e)); }
    if (qaHas('Close training for ' + name)) await qaTap('Close training for ' + name);
    if (qaRead().error) throw Error(qaRead().error);
  };
  window.qaTrainBudget = async (max = 18) => {
    const done = [];
    for (let i = 0; i < max; i++) {
      const c = qaRead().career, selected = qaDesired(c), priority = qaLib.pendingTrainingPriorityHolder(c), options = [];
      for (const p of c.players.filter(p => p.clubId === c.userClubId && !p.injuryWeeks && !p.awayWeeks && p.condition >= 84)) {
        if (!selected.has(p.id) && p.age > 22) continue;
        if (priority && priority.playerId !== p.id) continue;
        for (const path of qaLib.TRAINING_PATHS) {
          const weight = qaWeights[p.role][path.attribute]; if (!weight) continue;
          const drill = qaLib.resolveTrainingDrillForPath(c, path.pathId); if (drill.tpCost > c.trainingPoints) continue;
          const preview = qaLib.instantTrainingPreview(c, p.id, path.pathId), before = p.attrs[path.attribute] + (path.attribute === 'ref' ? p.refDisplayBonus ?? 0 : 0), gain = preview.adjustedAfter - before;
          if (gain <= 0) continue;
          const repeat = done.filter(d => d.id === p.id).length;
          options.push({ p, path, score: weight * gain / Math.max(20, p.attrs[path.attribute]) / drill.tpCost * (selected.has(p.id) ? 1 : .15) / (1 + repeat * .8) });
        }
      }
      options.sort((a, b) => b.score - a.score);
      if (!options.length) break;
      const best = options[0]; await qaTrain(best.p.name, best.path.attribute.toUpperCase()); done.push({ id: best.p.id, name: best.p.name, attribute: best.path.attribute });
    }
    qaLog.push({ action: 'weekly-training', season: qaState().season, week: qaState().week, drills: done });
    return done;
  };
  window.qaLineup = async () => {
    for (let i = 0; i < 11; i++) {
      const c = qaRead().career, ids = c.lineups.find(l => l.clubId === c.userClubId).playerIds, roster = c.players.filter(p => p.clubId === c.userClubId && !p.injuryWeeks && !p.awayWeeks && (!p.power || p.licensed));
      let swap;
      for (const role of ['GK', 'DEF', 'MID', 'FWD']) {
        const starters = roster.filter(p => ids.includes(p.id) && p.role === role && p.contractPromise?.perk !== 'GUARANTEED_STARTER').sort((a, b) => qaValue(a) - qaValue(b));
        const bench = roster.filter(p => !ids.includes(p.id) && p.role === role).sort((a, b) => qaValue(b) - qaValue(a));
        if (starters.length && bench.length && qaValue(bench[0]) > qaValue(starters[0]) + .003) { swap = { out: starters[0], into: bench[0] }; break; }
      }
      if (!swap) return;
      await qaTapPrefix(swap.out.name + ', starting'); await qaTapPrefix(swap.into.name + ', bench');
    }
  };
  window.qaDismiss = async () => {
    for (let i = 0; i < 40; i++) {
      const screen = qaRead().screen; let e;
      if (screen === 'faceoff') e = qaButtons().find(e => qaLabel(e).includes('Tap to skip.'));
      if (screen === 'postmatch') e = qaButtons().find(e => qaLabel(e) === 'Continue to the Home screen and review the financial report');
      if (screen === 'week-review') e = qaButtons().find(e => qaLabel(e).startsWith('Finish the weekly review'));
      if (screen === 'management') e = qaButtons().find(e => qaLabel(e) === 'Continue past the financial report');
      if (screen === 'awakening') e = qaButtons().find(e => qaLabel(e).startsWith('Awakening beat') || qaLabel(e).startsWith('SKIP.') || qaLabel(e).includes(' awakened with '));
      if (screen === 'midseason-training') e = qaButtons().find(e => qaLabel(e) === 'Continue to Home');
      if (e) { await qaTap(qaLabel(e)); continue; }
      if ((screen === 'awakening' || screen === 'midseason-training' || screen === 'faceoff') && i < 30) { await qaPause(150); continue; }
      return;
    }
  };
  window.qaRunMatch = async () => {
    for (let i = 0; i < 35; i++) {
      await qaClearUI();
      if (qaHas('Simulate this match with Quick Match')) { await qaLineup(); await qaTap('Simulate this match with Quick Match'); await qaDismiss(); return; }
      const intro = qaButtons().find(e => qaLabel(e).startsWith('Division Rival.'));
      if (intro) { await qaTap(qaLabel(intro)); await qaPause(250); continue; }
      return;
    }
  };
  window.qaBuild = async (name, x, y) => { await qaTap('Club tab'); await qaTap('Facility board'); await qaTapPrefix(name + '. '); await qaTap('Build at column ' + x + ', row ' + y); await qaTapPrefix('Approve building ' + name); await qaClearUI(); };
  window.qaUpgrade = async (name, level) => { await qaTap('Club tab'); await qaTap('Facility board'); await qaTapPrefix(name + ', level ' + level + '.'); await qaTapPrefix('Upgrade ' + name + ' for'); await qaTap('Approve upgrade'); await qaClearUI(); };
  window.qaBuyDrill = async (name, tier) => { await qaDrillsTab(); await qaTapPrefix('Buy ' + name + ' Tier ' + tier + ' drill'); await qaTap('Buy upgrade'); };
  window.qaPlayWeek = async ({ train = true } = {}) => {
    await qaDismiss(); await qaClearUI();
    if (qaRead().screen !== 'management') return { stopped: 'screen', state: qaBrief() };
    await qaTap('Home tab'); await qaClearUI();
    const duty = qaButtons().find(e => qaLabel(e).includes('Must do before Advance Week'));
    if (duty) return { stopped: 'inbox', label: qaLabel(duty), state: qaBrief() };
    if (qaRead().career.playerRequests?.pending) return { stopped: 'player-request', pending: qaRead().career.playerRequests.pending, state: qaBrief() };
    if (qaLib.midseasonTrainingStatus(qaRead().career) === 'prompt') {
      const trip = qaButtons().find(e => /^Spend \d+ TP, cost every player 10 condition, and train the team$/.test(qaLabel(e)));
      if (!trip) return { stopped: 'team-trip', state: qaBrief() };
      await qaTap(qaLabel(trip)); await qaDismiss();
    }
    if (train) await qaTrainBudget();
    await qaTap('Advance Week'); if (qaRead().screen === 'matchday') await qaRunMatch();
    await qaDismiss(); qaRecord(); return { state: qaBrief() };
  };
  window.qaStartWeeks = (count) => {
    if (window.qaJob?.running) throw Error('A playthrough batch is already running');
    window.qaJob = { running: true, results: [], started: new Date().toISOString() };
    (async () => { try { for (let i = 0; i < count; i++) { const r = await qaPlayWeek(); qaJob.results.push(r); if (r.stopped || qaRead().screen !== 'management') break; } } catch (e) { qaJob.error = e.stack || String(e); } finally { qaJob.running = false; qaJob.ended = new Date().toISOString(); } })();
    return 'started';
  };
  return qaRead().career ? qaBrief() : { screen: qaRead().screen };
})();
