// Run-specific UI driver. All career changes use rendered controls.
(() => {
  const Q = window.HFMRun = {};
  Q.read = () => HFMPlaytest.read();
  Q.transactions={};Q.fixtures={};Q.collect=()=>{const c=Q.read().career;if(!c)return;for(const t of c.cashTransactions??[])Q.transactions[t.id]=t;for(const f of c.fixtures.filter(f=>f.status==='played'&&(f.homeClubId===c.userClubId||f.awayClubId===c.userClubId)))Q.fixtures[f.id]={...f,kind:'league'};for(const cup of c.m2.nationalCups)for(const r of cup.rounds)for(const f of r.fixtures.filter(f=>f.status==='played'&&(f.homeClubId===c.userClubId||f.awayClubId===c.userClubId)))Q.fixtures[f.id]={...f,kind:'cup',roundLabel:r.label};};
  Q.pause = (ms=100) => new Promise(r=>setTimeout(r,ms));
  Q.controls = () => HFMPlaytest.controls();
  Q.has = l => Q.controls().some(x=>x.label===l && !x.disabled);
  Q.prefix = p => { const a=Q.controls().filter(x=>x.label.startsWith(p)&&!x.disabled); if(a.length!==1)throw Error('Prefix '+p+' matched '+a.length);return a[0].label; };
  Q.clear = async(except='') => {
    for(let i=0;i<24;i++){
      const e=Q.controls().find(x=>!x.disabled&&x.label!==except&&!x.label.includes('tab. Bert says:')&&!x.label.startsWith('Bert says: read the desk')&&(x.label==='Let them build. Close construction confirmation'||x.label==='Close coach confirmation and return home'||x.label==='I was angry, but I understand why you needed me here.'||x.label.startsWith('Bert Rudge:')||/\bsays?:/.test(x.label)));
      if(!e)return;await HFMPlaytest.tap(e.label);
    }
    throw Error('Too many overlay messages');
  };
  Q.tap=async l=>{await Q.clear(l);const r=await HFMPlaytest.tap(l);Q.collect();return r;};
  Q.tapPrefix=async p=>{await Q.clear();return Q.tap(Q.prefix(p));};
  Q.info=()=>{
    const s=Q.read(),c=s.career;if(!c)return HFMPlaytest.brief();
    const club=c.clubs.find(x=>x.id===c.userClubId),div=c.m2.pyramid.divisions.find(d=>d.clubs.some(x=>x.id===c.userClubId));
    const played=c.fixtures.filter(f=>f.season===c.season&&f.status==='played'&&f.score&&(f.homeClubId===c.userClubId||f.awayClubId===c.userClubId));
    const table=c.clubs.map(x=>({id:x.id,P:0,GF:0,GA:0}));for(const f of c.fixtures.filter(f=>f.season===c.season&&f.status==='played'&&f.score)){const h=table.find(t=>t.id===f.homeClubId),a=table.find(t=>t.id===f.awayClubId);if(!h||!a)continue;const hg=f.score.homeGoals,ag=f.score.awayGoals;h.GF+=hg;h.GA+=ag;a.GF+=ag;a.GA+=hg;h.P+=hg>ag?3:hg===ag?1:0;a.P+=ag>hg?3:ag===hg?1:0;}table.sort((a,b)=>b.P-a.P||(b.GF-b.GA)-(a.GF-a.GA)||b.GF-a.GF||(a.id<b.id?-1:a.id>b.id?1:0));const cup=c.m2.nationalCups.find(x=>x.season===c.season),cupFixtures=cup?.rounds.flatMap(r=>r.fixtures.filter(f=>f.status==='played'&&(f.homeClubId===c.userClubId||f.awayClubId===c.userClubId)))??[];const record={W:0,D:0,L:0,GF:0,GA:0};
    for(const f of played){const h=f.homeClubId===c.userClubId,a=h?f.score.homeGoals:f.score.awayGoals,b=h?f.score.awayGoals:f.score.homeGoals;record.GF+=a;record.GA+=b;record[a>b?'W':a<b?'L':'D']++;}
    return {...HFMPlaytest.brief(),division:div.level,position:table.findIndex(x=>x.id===c.userClubId)+1,leagueRecord:record,leaguePlayed:played.length,cupPlayed:cupFixtures.length,cupChampion:cup?.championClubId,fans:club.fans,formation:c.lineups.find(l=>l.clubId===c.userClubId)?.formation,construction:c.facilities.grid.construction,drills:c.totalInstantDrills??0};
  };
  Q.weeks=[];Q.notes=[];Q.checkpoints=[];
  Q.record=()=>{Q.collect();const s=Q.read(),c=s.career;const r={...Q.info(),time:new Date().toISOString(),roster:c.players.filter(p=>p.clubId===c.userClubId),facilities:c.facilities.grid.buildings,ownedTrainingTiers:c.ownedTrainingTiers,requests:c.playerRequests,ledgers:c.ledgers.slice(-1),transactions:c.cashTransactions?.slice(-12)};Q.weeks.push(r);return Q.info();};
  // A heuristic, not a balance claim. REF always uses the stored value.
  Q.weights={GK:{ref:.8,pac:.12,pas:.06,sta:.02},DEF:{def:.32,pac:.30,pas:.12,tec:.12,sta:.14},MID:{pas:.26,tec:.24,pac:.25,def:.10,sta:.15},FWD:{sho:.34,tec:.20,pac:.30,pas:.06,sta:.10}};
  Q.value=p=>Object.entries(Q.weights[p.role]).reduce((v,[a,w])=>v+w*Math.log(Math.max(1,p.attrs[a])),0)+Math.log(.9+(p.morale??50)*.002)+Math.log(.7+.3*(p.condition??100)/100)+(p.power&&p.licensed?.07:0);
  Q.desired=c=>{const l=c.lineups.find(l=>l.clubId===c.userClubId),sh=(l.formation??'4-4-2').split('-').map(Number),n={GK:1,DEF:sh[0],MID:sh[1],FWD:sh[2]};return new Set(Object.keys(n).flatMap(role=>c.players.filter(p=>p.clubId===c.userClubId&&p.role===role&&!p.injuryWeeks&&!p.awayWeeks&&(!p.power||p.licensed)).sort((a,b)=>Q.value(b)-Q.value(a)).slice(0,n[role]).map(p=>p.id)));};
  Q.drillsTab=async()=>{if(Q.read().activeTab!=='squad')await Q.tap('Squad tab');if(Q.has('Drills tab'))await Q.tap('Drills tab');};
  Q.train=async(name,attr)=>{
    await Q.drillsTab();await Q.tapPrefix('Train '+name+' now');await Q.tapPrefix('Train '+attr+',');
    const a=Q.controls().filter(x=>!x.disabled&&/^Run .+ for \d+ training points$/.test(x.label));if(a.length!==1)throw Error('Missing drill confirmation');
    await Q.tap(a[0].label);
    for(let i=0;i<8;i++){const e=Q.controls().find(x=>!x.disabled&&x.label.includes('Tap to continue.'));if(!e)break;await Q.tap(e.label);}
    if(Q.has('Close training for '+name))await Q.tap('Close training for '+name);
  };
  Q.trainBudget=async(max=16)=>{
    const done=[],paths={pac:'sprints',sho:'finishing',pas:'rondo',def:'duels',tec:'first-touch',sta:'circuit',ref:'keeper-drills'},suffix=['','', '-ii','-iii','-iv','-v'];
    for(let i=0;i<max;i++){
      const c=Q.read().career,desired=Q.desired(c),roster=c.players.filter(p=>p.clubId===c.userClubId&&!p.injuryWeeks&&!p.awayWeeks&&p.condition>=82);
      const priority=roster.find(p=>(p.priorityDrillsRemaining??0)>0&&p.contractPromise?.perk==='TRAINING_PRIORITY');const options=[];
      for(const p of roster){if(!desired.has(p.id)&&!priority)continue;if(priority&&priority.id!==p.id)continue;
        for(const [a,w] of Object.entries(Q.weights[p.role])){
          const path=paths[a],tier=c.ownedTrainingTiers?.[path]??1,drill=c.trainingRules.focusDrills.find(d=>d.id===path+suffix[tier]);if(!drill||drill.tpCost>c.trainingPoints||p.attrs[a]>=980)continue;
          const gain=drill.gains[a]??0,age=p.age??24,ageScale=age<=21?1.1:age<=27?1:age<=30?.8:.6,repeats=done.filter(d=>d.id===p.id).length;
          const trainingWeight=p.role==='GK'&&a==='ref'?.36:w;const score=trainingWeight*gain*ageScale/Math.max(18,p.attrs[a])/drill.tpCost/(1+repeats*.7);
          options.push({p,a,score});
        }
      }
      options.sort((a,b)=>b.score-a.score);if(!options.length)break;
      const best=options[0],before=best.p.attrs[best.a];await Q.train(best.p.name,best.a.toUpperCase());const after=Q.read().career.players.find(p=>p.id===best.p.id).attrs[best.a];done.push({id:best.p.id,name:best.p.name,attr:best.a,before,after});
    }
    Q.notes.push({type:'training',season:Q.info().season,week:Q.info().week,drills:done});return done;
  };
  Q.lineup=async()=>{
    for(let i=0;i<11;i++){
      const c=Q.read().career,ids=c.lineups.find(l=>l.clubId===c.userClubId).playerIds,roster=c.players.filter(p=>p.clubId===c.userClubId&&!p.injuryWeeks&&!p.awayWeeks&&(!p.power||p.licensed));let swap;
      for(const role of ['GK','DEF','MID','FWD']){const starters=roster.filter(p=>ids.includes(p.id)&&p.role===role&&p.contractPromise?.perk!=='GUARANTEED_STARTER').sort((a,b)=>Q.value(a)-Q.value(b)),bench=roster.filter(p=>!ids.includes(p.id)&&p.role===role).sort((a,b)=>Q.value(b)-Q.value(a));if(starters.length&&bench.length&&Q.value(bench[0])>Q.value(starters[0])+.003){swap={out:starters[0],into:bench[0]};break;}}
      if(!swap)return;await Q.tapPrefix(swap.out.name+', starting');await Q.tapPrefix(swap.into.name+', bench');
    }
  };
  Q.dismiss=async()=>{
    for(let i=0;i<40;i++){
      const screen=Q.read().screen;let e;
      if(screen==='postmatch')e=Q.controls().find(x=>x.label==='Continue to the Home screen and review the financial report');
      if(screen==='week-review')e=Q.controls().find(x=>x.label.startsWith('Finish the weekly review'));
      if(screen==='management')e=Q.controls().find(x=>x.label==='Continue past the financial report');
      if(screen==='awakening')e=Q.controls().find(x=>x.label.startsWith('Awakening beat')||x.label.startsWith('SKIP.')||x.label.includes(' awakened with '));
      if(screen==='midseason-training')e=Q.controls().find(x=>x.label==='Continue to Home');
      if(e){await Q.tap(e.label);continue;}
      if(['awakening','midseason-training','faceoff','simulating'].includes(screen)&&i<30){await Q.pause(200);continue;}
      return;
    }
  };
  Q.runMatch=async()=>{
    for(let i=0;i<35;i++){
      await Q.clear();
      if(Q.has('Simulate this match with Quick Match')){await Q.lineup();Q.checkpoints.push({kind:'pre-match',...Q.info(),fixture:Q.read().career.fixtures.find(f=>f.week===Q.info().week&&f.status==='scheduled'&&(f.homeClubId===Q.read().career.userClubId||f.awayClubId===Q.read().career.userClubId))});await Q.tap('Simulate this match with Quick Match');await Q.dismiss();return;}
      const intro=Q.controls().find(x=>x.label.startsWith('Division Rival.'));if(intro){await Q.tap(intro.label);continue;}return;
    }
  };
  Q.build=async(name,x,y)=>{await Q.tap('Club tab');await Q.tap('Facility board');await Q.tapPrefix(name+'. ');await Q.tap('Build at column '+x+', row '+y);await Q.tapPrefix('Approve building '+name);await Q.clear();};
  Q.upgrade=async(name,level)=>{await Q.tap('Club tab');await Q.tap('Facility board');await Q.tapPrefix(name+', level '+level+'.');await Q.tapPrefix('Upgrade '+name+' for');await Q.tap('Approve upgrade');await Q.clear();};
  Q.buyDrill=async(name,tier)=>{await Q.drillsTab();await Q.tapPrefix('Buy '+name+' Tier '+tier+' drill');await Q.tap('Buy upgrade');};
  Q.playWeek=async({train=true}={})=>{
    await Q.dismiss();await Q.clear();if(Q.read().screen!=='management')return {stopped:'screen',state:Q.info()};
    await Q.tap('Home tab');await Q.clear();const c=Q.read().career;
    const duty=Q.controls().find(x=>x.label.includes('Must do before Advance Week'));if(duty)return {stopped:'inbox',label:duty.label,state:Q.info()};
    if(c.playerRequests?.pending)return {stopped:'player-request',pending:c.playerRequests.pending,state:Q.info()};
    if(c.week===19)return {stopped:'midseason',state:Q.info()};
    if(train)await Q.trainBudget();await Q.tap('Home tab');await Q.tap('Advance Week');if(Q.read().screen==='matchday')await Q.runMatch();await Q.dismiss();Q.record();return {state:Q.info()};
  };
  Q.start=(count,opts={})=>{if(Q.job?.running)throw Error('Batch already running');Q.job={running:true,results:[],started:new Date().toISOString()};(async()=>{try{for(let i=0;i<count;i++){const r=await Q.playWeek(opts);Q.job.results.push(r);if(r.stopped||Q.read().screen!=='management')break;}}catch(e){Q.job.error=e.stack||String(e);}finally{Q.job.running=false;Q.job.ended=new Date().toISOString();}})();return 'started';};
  return 'HFMRun installed; UI-only actions, no store access.';
})();
