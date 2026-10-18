// Run-specific UI driver. All career changes use rendered controls.
(() => {
  const Q = window.HFMRun = {};
  Q.read = () => HFMPlaytest.read();
  Q.transactions={};Q.fixtures={};Q.collect=()=>{const c=Q.read().career;if(!c)return;for(const t of c.cashTransactions??[])Q.transactions[t.id]=t;for(const f of c.fixtures.filter(f=>f.status==='played'&&(f.homeClubId===c.userClubId||f.awayClubId===c.userClubId)))Q.fixtures[f.id]={...f,kind:'league'};for(const cup of c.m2.nationalCups)for(const r of cup.rounds)for(const f of r.fixtures.filter(f=>f.status==='played'&&(f.homeClubId===c.userClubId||f.awayClubId===c.userClubId)))Q.fixtures[f.id]={...f,kind:'cup',roundLabel:r.label};};
  Q.pause = (ms=100) => HFMPlaytest.pause(ms);
  Q.controls = () => HFMPlaytest.controls();
  Q.has = l => Q.controls().some(x=>x.label===l && !x.disabled);
  Q.prefix = p => { const a=Q.controls().filter(x=>x.label.startsWith(p)&&!x.disabled); if(a.length!==1)throw Error('Prefix '+p+' matched '+a.length);return a[0].label; };
  Q.clear = async(except='') => {
    for(let i=0;i<24;i++){
      const e=Q.controls().find(x=>!x.disabled&&x.label!==except&&!x.label.includes('tab. Bert says:')&&!x.label.startsWith('Bert says: read the desk')&&!x.label.includes('mid season trip')&&(x.label==='Let them build. Close construction confirmation'||x.label==='Close coach confirmation and return home'||x.label==='I was angry, but I understand why you needed me here.'||x.label.startsWith('Bert Rudge:')||/\bsays?:/.test(x.label)));
      if(!e)return;try{await HFMPlaytest.tap(e.label);}catch(error){if(!String(error).includes('found 0')||Q.has(e.label))throw error;Q.notes.push({type:'automatic-speech-transition',label:e.label});}
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
  Q.value=p=>Object.entries(Q.weights[p.role]).reduce((v,[a,w])=>v+w*Math.log(Math.max(1,p.attrs[a])),0)+Math.log((p.morale??50)>=30?1:.9+(p.morale??50)/300)+Math.log(.7+.3*(p.condition??100)/100)+(p.power&&p.licensed?.07:0);
  Q.desired=c=>{const l=c.lineups.find(l=>l.clubId===c.userClubId),sh=(l.formation??'4-4-2').split('-').map(Number),n={GK:1,DEF:sh[0],MID:sh[1],FWD:sh[2]};return new Set(Object.keys(n).flatMap(role=>c.players.filter(p=>p.clubId===c.userClubId&&p.role===role&&!p.injuryWeeks&&!p.awayWeeks&&(!p.power||p.licensed)).sort((a,b)=>Q.value(b)-Q.value(a)).slice(0,n[role]).map(p=>p.id)));};
  Q.drillsTab=async()=>{if(Q.read().activeTab!=='squad')await Q.tap('Squad tab');if(Q.has('Drills tab'))await Q.tap('Drills tab');};
  Q.train=async(name,attr,count=1)=>{
    const beforeDrills=Q.read().career.totalInstantDrills??0;
    await Q.drillsTab();await Q.tapPrefix('Train '+name+' now');const names={PAC:'Pace',SHO:'Shooting',PAS:'Passing',DEF:'Defense',TEC:'Technique',STA:'Stamina',REF:'Reflexes'};const target='Train '+name+' in '+names[attr]+' now';await HFMPlaytest.waitFor(()=>Q.has(target),20000);await Q.tap(target);
    if(count>1)await Q.tap('Run this drill '+count+' times in a row');
    const a=Q.controls().filter(x=>!x.disabled&&/^Run .+ for \d+ training points$/.test(x.label));if(a.length!==1)throw Error('Missing drill confirmation');
    await Q.tap(a[0].label);
    await HFMPlaytest.waitFor(()=>(Q.read().career.totalInstantDrills??0)>=beforeDrills+count,30000);
    if(Q.has('Close training for '+name))await Q.tap('Close training for '+name);
  };
  Q.keeperTarget=0;
  Q.trainBudget=async(max=16)=>{
    const done=[],paths={pac:'sprints',sho:'finishing',pas:'rondo',def:'duels',tec:'first-touch',sta:'circuit',ref:'keeper-drills'},suffix=['','', '-ii','-iii','-iv','-v'];
    const opening=Q.read().career,keeper=opening.players.filter(p=>p.clubId===opening.userClubId&&p.role==='GK'&&!p.injuryWeeks&&!p.awayWeeks&&p.condition>=90).sort((a,b)=>b.attrs.ref-a.attrs.ref)[0];
    if(keeper&&keeper.attrs.ref<Q.keeperTarget&&!opening.players.some(p=>p.clubId===opening.userClubId&&(p.priorityDrillsRemaining??0)>0)){
      const tier=opening.ownedTrainingTiers?.['keeper-drills']??1,drill=opening.trainingRules.focusDrills.find(d=>d.id==='keeper-drills'+suffix[tier]);
      if(drill&&opening.trainingPoints>=drill.tpCost){await Q.train(keeper.name,'REF');const after=Q.read().career.players.find(p=>p.id===keeper.id).attrs.ref;done.push({id:keeper.id,name:keeper.name,attr:'ref',before:keeper.attrs.ref,after,count:1,reservedKeeperDrill:true});}
    }
    const shootingBank=Q.read().career,shooter=shootingBank.players.find(p=>p.clubId===shootingBank.userClubId&&p.name==='Kai Ward'&&!p.injuryWeeks&&!p.awayWeeks&&p.condition>=90);
    if(shooter&&shooter.attrs.sho<400&&!shootingBank.players.some(p=>p.clubId===shootingBank.userClubId&&(p.priorityDrillsRemaining??0)>0)){
      const tier=shootingBank.ownedTrainingTiers?.finishing??1,drill=shootingBank.trainingRules.focusDrills.find(d=>d.id==='finishing'+suffix[tier]);
      if(drill&&shootingBank.trainingPoints>=drill.tpCost){await Q.train(shooter.name,'SHO');const after=Q.read().career.players.find(p=>p.id===shooter.id).attrs.sho;done.push({id:shooter.id,name:shooter.name,attr:'sho',before:shooter.attrs.sho,after,count:1,reservedCentreForwardDrill:true});}
    }
    const techniqueBank=Q.read().career,ace=techniqueBank.players.find(p=>p.clubId===techniqueBank.userClubId&&p.name==='Ace II'&&!p.injuryWeeks&&!p.awayWeeks&&p.condition>=90);
    if(ace&&ace.attrs.tec<240&&!techniqueBank.players.some(p=>p.clubId===techniqueBank.userClubId&&(p.priorityDrillsRemaining??0)>0)){
      const tier=techniqueBank.ownedTrainingTiers?.['first-touch']??1,drill=techniqueBank.trainingRules.focusDrills.find(d=>d.id==='first-touch'+suffix[tier]);
      if(drill&&techniqueBank.trainingPoints>=drill.tpCost){await Q.train(ace.name,'TEC');const after=Q.read().career.players.find(p=>p.id===ace.id).attrs.tec;done.push({id:ace.id,name:ace.name,attr:'tec',before:ace.attrs.tec,after,count:1,reservedTechniqueDrill:true});}
    }
    for(const [name,attr,target,path] of [['Ace II','sta',130,'circuit'],['Kai Ward','tec',200,'first-touch']]){
      const bank=Q.read().career,p=bank.players.find(p=>p.clubId===bank.userClubId&&p.name===name&&!p.injuryWeeks&&!p.awayWeeks&&p.condition>=90);
      if(!p||p.attrs[attr]>=target||bank.players.some(p=>p.clubId===bank.userClubId&&(p.priorityDrillsRemaining??0)>0))continue;
      const tier=bank.ownedTrainingTiers?.[path]??1,drill=bank.trainingRules.focusDrills.find(d=>d.id===path+suffix[tier]);
      if(drill&&bank.trainingPoints>=drill.tpCost){await Q.train(p.name,attr.toUpperCase());const after=Q.read().career.players.find(x=>x.id===p.id).attrs[attr];done.push({id:p.id,name:p.name,attr,before:p.attrs[attr],after,count:1,reservedWeakStatDrill:true});}
    }
    for(let i=0;i<max;i++){
      const c=Q.read().career,desired=Q.desired(c),roster=c.players.filter(p=>p.clubId===c.userClubId&&!p.injuryWeeks&&!p.awayWeeks&&p.condition>=82);
      const owed=c.players.find(p=>p.clubId===c.userClubId&&(p.priorityDrillsRemaining??0)>0&&p.contractPromise?.perk==='TRAINING_PRIORITY');
      const priority=owed?roster.find(p=>p.id===owed.id):undefined;if(owed&&!priority)break;const options=[];
      for(const p of roster){if(!desired.has(p.id)&&!priority)continue;if(priority&&priority.id!==p.id)continue;
        for(const [a,w] of Object.entries(Q.weights[p.role])){
          const path=paths[a],tier=c.ownedTrainingTiers?.[path]??1,drill=c.trainingRules.focusDrills.find(d=>d.id===path+suffix[tier]);if(!drill||drill.tpCost>c.trainingPoints||p.attrs[a]>=980)continue;
          const gain=drill.gains[a]??0,age=p.age??24,ageScale=age<=21?1.1:age<=27?1:age<=30?.8:.6,repeats=done.filter(d=>d.id===p.id).length;
          const requestScale=(c.playerRequests?.effects??[]).reduce((percent,e)=>e.kind==='DRILL_SQUAD'||(e.kind==='DRILL_PLAYER'&&e.playerId===p.id)?Math.round(percent*(e.multiplierPercent??100)/100):percent,100)/100;
          const facilityType={pac:'gym',sta:'gym',sho:'shooting-range',pas:'tech-center',tec:'tech-center',def:'training-pitch',ref:'keeper-court'}[a];
          const facilityLevel=Math.max(0,...c.facilities.grid.buildings.filter(b=>b.type===facilityType&&!(c.facilities.grid.construction?.kind==='BUILD'&&c.facilities.grid.construction.buildingId===b.id)).map(b=>b.level));
          const facilityScale=[1,1.1,1.15,1.2][facilityLevel]??1;
          const trainingWeight=p.role==='GK'&&a==='ref'?.36:w;const score=trainingWeight*Math.max(1,Math.round(gain*ageScale*facilityScale*requestScale))/Math.max(18,p.attrs[a])/drill.tpCost/(1+repeats*.7);
          const count=Math.min(3,Math.floor((p.condition-74)/8),Math.floor(c.trainingPoints/drill.tpCost));
          if(count>0)options.push({p,a,score,count});
        }
      }
      options.sort((a,b)=>b.score-a.score);if(!options.length)break;
      const best=options[0],before=best.p.attrs[best.a];await Q.train(best.p.name,best.a.toUpperCase(),best.count);const after=Q.read().career.players.find(p=>p.id===best.p.id).attrs[best.a];done.push({id:best.p.id,name:best.p.name,attr:best.a,before,after,count:best.count});
    }
    Q.notes.push({type:'training',season:Q.info().season,week:Q.info().week,drills:done});return done;
  };
  Q.lineup=async()=>{
    for(let i=0;i<11;i++){
      const c=Q.read().career,ids=c.lineups.find(l=>l.clubId===c.userClubId).playerIds,roster=c.players.filter(p=>p.clubId===c.userClubId&&!p.injuryWeeks&&!p.awayWeeks&&(!p.power||p.licensed));let swap;
      const shape=(c.lineups.find(l=>l.clubId===c.userClubId).formation??'4-4-2').split('-').map(Number),slotRoles=['GK',...Array(shape[0]).fill('DEF'),...Array(shape[1]).fill('MID'),...Array(shape[2]).fill('FWD')];
      for(let slot=0;slot<11;slot++){const out=roster.find(p=>p.id===ids[slot]);if(!out||out.role===slotRoles[slot]||out.contractPromise?.perk==='GUARANTEED_STARTER')continue;const bench=roster.filter(p=>!ids.includes(p.id)&&p.role===slotRoles[slot]).sort((a,b)=>Q.value(b)-Q.value(a));if(bench.length){swap={out,into:bench[0]};break;}}
      if(!swap)for(const role of ['GK','DEF','MID','FWD']){const starters=roster.filter(p=>ids.includes(p.id)&&p.role===role&&p.contractPromise?.perk!=='GUARANTEED_STARTER').sort((a,b)=>Q.value(a)-Q.value(b)),bench=roster.filter(p=>!ids.includes(p.id)&&p.role===role).sort((a,b)=>Q.value(b)-Q.value(a));if(starters.length&&bench.length&&Q.value(bench[0])>Q.value(starters[0])+.003){swap={out:starters[0],into:bench[0]};break;}}
      if(!swap)return;const outgoing=Q.controls().filter(e=>!e.disabled&&e.label.startsWith(swap.out.name+', ')&&/\bstarting\b/.test(e.label));if(outgoing.length!==1)throw Error('Expected one starting card for '+swap.out.name);await Q.tap(outgoing[0].label);await Q.tapPrefix(swap.into.name+', bench');
    }
  };
  Q.dismiss=async()=>{
    for(let i=0;i<40;i++){
      await Q.clear();
      const screen=Q.read().screen;let e;
      if(screen==='postmatch')e=Q.controls().find(x=>x.label==='Continue to the Home screen and review the financial report');
      if(screen==='week-review')e=Q.controls().find(x=>x.label.startsWith('Finish the weekly review'));
      if(screen==='management')e=Q.controls().find(x=>x.label==='Continue past the financial report');
      if(screen==='awakening')e=Q.controls().find(x=>x.label.startsWith('SKIP.'))??Q.controls().find(x=>x.label.startsWith('Awakening beat'));
      if(screen==='midseason-training')e=Q.controls().find(x=>x.label==='Continue to Home');
      if(e){try{await Q.tap(e.label);}catch(error){const moved=screen==='awakening'&&String(error).includes('found 0')&&!Q.has(e.label)&&Q.controls().some(x=>x.label.startsWith('SKIP.')||x.label.startsWith('Awakening beat')||x.label.includes(' awakened with ')||x.label==='Home tab');if(!moved)throw error;Q.notes.push({type:'automatic-awakening-transition',label:e.label});}continue;}
      if(['awakening','midseason-training','faceoff','simulating'].includes(screen)&&i<30){await Q.pause(200);continue;}
      return;
    }
  };
  Q.runMatch=async()=>{
    await Q.clear();
    const licenseCareer=Q.read().career,ed=licenseCareer.players.find(p=>p.clubId===licenseCareer.userClubId&&p.name==='Ed Stone'),ravi=licenseCareer.players.find(p=>p.clubId===licenseCareer.userClubId&&p.name==='Ravi Chan');
    if(Q.has('Simulate this match with Quick Match')&&ed?.power&&!ed.licensed&&ravi?.licensed){await Q.tap('Ravi Chan hero license');await Q.tap('Ed Stone hero license');Q.notes.push({type:'license-rotation',season:licenseCareer.season,week:licenseCareer.week,out:'Ravi Chan',in:'Ed Stone',reason:'Restore stronger defender after Future Sight awakening'});}
    for(let i=0;i<35;i++){
      await Q.clear();
      if(Q.has('Simulate this match with Quick Match')){await Q.lineup();const c=Q.read().career,l=c.lineups.find(l=>l.clubId===c.userClubId),ace=c.players.find(p=>p.clubId===c.userClubId&&p.name==='Ace II'),slot=l.playerIds.indexOf(ace?.id);if(['3-4-3','4-3-3'].includes(l.formation)&&slot>=8&&slot!==10){const other=c.players.find(p=>p.id===l.playerIds[10]);await Q.tapPrefix(ace.name+', starting');await Q.tapPrefix(other.name+', starting');Q.notes.push({type:'centre-forward-workaround',season:c.season,week:c.week,from:slot,to:10});}Q.checkpoints.push({kind:'pre-match',...Q.info(),fixture:Q.read().career.fixtures.find(f=>f.week===Q.info().week&&f.status==='scheduled'&&(f.homeClubId===Q.read().career.userClubId||f.awayClubId===Q.read().career.userClubId))});await Q.tap('Simulate this match with Quick Match');await Q.dismiss();return;}
      const intro=Q.controls().find(x=>x.label.startsWith('Division Rival.'));if(intro){try{await Q.tap(intro.label);}catch(error){const moved=String(error).includes('found 0')&&!Q.has(intro.label)&&(Q.has('Simulate this match with Quick Match')||Q.controls().some(x=>x.label.startsWith('Division Rival.')));if(!moved)throw error;Q.notes.push({type:'automatic-rival-intro-transition',label:intro.label});}continue;}return;
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
    if(c.week===19&&Q.info().division>=4)return {stopped:'midseason',state:Q.info()};
    if(train)await Q.trainBudget();await Q.tap('Home tab');await Q.tap('Advance Week');if(Q.read().screen==='matchday')await Q.runMatch();await Q.dismiss();Q.record();return {state:Q.info()};
  };
  Q.start=(count,opts={})=>{if(Q.job?.running)throw Error('Batch already running');Q.job={running:true,results:[],started:new Date().toISOString()};(async()=>{try{for(let i=0;i<count;i++){const before=Q.read().career,knownHeroes=new Set(before.players.filter(p=>p.clubId===before.userClubId&&p.power).map(p=>p.id));const r=await Q.playWeek(opts),after=Q.read().career,newHeroes=after.players.filter(p=>p.clubId===after.userClubId&&p.power&&!knownHeroes.has(p.id));if(newHeroes.length){r.stopped='new-hero';r.heroes=newHeroes.map(p=>({name:p.name,power:p.power}));}Q.job.results.push(r);if(r.stopped||Q.read().screen!=='management')break;}}catch(e){Q.job.error=e.stack||String(e);}finally{Q.job.running=false;Q.job.ended=new Date().toISOString();}})();return 'started';};
  return 'HFMRun installed; UI-only actions, no store access.';
})();
